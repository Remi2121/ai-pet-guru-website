// src/pages/Breed/Breed.jsx
import React, { useState, useEffect } from "react";

/**
 * Breed Explorer page with working "View Details" modal.
 *
 * - Click "View Details" on any card to open a modal with extended info.
 * - Modal is accessible (esc to close, backdrop click to close).
 * - Demo data includes extra fields (size, lifespan, temperament, care).
 *
 * Replace DEMO_BREEDS with your API data later.
 */

const DEMO_BREEDS = [
  {
    id: "golden",
    name: "Golden Retriever",
    origin: "Scotland",
    type: "Dog",
    img: "https://cdn2.thedogapi.com/images/HJ7Pzg5EQ.jpg",
    size: "Large",
    lifespan: "10–12 years",
    temperament: "Friendly, Intelligent, Devoted",
    care: [
      "Daily exercise (walks, play).",
      "Weekly brushing to reduce shedding.",
      "Balanced diet with named meat first."
    ],
  },
  {
    id: "german",
    name: "German Shepherd",
    origin: "Germany",
    type: "Dog",
    img: "https://cdn2.thedogapi.com/images/SJyBfg5NX.jpg",
    size: "Large",
    lifespan: "9–13 years",
    temperament: "Loyal, Courageous, Confident",
    care: [
      "High exercise needs — active owners only.",
      "Early socialization and training.",
      "Regular joint checks as they age."
    ],
  },
  {
    id: "persian",
    name: "Persian Cat",
    origin: "Iran",
    type: "Cat",
    img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS2bfjJR9ZIUi6CSH-GnjiczpazheBUSYa0ag&s",
    size: "Medium",
    lifespan: "12–17 years",
    temperament: "Calm, Affectionate, Quiet",
    care: [
      "Daily brushing to prevent mats.",
      "Keep indoors to avoid respiratory issues.",
      "Regular eye cleaning for tear staining."
    ],
  },
  {
    id: "siamese",
    name: "Siamese Cat",
    origin: "Thailand",
    type: "Cat",
    img: "https://cdn2.thecatapi.com/images/ai6Jps4sx.jpg",
    size: "Medium",
    lifespan: "12–20 years",
    temperament: "Vocal, Social, Intelligent",
    care: [
      "Interactive play and company.",
      "High-quality protein diet.",
      "Routine dental checks."
    ],
  },
];

function Modal({ open, onClose, breed }) {
  // close on ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !breed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* panel */}
      <div className="relative bg-white w-[min(900px,95%)] max-h-[90vh] overflow-auto rounded-2xl shadow-2xl p-6 z-10">
        <div className="flex items-start gap-4">
          <img src={breed.img} alt={breed.name} className="w-48 h-48 object-cover rounded-lg border" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--brand-primary)" }}>
              {breed.name}
            </h2>
            <p className="text-sm text-slate-600 mb-3">{breed.temperament}</p>

            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div><span className="font-medium">Origin:</span> {breed.origin}</div>
              <div><span className="font-medium">Type:</span> {breed.type}</div>
              <div><span className="font-medium">Size:</span> {breed.size}</div>
              <div><span className="font-medium">Lifespan:</span> {breed.lifespan}</div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Care tips</h4>
              <ul className="list-disc ml-5 text-sm space-y-1 mb-4">
                {breed.care.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border shadow-sm"
              >
                Close
              </button>

              <a
                href={`/disease?breed=${encodeURIComponent(breed.name)}`}
                className="px-4 py-2 rounded-lg text-white"
                style={{ background: "var(--brand-primary)" }}
              >
                Check health (Image)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Breed() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // breed object
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = DEMO_BREEDS.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const openDetails = (breed) => {
    setSelected(breed);
    setModalOpen(true);
  };

  const closeDetails = () => {
    setModalOpen(false);
    // small timeout so next modal open gets fresh state if needed
    setTimeout(() => setSelected(null), 200);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
        Breed Explorer
      </h1>
      <p className="text-slate-600 mb-6">
        Search or browse breeds to learn about origins, behavior, and care tips.
      </p>

      <div className="mb-8">
        <input
          type="text"
          placeholder="Search breed..."
          className="w-full max-w-md px-4 py-2 rounded-xl border border-slate-300 shadow-sm
                     focus:ring-2 focus:ring-[color:var(--brand-primary)]/50 focus:outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl shadow hover:shadow-lg transition p-3 flex flex-col">
            <img src={b.img} alt={b.name} className="w-full h-40 object-cover rounded-xl" />

            <div className="mt-3 flex-1">
              <h3 className="text-lg font-semibold">{b.name}</h3>
              <p className="text-sm text-slate-600">Origin: {b.origin}</p>
              <p className="text-sm text-slate-600">Type: {b.type}</p>
            </div>

            <div className="mt-4">
              <button
                onClick={() => openDetails(b)}
                className="w-full px-3 py-2 rounded-xl text-white font-medium"
                style={{ background: "var(--brand-primary)" }}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-slate-500 mt-10">No breeds found matching your search.</p>
      )}

      <Modal open={modalOpen} onClose={closeDetails} breed={selected} />
    </div>
  );
}
