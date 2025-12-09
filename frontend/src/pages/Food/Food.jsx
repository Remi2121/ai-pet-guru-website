// src/pages/Food/Food.jsx
import React, { useState } from "react";

export default function Food() {
  const [mode, setMode] = useState("text"); // text | image
  const [text, setText] = useState("");
  const [imgB64, setImgB64] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- mock AI result ---
  const analyzeFood = async () => {
    if (mode === "text" && !text.trim()) return;
    if (mode === "image" && !imgB64) return;

    setLoading(true);
    setResult(null);

    await new Promise((res) => setTimeout(res, 1200));

    setResult({
      rating: "caution",
      harmful: ["Salt", "Sugar", "Artificial colors"],
      better: ["Royal Canin", "Orijen", "Drools — grain free"],
      daily_qty_g: 180,
    });

    setLoading(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      setImgB64(base64);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: "var(--brand-primary)" }}
      >
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
              ? "bg-[color:var(--brand-primary)] text-white"
              : "bg-white border text-slate-700"
          }`}
        >
          Enter Ingredients
        </button>

        <button
          onClick={() => setMode("image")}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${
            mode === "image"
              ? "bg-[color:var(--brand-primary)] text-white"
              : "bg-white border text-slate-700"
          }`}
        >
          Upload Label Image
        </button>
      </div>

      {/* TEXT MODE */}
      {mode === "text" && (
        <div className="bg-white shadow rounded-2xl p-5 mb-6">
          <label className="font-medium text-sm text-slate-700 mb-2 block">
            Type ingredients:
          </label>
          <textarea
            placeholder="E.g., chicken meal, rice, salt, artificial color..."
            className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[color:var(--brand-primary)]"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}

      {/* IMAGE MODE */}
      {mode === "image" && (
        <div className="bg-white shadow rounded-2xl p-5 mb-6">
          <label className="font-medium text-sm text-slate-700 mb-2 block">
            Upload label image:
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="mb-4"
          />

          {imgB64 ? (
            <img
              src={`data:image/png;base64,${imgB64}`}
              alt="food label"
              className="w-full max-h-64 object-cover rounded-xl border"
            />
          ) : (
            <div className="w-full h-40 border border-dashed rounded-xl grid place-items-center text-slate-400">
              No image uploaded
            </div>
          )}
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={analyzeFood}
        disabled={
          loading ||
          (mode === "text" && !text.trim()) ||
          (mode === "image" && !imgB64)
        }
        className="px-6 py-3 rounded-xl text-white font-medium disabled:bg-slate-300 shadow"
        style={{ background: "var(--brand-primary)" }}
      >
        {loading ? "Analyzing..." : "Analyze Food"}
      </button>

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
              {result.rating.toUpperCase()}
            </span>
          </h3>

          {/* Harmful */}
          <div>
            <h4 className="font-medium">Harmful Ingredients</h4>
            <ul className="list-disc ml-5 text-sm text-slate-700">
              {result.harmful.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>

          {/* Better options */}
          <div>
            <h4 className="font-medium">Better Brands</h4>
            <ul className="list-disc ml-5 text-sm text-slate-700">
              {result.better.map((b) => (
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
