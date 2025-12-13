import React, { useEffect, useRef, useState } from "react";
import { searchAnyPet } from "../../lib/breedProviders";

// small debounce
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t.current);
  }, [value, ms]);
  return v;
}

export default function Breed() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const debounced = useDebounced(search, 350);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setErr("");
      // empty -> show a few popular defaults
      if (!debounced.trim()) {
        setItems([
          { id: "dog_demo", name: "Golden Retriever", type: "Dog", origin: "Scotland", img: "https://cdn2.thedogapi.com/images/HJ7Pzg5EQ.jpg", size: "Large", lifespan: "10–12 years", temperament: "Friendly, Intelligent, Devoted", care: ["Daily exercise.", "Weekly brushing.", "Balanced diet."] },
          { id: "cat_demo", name: "Persian Cat", type: "Cat", origin: "Iran", img: "https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg", size: "Medium", lifespan: "12–17 years", temperament: "Calm, Affectionate, Quiet", care: ["Daily brushing.", "Indoor care.", "Eye cleaning."] },
          { id: "rabbit_demo", name: "Holland Lop", type: "Rabbit", origin: "Netherlands", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQjFP8pxQPiX1TxFoKrBn4C__cz5IZ_CXTDsQ&s", size: "Small", lifespan: "7–10 years", temperament: "Gentle, Curious", care: ["Hay-based diet.", "Chew toys.", "Gentle handling."] },
          { id: "bird_demo", name: "Budgerigar", type: "Bird", origin: "Australia", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Detail_shot_of_budgerigars_head.jpg/560px-Detail_shot_of_budgerigars_head.jpg", size: "Small", lifespan: "5–10 years", temperament: "Social, Vocal", care: ["Spacious cage.", "Perches & toys.", "Daily interaction."] },
        ]);
        return;
      }

      setLoading(true);
      try {
        const res = await searchAnyPet(debounced);
        if (!cancelled) {
          setItems(res);
          if (res.length === 0) setErr("No pets found. Try a different spelling (e.g., 'budgerigar' or 'budgie').");
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debounced]);

  const openDetails = (b) => { setSelected(b); setOpen(true); };
  const closeDetails = () => { setOpen(false); setTimeout(() => setSelected(null), 200); };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2 text-[var(--brand-primary)]">Breed / Pet Explorer</h1>
      <p className="text-slate-600 mb-6">
        Type any pet or breed (e.g., husky, ragdoll, holland lop, budgie, leopard gecko).
      </p>

      <div className="mb-6 flex items-center gap-3">
        <input
          type="text"
          className="w-full max-w-md px-4 py-2 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-[var(--brand-primary)] focus:outline-none"
          placeholder="Search any pet or breed…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading && <span className="text-sm text-slate-500">Searching…</span>}
      </div>

      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl shadow hover:shadow-lg transition p-3 flex flex-col">
            <img src={b.img} alt={b.name} className="w-full h-40 object-cover rounded-xl" />
            <div className="mt-3 flex-1">
              <h3 className="text-lg font-semibold">{b.name}</h3>
              <p className="text-sm text-slate-600">Type: {b.type}</p>
              {b.origin && <p className="text-sm text-slate-600">Origin: {b.origin}</p>}
            </div>
            <button
              onClick={() => openDetails(b)}
              className="mt-4 w-full px-3 py-2 rounded-xl text-white font-medium"
              style={{ background: "var(--brand-primary)" }}
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {open && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetails} />
          <div className="relative bg-white w-[min(900px,95%)] max-h-[90vh] overflow-auto rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-start gap-4">
              <img src={selected.img} alt={selected.name} className="w-48 h-48 object-cover rounded-lg border" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1 text-[var(--brand-primary)]">{selected.name}</h2>
                <p className="text-sm text-slate-600 mb-3">{selected.temperament || "—"}</p>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div><span className="font-medium">Type:</span> {selected.type}</div>
                  <div><span className="font-medium">Origin:</span> {selected.origin || "—"}</div>
                  <div><span className="font-medium">Size:</span> {selected.size || "—"}</div>
                  <div><span className="font-medium">Lifespan:</span> {selected.lifespan || "—"}</div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Care tips</h4>
                  <ul className="list-disc ml-5 text-sm space-y-1 mb-4">
                    {(selected.care || []).map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button onClick={closeDetails} className="px-4 py-2 rounded-lg border shadow-sm">Close</button>
                  <a
                    href={`/disease?breed=${encodeURIComponent(selected.name)}`}
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
      )}
    </div>
  );
}
