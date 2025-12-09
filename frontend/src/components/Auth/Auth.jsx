// src/components/Auth/Auth.jsx
import React, { useEffect, useState } from "react";

/**
 * Auth modal (Login / Signup)
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *
 * This is a demo UI. Replace handlers with real API calls.
 */

export default function Auth({ open, onClose }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'

 useEffect(() => {
  if (!open) return; // modal closed -> do nothing

  // lock scroll
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  // reset mode ONLY when opening, but allow React to batch it safely
  Promise.resolve().then(() => setMode("login"));

  return () => {
    document.body.style.overflow = prev;
  };
}, [open]);


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md z-[1000] animate-scaleIn">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold" style={{ color: "var(--brand-primary)" }}>
            {mode === "login" ? "Login" : "Create Account"}
          </h3>

          <button
            onClick={onClose}
            className="p-2 rounded-lg border text-slate-600"
            aria-label="Close auth modal"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mb-4 gap-2">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 font-medium rounded-lg ${mode === "login" ? "bg-purple-100 text-purple-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 font-medium rounded-lg ${mode === "signup" ? "bg-purple-100 text-purple-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Signup
          </button>
        </div>

        {/* Forms */}
        {mode === "login" ? (
          <LoginForm onClose={onClose} />
        ) : (
          <SignupForm onClose={onClose} />
        )}
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scaleIn {
          animation: scaleIn 220ms cubic-bezier(.22,.9,.36,1);
        }
      `}</style>
    </div>
  );
}

/* ------------------ Login Form -------------------- */
function LoginForm({ onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e?.preventDefault();
    // TODO: replace with real login call
    if (!email || !password) {
      alert("Please enter email and password (demo).");
      return;
    }
    // simulate success
    alert("Logged in (demo): " + email);
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        required
      />

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="form-checkbox" /> Remember me
        </label>
        <button type="button" className="text-indigo-600 hover:underline text-xs">Forgot?</button>
      </div>

      <button
        type="submit"
        className="w-full py-2 rounded-xl text-white font-medium"
        style={{ background: "var(--brand-primary)" }}
      >
        Login
      </button>
    </form>
  );
}

/* ------------------ Signup Form -------------------- */
function SignupForm({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e?.preventDefault();
    if (!name || !email || !password) {
      alert("Please complete all fields (demo).");
      return;
    }
    // TODO: replace with real signup call
    alert("Account created (demo): " + name);
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="text"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        required
      />

      <button
        type="submit"
        className="w-full py-2 rounded-xl text-white font-medium"
        style={{ background: "var(--brand-primary)" }}
      >
        Create account
      </button>
    </form>
  );
}
