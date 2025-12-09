// src/pages/Lost/Lost.jsx
import React, { useState } from "react";

export default function Lost() {
  const [imgB64, setImgB64] = useState(null);
  const [fileName, setFileName] = useState("");
  const [petName, setPetName] = useState("");
  const [color, setColor] = useState("");
  const [location, setLocation] = useState("");
  const [lastSeen, setLastSeen] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      setImgB64(base64);
      setFileName(file.name);
      setResults([]);
    };
    reader.readAsDataURL(file);
  };

  // Mock AI search
  const findMatches = async () => {
    if (!imgB64) {
      alert("Upload a pet image first.");
      return;
    }

    setLoading(true);
    setResults([]);

    await new Promise((r) => setTimeout(r, 1200));

    // Mock “similar pets” response
    setResults([
      {
        id: 1,
        img: "https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg",
        similarity: 92,
        desc: "Found near Market Street, looks similar to your pet.",
      },
      {
        id: 2,
        img: "https://images.pexels.com/photos/5255215/pexels-photo-5255215.jpeg",
        similarity: 87,
        desc: "Seen in a nearby park two days ago.",
      },
    ]);

    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: "var(--brand-primary)" }}
      >
        Lost Pet Finder
      </h1>

      <p className="text-slate-600 mb-6">
        Upload your pet’s photo and details. We’ll search for visually similar pets and possible sightings nearby.
      </p>

      {/* Upload + Form */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {/* Upload section */}
        <div className="bg-white rounded-2xl shadow p-4">
          <label className="font-medium text-sm text-slate-700 mb-2 block">
            Upload your pet image
          </label>

          <input type="file" accept="image/*" onChange={handleFile} />

          <div className="mt-4">
            {imgB64 ? (
              <img
                src={`data:image/png;base64,${imgB64}`}
                className="w-full h-64 object-cover rounded-xl border"
                alt="pet upload"
              />
            ) : (
              <div className="w-full h-48 border border-dashed rounded-xl grid place-items-center text-slate-400">
                No image selected
              </div>
            )}
          </div>

          {fileName && (
            <p className="text-xs text-slate-500 mt-2">{fileName}</p>
          )}
        </div>

        {/* Details form */}
        <div className="bg-white rounded-2xl shadow p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Pet name (optional)
            </label>
            <input
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="e.g., Bruno"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Color / markings
            </label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g., brown & white"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Last seen location
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Colombo bus stand"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Last seen date
            </label>
            <input
              type="date"
              value={lastSeen}
              onChange={(e) => setLastSeen(e.target.value)}
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <button
            onClick={findMatches}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-white w-full mt-3"
            style={{ background: "var(--brand-primary)" }}
          >
            {loading ? "Searching…" : "Find Matches"}
          </button>
        </div>
      </div>

      {/* Results */}
      <h2 className="text-xl font-semibold mb-3">Possible matches</h2>

      {loading && <p className="text-slate-500">Searching nearby sightings…</p>}

      {!loading && results.length === 0 && (
        <p className="text-slate-500">No matches yet. Upload an image and search.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-6 mt-4">
        {results.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-xl shadow p-3 hover:shadow-lg transition"
          >
            <img
              src={r.img}
              className="w-full h-52 object-cover rounded-lg"
              alt="match"
            />

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{r.similarity}% match</h3>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                  Possible
                </span>
              </div>

              <p className="text-sm text-slate-600 mt-2">{r.desc}</p>

              <button
                className="mt-3 w-full px-3 py-2 rounded-xl text-white"
                style={{ background: "var(--brand-primary)" }}
              >
                Contact Finder
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
