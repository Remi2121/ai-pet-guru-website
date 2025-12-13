// src/pages/Food/Food.jsx
import React, { useState } from "react";

const API_BASE = import.meta?.env?.VITE_API_URL || "http://127.0.0.1:8000";

export default function Food() {
  const [mode, setMode] = useState("text"); // "text" | "image"
  const [animal, setAnimal] = useState("dog"); // "dog" | "cat" | "other"
  const [weight, setWeight] = useState(""); // kg optional
  const [text, setText] = useState("");

  const [imgDataUrl, setImgDataUrl] = useState(null); // store full data URL
  const [fileObj, setFileObj] = useState(null);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeFood = async () => {
    setError("");
    if (mode === "text" && !text.trim()) return;
    if (mode === "image" && !fileObj) return;

    setLoading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append("mode", mode);
      form.append("animal", animal);
      if (weight) form.append("weight_kg", String(weight));
      if (mode === "text") {
        form.append("ingredients", text.trim());
      } else {
        form.append("image", fileObj);
      }

      const res = await fetch(`${API_BASE}/api/food/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        // try to surface a helpful backend message if available
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.detail || j?.message || JSON.stringify(j);
        } catch {
          msg = await res.text();
        }
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message || "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileObj(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      // keep the full data URL so <img src={...}> works reliably
      const dataUrl = reader.result;
      setImgDataUrl(dataUrl);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2 text-(--brand-primary)">
        Food Analyzer
      </h1>

      <p className="text-slate-600 mb-6">
        Upload a food label or enter ingredients manually. We’ll check if it's
        safe and suggest better options.
      </p>

      {/* Mode Switch */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setMode("text")}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${
            mode === "text"
              ? "bg-(--brand-primary) text-white"
              : "bg-white border text-slate-700"
          }`}
        >
          Enter Ingredients
        </button>

        <button
          onClick={() => setMode("image")}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${
            mode === "image"
              ? "bg-(--brand-primary) text-white"
              : "bg-white border text-slate-700"
          }`}
        >
          Upload Label Image
        </button>
      </div>

      {/* Animal + weight */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <label className="block text-sm text-slate-700 mb-1">Pet</label>
          <select
            value={animal}
            onChange={(e) => setAnimal(e.target.value)}
            className="border rounded-xl px-3 py-2"
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-700 mb-1">
            Weight (kg) — optional
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="border rounded-xl px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-(--brand-primary)"
            placeholder="e.g. 8"
          />
        </div>
      </div>

      {/* TEXT MODE */}
      {mode === "text" && (
        <div className="bg-white shadow rounded-2xl p-5 mb-6">
          <label className="font-medium text-sm text-slate-700 mb-2 block">
            Type ingredients:
          </label>
          <textarea
            placeholder="E.g., chicken meal, rice, salt, artificial color..."
            className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-(--brand-primary)"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}

      {/* IMAGE MODE */}
      {mode === "image" && (
        <div className="bg-white shadow rounded-2xl p-5 mb-6">
          <label
            htmlFor="labelUpload"
            className="font-medium text-sm text-slate-700 mb-2 block cursor-pointer hover:text-(--brand-primary) hover:underline hover:decoration-(--brand-primary) transition-colors duration-200"
          >
            Upload label image
          </label>

          <input
            id="labelUpload"
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />

          {/* Clickable preview/drop area */}
          <div
            onClick={() => document.getElementById("labelUpload").click()}
            className="relative w-full rounded-xl border border-dashed border-slate-300 hover:border-(--brand-primary) transition cursor-pointer overflow-hidden"
            style={{ height: "10rem" }} // consistent height
          >
            {imgDataUrl ? (
              // IMPORTANT: contain image inside the box
              <img
                src={imgDataUrl}
                alt="food label"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-slate-400">
                Click or tap to upload an image
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={analyzeFood}
        disabled={
          loading ||
          (mode === "text" && !text.trim()) ||
          (mode === "image" && !imgDataUrl)
        }
        className="px-6 py-3 rounded-xl text-white font-medium disabled:bg-slate-300 shadow"
        style={{ background: "var(--brand-primary)", cursor: "pointer" }}
      >
        {loading ? "Analyzing..." : "Analyze Food"}
      </button>

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}

      {/* RESULT */}
      {result && (
        <div className="mt-10 bg-white shadow rounded-2xl p-6 space-y-5">
          <h3 className="text-xl font-semibold mb-2">
            Result:{" "}
            <span
              className={
                result.rating === "good"
                  ? "text-green-600"
                  : result.rating === "bad"
                  ? "text-red-600"
                  : "text-yellow-600"
              }
            >
              {result.rating?.toUpperCase()}
            </span>
          </h3>

          {result.source?.from === "image" && (
            <p className="text-xs text-slate-500">
              {result.source?.ocr_text
                ? "Extracted ingredients from image using AI OCR."
                : "Analyzed photo contents with AI vision (no readable label)."}
            </p>
          )}

          {/* Vision items table */}
          {!!result.source?.vision_items?.length && (
            <div>
              <h4 className="font-medium mb-2">Foods detected in photo</h4>
              <div className="overflow-x-auto border rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-left p-3">Grams</th>
                      <th className="text-left p-3">kcal/g</th>
                      <th className="text-left p-3">Est. kcal</th>
                      <th className="text-left p-3">Pet-safe?</th>
                      <th className="text-left p-3">Flag</th>
                      <th className="text-left p-3">Suggestion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.source.vision_items.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3 capitalize">{r.name}</td>
                        <td className="p-3">{r.grams ?? "—"}</td>
                        <td className="p-3">{r.kcal_g}</td>
                        <td className="p-3">{r.est_kcal}</td>
                        <td className="p-3">{r.pet_ok ? "✅" : "❌"}</td>
                        <td className="p-3">{r.flag}</td>
                        <td className="p-3">{r.suggestion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ingredients list used */}
          {!!result.ingredients?.length && (
            <div>
              <h4 className="font-medium">Detected Ingredients</h4>
              <ul className="list-disc ml-5 text-sm text-slate-700">
                {result.ingredients.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Harmful from label text */}
          <div>
            <h4 className="font-medium">Harmful / flagged from label</h4>
            {result.harmful?.length ? (
              <ul className="list-disc ml-5 text-sm text-slate-700">
                {result.harmful.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">
                No high-risk items found in text.
              </p>
            )}
          </div>

          {/* Better options */}
          <div>
            <h4 className="font-medium">Better Brands</h4>
            <ul className="list-disc ml-5 text-sm text-slate-700">
              {result.better?.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>

          {/* Quantity */}
          <div>
            <h4 className="font-medium">Recommended Daily Quantity</h4>
            <p className="text-slate-700">{result.daily_qty_g} g per day</p>
          </div>
        </div>
      )}
    </div>
  );
}
