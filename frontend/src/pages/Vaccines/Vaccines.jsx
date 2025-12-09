// src/pages/Vaccines/Vaccines.jsx
import React, { useEffect, useState } from "react";

/**
 * Vaccines page (local-only, persists using localStorage)
 *
 * - Reads from localStorage using lazy initializer (no setState inside mount effect)
 * - Persists entries on change
 * - Add / Edit / Delete / Mark done / Export .txt
 */

const STORAGE_KEY = "ai_pet_guru_vaccines_v1";

const DEMO_RECOMMENDED = [
  { id: "d1", name: "Core vaccine: Rabies", dueInWeeks: 12, note: "Single dose; booster per local rules" },
  { id: "d2", name: "DHPP / Distemper Combo", dueInWeeks: 8, note: "Primary series—repeat per vet guidance" },
  { id: "d3", name: "Bordetella (Kennel cough)", dueInWeeks: 16, note: "Optional; recommended for boarding" },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function formatDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function humanDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString();
}

export default function Vaccines() {
  // Lazy initial state: read from localStorage synchronously during initial render.
  const [entries, setEntries] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to parse vaccine storage:", e);
      return [];
    }
  });

  const [form, setForm] = useState({ name: "", dueDate: "", notes: "" });
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all"); // all | upcoming | done | pending
  const [demoUsed, setDemoUsed] = useState(false);

  // Persist whenever entries change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error("Failed to write vaccine storage:", e);
    }
  }, [entries]);

  const addDemoRecommended = () => {
    const today = new Date();
    const demoEntries = DEMO_RECOMMENDED.map((d) => {
      const due = new Date(today);
      due.setDate(today.getDate() + (d.dueInWeeks || 0) * 7);
      return {
        id: uid(),
        name: d.name,
        dueDate: due.toISOString(),
        notes: d.note,
        done: false,
        createdAt: new Date().toISOString(),
      };
    });
    setEntries((s) => [...demoEntries, ...s]);
    setDemoUsed(true);
  };

  const handleAddOrUpdate = (e) => {
    e?.preventDefault();
    if (!form.name.trim() || !form.dueDate) return alert("Please provide a name and due date.");
    if (editingId) {
      setEntries((s) => s.map((it) => (it.id === editingId ? { ...it, ...form } : it)));
      setEditingId(null);
    } else {
      const newEntry = {
        id: uid(),
        name: form.name.trim(),
        dueDate: new Date(form.dueDate).toISOString(),
        notes: form.notes || "",
        done: false,
        createdAt: new Date().toISOString(),
      };
      setEntries((s) => [newEntry, ...s]);
    }
    setForm({ name: "", dueDate: "", notes: "" });
  };

  const handleEdit = (id) => {
    const it = entries.find((e) => e.id === id);
    if (!it) return;
    setEditingId(id);
    setForm({ name: it.name, dueDate: formatDateInput(it.dueDate), notes: it.notes ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleDone = (id) => {
    setEntries((s) => s.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  };

  const handleDelete = (id) => {
    if (!confirm("Delete this vaccine entry?")) return;
    setEntries((s) => s.filter((it) => it.id !== id));
  };

  const upcoming = entries
    .filter((e) => !e.done)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  const filtered = entries.filter((e) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return !e.done && new Date(e.dueDate) >= new Date();
    if (filter === "done") return e.done;
    if (filter === "pending") return !e.done;
    return true;
  });

  const exportAsTxt = () => {
    let txt = "AI Pet Guru — Vaccine Schedule\n\n";
    entries.forEach((e) => {
      txt += `Name: ${e.name}\nDue: ${humanDate(e.dueDate)}\nStatus: ${e.done ? "Done" : "Pending"}\nNotes: ${e.notes || "-"}\n\n`;
    });
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vaccines-schedule.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>Vaccination Planner</h1>
        <p className="text-slate-600 mt-1">Keep track of vaccine due dates, mark completed doses, and export your schedule.</p>
      </div>

      {/* Top form */}
      <form onSubmit={handleAddOrUpdate} className="bg-white rounded-2xl p-5 shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="text-sm text-slate-700 font-medium">Vaccine name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g., Rabies, DHPP"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
          />
        </div>

        <div>
          <label className="text-sm text-slate-700 font-medium">Due date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-sm text-slate-700 font-medium">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Any reminders (vet name, location, batch number)..."
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
            rows={2}
          />
        </div>

        <div className="md:col-span-3 flex gap-3 justify-end">
          {editingId ? (
            <button type="button" onClick={() => { setEditingId(null); setForm({ name: "", dueDate: "", notes: "" }); }} className="px-4 py-2 rounded-xl border">Cancel</button>
          ) : null}

          <button type="submit" className="px-4 py-2 rounded-xl text-white" style={{ background: "var(--brand-primary)" }}>
            {editingId ? "Update entry" : "Add vaccine"}
          </button>
        </div>
      </form>

      {/* Quick actions & upcoming list */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-2 items-center">
          <button onClick={addDemoRecommended} disabled={demoUsed} className="px-3 py-2 rounded-lg border bg-white">Add recommended schedule</button>
          <button onClick={() => { setEntries([]); localStorage.removeItem(STORAGE_KEY); }} className="px-3 py-2 rounded-lg border">Clear all</button>
          <button onClick={exportAsTxt} className="px-3 py-2 rounded-lg border bg-white">Export .txt</button>
        </div>

        <div className="text-sm text-slate-600">
          Upcoming:{" "}
          {upcoming.length ? upcoming.map((u) => <span key={u.id} className="inline-block ml-2 px-2 py-1 rounded-full bg-slate-100 text-xs">{u.name} — {humanDate(u.dueDate)}</span>)
            : <span className="text-slate-500 ml-2">No upcoming vaccines</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {["all","upcoming","pending","done"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-lg ${filter===f ? "ring-1 ring-[color:var(--brand-primary)]/30 bg-[color:var(--brand-primary)]/10" : "bg-white border"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="grid gap-4">
        {filtered.length === 0 && <div className="text-slate-500 p-6 bg-white rounded-2xl">No vaccine records yet. Add or use recommended schedule above.</div>}

        {filtered.map((e) => (
          <div key={e.id} className="bg-white p-4 rounded-2xl shadow flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">{e.name}</div>
                  <div className="text-sm text-slate-600">Due: <strong>{humanDate(e.dueDate)}</strong></div>
                </div>

                <div className="text-sm">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${e.done ? "bg-green-100 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {e.done ? "Done" : "Pending"}
                  </div>
                </div>
              </div>

              {e.notes && <div className="mt-2 text-sm text-slate-700">{e.notes}</div>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleToggleDone(e.id)} className="px-3 py-2 rounded-lg border">
                {e.done ? "Mark Pending" : "Mark Done"}
              </button>
              <button onClick={() => handleEdit(e.id)} className="px-3 py-2 rounded-lg border">Edit</button>
              <button onClick={() => handleDelete(e.id)} className="px-3 py-2 rounded-lg border text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
