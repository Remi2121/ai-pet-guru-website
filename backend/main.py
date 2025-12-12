import os, json, base64, logging, re, requests
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from google import genai

# ==========================================================
# 🚀 SETUP
# ==========================================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-pet-backend")

load_dotenv()

# --- Gemini (health + captions + fallback for training plan)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise SystemExit("❌ Set GEMINI_API_KEY in backend/.env")
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
GEMINI_MODEL = "models/gemini-2.5-flash"

# --- Hugging Face (primary for training plan)
HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise SystemExit("❌ Set HF_TOKEN in backend/.env")
HF_MODEL = os.getenv("HF_TEXT_MODEL", "HuggingFaceH4/zephyr-7b-beta:featherless-ai")
HF_CHAT_URL = "https://api-inference.huggingface.co/v1/chat/completions"

# --- FastAPI
app = FastAPI(title="🐾 AI Pet Assistant (Gemini + Hugging Face)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# ⚙️ HELPERS
# ==========================================================
def clamp01(x, default=0.0):
    try:
        f = float(x)
        return max(0.0, min(1.0, f))
    except Exception:
        return default

SMART_QUOTES = {
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
}

def _extract_balanced(s: str, open_ch: str, close_ch: str) -> str | None:
    start = None
    depth = 0
    for i, ch in enumerate(s):
        if ch == open_ch:
            if depth == 0:
                start = i
            depth += 1
        elif ch == close_ch:
            if depth > 0:
                depth -= 1
                if depth == 0 and start is not None:
                    return s[start:i+1]
    return None

def extract_balanced_json_or_array(s: str) -> str | None:
    cand = _extract_balanced(s, '{', '}')
    if cand:
        return cand
    return _extract_balanced(s, '[', ']')

def sanitize_json_text(t: str) -> str:
    t = (t or "").strip()

    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t)

    for k, v in SMART_QUOTES.items():
        t = t.replace(k, v)

    t = re.sub(r"//.*?$", "", t, flags=re.MULTILINE)
    t = re.sub(r"/\*[\s\S]*?\*/", "", t)

    candidate = extract_balanced_json_or_array(t)
    if candidate:
        t = candidate

    t = re.sub(r",\s*([}\]])", r"\1", t)
    t = re.sub(r'([{\[,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)(\s*):', r'\1"\2"\3:', t)

    def _fix_single_quotes(m):
        inner = m.group(1)
        inner = inner.replace('\\', '\\\\').replace('"', '\\"')
        return f'"{inner}"'
    t = re.sub(r"'([^'\\]*(?:\\.[^'\\]*)*)'", _fix_single_quotes, t)

    # heuristic: escape stray inner quotes like Practice "come"
    t = re.sub(r'(".*?)(?<!\\)"([A-Za-z][^"]{0,20}?)"(?=(.*?"))', r'\1\"\2\"', t)

    return t

def parse_json_loose(text: str):
    try:
        return json.loads(text)
    except Exception:
        pass

    t = sanitize_json_text(text)
    try:
        return json.loads(t)
    except Exception:
        try:
            if t.strip().startswith('['):
                return {"_data": json.loads(t)}
        except Exception:
            pass
        preview = (t or "")[:800].replace("\n", "\\n")
        raise ValueError(f"Could not parse JSON after repairs. First 800 chars: {preview}")

def normalize_plan_like_object(plan, body):
    if isinstance(plan, str):
        try:
            maybe = json.loads(plan)
            plan = maybe if isinstance(maybe, dict) else {"_data": maybe}
        except Exception:
            plan = {"raw": plan}
    elif isinstance(plan, (list, tuple)):
        plan = {"_data": plan}
    elif not isinstance(plan, dict):
        plan = {"value": plan}

    plan.setdefault("title", "Personalized Training Plan")
    plan.setdefault("summary", "")
    plan.setdefault("dailyRoutine", [])
    plan.setdefault("sevenDay", [])
    plan.setdefault("rewards", [])
    plan.setdefault("videoLinks", [])
    plan.setdefault("notes", [])
    plan.setdefault("meta", {})
    plan["meta"].setdefault("seed", (body.petType + "-" + body.problem).lower().replace(" ", "-")[:24])
    plan.setdefault("friendlyName", "pup" if body.petType == "Dog" else "kitty" if body.petType == "Cat" else "pet")
    return plan

# ---------- JSON Schema to enforce on HF ----------
HF_JSON_SCHEMA = {
    "name": "PetTrainingPlan",
    "schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "summary": {"type": "string"},
            "dailyRoutine": {"type": "array", "items": {"type": "string"}},
            "sevenDay": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "day": {"type": "integer", "minimum": 1, "maximum": 7},
                        "activities": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 2,
                            "maxItems": 3
                        }
                    },
                    "required": ["day", "activities"],
                    "additionalProperties": False
                },
                "minItems": 7,
                "maxItems": 7
            },
            "rewards": {"type": "array", "items": {"type": "string"}},
            "videoLinks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "url": {"type": "string"}
                    },
                    "required": ["title", "url"],
                    "additionalProperties": False
                },
                "minItems": 2,
                "maxItems": 2
            },
            "notes": {"type": "array", "items": {"type": "string"}},
            "meta": {
                "type": "object",
                "properties": {"seed": {"type": "string"}},
                "required": ["seed"],
                "additionalProperties": False
            },
            "friendlyName": {"type": "string"}
        },
        "required": ["title","summary","dailyRoutine","sevenDay","rewards","videoLinks","notes","meta","friendlyName"],
        "additionalProperties": False
    },
    "strict": True
}

def call_hf(prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "model": HF_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Return a SINGLE VALID JSON object that matches the user's schema. "
                    "Absolutely no prose, no markdown, no extra keys, no trailing commas. "
                    "Never put a double-quote character inside string values; if you must quote a word, "
                    "use backticks instead (e.g., `come`). No numbered steps inside strings. "
                    "No comments. No trailing commas. If unsure, return an empty object {}."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 900,
        "stop": ["[/USER]", "[/ASSISTANT]"],
        "response_format": {
            "type": "json_schema",
            "json_schema": HF_JSON_SCHEMA
        },
    }
    resp = requests.post(HF_CHAT_URL, headers=headers, json=payload, timeout=120)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"HF API {resp.status_code}: {resp.text}")
    data = resp.json()
    choice0 = (data.get("choices") or [{}])[0]
    raw_text = None
    if isinstance(choice0, dict):
        if isinstance(choice0.get("message"), dict):
            raw_text = choice0["message"].get("content")
        if not raw_text:
            raw_text = choice0.get("text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise HTTPException(status_code=502, detail="HF returned no text content")
    return raw_text

def call_gemini_for_plan(prompt: str) -> str:
    schema_hint = (
        '{ "title": "", "summary": "", "dailyRoutine": [], '
        '"sevenDay": [{"day":1,"activities":[]}], '
        '"rewards": [], "videoLinks": [{"title":"","url":""}], '
        '"notes": [], "meta": {"seed": ""}, "friendlyName": "" }'
    )
    res = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[{
            "role": "user",
            "parts": [
                {"text": "Return STRICT JSON only, no markdown or commentary."},
                {"text": "Never include a double-quote character inside any string value; use backticks for quoted words."},
                {"text": "No numbered steps inside strings. No trailing commas."},
                {"text": "Schema example (must match keys, values may differ):"},
                {"text": schema_hint},
                {"text": prompt},
            ],
        }],
        config={"temperature": 0.2, "response_mime_type": "application/json"},
    )
    return (res.text or "").strip()

# ==========================================================
# 💚 HEALTH CHECK
# ==========================================================
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "gemini": bool(GEMINI_API_KEY),
        "huggingface_model": HF_MODEL,
    }

# ==========================================================
# 🐕 TRAINING PLANNER (HF first, Gemini fallback)
# ==========================================================
class TrainIn(BaseModel):
    petType: str
    age: str | None = None
    problem: str
    goal: str | None = None

def build_prompt(petType: str, age: str | None, problem: str, goal: str | None) -> str:
    return f"""
You are a certified pet trainer. Create a gentle, stepwise 7-day training plan.

Return STRICT JSON ONLY (no markdown, no code fences) with exactly this shape:
{{
  "title": string,
  "summary": string,
  "dailyRoutine": string[],
  "sevenDay": [{{"day": number, "activities": string[]}}],
  "rewards": string[],
  "videoLinks": [{{"title": string, "url": string}}],
  "notes": string[],
  "meta": {{"seed": string}},
  "friendlyName": string
}}

Rules:
- "friendlyName": "pup" for Dog, "kitty" for Cat, else "pet".
- 7 entries in "sevenDay" (days 1–7), each with 2–3 concrete activities.
- Keep tone positive, warm, and simple.
- Give 2 videoLinks; URLs can be placeholders like "https://example.com/training".
- "meta.seed": short slug from petType + problem (lowercase, dash-separated).
- IMPORTANT: Never use a double-quote (") inside any string value. If you quote a word like come/stay, use backticks: `come`.
- No numbered prefixes like "1." inside strings. No comments. No trailing commas.
- Respond with JSON only.

Context:
Pet type: {petType}
Age: {age or "unknown"}
Problem: {problem}
Desired outcome: {goal or "not specified"}
""".strip()

@app.post("/api/train")
def generate_training_plan(body: TrainIn):
    if not body.petType or not body.problem:
        raise HTTPException(status_code=400, detail="petType and problem are required")

    prompt = build_prompt(body.petType, body.age, body.problem, body.goal)

    # Try HF first (with schema)
    try:
        raw_text = call_hf(prompt)
        logger.info("HF raw (first 300): %s", raw_text[:300].replace("\n", " "))
        try:
            plan = json.loads(raw_text)
        except Exception:
            plan = parse_json_loose(raw_text)
        plan = normalize_plan_like_object(plan, body)
        return plan
    except Exception:
        logger.exception("HF plan failed or invalid JSON, falling back to Gemini")

    # Fallback to Gemini
    try:
        raw_text = call_gemini_for_plan(prompt)
        logger.info("Gemini raw (first 300): %s", raw_text[:300].replace("\n", " "))
        try:
            plan = json.loads(raw_text)
        except Exception:
            plan = parse_json_loose(raw_text)
        plan = normalize_plan_like_object(plan, body)
        return plan
    except Exception as e:
        logger.exception("Gemini fallback failed")
        raise HTTPException(status_code=500, detail=f"Both providers failed: {e}")

# ==========================================================
# 🧩 GEMINI HEALTH DETECTION
# ==========================================================
@app.post("/api/predict")
async def predict(
    image: UploadFile = File(...),
    animal: str = Form("unknown"),
    sex: str = Form("unknown"),
):
    try:
        img_bytes = await image.read()
        Image.open(BytesIO(img_bytes))
    except Exception as e:
        logger.exception("Invalid image")
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    mime = image.content_type or "image/jpeg"
    data_b64 = base64.b64encode(img_bytes).decode("ascii")
    image_part = {"inline_data": {"mime_type": mime, "data": data_b64}}

    system_rules = (
        "You are a veterinary assistant analyzing pet skin/wound issues. "
        "Return STRICT JSON only, no markdown or comments."
    )

    schema = {
        "predictions": [{"label": "string", "probability": 0.0}],
        "clip_scores": [{"text": "string", "score": 0.0}],
        "meta": {"animal": animal, "sex": sex, "notes": "Short plain sentence."},
    }

    user_instruction = (
        f"Animal: {animal}\nSex: {sex}\n\n"
        "Inspect the photo for likely dermatological issues and return top 3 predictions with probabilities.\n"
        "Also add 3 short text hints in clip_scores (with scores 0–1).\n"
        "Respond in JSON only."
    )

    try:
        res = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": system_rules},
                        {"text": json.dumps(schema)},
                        {"text": user_instruction},
                        image_part,
                    ],
                }
            ],
            config={"temperature": 0.2, "response_mime_type": "application/json"},
        )
    except Exception as e:
        logger.exception("Gemini request failed")
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {e}")

    try:
        data = json.loads(res.text)
    except Exception:
        data = {
            "predictions": [{"label": "Unknown", "probability": 0.0}],
            "clip_scores": [],
            "meta": {"animal": animal, "sex": sex, "notes": "AI helper, not diagnosis."},
        }

    for p in data.get("predictions", []):
        p["label"] = str(p.get("label", "Unknown"))[:64]
        p["probability"] = clamp01(p.get("probability", 0.0))
    for c in data.get("clip_scores", []):
        c["text"] = str(c.get("text", ""))[:80]
        c["score"] = clamp01(c.get("score", 0.0))

    return JSONResponse(data)

# ==========================================================
# 🎨 GEMINI CAPTION GENERATOR
# ==========================================================
@app.post("/generate-caption")
async def generate_caption(image: UploadFile = File(...), category: str = Form("")):
    img_bytes = await image.read()
    mime = image.content_type or "image/jpeg"
    data_b64 = base64.b64encode(img_bytes).decode("ascii")
    image_part = {"inline_data": {"mime_type": mime, "data": data_b64}}

    prompt = f"Write a {category} style stylish caption (<=80 chars) with emoji and simple English."

    try:
        res = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}, image_part]}],
            config={"temperature": 0.3},
        )
        return {"caption": (res.text or "").strip()}
    except Exception as e:
        logger.exception("Gemini caption failed")
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {e}")
