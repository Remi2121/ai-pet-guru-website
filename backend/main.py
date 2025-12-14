# main.py
import os, json, base64, logging, re, requests, hashlib, time
from io import BytesIO
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from PIL import Image
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from google import genai
try:
    from google.genai.errors import ClientError
except Exception:
    ClientError = Exception  # fallback

# ==========================================================
# 🚀 SETUP
# ==========================================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-pet-backend")

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise SystemExit("❌ Set GEMINI_API_KEY in backend/.env")
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
GEMINI_MODEL = "models/gemini-2.5-flash"

HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise SystemExit("❌ Set HF_TOKEN in backend/.env")
HF_MODEL = os.getenv("HF_TEXT_MODEL", "HuggingFaceH4/zephyr-7b-beta:featherless-ai")
HF_CHAT_URL = "https://api-inference.huggingface.co/v1/chat/completions"

app = FastAPI(title="🐾 AI Pet Assistant (stable images)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def _log_routes():
    for r in app.routes:
        if getattr(r, "path", None):
            logger.info("ROUTE %s %s", getattr(r, "methods", ""), r.path)

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

def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "pet").lower()).strip("-") or "pet"

# ==========================================================
# 🧯 RATE LIMIT + CACHE HELPERS
# ==========================================================
@dataclass
class TokenBucket:
    capacity: int
    refill_per_sec: float
    tokens: float
    last: float
    def allow(self, cost: float = 1.0) -> bool:
        now = time.time()
        elapsed = now - self.last
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_sec)
        self.last = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

PREDICT_BUCKET   = TokenBucket(capacity=5, refill_per_sec=5.0, tokens=5.0, last=time.time())
VOICE_BUCKET     = TokenBucket(capacity=5, refill_per_sec=5.0, tokens=5.0, last=time.time())
CAPTION_BUCKET   = TokenBucket(capacity=5, refill_per_sec=5.0, tokens=5.0, last=time.time())
RECOMMEND_BUCKET = TokenBucket(capacity=5, refill_per_sec=5.0, tokens=5.0, last=time.time())
TRAIN_BUCKET     = TokenBucket(capacity=5, refill_per_sec=5.0, tokens=5.0, last=time.time())
FOOD_BUCKET      = TokenBucket(capacity=5, refill_per_sec=5.0, tokens=5.0, last=time.time())

_PREDICT_CACHE: Dict[str, Dict[str, Any]]   = {}
_VOICE_CACHE: Dict[str, Dict[str, Any]]     = {}
_CAPTION_CACHE: Dict[str, Dict[str, Any]]   = {}
_RECOMMEND_CACHE: Dict[str, Dict[str, Any]] = {}
_TRAIN_CACHE: Dict[str, Dict[str, Any]]     = {}
_FOOD_CACHE: Dict[str, Dict[str, Any]]      = {}

def _call_gemini_json(model: str, parts: list, *, temperature: float = 0.2) -> Dict[str, Any]:
    try:
        res = gemini_client.models.generate_content(
            model=model,
            contents=[{"role": "user", "parts": parts}],
            config={"temperature": temperature, "response_mime_type": "application/json"},
        )
        raw = (getattr(res, "text", None) or "").strip()
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return parse_json_loose(raw) or {}
    except ClientError as e:
        msg = getattr(e, "message", "") or str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
            logger.warning("Gemini 429/Quota hit; returning fallback marker.")
            return {"__FALLBACK__": True}
        logger.exception("Gemini client error")
        return {}
    except Exception:
        logger.exception("Gemini request failed unexpectedly")
        return {}

# ==========================================================
# 🖼️ PLACEHOLDER IMAGES
# ==========================================================
PLACEHOLDER_IMAGES: Dict[str, str] = {
    "golden retriever": "https://images.unsplash.com/photo-1507149833265-60c372daea22?auto=format&fit=crop&w=1200&q=60",
    "labrador retriever": "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=1200&q=60",
    "german shepherd": "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=60",
    "beagle": "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=60",
    "siberian husky": "https://images.unsplash.com/photo-1507149833265-60c372daea22?auto=format&fit=crop&w=1200&q=60",
    "poodle (mini)": "https://images.unsplash.com/photo-1525253013412-55c1a69a5738?auto=format&fit=crop&w=1200&q=60",
    "poodle": "https://images.unsplash.com/photo-1525253013412-55c1a69a5738?auto=format&fit=crop&w=1200&q=60",
    "great dane": "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=60",
    "dachshund": "https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?auto=format&fit=crop&w=1200&q=60",
    "shih tzu": "https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?auto=format&fit=crop&w=1200&q=60",
    "pug": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=60",
    "chihuahua": "https://images.unsplash.com/photo-1505628346881-b72b27e84530?auto=format&fit=crop&w=1200&q=60",
    "border collie": "https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=1200&q=60",
    "australian shepherd": "https://images.unsplash.com/photo-1537151625747-768eb6cf92b6?auto=format&fit=crop&w=1200&q=60",
    "boxer": "https://images.unsplash.com/photo-1522276498395-f4f68f7f8455?auto=format&fit=crop&w=1200&q=60",
    "french bulldog": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=60",
    "bulldog": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=60",
    "doberman": "https://images.unsplash.com/photo-1529927052301-0eecbf1be1dc?auto=format&fit=crop&w=1200&q=60",
    "rottweiler": "https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?auto=format&fit=crop&w=1200&q=60",
    "cocker spaniel": "https://images.unsplash.com/photo-1548191265-cc70d3d45ba1?auto=format&fit=crop&w=1200&q=60",
    "pomeranian": "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=60",
    "indian pariah dog": "https://images.unsplash.com/photo-1583511655826-05700d52f4d9?auto=format&fit=crop&w=1200&q=60",

    "domestic shorthair cat": "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1200&q=60",
    "bengal cat": "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=1200&q=60",
    "ragdoll cat": "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1200&q=60",
    "sphynx cat": "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?auto=format&fit=crop&w=1200&q=60",
    "devon rex cat": "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?auto=format&fit=crop&w=1200&q=60",
    "siberian cat": "https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?auto=format&fit=crop&w=1200&q=60",
    "persian cat": "https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?auto=format&fit=crop&w=1200&q=60",
    "siamese cat": "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1200&q=60",
    "maine coon": "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=1200&q=60",
    "british shorthair": "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=1200&q=60",
    "scottish fold": "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=1200&q=60",

    "guinea pig": "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=1200&q=60",
    "hamster": "https://images.unsplash.com/photo-1583511655903-48058f2a5b51?auto=format&fit=crop&w=1200&q=60",
    "rabbit": "https://images.unsplash.com/photo-1501706362039-c06b2d715385?auto=format&fit=crop&w=1200&q=60",
    "betta fish": "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=60",
    "goldfish": "https://images.unsplash.com/photo-1507149833265-60c372daea22?auto=format&fit=crop&w=1200&q=60",
    "budgerigar": "https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=1200&q=60",
    "parakeet": "https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=1200&q=60",
    "cockatiel": "https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=1200&q=60",
    "canary": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=60",
    "tortoise": "https://images.unsplash.com/photo-1519066629447-267fffa62d5b?auto=format&fit=crop&w=1200&q=60",
    "turtle": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=60",
    "leopard gecko": "https://images.unsplash.com/photo-1619855329421-6f4b9d24dd47?auto=format&fit=crop&w=1200&q=60",
}

SYNONYMS = {
    "miniature poodle": "poodle (mini)",
    "toy poodle": "poodle (mini)",
    "standard poodle": "poodle",
    "domestic shorthair": "domestic shorthair cat",
    "budgie": "budgerigar",
    "parrot": "parakeet",
}

def _canonical(name: str) -> str:
    n = (name or "").lower().strip()
    n = re.sub(r"\s*\([^)]*\)", "", n)
    n = re.sub(r"\s+", " ", n)
    return n

def _placeholder_for(pet_name: str) -> Optional[str]:
    if not pet_name:
        return None
    n = _canonical(pet_name)
    if n in SYNONYMS:
        n = _canonical(SYNONYMS[n])
    if n in PLACEHOLDER_IMAGES:
        return PLACEHOLDER_IMAGES[n]
    for k, v in PLACEHOLDER_IMAGES.items():
        if k in n or n in k:
            return v
    return None

def _seeded_fallback(pet_name: str, idx: int = 0) -> str:
    seed = f"{_slug(pet_name)}-{idx}"
    return f"https://picsum.photos/seed/{seed}/900/600"

# ==========================================================
# TRAINING PLAN (HF primary, Gemini fallback)
# ==========================================================
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
                        "activities": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 3}
                    },
                    "required": ["day", "activities"],
                    "additionalProperties": False
                },
                "minItems": 7, "maxItems": 7
            },
            "rewards": {"type": "array", "items": {"type": "string"}},
            "videoLinks": {
                "type": "array",
                "items": {"type": "object",
                          "properties": {"title": {"type": "string"}, "url": {"type": "string"}},
                          "required": ["title", "url"], "additionalProperties": False},
                "minItems": 2, "maxItems": 2
            },
            "notes": {"type": "array", "items": {"type": "string"}},
            "meta": {"type": "object", "properties": {"seed": {"type": "string"}}, "required": ["seed"], "additionalProperties": False},
            "friendlyName": {"type": "string"}
        },
        "required": ["title","summary","dailyRoutine","sevenDay","rewards","videoLinks","notes","meta","friendlyName"],
        "additionalProperties": False
    },
    "strict": True
}

class TrainIn(BaseModel):
    petType: str
    age: str | None = None
    problem: str
    goal: str | None = None

def build_prompt(petType: str, age: str | None, problem: str, goal: str | None) -> str:
    return f"""
You are a certified pet trainer. Create a gentle, stepwise 7-day training plan.

Return STRICT JSON ONLY:
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
- friendlyName: "pup" for Dog, "kitty" for Cat, else "pet".
- 7 entries in sevenDay; 2–3 activities each.
- 2 videoLinks (placeholders ok).
- meta.seed = slug(petType + problem).
- Never use a double-quote inside values; use backticks if needed.

Context:
Pet type: {petType}
Age: {age or "unknown"}
Problem: {problem}
Desired outcome: {goal or "not specified"}
""".strip()

def call_hf(prompt: str) -> str:
    headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json", "Accept": "application/json"}
    payload = {
        "model": HF_MODEL,
        "messages": [
            {"role": "system", "content": "Return a SINGLE VALID JSON object matching the schema. No prose/markdown."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 900,
        "response_format": {"type": "json_schema", "json_schema": HF_JSON_SCHEMA},
    }
    resp = requests.post(HF_CHAT_URL, headers=headers, json=payload, timeout=90)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"HF API {resp.status_code}: {resp.text}")
    data = resp.json()
    choice0 = (data.get("choices") or [{}])[0]
    raw = (choice0.get("message") or {}).get("content") or choice0.get("text") or ""
    if not raw.strip():
        raise HTTPException(status_code=502, detail="HF returned no text content")
    return raw

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

def _train_fallback(body: TrainIn) -> Dict[str, Any]:
    pet = body.petType
    friendly = "pup" if pet == "Dog" else "kitty" if pet == "Cat" else "pet"
    activities = [
        ["Short play + name recall", "Reward calm behavior"],
        ["Leash walk 10–15 min", "Sit/Stay basics"],
        ["Targeting (hand touch)", "Crate/Mat training"],
        ["Impulse control (wait)", "Gentle grooming"],
        ["Recall games (indoors)", "Loose-leash practice"],
        ["Novel sound socialization", "Calm enrichment"],
        ["Review + easy challenge", "Celebrate progress"],
    ]
    return {
        "title": f"7-Day {pet} Plan",
        "summary": f"Goal: {body.goal or body.problem}. Gentle, reward-based steps.",
        "dailyRoutine": ["3–5 short sessions/day", "Fresh water & rest", "End on success"],
        "sevenDay": [{"day": i+1, "activities": activities[i]} for i in range(7)],
        "rewards": ["Tiny treats", "Praise", "Play break"],
        "videoLinks": [
            {"title": "Marker & timing basics", "url": "https://youtu.be/dQw4w9WgXcQ"},
            {"title": "Loose leash intro", "url": "https://youtu.be/o-YBDTqX_ZU"},
        ],
        "notes": ["Keep sessions <10 min", "If stress signs appear, pause."],
        "meta": {"seed": (pet + "-" + body.problem).lower().replace(" ", "-")[:24]},
        "friendlyName": friendly,
    }

@app.get("/api/health")
def health():
    return {"status": "ok", "gemini": bool(GEMINI_API_KEY), "huggingface_model": HF_MODEL}

@app.post("/api/train")
def generate_training_plan(body: TrainIn):
    if not body.petType or not body.problem:
        raise HTTPException(status_code=400, detail="petType and problem are required")
    prompt = build_prompt(body.petType, body.age, body.problem, body.goal)
    key = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:24]
    if key in _TRAIN_CACHE:
        return _TRAIN_CACHE[key]
    if not TRAIN_BUCKET.allow():
        logger.info("Train RL hit; serving fallback")
        plan = _train_fallback(body)
        _TRAIN_CACHE[key] = plan
        return plan
    try:
        raw = call_hf(prompt)
        try: plan = json.loads(raw)
        except Exception: plan = parse_json_loose(raw)
        plan = normalize_plan_like_object(plan, body)
        _TRAIN_CACHE[key] = plan
        return plan
    except Exception:
        logger.exception("HF failed; trying Gemini")
    parts = [{"text": "Return STRICT JSON only."}, {"text": prompt}]
    data = _call_gemini_json(GEMINI_MODEL, parts, temperature=0.2)
    if data.get("__FALLBACK__") or not isinstance(data, dict) or not data:
        plan = _train_fallback(body)
    else:
        try:
            plan = normalize_plan_like_object(data, body)
        except Exception:
            plan = _train_fallback(body)
    _TRAIN_CACHE[key] = plan
    return plan

# ==========================================================
# 🧩 IMAGE HEALTH
# ==========================================================
def _img_key(img_bytes: bytes, animal: str, sex: str) -> str:
    h = hashlib.sha256(img_bytes).hexdigest()[:16]
    return f"{h}:{animal}:{sex}"

def _predict_fallback(animal: str, sex: str) -> Dict[str, Any]:
    return {
        "predictions": [
            {"label": "Skin irritation (unsure)", "probability": 0.34},
            {"label": "Allergic dermatitis (unsure)", "probability": 0.33},
            {"label": "Hot spot / moisture lesion (unsure)", "probability": 0.22},
        ],
        "clip_scores": [
            {"text": "redness near wound", "score": 0.52},
            {"text": "hair loss patch", "score": 0.49},
            {"text": "moist area / licking", "score": 0.41},
        ],
        "meta": {"animal": animal, "sex": sex, "notes": "Model unavailable; heuristic fallback."},
    }

def _pet_gate_check(img_b64: str, mime: str) -> Dict[str, Any]:
    """
    Use Gemini vision to verify the image is a PET photo.
    Returns: {"is_pet": bool|None, "animal": str|None, "confidence": float, "reason": str}
    - None means the checker couldn't decide (API fallback/ambiguous).
    """
    parts = [
        {"text": (
            "You are an image gatekeeper. Decide if this image PRIMARILY shows a PET "
            "(dog, cat, rabbit, hamster/guinea pig, bird, reptile, or fish). "
            "Return STRICT JSON: "
            "{\"is_pet\": boolean, \"animal\": string|null, \"confidence\": number, \"reason\": string}."
        )},
        {"inline_data": {"mime_type": mime, "data": img_b64}},
    ]
    data = _call_gemini_json(GEMINI_MODEL, parts, temperature=0.0)
    if data.get("__FALLBACK__") or not isinstance(data, dict):
        return {"is_pet": None, "animal": None, "confidence": 0.0, "reason": "model_fallback"}
    try:
        is_pet = data.get("is_pet", None)
        animal = data.get("animal", None)
        conf = clamp01(data.get("confidence", 0.0))
        reason = str(data.get("reason", ""))[:200]
        if isinstance(is_pet, bool):
            return {"is_pet": is_pet, "animal": animal, "confidence": conf, "reason": reason}
        return {"is_pet": None, "animal": None, "confidence": conf, "reason": reason}
    except Exception:
        return {"is_pet": None, "animal": None, "confidence": 0.0, "reason": "parse_error"}

@app.post("/api/predict")
async def predict(image: UploadFile = File(...), animal: str = Form("unknown"), sex: str = Form("unknown")):
    # ---------- Read/validate image ----------
    try:
        img_bytes = await image.read()
        Image.open(BytesIO(img_bytes))
    except Exception as e:
        logger.exception("Invalid image")
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    mime = image.content_type or "image/jpeg"
    img_b64 = base64.b64encode(img_bytes).decode("ascii")

    # ---------- PET GATE: block non-pet images with friendly message ----------
    gate = _pet_gate_check(img_b64, mime)
    # If model is confident it's NOT a pet, stop here.
    if gate.get("is_pet") is False and gate.get("confidence", 0.0) >= 0.6:
        msg_en = ("This photo doesn't seem to be a pet. Please upload a clear photo of your pet's "
                  "skin/wound area (dog/cat, good lighting, close-up).")
        return JSONResponse(
            status_code=422,
            content={
                "error": "not_pet_image",
                "message": msg_en,
                "gate": gate,
            },
        )

    # ---------- Cache key only after we allow pet images ----------
    cache_key = _img_key(img_bytes, animal, sex)
    if cache_key in _PREDICT_CACHE:
        return JSONResponse(_PREDICT_CACHE[cache_key])

    # ---------- Rate limit ----------
    if not PREDICT_BUCKET.allow():
        logger.info("Rate-limited locally; serving fallback for predict()")
        data = _predict_fallback(animal, sex)
        _PREDICT_CACHE[cache_key] = data
        return JSONResponse(data)

    # ---------- Gemini dermatology inference ----------
    system_rules = "You are a veterinary assistant analyzing pet skin/wound issues. Return STRICT JSON only."
    schema = {
        "predictions": [{"label": "string", "probability": 0.0}],
        "clip_scores": [{"text": "string", "score": 0.0}],
        "meta": {"animal": animal, "sex": sex, "notes": "Short plain sentence."},
    }
    user_instruction = (
        f"Animal: {animal}\nSex: {sex}\n\n"
        "Return top 3 likely dermatology issues with probabilities and 3 clip hints (0–1)."
    )
    parts = [
        {"text": system_rules},
        {"text": json.dumps(schema)},
        {"text": user_instruction},
        {"inline_data": {"mime_type": mime, "data": img_b64}},
    ]

    data = _call_gemini_json(GEMINI_MODEL, parts, temperature=0.2)
    if data.get("__FALLBACK__"):
        data = _predict_fallback(animal, sex)

    try:
        for p in data.get("predictions", []):
            p["label"] = str(p.get("label", "Unknown"))[:64]
            p["probability"] = clamp01(p.get("probability", 0.0))
        for c in data.get("clip_scores", []):
            c["text"] = str(c.get("text", ""))[:80]
            c["score"] = clamp01(c.get("score", 0.0))
        if "meta" not in data:
            data["meta"] = {"animal": animal, "sex": sex, "notes": "AI helper, not diagnosis."}
        elif "notes" not in data["meta"]:
            data["meta"]["notes"] = "AI helper, not diagnosis."
        # attach gate info (useful for UI debug)
        data.setdefault("gate", gate)
    except Exception:
        logger.exception("Post-process sanitize failed; supplying fallback")
        data = _predict_fallback(animal, sex)
        data["gate"] = gate

    _PREDICT_CACHE[cache_key] = data
    return JSONResponse(data)

# ==========================================================
# 🎤 VOICE SYMPTOM CHECKER
# ==========================================================
class VoiceIn(BaseModel):
    audio_b64: str
    mime: Optional[str] = "audio/webm"

def _voice_key(audio_b64: str, mime: str) -> str:
    return hashlib.sha256((mime + ":" + audio_b64).encode("utf-8")).hexdigest()[:24]

def _voice_fallback() -> Dict[str, Any]:
    return {
        "disease": "Unknown",
        "confidence": 0.0,
        "advice": [
            "Keep the room quiet & ventilated.",
            "Offer fresh water; avoid strong scents.",
            "If symptoms persist or worsen, see a vet."
        ],
        "danger": "low",
        "raw": [
            {"label": "cough", "prob": 0.25},
            {"label": "stress", "prob": 0.22},
            {"label": "allergy", "prob": 0.18},
        ],
    }

@app.post("/api/voice/analyze")
def analyze_voice(body: VoiceIn):
    if not body.audio_b64:
        raise HTTPException(status_code=400, detail="audio_b64 is required")
    mime = (body.mime or "audio/webm").strip() or "audio/webm"

    key = _voice_key(body.audio_b64, mime)
    if key in _VOICE_CACHE:
        return JSONResponse(_VOICE_CACHE[key])

    if not VOICE_BUCKET.allow():
        logger.info("Rate-limited locally; serving voice fallback")
        data = _voice_fallback()
        _VOICE_CACHE[key] = data
        return JSONResponse(data)

    schema = {
        "type":"object","properties":{
            "disease":{"type":"string"},"confidence":{"type":"number"},
            "advice":{"type":"array","items":{"type":"string"}},
            "danger":{"type":"string","enum":["low","medium","high"]},
            "raw":{"type":"array","items":{"type":"object","properties":{"label":{"type":"string"},"prob":{"type":"number"}},
                    "required":["label","prob"],"additionalProperties":False}}
        },"required":["disease","confidence","advice","danger"],"additionalProperties":False
    }

    system_rules = "You are a careful veterinary assistant listening to short pet audio. Return STRICT JSON only."
    guidance = "Pick the single most likely issue; give 2–5 short tips; set danger properly; confidence 0–1."

    parts = [
        {"text":system_rules},{"text":"Schema:"},{"text":json.dumps(schema)},
        {"text":"Instructions:"},{"text":guidance},
        {"inline_data":{"mime_type":mime,"data":body.audio_b64}}
    ]

    data = _call_gemini_json(GEMINI_MODEL, parts, temperature=0.2)
    if data.get("__FALLBACK__"):
        data = _voice_fallback()

    disease = (str(data.get("disease","Unknown")).strip() or "Unknown")[:64]
    confidence = clamp01(data.get("confidence",0.0))
    advice = [str(a)[:160] for a in (data.get("advice") or [])][:5]
    danger = str(data.get("danger","low")).lower()
    if danger not in ("low","medium","high"): danger = "low"
    raw_preds = []
    for r in (data.get("raw") or []):
        try: raw_preds.append({"label":str(r.get("label",""))[:64],"prob":clamp01(r.get("prob",0.0))})
        except Exception: pass
    if not advice:
        advice = ["Monitor breathing tonight.","Keep the room calm & ventilated.","Offer fresh water; avoid strong scents."]

    out = {"disease":disease,"confidence":confidence,"advice":advice,"danger":danger,"raw":raw_preds}
    _VOICE_CACHE[key] = out
    return JSONResponse(out)

# ==========================================================
# 🎨 CAPTION
# ==========================================================
def _caption_key(img_bytes: bytes, category: str) -> str:
    h = hashlib.sha256(img_bytes + b"|" + category.encode()).hexdigest()[:24]
    return f"{h}:{category}"

@app.post("/generate-caption")
async def generate_caption(image: UploadFile = File(...), category: str = Form("")):
    img_bytes = await image.read()
    try:
        Image.open(BytesIO(img_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    key = _caption_key(img_bytes, category or "")
    if key in _CAPTION_CACHE:
        return _CAPTION_CACHE[key]

    if not CAPTION_BUCKET.allow():
        out = {"caption": "Cuteness overload 🌟"}
        _CAPTION_CACHE[key] = out
        return out

    mime = image.content_type or "image/jpeg"
    data_b64 = base64.b64encode(img_bytes).decode("ascii")
    prompt = f"Write a {category} style stylish caption (<=80 chars) with emoji and simple English."
    parts = [{"text":prompt}, {"inline_data":{"mime_type":mime,"data":data_b64}}]

    data = _call_gemini_json(GEMINI_MODEL, parts, temperature=0.3)
    if data.get("__FALLBACK__"):
        out = {"caption": "Too cute to handle 😍"}
    else:
        cap = data if isinstance(data, str) else (data.get("caption") if isinstance(data, dict) else "")
        if not cap:
            cap = "Best boy energy ✨"
        out = {"caption": str(cap).strip()[:120] or "Pet vibes ✨"}
    _CAPTION_CACHE[key] = out
    return out

# ==========================================================
# 🐾 RECOMMENDER
# ==========================================================
class RecommendIn(BaseModel):
    house: str
    budget: str
    lifestyle: str
    allergies: str = "no"
    time: str

CATALOG = [
    {"pet":"Beagle","img":"","hypoallergenic":False,"monthly_cost":"₹4,000–₹7,000"},
    {"pet":"Domestic Shorthair Cat","img":"","hypoallergenic":False,"monthly_cost":"₹2,500–₹5,500"},
    {"pet":"Guinea Pig","img":"","hypoallergenic":True,"monthly_cost":"₹1,000–₹2,500"},
    {"pet":"Poodle (Mini)","img":"","hypoallergenic":True,"monthly_cost":"₹3,500–₹6,500"},
    {"pet":"Betta Fish","img":"","hypoallergenic":True,"monthly_cost":"₹500–₹1,200"},
    {"pet":"Budgerigar (Parakeet)","img":"","hypoallergenic":True,"monthly_cost":"₹800–₹1,800"},
    {"pet":"Labrador Retriever","img":"","hypoallergenic":False,"monthly_cost":"₹5,000–₹8,500"},
    {"pet":"Siberian Cat","img":"","hypoallergenic":True,"monthly_cost":"₹3,500–₹6,500"},
]

def _parse_int(x: Any) -> int:
    try: return int(float(str(x).replace(",", "")))
    except Exception: return 0

def _pet_reco_prompt(payload: Dict[str, Any]) -> str:
    return f"""
You are a pet adoption consultant. Recommend 5 suitable pets.

Return STRICT JSON ONLY:
{{ "results": [ {{"pet": string, "reason": string, "monthly_cost": string, "hypoallergenic": boolean, "img": string}} ] }}

Rules:
- 5 results only.
- If allergies is "yes", only hypoallergenic=true.
- Costs must be realistic INR ranges (₹).
- reason <= 160 chars, friendly & specific.
- img can be empty; backend will fill a correct photo.

Inputs:
house: {payload.get('house')}
budget: {payload.get('budget')}
lifestyle: {payload.get('lifestyle')}
allergies: {payload.get('allergies')}
time: {payload.get('time')}
name: {payload.get('name') or "unknown"}
""".strip()

def _rule_based(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    want_hypo = (payload.get("allergies","no").lower() == "yes")
    budget = _parse_int(payload.get("budget"))
    time = (payload.get("time") or "").lower()
    lifestyle = (payload.get("lifestyle") or "").lower()
    def ok(item):
        if want_hypo and not item["hypoallergenic"]: return False
        low = _parse_int(re.search(r"₹\s*([\d,]+)", item["monthly_cost"]).group(1)) if re.search(r"₹\s*([\d,]+)", item["monthly_cost"]) else 0
        if budget and low > max(budget * 1.2, budget + 1000): return False
        if "poodle" in item["pet"].lower() or "labrador" in item["pet"].lower():
            if time == "low" or lifestyle == "calm": return False
        return True
    picks = [i for i in CATALOG if ok(i)] or CATALOG[:]
    return picks[:5]

def _reco_key(payload: Dict[str, Any], img_digest: str | None) -> str:
    base = json.dumps(payload, sort_keys=True)
    to_hash = (base + "|" + (img_digest or "")).encode("utf-8")
    return hashlib.sha256(to_hash).hexdigest()[:24]

@app.post("/api/recommend")
async def recommend(
    json_body: Optional[RecommendIn] = None,
    house: Optional[str] = Form(None),
    budget: Optional[str] = Form(None),
    lifestyle: Optional[str] = Form(None),
    allergies: Optional[str] = Form(None),
    time: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    payload: Dict[str, Any] = {}
    img_bytes: Optional[bytes] = None
    img_mime = "image/jpeg"

    if json_body:
        payload = {
            "house": json_body.house, "budget": json_body.budget, "lifestyle": json_body.lifestyle,
            "allergies": (json_body.allergies or "no").lower(), "time": json_body.time, "name": None,
        }
    else:
        required = [house, budget, lifestyle, time]
        if any(v in (None, "") for v in required):
            raise HTTPException(status_code=400, detail="Missing required fields in form")
        payload = {
            "house": str(house), "budget": str(budget), "lifestyle": str(lifestyle),
            "allergies": str(allergies or "no").lower(), "time": str(time), "name": (name or "").strip() or None,
        }
        if image is not None:
            try:
                img_bytes = await image.read()
                Image.open(BytesIO(img_bytes))
                img_mime = image.content_type or "image/jpeg"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    img_digest = hashlib.sha256(img_bytes).hexdigest()[:16] if img_bytes else None
    ck = _reco_key(payload, img_digest)
    if ck in _RECOMMEND_CACHE:
        return _RECOMMEND_CACHE[ck]

    if not RECOMMEND_BUCKET.allow():
        logger.info("Recommend RL hit; using rule-based")
        results = _rule_based(payload)
    else:
        prompt = _pet_reco_prompt(payload)
        parts = [{"text": prompt}]
        data = _call_gemini_json(GEMINI_MODEL, parts, temperature=0.2)
        if data.get("__FALLBACK__"):
            results = _rule_based(payload)
        else:
            try:
                results = (data.get("results") if isinstance(data, dict) else []) or _rule_based(payload)
            except Exception:
                results = _rule_based(payload)

    if len(results) < 5:
        results = (results + _rule_based(payload))[:5]

    if img_bytes and results:
        data_url = f"data:{img_mime};base64,{base64.b64encode(img_bytes).decode('ascii')}"
        if not (results[0].get("img") or "").strip():
            results[0]["img"] = data_url

    used: set[str] = set()
    normd: List[Dict[str, Any]] = []
    for i, r in enumerate(results[:5]):
        pet = str(r.get("pet","Companion Pet")).strip() or "Companion Pet"
        img = (r.get("img") or "").strip()
        if not img:
            ph = _placeholder_for(pet)
            if ph: img = ph
        if not img:
            img = _seeded_fallback(pet, i)
        if img in used:
            img = _seeded_fallback(pet, i+100)
        used.add(img)
        normd.append({
            "pet": pet[:60],
            "reason": str(r.get("reason","Fits your lifestyle."))[:200],
            "monthly_cost": str(r.get("monthly_cost","₹1,000–₹5,000"))[:40],
            "hypoallergenic": bool(r.get("hypoallergenic", False)),
            "img": img,
        })

    out = {"results": normd}
    _RECOMMEND_CACHE[ck] = out
    return out

# ==========================================================
# 🥫 FOOD ANALYZER — text or image (OCR + vision)
# ==========================================================
DOG_HARMFUL = {
    "xylitol","chocolate","cocoa","caffeine","grapes","raisins","onion","garlic",
    "leek","chives","macadamia","ethoxyquin","bht","bha","propylene glycol",
    "sorbitol (xylitol mix)","alcohol","maltitol"
}
CAT_HARMFUL = {
    "onion","garlic","leek","chives","grapes","raisins","alcohol","caffeine",
    "propylene glycol","ethylene glycol","lilies","chocolate","cocoa","xylitol"
}
UNIVERSAL_CAUTION = {
    "salt","sugar","artificial color","artificial colours","artificial color(s)",
    "artificial flavour","artificial flavours","caramel color","msg",
    "monosodium glutamate","corn syrup","glucose syrup","maltodextrin",
    "by-product","meat by-product"
}
BETTER_BRANDS = ["Orijen","Acana","Royal Canin","Farmina N&D","Drools Focus"]

# --- Energy density & safety DB (kcal per gram)
FOOD_DB = {
    "burger":        {"kcal_g": 2.6, "pet_ok": False, "tags": ["greasy","salt"]},
    "fried chicken": {"kcal_g": 2.5, "pet_ok": False, "tags": ["bones","greasy","salt"]},
    "donut":         {"kcal_g": 4.3, "pet_ok": False, "tags": ["sugar","fat"]},
    "cookies":       {"kcal_g": 4.5, "pet_ok": False, "tags": ["sugar","chocolate?"]},
    "pizza":         {"kcal_g": 2.7, "pet_ok": False, "tags": ["salt","fat","onion?","garlic?"]},
    "french fries":  {"kcal_g": 3.1, "pet_ok": False, "tags": ["salt","oil"]},
    "soda":          {"kcal_g": 0.4, "pet_ok": False, "tags": ["sugar","caffeine?"]},
    "chocolate":     {"kcal_g": 5.3, "pet_ok": False, "tags": ["toxic (theobromine)"]},
    "cake":          {"kcal_g": 3.8, "pet_ok": False, "tags": ["sugar","fat","raisins?"]},
    "ice cream":     {"kcal_g": 2.0, "pet_ok": False, "tags": ["lactose","sugar"]},
    "boiled chicken": {"kcal_g": 1.7, "pet_ok": True, "tags": ["lean protein"]},
    "rice":           {"kcal_g": 1.3, "pet_ok": True, "tags": ["carb"]},
    "egg":            {"kcal_g": 1.6, "pet_ok": True, "tags": ["protein","fat"]},
    "carrot":         {"kcal_g": 0.4, "pet_ok": True, "tags": ["veggie"]},
}

def _food_key(text: str|None, img_bytes: bytes|None) -> str:
    if text and text.strip():
        return "T:" + hashlib.sha256(text.strip().lower().encode()).hexdigest()[:24]
    if img_bytes:
        return "I:" + hashlib.sha256(img_bytes).hexdigest()[:24]
    return "food:empty"

def _split_ingredients(raw: str) -> list[str]:
    t = (raw or "").lower()
    t = re.sub(r"[^a-z0-9, \-\(\)\/\.]", " ", t)
    parts = [p.strip(" .") for p in re.split(r",|\n", t) if p.strip()]
    norm = [re.sub(r"\s+", " ", p) for p in parts]
    seen=set(); out=[]
    for p in norm:
        if p not in seen:
            out.append(p); seen.add(p)
    return out[:60]

def _score_food(ings: list[str], animal: str) -> dict:
    a = (animal or "").strip().lower()
    harmful_set = DOG_HARMFUL if a == "dog" else CAT_HARMFUL if a == "cat" else DOG_HARMFUL | CAT_HARMFUL
    harmful, caution = [], []
    for item in ings:
        base = item
        for h in harmful_set:
            if h in base:
                harmful.append(item); break
        else:
            for c in UNIVERSAL_CAUTION:
                if c in base:
                    caution.append(item); break
    harmful = list(dict.fromkeys(harmful))[:12]
    caution = list(dict.fromkeys(caution))[:12]
    if harmful:
        rating = "bad"
    elif len(caution) >= 2:
        rating = "caution"
    else:
        rating = "good"
    return {"rating": rating, "harmful": harmful, "caution": caution}

def _estimate_qty_grams(animal: str, weight_kg: float|None) -> int:
    if not weight_kg:
        return 180
    a = (animal or "").strip().lower()
    kcal = (70 * (weight_kg ** 0.75)) * (1.2 if a == "cat" else 1.4)
    grams = int(kcal / 3.5)
    return max(60, min(grams, 400))

def _items_to_table(items: list[dict], animal: str, daily_kcal: int) -> list[dict]:
    rows = []
    for it in items:
        name = (it.get("name") or "").strip().lower()
        grams = float(it.get("grams") or 0) if str(it.get("grams") or "").strip() else None
        key = None
        for k in FOOD_DB.keys():
            if k in name or name in k:
                key = k; break
        info = FOOD_DB.get(key or name)
        if not info:
            info = {"kcal_g": 2.5, "pet_ok": False, "tags": ["unknown"]}
        kcal_g = float(info["kcal_g"])
        est_kcal = int(round(kcal_g * (grams or 100)))
        pet_ok = bool(info["pet_ok"])
        flag = "unsafe" if not pet_ok else ("high-calorie" if kcal_g >= 3.5 else "ok")
        if not pet_ok:
            suggestion = "Avoid for pets."
        elif kcal_g >= 3.5:
            suggestion = "Limit; very energy-dense."
        else:
            max_g = int((0.1 * daily_kcal) / max(kcal_g, 0.1))
            suggestion = f"≤ {max_g} g (treat budget)."
        rows.append({
            "name": name or (key or "food"),
            "grams": grams,
            "kcal_g": round(kcal_g, 2),
            "est_kcal": est_kcal,
            "pet_ok": pet_ok,
            "flag": flag,
            "tags": info.get("tags", []),
            "suggestion": suggestion,
        })
    return rows

class FoodIn(BaseModel):
    mode: str = "text"           # "text" or "image"
    ingredients: Optional[str] = None
    animal: str = "dog"
    weight_kg: Optional[float] = None

@app.post("/api/food/analyze")
async def food_analyze(
    mode: str = Form("text"),
    animal: str = Form("dog"),
    weight_kg: Optional[float] = Form(None),
    ingredients: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    json_body: Optional[FoodIn] = None,
):
    # normalize
    if json_body:
        mode = (json_body.mode or "text").lower()
        animal = (json_body.animal or "dog").lower()
        weight_kg = json_body.weight_kg
        ingredients = json_body.ingredients

    img_bytes = None
    mime = "image/jpeg"
    if mode == "image":
        if image is None:
            raise HTTPException(status_code=400, detail="image required for mode=image")
        try:
            img_bytes = await image.read()
            Image.open(BytesIO(img_bytes))
            mime = image.content_type or "image/jpeg"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image: {e}")
    else:
        if not (ingredients and ingredients.strip()):
            raise HTTPException(status_code=400, detail="ingredients text required for mode=text")

    ck = _food_key(ingredients, img_bytes)
    if ck in _FOOD_CACHE:
        return JSONResponse(_FOOD_CACHE[ck])

    if not FOOD_BUCKET.allow():
        logger.info("Food RL hit; returning rule-based only")
        ings = _split_ingredients(ingredients or "")
        scored = _score_food(ings, animal)
        out = {
            "rating": scored["rating"],
            "harmful": scored["harmful"] or [],
            "better": BETTER_BRANDS[:5],
            "daily_qty_g": _estimate_qty_grams(animal, weight_kg),
            "source": {"from": "rate-limit"},
            "ingredients": ings,
        }
        _FOOD_CACHE[ck] = out
        return JSONResponse(out)

    # ---------- Image mode: OCR + Vision ----------
    ocr_text = None
    vision_items = []
    if mode == "image":
        _b64 = base64.b64encode(img_bytes).decode("ascii")

        # (1) OCR label
        ocr_parts = [
            {"text": "Extract the ingredient list from this pet food label. Return STRICT JSON: {\"ingredients\": string}."},
            {"inline_data": {"mime_type": mime, "data": _b64}},
        ]
        ocr = _call_gemini_json(GEMINI_MODEL, ocr_parts, temperature=0.0)
        if not ocr.get("__FALLBACK__"):
            try:
                ocr_text = (ocr.get("ingredients") or "").strip() or None
            except Exception:
                ocr_text = None

        # (2) Vision items (works for junk-food photos)
        det_parts = [
            {"text": (
                "Look at the photo and list human foods you see. "
                "Return STRICT JSON: {\"items\": [{\"name\": string, \"grams\": number|null}]} . "
                "Use simple names like burger, fried chicken, donut, pizza, cookies, soda, chocolate."
            )},
            {"inline_data": {"mime_type": mime, "data": _b64}},
        ]
        det = _call_gemini_json(GEMINI_MODEL, det_parts, temperature=0.0)
        if not det.get("__FALLBACK__"):
            try:
                vision_items = det.get("items") or []
            except Exception:
                vision_items = []

        # mix OCR text into ingredients
        ingredients = (ingredients or "")
        if ocr_text:
            ingredients = (ingredients + "\n" + ocr_text).strip()

    # ---------- Text analysis ----------
    ings = _split_ingredients(ingredients or "")
    scored = _score_food(ings, animal)

    # per-item kcal table + stronger verdict for junk images
    daily_kcal = int((70 * ((float(weight_kg) if weight_kg else 8.0) ** 0.75)) * (1.2 if animal=="cat" else 1.4))
    table = _items_to_table(vision_items, animal, daily_kcal) if vision_items else []
    if mode == "image" and table:
        if any(not r["pet_ok"] for r in table):
            rating = "bad"
        else:
            rating = "caution" if any(r["kcal_g"] >= 3.5 for r in table) else scored["rating"]
    else:
        rating = scored["rating"]

    out = {
        "rating": rating,
        "harmful": scored["harmful"] or [],
        "better": BETTER_BRANDS[:5],
        "daily_qty_g": _estimate_qty_grams(animal, weight_kg),
        "source": {
            "from": "image" if img_bytes else "text",
            "ocr_text": ocr_text if img_bytes else None,
            "vision_items": table,
        },
        "ingredients": ings,
    }
    _FOOD_CACHE[ck] = out
    return JSONResponse(out)

# ==========================================================
# 🩺 HEALTH LOG ANALYZER (Firestore integration via frontend)
# ==========================================================
ANALYTICS_BUCKET = TokenBucket(capacity=5, refill_per_sec=2.0, tokens=5.0, last=time.time())

class HealthEntry(BaseModel):
    dateISO: Optional[str] = None
    food: Optional[str] = ""
    water: Optional[float] = None
    vomit: Optional[str] = "no"
    diarrhea: Optional[str] = "no"
    activity: Optional[float] = None
    notes: Optional[str] = ""

class AnalyzeLogsIn(BaseModel):
    logs: List[HealthEntry]

def _rule_health(entries: List[HealthEntry]) -> Dict[str, Any]:
    """Fallback if Gemini quota/rate-limit — lightweight rule check."""
    if not entries:
        return {
            "status": "watch",
            "score": 0.5,
            "reasons": ["No recent logs available."],
            "tips": ["Add daily logs", "Monitor appetite and water intake"],
        }

    bad_flags = 0
    warn_flags = 0
    total_water = 0
    total_activity = 0
    n = min(7, len(entries))

    for e in entries[:n]:
        if (e.vomit or "").lower() == "yes": bad_flags += 1
        if (e.diarrhea or "").lower() == "yes": bad_flags += 1
        if not e.water or e.water < 100: warn_flags += 1
        if not e.activity or e.activity < 10: warn_flags += 1
        total_water += float(e.water or 0)
        total_activity += float(e.activity or 0)

    reasons = []
    if bad_flags >= 2:
        reasons.append("Multiple vomiting or diarrhea entries detected.")
    elif bad_flags == 1:
        reasons.append("Single digestion issue reported.")
    if total_water < 400 * (n / 2):
        reasons.append("Low water intake overall.")
    if total_activity < 30 * n:
        reasons.append("Low physical activity noted.")

    if bad_flags >= 2:
        status = "bad"
        base = 0.3
    elif bad_flags == 1 or warn_flags >= 3:
        status = "watch"
        base = 0.55
    else:
        status = "good"
        base = 0.8

    score = max(0.1, min(0.98, base))
    tips = [
        "Ensure fresh water daily",
        "Maintain consistent meals",
        "Encourage regular exercise",
        "If symptoms persist, consult a vet"
    ]
    return {"status": status, "score": score, "reasons": reasons or ["All good!"], "tips": tips}

@app.post("/api/health/analyze-logs")
def analyze_logs(body: AnalyzeLogsIn):
    if not body.logs:
        raise HTTPException(status_code=400, detail="logs are required")

    # Rate limit check
    if not ANALYTICS_BUCKET.allow():
        return JSONResponse(_rule_health(body.logs))

    # Prepare compact rows
    rows = []
    for e in body.logs[:7]:
        rows.append({
            "date": e.dateISO,
            "food": e.food or "",
            "water_ml": e.water or 0,
            "vomit": e.vomit or "no",
            "diarrhea": e.diarrhea or "no",
            "activity_min": e.activity or 0,
            "notes": e.notes or "",
        })

    schema = {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["good", "watch", "bad"]},
            "score": {"type": "number"},
            "reasons": {"type": "array", "items": {"type": "string"}},
            "tips": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["status", "score"],
    }

    parts = [
        {"text": "You are a veterinary assistant analyzing a pet's daily health logs."},
        {"text": "Return STRICT JSON following this schema:"},
        {"text": json.dumps(schema)},
        {"text": "Use status: 'good', 'watch', or 'bad'."},
        {"text": "Recent logs (latest first):"},
        {"text": json.dumps(rows)},
    ]

    data = _call_gemini_json(GEMINI_MODEL, parts, temperature=0.1)
    if data.get("__FALLBACK__") or not isinstance(data, dict) or "status" not in data:
        return JSONResponse(_rule_health(body.logs))

    status = str(data.get("status", "watch")).lower()
    if status not in ("good", "watch", "bad"):
        status = "watch"
    score = clamp01(data.get("score", 0.5))
    reasons = [str(r)[:160] for r in (data.get("reasons") or [])][:6]
    tips = [str(t)[:160] for t in (data.get("tips") or [])][:6]

    return JSONResponse({
        "status": status,
        "score": score,
        "reasons": reasons,
        "tips": tips,
    })
