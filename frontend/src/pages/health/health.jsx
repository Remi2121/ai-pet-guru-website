// src/pages/health/Health.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  doc,
  limit,
} from "firebase/firestore";
import { db, auth, ensureSignedIn } from "../../../firebase";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/**
 * Health log page (Firestore + AI analyze)
 * - Saves logs to Firestore (healthLogs)
 * - Shows your logs realtime (by current user)
 * - Analyze button calls backend and shows status with animation
 */

export default function Health() {
  // Realtime logs from Firestore
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Analyze status
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Form state
  const [form, setForm] = useState({
    food: "",
    water: "",
    vomit: "no",
    diarrhea: "no",
    activity: "",
    notes: "",
  });

  // Start realtime subscription to *my* logs
  useEffect(() => {
    let unsub = () => {};
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const user = await ensureSignedIn(); // anonymous ok
        const uid = user?.uid;

        const q = query(
          collection(db, "healthLogs"),
          where("byUid", "==", uid),
          orderBy("createdAt", "desc"),
          limit(200)
        );

        unsub = onSnapshot(q, (snap) => {
          const items = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          if (mounted) setLogs(items);
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsub && unsub();
    };
  }, []);

  const submitLog = async (e) => {
    e.preventDefault();

    const toNum = (v) => (v === "" || v === null ? null : Number(v));
    const toStr = (v) => (v || "").trim();

    try {
      await ensureSignedIn();

      await addDoc(collection(db, "healthLogs"), {
        byUid: auth?.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        dateISO: new Date().toISOString(),
        dateHuman: new Date().toLocaleString(),

        food: toStr(form.food),
        water: toNum(form.water),
        vomit: form.vomit === "yes" ? "yes" : "no",
        diarrhea: form.diarrhea === "yes" ? "yes" : "no",
        activity: toNum(form.activity),
        notes: toStr(form.notes),
      });

      setForm({
        food: "",
        water: "",
        vomit: "no",
        diarrhea: "no",
        activity: "",
        notes: "",
      });
    } catch (e) {
      console.error("Failed to add health log:", e);
      alert(
        e?.code === "permission-denied"
          ? "Signin required (enable Anonymous in Firebase Auth)."
          : "Failed to save log. Try again."
      );
    }
  };

  const deleteLog = async (id) => {
    if (!confirm("Delete this log?")) return;
    try {
      await ensureSignedIn();
      await deleteDoc(doc(db, "healthLogs", id));
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Could not delete. Please try again.");
    }
  };

  const clearAll = async () => {
    if (!confirm("Clear ALL your health logs? This can't be undone.")) return;
    try {
      await ensureSignedIn();
      for (const l of logs) {
        await deleteDoc(doc(db, "healthLogs", l.id));
      }
    } catch (e) {
      console.error(e);
      alert("Failed to clear all logs.");
    }
  };

  // ---------- Analyze with backend (Gemini/HF) ----------
  const analyzeNow = async () => {
    try {
      setAnalyzing(true);
      setAnalysis(null);

      // send last 7 logs (lightweight)
      const payload = {
        logs: logs.slice(0, 7).map((l) => ({
          dateISO: l.createdAt?.toDate ? l.createdAt.toDate().toISOString() : l.dateISO,
          food: l.food ?? "",
          water: l.water ?? null,
          vomit: l.vomit ?? "no",
          diarrhea: l.diarrhea ?? "no",
          activity: l.activity ?? null,
          notes: l.notes ?? "",
        })),
      };

      const res = await fetch(`${API}/api/health/analyze-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Analyze failed");
      setAnalysis(data);
    } catch (err) {
      console.error(err);
      alert("Analyze failed. Start backend or check VITE_API_BASE.");
    } finally {
      setAnalyzing(false);
    }
  };

  const badge = (status) => {
    switch ((status || "").toLowerCase()) {
      case "good":
        return "bg-emerald-100 text-emerald-700";
      case "watch":
        return "bg-amber-100 text-amber-700";
      case "bad":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-4">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--brand-primary)" }}
        >
          Health Log
        </h1>
        <p className="text-slate-600 mt-1">
          Track food, water, digestion, activity and notes daily. (Saved to cloud ✅)
        </p>
      </div>

      {/* Quick analyze header card */}
      <div className="bg-white rounded-2xl shadow p-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              analysis?.status === "good"
                ? "bg-emerald-500"
                : analysis?.status === "watch"
                ? "bg-amber-500"
                : analysis?.status === "bad"
                ? "bg-rose-500"
                : "bg-slate-400"
            } ${analyzing ? "animate-pulse" : ""}`}
          />
          <div className="text-sm text-slate-600">
            {analyzing
              ? "Analyzing recent logs…"
              : analysis
              ? `Status: ${analysis.status.toUpperCase()} • Score ${Math.round(
                  (analysis.score || 0) * 100
                )}/100`
              : "Click Analyze to get a quick status."}
          </div>
        </div>
        <button
          type="button"
          onClick={analyzeNow}
          disabled={analyzing || logs.length === 0}
          className="px-4 py-2 rounded-xl text-white cursor-pointer hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--brand-primary)" }}
          title="Analyze last few logs with AI"
        >
          {analyzing ? "Analyzing…" : "Analyze Health"}
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={submitLog}
        className="bg-white rounded-2xl shadow p-6 space-y-4"
      >
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
          <label className="text-sm font-medium text-slate-700">
            Water (ml)
          </label>
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
            <label className="text-sm font-medium text-slate-700">
              Diarrhea?
            </label>
            <select
              value={form.diarrhea}
              onChange={(e) =>
                setForm((s) => ({ ...s, diarrhea: e.target.value }))
              }
              className="w-full mt-2 px-3 py-2 border rounded-lg"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">
            Activity (minutes)
          </label>
          <input
            type="number"
            min={0}
            value={form.activity}
            onChange={(e) =>
              setForm((s) => ({ ...s, activity: e.target.value }))
            }
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
            className="px-4 py-2 rounded-xl text-white cursor-pointer hover:opacity-90"
            style={{ background: "var(--brand-primary)" }}
          >
            Save Log
          </button>

          <button
            type="button"
            onClick={() =>
              setForm({
                food: "",
                water: "",
                vomit: "no",
                diarrhea: "no",
                activity: "",
                notes: "",
              })
            }
            className="px-4 py-2 rounded-xl border bg-white cursor-pointer hover:opacity-90"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={clearAll}
            className="ml-auto px-4 py-2 rounded-xl border text-red-600 cursor-pointer hover:opacity-90"
          >
            Clear All Logs
          </button>
        </div>
      </form>

      {/* Analysis card */}
      {analysis && (
        <div className="mt-6 bg-white rounded-2xl shadow p-5 border">
          <div className="flex items-center justify-between">
            <div className={`text-xs px-2 py-1 rounded-full ${badge(analysis.status)} animate-pulse`}>
              {analysis.status?.toUpperCase() || "UNKNOWN"}
            </div>
            <div className="text-sm text-slate-500">
              Score: <b>{Math.round((analysis.score || 0) * 100)}</b>/100
            </div>
          </div>
          {analysis.reasons?.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-slate-700 text-sm">
              {analysis.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {analysis.tips?.length > 0 && (
            <>
              <div className="mt-4 text-sm font-semibold">Tips</div>
              <ul className="mt-1 list-disc pl-5 text-slate-700 text-sm">
                {analysis.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Logs</h2>
          <div className="text-sm text-slate-500">
            {loading ? "Loading…" : `${logs.length} entries`}
          </div>
        </div>

        {!loading && logs.length === 0 && (
          <p className="text-slate-500">
            No logs yet — add today’s health info above.
          </p>
        )}

        <div className="space-y-4 mt-4">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-xl shadow p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600">
                    {log.createdAt?.toDate
                      ? log.createdAt.toDate().toLocaleString()
                      : log.dateHuman || new Date().toLocaleString()}
                  </div>
                  <div className="text-lg font-semibold mt-1">
                    Food: {log.food || "-"}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => deleteLog(log.id)}
                    className="px-3 py-1 rounded-md border text-sm text-red-600 cursor-pointer hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 text-sm mt-3">
                <div>
                  <b>Water:</b>{" "}
                  {log.water !== null && log.water !== undefined
                    ? `${log.water} ml`
                    : "-"}
                </div>
                <div>
                  <b>Vomit:</b> {log.vomit === "yes" ? "Yes" : "No"}
                </div>
                <div>
                  <b>Diarrhea:</b> {log.diarrhea === "yes" ? "Yes" : "No"}
                </div>
                <div>
                  <b>Activity:</b>{" "}
                  {log.activity !== null && log.activity !== undefined
                    ? `${log.activity} min`
                    : "-"}
                </div>
              </div>

              {log.notes && (
                <p className="text-sm mt-3">
                  <b>Notes:</b> {log.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
