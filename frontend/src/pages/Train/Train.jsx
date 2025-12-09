// src/pages/Train/Train.jsx
import React, { useState } from "react";

const PET_TYPES = ["Dog", "Cat", "Rabbit", "Other"];

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

  const generateMockPlan = (inputs) => {
    // simple deterministic mock so repeated clicks produce similar output
    const seed = (inputs.petType + inputs.problem).slice(0, 12);
    const friendlyName = inputs.petType === "Dog" ? "pup" : inputs.petType === "Cat" ? "kitty" : "pet";

    return {
      title: `${inputs.petType} training plan — ${inputs.problem}`,
      summary: `A gentle, stepwise plan to address "${inputs.problem}" for your ${inputs.petType.toLowerCase()}. Focus on short sessions, positive rewards, and consistency.`,
      dailyRoutine: [
        "2 short practice sessions (5–10 min) — morning & evening",
        "1 enrichment/play session (15–20 min)",
        "Daily recap: 2 positive reinforcements for target behavior",
      ],
      sevenDay: [
        { day: 1, activities: ["Observe triggers", "1 short training session: reward on calmness"] },
        { day: 2, activities: ["Clicker/marker introduction", "Practice 2 step commands (sit, stay)"] },
        { day: 3, activities: ["Increase distractions slightly", "Short leash practice (dogs)"] },
        { day: 4, activities: ["Reward-only day: catch good behaviour & reward"] },
        { day: 5, activities: ["Combine cues: add hand signal + voice"] },
        { day: 6, activities: ["Simulate real scenario (caller/doorbell) and reward calmness"] },
        { day: 7, activities: ["Review progress, set next goals, small celebration"] },
      ],
      rewards: ["Small soft treats", "Praise & petting", "1–2 min high-value toy play"],
      videoLinks: [
        { title: "Positive Reinforcement Basics", url: "https://www.youtube.com/watch?v=example1" },
        { title: "Clicker Training Intro", url: "https://www.youtube.com/watch?v=example2" },
      ],
      notes: [
        `Keep sessions short and upbeat.`,
        `If unsure or behavior is dangerous, consult a certified trainer or vet behaviorist.`,
      ],
      meta: { seed },
      friendlyName,
    };
  };

  const onGenerate = async (e) => {
    e?.preventDefault();
    if (!problem.trim()) return;
    setLoading(true);
    setPlan(null);

    // simulate network/AI time
    await new Promise((r) => setTimeout(r, 900));

    const p = generateMockPlan({ petType, age, problem, goal });
    setPlan(p);
    setLoading(false);
    window.scrollTo({ top: 400, behavior: "smooth" });
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
      ...plan.dailyRoutine,
      "",
      "7-day micro plan:",
      ...plan.sevenDay.map((d) => `Day ${d.day}: ${d.activities.join(" • ")}`),
      "",
      "Rewards: " + plan.rewards.join(", "),
      "",
      "Notes:",
      ...plan.notes,
      "",
      "Videos:",
      ...plan.videoLinks.map((v) => `${v.title}: ${v.url}`),
    ].join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      alert("Plan copied to clipboard — paste anywhere to save.");
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--brand-primary)" }}>
        Training AI — Personalized Plans
      </h1>
      <p className="text-slate-600 mb-6">Describe the behavior you want to change and we’ll create a gentle, daily plan.</p>

      <form onSubmit={onGenerate} className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="md:col-span-1 bg-white rounded-2xl p-4 shadow">
          <label className="text-sm text-slate-700 font-medium">Pet type</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            {PET_TYPES.map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => setPetType(pt)}
                className={`px-3 py-2 rounded-lg text-sm ${
                  petType === pt ? "bg-[color:var(--brand-primary)]/15 ring-1 ring-[color:var(--brand-primary)]/20" : "bg-white border border-slate-200"
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
              className="px-4 py-2 rounded-xl text-white font-medium"
              style={{ background: "var(--brand-primary)" }}
            >
              {loading ? "Generating…" : "Generate Plan"}
            </button>

            <button
              type="button"
              onClick={() => { setProblem(""); setGoal(""); setPlan(null); }}
              className="px-4 py-2 rounded-xl border bg-white"
            >
              Clear
            </button>

            <div className="ml-auto text-sm text-slate-500">
              Tip: keep problem short & concrete for better results.
            </div>
          </div>
        </div>
      </form>

      {/* Result */}
      {plan && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold" style={{ color: "var(--brand-primary)" }}>{plan.title}</h2>
                <p className="text-sm text-slate-600 mt-2">{plan.summary}</p>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium">Daily routine</h4>
                    <ul className="list-disc ml-5 text-sm mt-2 text-slate-700">
                      {plan.dailyRoutine.map((d) => <li key={d}>{d}</li>)}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">Rewards</h4>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {plan.rewards.map((r) => <Pill key={r}>{r}</Pill>)}
                    </div>

                    <h4 className="font-medium mt-4">Quick notes</h4>
                    <ul className="list-disc ml-5 text-sm mt-2 text-slate-700">
                      {plan.notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={copyPlan}
                    className="px-4 py-2 rounded-lg border bg-white"
                  >
                    Copy plan
                  </button>

                  <a
                    className="px-4 py-2 rounded-lg text-white"
                    style={{ background: "var(--brand-primary)" }}
                    href="#download"
                    onClick={(ev) => {
                      ev.preventDefault();
                      // simple download as text file
                      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `training-plan-${plan.meta.seed}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download JSON
                  </a>

                  <a
                    className="px-4 py-2 rounded-lg text-white"
                    style={{ background: "rgba(0,0,0,0.08)" }}
                    href="#videos"
                    onClick={(e) => { e.preventDefault(); document.getElementById("videos")?.scrollIntoView({behavior:"smooth"}); }}
                  >
                    View videos
                  </a>
                </div>
              </div>

              <div className="w-40">
                <div className="text-xs text-slate-500">For</div>
                <div className="mt-1"><Pill>{petType}</Pill></div>
                {age && <div className="mt-2 text-xs text-slate-500">Age</div>}
                {age && <div className="mt-1"><Pill>{age}</Pill></div>}
              </div>
            </div>
          </div>

          {/* 7-day micro plan */}
          <div className="bg-white rounded-2xl p-4 shadow">
            <h3 className="text-lg font-semibold mb-3">7-day micro plan</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {plan.sevenDay.map((d) => (
                <div key={d.day} className="border rounded-lg p-3">
                  <div className="font-medium">Day {d.day}</div>
                  <div className="text-sm mt-1">
                    {d.activities.map((a, i) => <div key={i}>• {a}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Videos */}
          <div id="videos" className="bg-white rounded-2xl p-4 shadow">
            <h3 className="text-lg font-semibold mb-3">Video resources</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {plan.videoLinks.map((v) => (
                <a
                  key={v.url}
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="border rounded-lg p-3 hover:shadow"
                >
                  <div className="font-medium">{v.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{v.url}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {!plan && (
        <div className="mt-6 text-sm text-slate-500">
          Describe a behavior issue and press <strong>Generate Plan</strong>. The plan is a mock AI output for UI testing — replace with backend AI when ready.
        </div>
      )}
    </div>
  );
}
