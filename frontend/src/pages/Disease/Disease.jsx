// src/pages/Disease/Disease.jsx
import { useState } from "react";
import UploadBox from "../../components/UploadBox/UploadBox";
import DangerMeter from "../../components/DangerMeter/DangerMeter";

const ANIMALS = [
  { id: "dog", label: "Dog" },
  { id: "cat", label: "Cat" },
  { id: "rabbit", label: "Rabbit" },
  { id: "cow", label: "Cow" },
  { id: "bird", label: "Bird" },
  { id: "hamster", label: "Hamster" },
  { id: "guinea_pig", label: "Guinea Pig" },
  { id: "reptile", label: "Reptile" },
  { id: "fish", label: "Fish" },
  { id: "horse", label: "Horse" },
  { id: "other", label: "Other" },
];

const SEXES = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "unknown", label: "Unknown" },
];

function SmallBadge({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
      {children}
    </span>
  );
}

export default function Disease() {
  const [animal, setAnimal] = useState("dog");
  const [sex, setSex] = useState("unknown");
  const [imgB64, setImgB64] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  // ---- helper to read nice backend error JSON (422, 400, etc.)
  const readErrorMessage = async (resp) => {
    try {
      const j = await resp.json();
      if (j?.error === "not_pet_image") {
        const en = j.message || "This photo doesn't seem to be a pet.";
        const ta = j.message_ta || "";
        return `${en}\n${ta}`;
      }
      if (j?.detail) return String(j.detail);
      if (j?.message) return String(j.message);
    // eslint-disable-next-line no-unused-vars
    } catch (_) { /* empty */ }
    return `Server error (${resp.status})`;
  };

  // ⭐ REAL BACKEND API CALL
  const analyze = async () => {
    if (!imgB64) {
      setErr("Please upload a clear photo first.");
      return;
    }

    setErr(null);
    setLoading(true);
    setRes(null);

    try {
      const blob = await fetch(imgB64).then((r) => r.blob());

      const fd = new FormData();
      fd.append("image", blob, fileName || "upload.jpg");
      fd.append("animal", animal);
      fd.append("sex", sex);

      const resp = await fetch("http://127.0.0.1:8000/api/predict", {
        method: "POST",
        body: fd,
      });

      // Show friendly bilingual message for 422 from backend
      if (resp.status === 422) {
        const msg = await readErrorMessage(resp);
        setErr(msg);
        setLoading(false);
        return;
      }

      if (!resp.ok) {
        const msg = await readErrorMessage(resp);
        throw new Error(msg);
      }

      const data = await resp.json();

      // top prediction
      const top = data?.predictions?.[0] || { label: "Unknown", probability: 0 };

      // build readable description from top-3 preds and CLIP
      const predsText = (data.predictions || [])
        .slice(0, 3)
        .map((p) => `${p.label} (${Math.round(p.probability * 100)}%)`)
        .join(", ");

      const clipText = (data.clip_scores || [])
        .slice(0, 3)
        .map((c) => `${c.text} (${Math.round(c.score * 100)}%)`)
        .join(", ");

      const descParts = [];
      if (predsText) descParts.push(`Model predictions: ${predsText}.`);
      if (clipText) descParts.push(`Zero-shot hints: ${clipText}.`);
      descParts.push(
        `Notes: This is an automated assistive result — not a veterinary diagnosis. For worsening signs (increased swelling, bleeding, severe pain) contact a vet.`
      );

      const uiRes = {
        disease: top.label,
        probability: top.probability || 0,
        danger: top.probability > 0.85 ? "medium" : "low",

        remedies: ["Gently clean area with saline", "Prevent licking", "Keep area dry"],
        suggested_meds: ["Soothing ointment"],
        see_vet_when: ["Swelling increases", "Bleeding", "Pet appears in pain"],

        // use overlay returned by backend (annotated image)
        disease_image_b64: data.overlay_base64 || data.mask_base64 || null,

        // friendly description
        disease_description: descParts.join(" "),

        gradcam: data.gradcam_base64 || null,
        boxes: data.boxes || [],
        clip_scores: data.clip_scores || [],
        meta: data.meta || {},
      };

      setRes(uiRes);
    } catch (error) {
      console.error(error);
      setErr(String(error.message || "Backend error — check console"));
    }

    setLoading(false);
  };

  // reset
  const clearAll = () => {
    setImgB64(null);
    setFileName("");
    setRes(null);
    setErr(null);
  };

  const previewSrc = (b64) => {
    if (!b64) return null;
    return b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
    };

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h2 className="text-3xl font-semibold" style={{ color: "var(--brand-primary)" }}>
          AI Disease Detector
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Choose animal & sex, upload a clear photo. AI will analyse in real-time.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* LEFT SIDE */}
        <aside className="md:col-span-1 space-y-4">
          {/* animal buttons */}
          <div className="bg-white rounded-2xl shadow p-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Which animal?
            </label>
            <div className="flex gap-2 flex-wrap">
              {ANIMALS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAnimal(a.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    animal === a.id
                      ? "bg-(--brand-primary)/15 text-(--brand-primary) ring-1 ring-(--brand-primary)/20"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* sex buttons */}
          <div className="bg-white rounded-2xl shadow p-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">Sex</label>
            <div className="flex gap-2">
              {SEXES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSex(s.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    sex === s.id
                      ? "bg-(--brand-primary)/15 text-(--brand-primary) ring-1 ring-(--brand-primary)/20"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* upload */}
          <div className="bg-white rounded-2xl shadow p-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Upload pet image
            </label>

            <UploadBox
              label={imgB64 ? "Replace image" : "Upload image (JPG/PNG)"}
              accept="image/*"
              maxSizeMB={8}
              onBase64={(dataUrl, file) => {
                setImgB64(dataUrl);
                setFileName(file?.name ?? "");
                setRes(null);
                setErr(null);
              }}
            />

            <div className="mt-4 flex gap-3 items-center">
              <button
                onClick={analyze}
                disabled={!imgB64 || loading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium transition ${
                  !imgB64 || loading ? "bg-slate-300 cursor-not-allowed" : ""
                }`}
                style={{
                  background: !imgB64 || loading ? undefined : "var(--brand-primary)",
                }}
              >
                {loading ? "Analyzing…" : "Analyze Image"}
              </button>

              <button onClick={clearAll} className="px-4 py-2 rounded-xl border bg-white">
                Clear
              </button>
            </div>

            {err && <p className="text-sm text-red-600 mt-3 whitespace-pre-line">{err}</p>}
          </div>
        </aside>

        {/* RIGHT SIDE */}
        <div className="md:col-span-2 space-y-4">
          {/* Preview + Results */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              {/* uploaded image preview */}
              <div className="w-full md:w-1/3 flex flex-col items-center">
                <p className="text-sm text-slate-600 mb-2">Uploaded image</p>

                {imgB64 ? (
                  <img
                    src={previewSrc(imgB64)}
                    alt="uploaded pet"
                    className="w-full h-48 object-cover rounded-lg border border-slate-100"
                  />
                ) : (
                  <div className="w-full h-48 rounded-lg border border-dashed border-slate-200 grid place-items-center text-slate-400">
                    No image uploaded
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <SmallBadge>{animal.toUpperCase()}</SmallBadge>
                  <SmallBadge>{sex.toUpperCase()}</SmallBadge>
                </div>

                <p className="text-xs text-slate-500 mt-2">{fileName}</p>
              </div>

              {/* RESULT PANEL */}
              <div className="flex-1">
                {!res && (
                  <div className="text-sm text-slate-600">
                    <p>
                      Select animal, sex, upload a clear photo and press{" "}
                      <strong>Analyze Image</strong>.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Tip: include affected area for best accuracy.</p>
                  </div>
                )}

                {res && (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">{res.disease}</h3>
                        <p className="text-sm text-slate-600">
                          Probability: {(res.probability * 100).toFixed(0)}%
                        </p>
                      </div>

                      <div className="w-36">
                        <DangerMeter level={res.danger} />
                      </div>
                    </div>

                    {/* remedies */}
                    <div>
                      <h4 className="font-medium">Home remedies</h4>
                      <ul className="list-disc ml-5 text-sm">
                        {res.remedies.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    {/* meds */}
                    <div>
                      <h4 className="font-medium">Suggested meds</h4>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {res.suggested_meds.map((m) => (
                          <span key={m} className="px-3 py-1 bg-slate-100 rounded-full text-sm">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* vet warning */}
                    <div>
                      <h4 className="font-medium">See a vet when</h4>
                      <ul className="list-disc ml-5 text-sm">
                        {res.see_vet_when.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    {/* GRAD-CAM */}
                    {res.gradcam && (
                      <div>
                        <h4 className="font-medium">Heatmap (Grad-CAM)</h4>
                        <img src={res.gradcam} alt="gradcam" className="w-full max-w-xs rounded-lg border mt-2" />
                      </div>
                    )}

                    {/* SEGMENTATION / overlay */}
                    {res.disease_image_b64 && (
                      <div>
                        <h4 className="font-medium">Segmentation / Overlay</h4>
                        <img src={previewSrc(res.disease_image_b64)} className="w-full max-w-xs rounded-lg border mt-2" alt="mask overlay" />
                      </div>
                    )}

                    {/* YOLO boxes */}
                    {res.boxes.length > 0 && (
                      <div>
                        <h4 className="font-medium">Detected Areas</h4>
                        <ul className="list-disc ml-5 text-sm">
                          {res.boxes.map((b, i) => (
                            <li key={i}>
                              Box {i + 1}: ({Math.round(b.x1)}, {Math.round(b.y1)}) → ({Math.round(b.x2)}, {Math.round(b.y2)}) —{" "}
                              {Math.round(b.confidence * 100)}%
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* explanation section */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h4 className="font-medium mb-3">Disease explanation</h4>

            {res ? (
              res.disease_image_b64 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <img src={previewSrc(res.disease_image_b64)} className="rounded-md border h-48 object-cover" alt="example" />
                  <p className="text-sm text-slate-700">{res.disease_description}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-700 mb-3">{res.disease_description}</p>
                  <p className="text-xs text-slate-500">Tip: if the overlay is missing, try a clearer close-up of the affected area.</p>
                </div>
              )
            ) : (
              <p className="text-sm text-slate-600">No example image provided yet. Upload & analyze an image.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
