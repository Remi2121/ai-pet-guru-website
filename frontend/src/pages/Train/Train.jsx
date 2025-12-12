import React, { useState } from "react";

const PET_TYPES = ["Dog", "Cat", "Rabbit", "Other"];

// local dev uses Vite proxy; prod can set VITE_API_URL
const API_BASE = import.meta?.env?.VITE_API_URL || "";

function Pill({ children }) {
  return (
    <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">
      {children}
    </span>
  );
}

export default function Train() {
  const [petType, setPetType] = useState("Dog");
  const [age, setAge] = useState("");
  const [problem, setProblem] = useState("");
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const onGenerate = async (e) => {
    e?.preventDefault();
    if (!problem.trim()) return;
    setLoading(true);
    setPlan(null);

    try {
      const res = await fetch(`${API_BASE}/api/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ petType, age, problem, goal }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `AI request failed (${res.status})`);
      }

      const p = await res.json();
      setPlan(p);
      window.scrollTo({ top: 400, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      alert("❌ Could not generate plan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPlan = () => {
    if (!plan) return;
    const text = [
      plan.title,
      "",
      "Summary:",
      plan.summary,
      "",
      "Daily routine:",
      ...(plan.dailyRoutine || []),
      "",
      "7-day micro plan:",
      ...(plan.sevenDay || []).map((d) => `Day ${d.day}: ${(d.activities || []).join(" • ")}`),
      "",
      "Rewards: " + (plan.rewards || []).join(", "),
      "",
      "Notes:",
      ...(plan.notes || []),
      "",
      "Videos:",
      ...(plan.videoLinks || []).map((v) => `${v.title}: ${v.url}`),
    ].join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      alert("📋 Plan copied to clipboard — paste anywhere to save.");
    });
  };

  // -------- PDF download (robust import; works in Vite) --------
  const downloadPdf = async () => {
    try {
      if (!plan) return;

      // some builds export { jsPDF }, some export default
      const mod = await import("jspdf");
      const JsPDF = mod.jsPDF || mod.default;
      const doc = new JsPDF({ unit: "pt", format: "a4" });

      const margin = 40;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;
      const lineGap = 6;
      let y = margin;

      const maybeAddPage = () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addHeader = (text) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        const lines = doc.splitTextToSize(text || "Personalized Training Plan", contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 22 + 6;
      };

      const addSubHeader = (text) => {
        maybeAddPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(text, margin, y);
        y += 18;
      };

      const addPara = (text) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(text || "-", contentWidth);
        for (const line of lines) {
          maybeAddPage();
          doc.text(line, margin, y);
          y += 14;
        }
        y += lineGap;
      };

      const addBullets = (items) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        for (const it of items || []) {
          const lines = doc.splitTextToSize(`• ${it}`, contentWidth);
          for (const line of lines) {
            maybeAddPage();
            doc.text(line, margin, y);
            y += 14;
          }
        }
        y += lineGap;
      };

      // Title + meta
      addHeader(plan.title);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const metaBits = [
        petType ? `For: ${petType}` : null,
        age ? `Age: ${age}` : null,
        plan?.meta?.seed ? `Ref: ${plan.meta.seed}` : null,
      ].filter(Boolean);
      if (metaBits.length) {
        doc.text(metaBits.join("   •   "), margin, y);
        y += 18;
      }

      // Sections
      addSubHeader("Summary");
      addPara(plan.summary);

      addSubHeader("Daily routine");
      addBullets(plan.dailyRoutine || []);

      addSubHeader("7-day micro plan");
      (plan.sevenDay || []).forEach((d) => {
        maybeAddPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`Day ${d.day}`, margin, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        addBullets(d.activities || []);
      });

      addSubHeader("Rewards");
      addBullets((plan.rewards || []).map(String));

      addSubHeader("Notes");
      addBullets(plan.notes || []);

      addSubHeader("Videos");
      (plan.videoLinks || []).forEach((v) => {
        const title = v?.title ? `${v.title}:` : "Video:";
        const url = v?.url || "";
        addPara(`${title} ${url}`);
      });

      const filename = `training-plan-${plan?.meta?.seed || "plan"}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error(e);
      alert("PDF create panna try panna fail aagiduchu. Check console.");
    }
  };
  // ------------------------------------------------------------

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--brand-primary)" }}>
        Training AI — Personalized Plans
      </h1>
      <p className="text-slate-600 mb-6">
        Describe the behavior you want to change and we’ll create a gentle, daily plan.
      </p>

      <form onSubmit={onGenerate} className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="md:col-span-1 bg-white rounded-2xl p-4 shadow">
          <label className="text-sm text-slate-700 font-medium">Pet type</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            {PET_TYPES.map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => setPetType(pt)}
                className={`px-3 py-2 rounded-lg text-sm cursor-pointer ${
                  petType === pt
                    ? "bg-[color:var(--brand-primary)]/15 ring-1 ring-[color:var(--brand-primary)]/20"
                    : "bg-white border border-slate-200"
                }`}
              >
                {pt}
              </button>
            ))}
          </div>

          <label className="text-sm text-slate-700 font-medium mt-4 block">Age (optional)</label>
          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 2 years"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200"
          />
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl p-4 shadow space-y-3">
          <label className="text-sm text-slate-700 font-medium">Describe the problem</label>
          <textarea
            rows={3}
            placeholder="E.g., 'Bites visitors', 'Chews furniture when left alone', 'Won't come when called'"
            className="w-full px-3 py-2 rounded-lg border border-slate-200"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />

          <label className="text-sm text-slate-700 font-medium">What outcome would you like? (optional)</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="E.g., 'Stay calm when guests arrive', 'Respond reliably to recall'"
            className="w-full px-3 py-2 rounded-lg border border-slate-200"
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!problem.trim() || loading}
              className="px-4 py-2 rounded-xl text-white font-medium cursor-pointer"
              style={{ background: "var(--brand-primary)" }}
            >
              {loading ? "Generating…" : "Generate Plan"}
            </button>

            <button
              type="button"
              onClick={() => {
                setProblem("");
                setGoal("");
                setPlan(null);
              }}
              className="px-4 py-2 rounded-xl border bg-white cursor-pointer"
            >
              Clear
            </button>

            <div className="ml-auto text-sm text-slate-500">
              Tip: keep problem short & concrete for better results.
            </div>
          </div>
        </div>
      </form>

      {plan && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold" style={{ color: "var(--brand-primary)" }}>
                  {plan.title}
                </h2>
                <p className="text-sm text-slate-600 mt-2">{plan.summary}</p>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium">Daily routine</h4>
                    <ul className="list-disc ml-5 text-sm mt-2 text-slate-700">
                      {(plan.dailyRoutine || []).map((d, i) => (
                        <li key={`${d}-${i}`}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">Rewards</h4>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {(plan.rewards || []).map((r, i) => (
                        <Pill key={`${r}-${i}`}>{r}</Pill>
                      ))}
                    </div>

                    <h4 className="font-medium mt-4">Quick notes</h4>
                    <ul className="list-disc ml-5 text-sm mt-2 text-slate-700">
                      {(plan.notes || []).map((n, i) => (
                        <li key={`${n}-${i}`}>{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button onClick={copyPlan} className="px-4 py-2 rounded-lg border bg-white cursor-pointer">
                    Copy plan
                  </button>

                  {/* PDF download */}
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg text-white cursor-pointer"
                    style={{ background: "#334155" }}
                    onClick={downloadPdf}
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="w-40">
                <div className="text-xs text-slate-500">For</div>
                <div className="mt-1">
                  <Pill>{petType}</Pill>
                </div>
                {age && <div className="mt-2 text-xs text-slate-500">Age</div>}
                {age && (
                  <div className="mt-1">
                    <Pill>{age}</Pill>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div id="videos" className="bg-white rounded-2xl p-4 shadow">
            <h3 className="text-lg font-semibold mb-3">7-day micro plan</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {(plan.sevenDay || []).map((d) => (
                <div key={d.day} className="border rounded-lg p-3">
                  <div className="font-medium">Day {d.day}</div>
                  <div className="text-sm mt-1">
                    {(d.activities || []).map((a, i) => (
                      <div key={i}>• {a}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!plan && (
        <div className="mt-6 text-sm text-slate-500">
          Describe a behavior issue and press <strong>Generate Plan</strong>. The plan is generated live by
          your AI backend (Hugging Face model).
        </div>
      )}
    </div>
  );
}
