// src/pages/Home/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import heroDog from "../../assets/pet-hero.png"; // change image name to your file

export default function Home() {
  return (
    <div className="min-h-[80vh] flex flex-col md:flex-row items-center justify-between px-6 md:px-16 mt-10">

      {/* LEFT SIDE */}
      <div className="max-w-xl space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight"
            style={{ color: "var(--brand-primary)" }}>
          Intelligent Pet Care,  
          <br />
          Made Simple ❤️🐾
        </h1>

        <p className="text-slate-600 text-lg">
          Upload a photo, describe symptoms, or ask questions.  
          Our AI helps you detect diseases, choose food, track vaccines,  
          and care for your pet like a pro.
        </p>

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap gap-4 pt-4">
          <Link
            to="/disease"
            className="px-6 py-3 rounded-xl text-white font-medium shadow-md hover:opacity-90"
            style={{ background: "var(--brand-primary)" }}
          >
            Start Image Check
          </Link>

          <Link
            to="/recommend"
            className="px-6 py-3 rounded-xl border border-[color:var(--brand-primary)] text-[color:var(--brand-primary)] hover:bg-[color:var(--brand-primary)]/10"
          >
            Get Recommendations
          </Link>
        </div>
      </div>

      {/* RIGHT SIDE IMAGE */}
      <div className="mt-10 md:mt-0">
        <img
          src={heroDog}
          alt="Pet Hero"
          className="w-[400px] md:w-[520px] drop-shadow-xl max-h-[600px]"
        />
      </div>

    </div>
  );
}
