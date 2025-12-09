import React from "react";

export default function Abou() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Title */}
      <h1
        className="text-3xl font-bold mb-3"
        style={{ color: "var(--brand-primary)" }}
      >
        About AI Pet Guru
      </h1>

      <p className="text-slate-600 mb-8 text-sm">
        Caring for pets should feel simple, calm, and stress-free.  
        AI Pet Guru was created to give pet parents instant, reliable insights at their fingertips.
      </p>

      {/* Mission Section */}
      <div className="bg-white rounded-2xl shadow p-6 mb-10">
        <h2 className="text-xl font-semibold mb-2">Our Mission</h2>
        <p className="text-slate-700 text-sm leading-relaxed">
          We believe every pet deserves love, safety, and proper healthcare.
          Our mission is to empower pet owners with AI tools that help detect
          diseases early, understand behavior, track daily health, manage
          vaccinations, and even find lost pets faster.
        </p>
      </div>

      {/* Features Overview */}
      <h2 className="text-xl font-semibold mb-4">What We Provide</h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {[
          { title: "AI Disease Detection", text: "Upload an image and get gentle guidance on possible issues." },
          { title: "Breed Identification", text: "Know your pet’s breed, size expectations, and personality traits." },
          { title: "Food Analyzer", text: "Check if ingredients are safe & healthy." },
          { title: "Training Assistant", text: "Step-by-step routines for better behavior." },
          { title: "Health Log", text: "Track food, water, symptoms & activity daily." },
          { title: "Lost Pet Finder", text: "AI-powered match system to locate similar pets." },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </div>

      {/* Vision / Team Section */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Our Vision</h2>

        <p className="text-slate-700 text-sm leading-relaxed mb-4">
          We imagine a world where advanced technology supports every pet owner.
          Whether you're a first-time pet parent or experienced caretaker,
          AI Pet Guru aims to be your trusted companion for health checks,
          nutrition insights, behavior guidance, and emergency help.
        </p>

        <div className="mt-4 p-4 bg-[#f9f9ff] rounded-xl border border-indigo-100">
          <p className="text-sm text-slate-700">
            <b>AI Pet Guru</b> is built with compassion, love for animals, and modern AI models.
            Your pet’s safety, privacy, and comfort come first — always.
          </p>
        </div>
      </div>

    </div>
  );
}
