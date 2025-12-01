// src/pages/Disease/Disease.jsx
import { useState } from "react";
import UploadBox from "../../components/UploadBox/UploadBox";
import DangerMeter from "../../components/DangerMeter/DangerMeter";

const ANIMALS = [
  { id: "dog", label: "Dog" },
  { id: "cat", label: "Cat" },
  { id: "rabbit", label: "Rabbit" },
  {id: "cow", label: "Cow" },
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
  const [imgB64, setImgB64] = useState(null); // store data URL (data:image/..;base64,...)
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  // analyze (mock) — replace with backend call later if needed
  const analyze = async () => {
    if (!imgB64) {
      setErr("Please upload a clear photo first.");
      return;
    }
    setErr(null);
    setLoading(true);
    setRes(null);

    await new Promise((r) => setTimeout(r, 900)); // simulate work

    // mock result tuned by animal selection
    const mock = {
      disease:
        animal === "dog"
          ? "Allergic Dermatitis"
          : animal === "cat"
          ? "Feline Skin Irritation"
          : "Skin Irritation",
      probability: animal === "fish" ? 0.55 : 0.82,
      danger: animal === "horse" ? "medium" : "low",
      remedies: ["Gently clean area with saline", "Prevent licking", "Keep area dry"],
      suggested_meds: animal === "cat" ? ["Cat-safe topical"] : ["Soothing ointment"],
      see_vet_when: ["Swelling increases", "Bleeding", "Pet appears in pain"],
      disease_image_b64: null,
      disease_description:
        "This is a mock diagnosis for UI testing. Consult your vet for professional diagnosis.",
    };

    setRes(mock);
    setLoading(false);
  };

  const clearAll = () => {
    setImgB64(null);
    setFileName("");
    setRes(null);
    setErr(null);
  };

  const goodOptionsFor = (animalType) => {
    if (animalType === "dog") {
      return ["Balanced kibble with named meat first.", "Monthly flea/tick prevention.", "Daily walks & play."];
    }
    if (animalType === "cat") {
      return ["High-protein wet food.", "Clean litter & scratch posts.", "Indoor enrichment."];
    }
    if (animalType === "rabbit") return ["High-fiber hay; fresh greens; clean hutch."];
    if (animalType === "fish") return ["Clean water; correct temperature; proper diet."];
    return ["Species-appropriate food.", "Clean bedding.", "Calm environment."];
  };

  const previewSrc = (b64) => {
    if (!b64) return null;
    if (typeof b64 !== "string") return null;
    if (b64.startsWith("data:")) return b64;
    return `data:image/png;base64,${b64}`;
  };

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h2 className="text-3xl font-semibold" style={{ color: "var(--brand-primary)" }}>
          AI Disease Detector
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Choose animal & sex, upload a clear photo (affected area or whole pet). Results are mock until backend is connected.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Controls */}
        <aside className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">Which animal?</label>
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

          <div className="bg-white rounded-2xl shadow p-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">Upload pet image</label>

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
                style={{ background: !imgB64 || loading ? undefined : "var(--brand-primary)" }}
              >
                {loading ? "Analyzing…" : "Analyze Image"}
              </button>

              <button onClick={clearAll} className="px-4 py-2 rounded-xl border bg-white">
                Clear
              </button>
            </div>

            {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h4 className="font-medium text-sm mb-3">Good options</h4>
            <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">
              {goodOptionsFor(animal).map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Right: preview + results */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              {/* Uploaded image preview */}
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

              {/* Result panel */}
              <div className="flex-1">
                {!res && (
                  <div className="text-sm text-slate-600">
                    <p>Select animal, sex, upload a clear photo and press <strong>Analyze Image</strong>.</p>
                    <p className="mt-2 text-xs text-slate-500">Tip: include the affected area when possible for better results.</p>
                  </div>
                )}

                {res && (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">{res.disease}</h3>
                        <p className="text-sm text-slate-600">Probability: {(res.probability * 100).toFixed(0)}%</p>
                      </div>

                      <div className="w-36">
                        <DangerMeter level={res.danger} />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium">Home remedies</h4>
                      <ul className="list-disc ml-5 text-sm text-slate-700">
                        {res.remedies.map((r) => <li key={r}>{r}</li>)}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium">Suggested meds (general)</h4>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {res.suggested_meds.map((m) => (
                          <span key={m} className="px-3 py-1 bg-slate-100 rounded-full text-sm">{m}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium">See a vet when</h4>
                      <ul className="list-disc ml-5 text-sm text-slate-700">
                        {res.see_vet_when.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h4 className="font-medium mb-3">Disease explanation</h4>

            {res?.disease_image_b64 ? (
              <div className="grid md:grid-cols-2 gap-4">
                <img src={previewSrc(res.disease_image_b64)} className="rounded-md border h-48 object-cover" alt="example" />
                <p className="text-sm text-slate-700">{res.disease_description}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">No example image provided. Your uploaded photo is used instead.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
