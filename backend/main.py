import os, json, base64, logging
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai


# ----------------- SETUP -----------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-pet-backend")

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise SystemExit("❌ Set GEMINI_API_KEY in backend/.env")

client = genai.Client(api_key=API_KEY)
MODEL = "models/gemini-2.5-flash"

app = FastAPI(title="🐾 AI Pet Disease Detector Backend")

# ⚙️ CORS (allow your React dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- HELPERS -----------------
def clamp01(x, default=0.0):
    try:
        f = float(x)
        return max(0.0, min(1.0, f))
    except Exception:
        return default


# ----------------- HEALTH CHECK -----------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ----------------- PREDICT -----------------
@app.post("/api/predict")
async def predict(
    image: UploadFile = File(...),
    animal: str = Form("unknown"),
    sex: str = Form("unknown"),
):
    # Validate + read image
    try:
        img_bytes = await image.read()
        Image.open(BytesIO(img_bytes))  # verify image
    except Exception as e:
        logger.exception("Invalid image")
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    mime = image.content_type or "image/jpeg"
    data_b64 = base64.b64encode(img_bytes).decode("ascii")
    image_part = {"inline_data": {"mime_type": mime, "data": data_b64}}

    system_rules = (
        "You are a veterinary image triage assistant for pet skin/wound issues. "
        "You MUST return strict JSON only. No Markdown, no commentary."
    )

    json_contract = {
        "predictions": [{"label": "string", "probability": 0.0}],
        "clip_scores": [{"text": "string", "score": 0.0}],
        "gradcam_base64": None,
        "overlay_base64": None,
        "mask_base64": None,
        "boxes": [{"x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0, "confidence": 0.0}],
        "meta": {"animal": animal, "sex": sex, "notes": "Short explanation in one sentence."},
    }

    user_instruction = (
        f"Animal: {animal}\nSex: {sex}\n\n"
        "Task: Inspect the pet image and predict likely dermatological issues.\n"
        "Return the TOP-3 predictions with probabilities in [0,1].\n"
        "Also return 3 short zero-shot text hints in clip_scores with scores in [0,1].\n"
        "If you cannot produce heatmaps/overlays/boxes, set them to null or [].\n"
        "Keep labels short (e.g., 'Fungal Infection', 'Hotspot').\n"
        "Include a one-sentence note in meta.notes (plain English)."
    )

    try:
        res = client.models.generate_content(
            model=MODEL,
            contents=[
                {"role": "user", "parts": [
                    {"text": system_rules},
                    {"text": "Return ONLY valid JSON conforming to this schema:"},
                    {"text": json.dumps(json_contract, indent=2)},
                    {"text": "\nNow analyze this case and fill the fields:"},
                    {"text": user_instruction},
                    image_part,
                ]}
            ],
            config={
                "temperature": 0.2,
                "response_mime_type": "application/json",
            },
        )
    except Exception as e:
        logger.exception("Gemini request failed")
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {e}")

    # Parse JSON safely
    try:
        data = json.loads(res.text)
    except Exception as e:
        logger.exception("Model did not return valid JSON")
        data = {
            "predictions": [{"label": "Unknown", "probability": 0.0}],
            "clip_scores": [],
            "gradcam_base64": None,
            "overlay_base64": None,
            "mask_base64": None,
            "boxes": [],
            "meta": {"animal": animal, "sex": sex, "notes": "AI helper, not a diagnosis."},
        }

    # Normalize
    data.setdefault("predictions", [])
    data.setdefault("clip_scores", [])
    data.setdefault("gradcam_base64", None)
    data.setdefault("overlay_base64", None)
    data.setdefault("mask_base64", None)
    data.setdefault("boxes", [])
    data.setdefault("meta", {"animal": animal, "sex": sex})

    for p in data["predictions"]:
        p["label"] = str(p.get("label", "Unknown"))[:64]
        p["probability"] = clamp01(p.get("probability", 0.0))

    for c in data["clip_scores"]:
        c["text"] = str(c.get("text", ""))[:80]
        c["score"] = clamp01(c.get("score", 0.0))

    if not data.get("overlay_base64") and data.get("mask_base64"):
        data["overlay_base64"] = data["mask_base64"]

    return JSONResponse(data)


# ----------------- CAPTION GENERATOR -----------------
@app.post("/generate-caption")
async def generate_caption(
    image: UploadFile = File(...),
    category: str = Form(""),
):
    img_bytes = await image.read()
    mime = image.content_type or "image/jpeg"
    data_b64 = base64.b64encode(img_bytes).decode("ascii")
    image_part = {"inline_data": {"mime_type": mime, "data": data_b64}}

    prompt = f"Write a {category} style stylish caption (<= 80 chars) with simple English and emoji."

    try:
        res = client.models.generate_content(
            model=MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}, image_part]}],
            config={"temperature": 0.2},
        )
        caption = (res.text or "").strip()
        return {"caption": caption}
    except Exception as e:
        logger.exception("Gemini caption failed")
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {e}")
