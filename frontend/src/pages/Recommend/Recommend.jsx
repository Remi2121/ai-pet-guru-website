import React, { useState, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const FALLBACK = (name) =>
  `https://picsum.photos/seed/${encodeURIComponent((name || "pet").toLowerCase())}/900/600`;

export default function Recommend() {
  const [form, setForm] = useState({
    name: "",
    house: "",
    budget: "",
    lifestyle: "",
    allergies: "no",
    time: "",
  });
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const getRecs = async () => {
    setErr("");
    if (!form.house || !form.budget || !form.lifestyle || !form.time) {
      alert("Please fill all required fields.");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const fd = new FormData();
      fd.append("house", String(form.house));
      fd.append("budget", String(form.budget));
      fd.append("lifestyle", String(form.lifestyle));
      fd.append("allergies", String(form.allergies));
      fd.append("time", String(form.time));
      if (form.name) fd.append("name", String(form.name));
      if (file) fd.append("image", file);

      const res = await fetch(`${API_BASE}/api/recommend`, { method: "POST", body: fd });
      if (!res.ok) {
        let msg = "Server error";
        try { const j = await res.json(); msg = j?.detail || JSON.stringify(j); } catch { /* empty */ }
        setErr(msg); alert(msg); return;
      }
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      console.error(e);
      setErr("Network/Server error");
    } finally {
      setLoading(false);
    }
  };

  const onPickImage = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const safeImg = (url, name) => {
    const u = (url || "").trim();
    return u.length ? u : FALLBACK(name);
    // onError also swaps to a seeded fallback
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--brand-primary)" }}>
        Pet Recommendation
      </h1>
      <p className="text-slate-600 mb-8 text-sm">
        Answer a few questions and AI will suggest the best pets for your lifestyle.
      </p>

      <div className="bg-white rounded-2xl shadow p-6 space-y-5 mb-10">
        <div>
          <label className="text-sm font-medium text-slate-700">Your name</label>
          <input
            value={form.name}
            onChange={(e) => handle("name", e.target.value)}
            placeholder="e.g., Remi"
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Optional: upload a home photo</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPickImage}
              className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
            {file && <span className="text-xs text-slate-500">{file.name}</span>}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">House size *</label>
          <select value={form.house} onChange={(e) => handle("house", e.target.value)} className="w-full mt-2 px-3 py-2 border rounded-lg">
            <option value="">Select</option>
            <option value="small">Small (Apartment)</option>
            <option value="medium">Medium Home</option>
            <option value="large">Large House / Yard</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Monthly budget (₹) *</label>
          <input
            type="number"
            value={form.budget}
            onChange={(e) => handle("budget", e.target.value)}
            placeholder="Your monthly budget for pet care"
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Your lifestyle *</label>
          <select value={form.lifestyle} onChange={(e) => handle("lifestyle", e.target.value)} className="w-full mt-2 px-3 py-2 border rounded-lg">
            <option value="">Select</option>
            <option value="active">Active (Outdoor / Exercise)</option>
            <option value="balanced">Balanced</option>
            <option value="calm">Calm / Indoor</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Pet hair allergy?</label>
          <select value={form.allergies} onChange={(e) => handle("allergies", e.target.value)} className="w-full mt-2 px-3 py-2 border rounded-lg">
            <option value="no">No</option>
            <option value="yes">Yes (Hypoallergenic pets only)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Daily time you can give *</label>
          <select value={form.time} onChange={(e) => handle("time", e.target.value)} className="w-full mt-2 px-3 py-2 border rounded-lg">
            <option value="">Select</option>
            <option value="low">Less than 1 hour</option>
            <option value="medium">1–3 hours</option>
            <option value="high">3+ hours</option>
          </select>
        </div>

        <button
          onClick={getRecs}
          disabled={loading}
          className="w-full px-4 py-3 rounded-xl text-white font-medium"
          style={{ background: "var(--brand-primary)", cursor: "pointer" }}
        >
          {loading ? "Finding best pets..." : "Get Recommendations"}
        </button>

        {err && <div className="text-red-600 text-sm">{err}</div>}
      </div>

      <h2 className="text-xl font-semibold mb-3">
        {form.name ? `Top Matches for ${form.name}` : "Top Matches"}
      </h2>

      {!results.length && !loading && (
        <p className="text-slate-500">Fill the form to get your personalized pet suggestions.</p>
      )}

      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-4 animate-pulse">
              <div className="w-full h-44 bg-slate-200 rounded-xl" />
              <div className="h-4 bg-slate-200 rounded mt-4 w-3/5" />
              <div className="h-3 bg-slate-200 rounded mt-2 w-2/3" />
              <div className="h-3 bg-slate-200 rounded mt-2 w-4/5" />
              <div className="h-9 bg-slate-200 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {results.map((r, idx) => (
          <div key={`${r.pet}-${idx}`} className="bg-white rounded-xl shadow hover:shadow-lg transition p-4">
            <img
              src={safeImg(r.img, r.pet)}
              referrerPolicy="no-referrer"
              loading="lazy"
              className="w-full h-44 object-cover rounded-xl"
              alt={r.pet}
              onError={(e) => {
                const next = FALLBACK(`${r.pet}-err-${idx}`);
                if (e.currentTarget.src !== next) e.currentTarget.src = next;
              }}
            />
            <h3 className="font-semibold text-lg mt-3">{r.pet}</h3>
            <p className="text-sm text-slate-600">Monthly cost: {r.monthly_cost}</p>
            <p className="text-sm text-slate-700 mt-2">{r.reason}</p>
            {r.hypoallergenic && (
              <span className="inline-block mt-2 text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">
                Hypoallergenic
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
