// src/components/Auth/Auth.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../../../firebase"; // adjust if your path differs
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

/**
 * Auth modal (Login / Signup) with:
 * - Switch links under forms
 * - Password show/hide (eye)
 * - Firebase Email/Password auth
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 */
export default function Auth({ open, onClose }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // reset to login every time it opens
    Promise.resolve().then(() => setMode("login"));
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
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


        {/* Forms */}
        {mode === "login" ? (
          <LoginForm onClose={onClose} switchMode={setMode} />
        ) : (
          <SignupForm onClose={onClose} switchMode={setMode} />
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

/* ------------------ Small Eye Icon Button -------------------- */
function EyeButton({ shown, onToggle, id }) {
  return (
    <button
      type="button"
      aria-label={shown ? "Hide password" : "Show password"}
      aria-controls={id}
      onClick={onToggle}
      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700"
      tabIndex={-1}
    >
      {/* simple inline SVG (no extra deps) */}
      {shown ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M3 3l18 18M10.58 10.58A3 3 0 0112 9a3 3 0 013 3c0 .42-.09.82-.24 1.18M9.88 5.5A9.77 9.77 0 0112 5c5 0 9 4 9 7 0 1.14-.52 2.37-1.47 3.5M6.12 6.12C4.01 7.62 3 9.41 3 12c0 3 4 7 9 7 1.07 0 2.09-.17 3.03-.49" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" strokeWidth="2" />
        </svg>
      )}
    </button>
  );
}

/* ------------------ Login Form -------------------- */
function LoginForm({ onClose, switchMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const passId = "login-password";

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("✅ Logged in successfully!");
      onClose();
    } catch (err) {
      alert("❌ Login failed: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        required
      />

      <div className="relative">
        <input
          id={passId}
          type={showPass ? "text" : "password"}
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg pr-10"
          required
        />
        <EyeButton shown={showPass} onToggle={() => setShowPass((s) => !s)} id={passId} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="form-checkbox" /> Remember me
        </label>
        <button type="button" className="text-indigo-600 hover:underline text-xs">
          Forgot?
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded-xl text-white font-medium"
        style={{ background: "var(--brand-primary)" }}
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      {/* Switch to Signup link */}
      <p className="text-xs text-center text-slate-600">
        Don’t have an account?{" "}
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className="text-indigo-600 hover:underline font-medium"
        >
          Create one
        </button>
      </p>
    </form>
  );
}

/* ------------------ Signup Form -------------------- */
function SignupForm({ onClose, switchMode }) {
  const [name, setName] = useState(""); // you can store/display later with updateProfile if needed
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const passId = "signup-password";

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("🎉 Account created successfully!");
      onClose();
    } catch (err) {
      alert("❌ Signup failed: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
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
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        required
      />

      <div className="relative">
        <input
          id={passId}
          type={showPass ? "text" : "password"}
          placeholder="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg pr-10"
          required
        />
        <EyeButton shown={showPass} onToggle={() => setShowPass((s) => !s)} id={passId} />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded-xl text-white font-medium"
        style={{ background: "var(--brand-primary)" }}
      >
        {loading ? "Creating..." : "Create account"}
      </button>

      {/* Switch to Login link */}
      <p className="text-xs text-center text-slate-600">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => switchMode("login")}
          className="text-indigo-600 hover:underline font-medium"
        >
          Log in
        </button>
      </p>
    </form>
  );
}
