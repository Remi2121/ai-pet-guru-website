// src/pages/Vaccines/Vaccines.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../../../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/**
 * Vaccines page (per-user Firestore)
 * Path: users/{uid}/vaccines/{docId}
 */


function formatDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}
function humanDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString();
}

export default function Vaccines() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [entries, setEntries] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState({
    name: "",
    dueDate: "",
    notes: "",
    vet: "",
    location: "",
    batch: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all"); // all | upcoming | done | pending
  const [demoUsed, setDemoUsed] = useState(false);
  const [openDetail, setOpenDetail] = useState(null);

  const formRef = useRef(null);
  const nameInputRef = useRef(null);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  // Subscribe per user
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntries([]);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    const colRef = collection(db, "users", user.uid, "vaccines");
    const qy = query(colRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            notes: data.notes || "",
            vet: data.vet || "",
            location: data.location || "",
            batch: data.batch || "",
            done: !!data.done,
            createdAt: data.createdAt?.toDate?.() ?? null,
            dueDate:
              data.dueDate instanceof Timestamp
                ? data.dueDate.toDate()
                : data.dueDate
                ? new Date(data.dueDate)
                : null,
          };
        });
        setEntries(list);
        setLoadingData(false);
      },
      (err) => {
        console.error("onSnapshot error:", err);
        setLoadingData(false);
        alert(err?.message || "Failed to load vaccines");
      }
    );
    return () => unsub();
  }, [user]);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => nameInputRef.current?.focus(), 300);
  };

  const addDemoRecommended = async () => {
    try {
      if (!user) return alert("Please login to add schedule.");
      const today = new Date();
      const colRef = collection(db, "users", user.uid, "vaccines");
      await Promise.all(
        // eslint-disable-next-line no-undef
        DEMO_RECOMMENDED.map((d) => {
          const due = new Date(today);
          due.setDate(today.getDate() + (d.dueInWeeks || 0) * 7);
          return addDoc(colRef, {
            name: d.name,
            dueDate: Timestamp.fromDate(due),
            notes: d.note || "",
            vet: "",
            location: "",
            batch: "",
            done: false,
            createdAt: serverTimestamp(),
          });
        })
      );
      setDemoUsed(true);
    } catch (err) {
      console.error("addDemoRecommended failed:", err);
      alert(err?.message || "Failed to add demo schedule");
    }
  };

  const handleAddOrUpdate = async (e) => {
    e?.preventDefault();
    if (!user) return alert("Please login first.");
    if (!form.name.trim() || !form.dueDate) return alert("Please provide a name and due date.");

    try {
      const colRef = collection(db, "users", user.uid, "vaccines");
      const payload = {
        name: form.name.trim(),
        dueDate: Timestamp.fromDate(new Date(form.dueDate)),
        notes: form.notes || "",
        vet: form.vet || "",
        location: form.location || "",
        batch: form.batch || "",
      };

      if (editingId) {
        await updateDoc(doc(colRef, editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(colRef, { ...payload, done: false, createdAt: serverTimestamp() });
      }
      setForm({ name: "", dueDate: "", notes: "", vet: "", location: "", batch: "" });
    } catch (err) {
      console.error("Save failed:", err);
      alert(err?.message || "Failed to save");
    }
  };

  const handleEdit = (id) => {
    const it = entries.find((e) => e.id === id);
    if (!it) return;
    setEditingId(id);
    setForm({
      name: it.name,
      dueDate: formatDateInput(it.dueDate),
      notes: it.notes ?? "",
      vet: it.vet ?? "",
      location: it.location ?? "",
      batch: it.batch ?? "",
    });
    scrollToForm();
  };

  const handleToggleDone = async (id) => {
    try {
      if (!user) return;
      const it = entries.find((e) => e.id === id);
      if (!it) return;
      const colRef = collection(db, "users", user.uid, "vaccines");
      await updateDoc(doc(colRef, id), { done: !it.done });
    } catch (err) {
      console.error("Toggle failed:", err);
      alert(err?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    try {
      if (!user) return;
      if (!confirm("Delete this vaccine entry?")) return;
      const colRef = collection(db, "users", user.uid, "vaccines");
      await deleteDoc(doc(colRef, id));
      if (openDetail === id) setOpenDetail(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert(err?.message || "Failed to delete");
    }
  };

  const upcoming = useMemo(
    () =>
      entries
        .filter((e) => !e.done && e.dueDate)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 3),
    [entries]
  );

  const filtered = useMemo(() => {
    const now = new Date();
    return entries.filter((e) => {
      if (filter === "all") return true;
      if (filter === "upcoming") return !e.done && e.dueDate && new Date(e.dueDate) >= now;
      if (filter === "done") return e.done;
      if (filter === "pending") return !e.done;
      return true;
    });
  }, [entries, filter]);

  const exportAsTxt = () => {
    let txt = "AI Pet Guru — Vaccine Schedule\n\n";
    entries.forEach((e) => {
      txt += `Name: ${e.name}\nDue: ${humanDate(e.dueDate)}\nStatus: ${e.done ? "Done" : "Pending"}\nVet: ${e.vet || "-"}\nLocation: ${e.location || "-"}\nBatch: ${e.batch || "-"}\nNotes: ${e.notes || "-"}\n\n`;
    });
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vaccines-schedule.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingUser || loadingData) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-slate-600">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>
          Vaccination Planner
        </h1>
        <p className="mt-2 text-slate-600">
          Please <span className="font-semibold">log in</span> to manage your pet’s vaccines. (Ovvoru user-kku
          thani data save aagum 🔒)
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 relative">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>Vaccination Planner</h1>
        <p className="text-slate-600 mt-1">Track due dates, mark doses, and export (saved to your account).</p>
      </div>

      {/* Top form */}
      <form
        ref={formRef}
        onSubmit={handleAddOrUpdate}
        className="bg-white rounded-2xl p-5 shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
      >
        <div className="md:col-span-2">
          <label className="text-sm text-slate-700 font-medium">Vaccine name</label>
          <input
            ref={nameInputRef}
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

        {/* Extra details */}
        <div>
          <label className="text-sm text-slate-700 font-medium">Vet name (optional)</label>
          <input
            value={form.vet}
            onChange={(e) => setForm((s) => ({ ...s, vet: e.target.value }))}
            placeholder="Dr. Priya"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
          />
        </div>
        <div>
          <label className="text-sm text-slate-700 font-medium">Location (optional)</label>
          <input
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
            placeholder="Happy Paws Clinic, Jaffna"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
          />
        </div>
        <div>
          <label className="text-sm text-slate-700 font-medium">Batch no. (optional)</label>
          <input
            value={form.batch}
            onChange={(e) => setForm((s) => ({ ...s, batch: e.target.value }))}
            placeholder="RBX-18"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-sm text-slate-700 font-medium">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Any reminders (follow-up, reactions, etc.)…"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
            rows={2}
          />
        </div>

        <div className="md:col-span-3 flex gap-3 justify-end">
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", dueDate: "", notes: "", vet: "", location: "", batch: "" });
              }}
              className="px-4 py-2 rounded-xl border cursor-pointer"
            >
              Cancel
            </button>
          ) : null}

          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--brand-primary)" }}
          >
            {editingId ? "Update entry" : "Add vaccine"}
          </button>
        </div>
      </form>

      {/* Quick actions & upcoming list */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-2 items-center">
          <button
            onClick={addDemoRecommended}
            disabled={demoUsed}
            className="px-3 py-2 rounded-lg border bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add recommended schedule
          </button>
          <button
            onClick={async () => {
              try {
                if (!confirm("Clear all vaccines for your account?")) return;
                const promises = entries.map((e) =>
                  deleteDoc(doc(collection(db, "users", user.uid, "vaccines"), e.id))
                );
                await Promise.all(promises);
              } catch (err) {
                console.error("Clear all failed:", err);
                alert(err?.message || "Failed to clear");
              }
            }}
            className="px-3 py-2 rounded-lg border cursor-pointer"
          >
            Clear all
          </button>
          <button
            onClick={exportAsTxt}
            className="px-3 py-2 rounded-lg border bg-white cursor-pointer"
          >
            Export .txt
          </button>
        </div>

        <div className="text-sm text-slate-600">
          Upcoming:
          {upcoming.length ? (
            upcoming.map((u) => (
              <span key={u.id} className="inline-block ml-2 px-2 py-1 rounded-full bg-slate-100 text-xs">
                {u.name} — {humanDate(u.dueDate)}
              </span>
            ))
          ) : (
            <span className="text-slate-500 ml-2">No upcoming vaccines</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {["all", "upcoming", "pending", "done"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg cursor-pointer ${
              filter === f
                ? "ring-1 ring-(--brand-primary)/30 bg-(--brand-primary)/10"
                : "bg-white border"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="text-slate-600 p-6 bg-white rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="font-semibold">No vaccine records yet.</div>
              <div className="text-sm">Start by adding your first vaccine below.</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={scrollToForm}
                className="px-3 py-2 rounded-lg text-white cursor-pointer"
                style={{ background: "var(--brand-primary)" }}
              >
                ➕ Add your first vaccine
              </button>
              <button
                onClick={addDemoRecommended}
                disabled={demoUsed}
                className="px-3 py-2 rounded-lg border bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use recommended
              </button>
            </div>
          </div>
        ) : null}

        {filtered.map((e) => {
          const expanded = openDetail === e.id;
          return (
            <div key={e.id} className="bg-white p-4 rounded-2xl shadow">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">{e.name}</div>
                      <div className="text-sm text-slate-600">
                        Due: <strong>{humanDate(e.dueDate)}</strong>
                      </div>
                    </div>

                    <div className="text-sm shrink-0">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                          e.done ? "bg-green-100 text-green-700" : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {e.done ? "Done" : "Pending"}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  {expanded && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="text-slate-500">Vet</div>
                        <div className="font-medium">{e.vet || "-"}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="text-slate-500">Location</div>
                        <div className="font-medium">{e.location || "-"}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="text-slate-500">Batch</div>
                        <div className="font-medium">{e.batch || "-"}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 sm:col-span-2">
                        <div className="text-slate-500">Notes</div>
                        <div className="font-medium whitespace-pre-wrap">{e.notes || "-"}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 self-stretch md:self-center">
                  <button
                    onClick={() => setOpenDetail((cur) => (cur === e.id ? null : e.id))}
                    className="px-3 py-2 rounded-lg border cursor-pointer"
                  >
                    {expanded ? "Hide Details" : "Show Details"}
                  </button>
                  <button
                    onClick={() => handleToggleDone(e.id)}
                    className="px-3 py-2 rounded-lg border cursor-pointer"
                  >
                    {e.done ? "Mark Pending" : "Mark Done"}
                  </button>
                  <button
                    onClick={() => handleEdit(e.id)}
                    className="px-3 py-2 rounded-lg border cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="px-3 py-2 rounded-lg border text-red-600 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={scrollToForm}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 rounded-full shadow-lg px-5 py-3 text-white text-sm font-medium cursor-pointer"
        style={{ background: "var(--brand-primary)" }}
        aria-label="Add vaccine"
        title="Add vaccine"
      >
        ➕ Add
      </button>
    </div>
  );
}
