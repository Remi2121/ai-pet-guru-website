// src/pages/Recommend/Recommend.jsx
import React, { useState } from "react";

export default function Recommend() {
  const [form, setForm] = useState({
    house: "",
    budget: "",
    lifestyle: "",
    allergies: "no",
    time: "",
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handle = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  // Mock AI recommendation
  const getRecs = async () => {
    if (!form.house || !form.budget || !form.lifestyle || !form.time) {
      alert("Please fill all required fields.");
      return;
    }

    setLoading(true);
    setResults([]);

    await new Promise((r) => setTimeout(r, 1200));

    const mockPets = [
      {
        pet: "Golden Retriever",
        img: "https://cdn2.thedogapi.com/images/HJ7Pzg5EQ.jpg",
        monthly_cost: "₹4,000–7,000",
        reason: "Friendly, family-friendly, great for active homes.",
      },
      {
        pet: "Persian Cat",
        img: "https://cdn2.thecatapi.com/images/UiN1z1vE2.jpg",
        monthly_cost: "₹2,000–4,000",
        reason: "Calm, indoor-loving, suitable for quiet households.",
      },
      {
        pet: "Budgie Bird",
        img: "https://upload.wikimedia.org/wikipedia/commons/2/24/Budgerigar.jpg",
        monthly_cost: "₹500–1,000",
        reason: "Low maintenance, affectionate, great for small spaces.",
      },
    ];

    setResults(mockPets);
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Heading */}
      <h1
        className="text-3xl font-bold mb-3"
        style={{ color: "var(--brand-primary)" }}
      >
        Pet Recommendation
      </h1>

      <p className="text-slate-600 mb-8 text-sm">
        Answer a few questions and AI will suggest the best pets for your lifestyle.
      </p>

      {/* Form Section */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-5 mb-10">

        {/* House size */}
        <div>
          <label className="text-sm font-medium text-slate-700">
            House size *
          </label>
          <select
            value={form.house}
            onChange={(e) => handle("house", e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          >
            <option value="">Select</option>
            <option value="small">Small (Apartment)</option>
            <option value="medium">Medium Home</option>
            <option value="large">Large House / Yard</option>
          </select>
        </div>

        {/* Budget */}
        <div>
          <label className="text-sm font-medium text-slate-700">
            Monthly budget (₹) *
          </label>
          <input
            type="number"
            value={form.budget}
            onChange={(e) => handle("budget", e.target.value)}
            placeholder="Your monthly budget for pet care"
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          />
        </div>

        {/* Lifestyle */}
        <div>
          <label className="text-sm font-medium text-slate-700">
            Your lifestyle *
          </label>
          <select
            value={form.lifestyle}
            onChange={(e) => handle("lifestyle", e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          >
            <option value="">Select</option>
            <option value="active">Active (Outdoor / Exercise)</option>
            <option value="balanced">Balanced</option>
            <option value="calm">Calm / Indoor</option>
          </select>
        </div>

        {/* Allergies */}
        <div>
          <label className="text-sm font-medium text-slate-700">
            Pet hair allergy?
          </label>
          <select
            value={form.allergies}
            onChange={(e) => handle("allergies", e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          >
            <option value="no">No</option>
            <option value="yes">Yes (Hypoallergenic pets only)</option>
          </select>
        </div>

        {/* Time Availability */}
        <div>
          <label className="text-sm font-medium text-slate-700">
            Daily time you can give *
          </label>
          <select
            value={form.time}
            onChange={(e) => handle("time", e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded-lg"
          >
            <option value="">Select</option>
            <option value="low">Less than 1 hour</option>
            <option value="medium">1–3 hours</option>
            <option value="high">3+ hours</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          onClick={getRecs}
          disabled={loading}
          className="w-full px-4 py-3 rounded-xl text-white font-medium"
          style={{ background: "var(--brand-primary)" }}
        >
          {loading ? "Finding best pets..." : "Get Recommendations"}
        </button>
      </div>

      {/* Results */}
      <h2 className="text-xl font-semibold mb-3">Top Matches</h2>

      {!results.length && (
        <p className="text-slate-500">Fill the form to get your personalized pet suggestions.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {results.map((r) => (
          <div
            key={r.pet}
            className="bg-white rounded-xl shadow hover:shadow-lg transition p-4"
          >
            <img
              src={r.img}
              className="w-full h-44 object-cover rounded-xl"
              alt={r.pet}
            />

            <h3 className="font-semibold text-lg mt-3">{r.pet}</h3>
            <p className="text-sm text-slate-600">Monthly cost: {r.monthly_cost}</p>

            <p className="text-sm text-slate-700 mt-2">{r.reason}</p>

            <button
              className="mt-3 w-full px-3 py-2 rounded-xl text-white font-medium"
              style={{ background: "var(--brand-primary)" }}
            >
              View Care Guide
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
