// src/pages/health/Health.jsx
import React, { useEffect, useState } from "react";

/**
 * Health log page
 * - Reads saved logs from localStorage using a lazy useState initializer (no setState inside mount effect)
 * - Persists logs to localStorage whenever they change
 * - Simple form to add daily logs
 */

const STORAGE_KEY = "pet-health-logs-v1";

export default function Health() {
  // Lazy initializer reads from localStorage synchronously during initial render
  const [logs, setLogs] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Failed reading health logs from localStorage:", e);
      return [];
    }
  });

  const [form, setForm] = useState({
    food: "",
    water: "",
    vomit: "no",
    diarrhea: "no",
    activity: "",
    notes: "",
  });

  // Persist logs whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error("Failed to persist health logs:", e);
    }
  }, [logs]);

  const submitLog = (e) => {
    e.preventDefault();

    const entry = {
      id: Date.now(),
      dateISO: new Date().toISOString(),
      dateHuman: new Date().toLocaleString(),
      ...form,
    };

    // prepend newest
    setLogs((prev) => [entry, ...prev]);

    // reset form
    setForm({
      food: "",
      water: "",
      vomit: "no",
      diarrhea: "no",
      activity: "",
      notes: "",
    });
  };

  const clearAll = () => {
    if (!confirm("Clear all health logs? This can't be undone.")) return;
    setLogs([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const deleteLog = (id) => {
    if (!confirm("Delete this log?")) return;
    setLogs((s) => s.filter((l) => l.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-4">
        <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>
          Health Log
        </h1>
        <p className="text-slate-600 mt-1">Track food, water, digestion, activity and notes daily.</p>
      </div>

      {/* Form */}
      <form onSubmit={submitLog} className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Food</label>
          <input
            value={form.food}
            onChange={(e) => setForm((s) => ({ ...s, food: e.target.value }))}
            placeholder="What did your pet eat?"
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Water (ml)</label>
          <input
            type="number"
            min={0}
            value={form.water}
            onChange={(e) => setForm((s) => ({ ...s, water: e.target.value }))}
            placeholder="e.g. 350"
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Vomit?</label>
            <select
              value={form.vomit}
              onChange={(e) => setForm((s) => ({ ...s, vomit: e.target.value }))}
              className="w-full mt-2 px-3 py-2 border rounded-lg"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Diarrhea?</label>
            <select
              value={form.diarrhea}
              onChange={(e) => setForm((s) => ({ ...s, diarrhea: e.target.value }))}
              className="w-full mt-2 px-3 py-2 border rounded-lg"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Activity (minutes)</label>
          <input
            type="number"
            min={0}
            value={form.activity}
            onChange={(e) => setForm((s) => ({ ...s, activity: e.target.value }))}
            placeholder="e.g. 45"
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Any unusual behavior, appetite changes, etc."
            className="w-full mt-2 px-3 py-2 border rounded-lg h-24"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-white"
            style={{ background: "var(--brand-primary)" }}
          >
            Save Log
          </button>

          <button
            type="button"
            onClick={() => setForm({ food: "", water: "", vomit: "no", diarrhea: "no", activity: "", notes: "" })}
            className="px-4 py-2 rounded-xl border bg-white"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={clearAll}
            className="ml-auto px-4 py-2 rounded-xl border text-red-600"
          >
            Clear All Logs
          </button>
        </div>
      </form>

      {/* Logs */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Previous Logs</h2>
          <div className="text-sm text-slate-500">{logs.length} entries</div>
        </div>

        {logs.length === 0 && <p className="text-slate-500">No logs yet — add today's health info above.</p>}

        <div className="space-y-4 mt-4">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-xl shadow p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600">{new Date(log.dateISO).toLocaleString()}</div>
                  <div className="text-lg font-semibold mt-1">Food: {log.food || "-"}</div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => deleteLog(log.id)}
                    className="px-3 py-1 rounded-md border text-sm text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 text-sm mt-3">
                <div><b>Water:</b> {log.water ? `${log.water} ml` : "-"}</div>
                <div><b>Vomit:</b> {log.vomit}</div>
                <div><b>Diarrhea:</b> {log.diarrhea}</div>
                <div><b>Activity:</b> {log.activity ? `${log.activity} min` : "-"}</div>
              </div>

              {log.notes && <p className="text-sm mt-3"><b>Notes:</b> {log.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
