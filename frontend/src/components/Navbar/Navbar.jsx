import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";

const nav = [
  { to: "/disease", label: "Image Check" },
  { to: "/voice", label: "Voice Check" },
  { to: "/breed", label: "Breed" },
  { to: "/food", label: "Food" },
  { to: "/recommend", label: "Recommend" },
  { to: "/train", label: "Training" },
  { to: "/health", label: "Health Log" },
  { to: "/vaccines", label: "Vaccines" },
  { to: "/lost", label: "Lost" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Auto-close menu when resizing above mobile
  useEffect(() => {
    const closeOnResize = () => {
      if (window.innerWidth >= 768 && open) setOpen(false);
    };
    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-purple-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/ai-pet-guru-logo.png"
            className="h-9 w-9 rounded-xl"
            alt="AI Pet Guru"
          />
          <span className="font-bold text-lg text-purple-700">AI Pet Guru</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex ml-auto gap-1 items-center">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-purple-100 text-purple-700"
                    : "text-slate-700 hover:bg-purple-50"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop Start button */}
        <div className="hidden md:block ml-2">
          <Link
            to="/disease"
            className="px-5 py-2 text-white rounded-xl shadow"
            style={{ background: "var(--brand-primary)" }}
          >
            Start
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden ml-auto inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor">
              <path
                strokeWidth="2"
                strokeLinecap="round"
                d="M6 6l12 12M6 18L18 6"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor">
              <path
                strokeWidth="2"
                strokeLinecap="round"
                d="M3 6h18M3 12h18M3 18h18"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Slide-down panel */}
          <div className="absolute inset-x-0 top-0 bg-white rounded-b-2xl shadow-lg p-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2"
              >
                <img
                  src="/ai-pet-guru-logo.png"
                  className="h-8 w-8 rounded-lg"
                  alt="AI Pet Guru"
                />
                <span className="font-semibold text-purple-700">
                  AI Pet Guru
                </span>
              </Link>
              <button
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border"
                onClick={() => setOpen(false)}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            {/* Mobile nav items */}
            <div className="mt-3 space-y-2">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-3 rounded-lg font-medium ${
                      isActive
                        ? "bg-purple-100 text-purple-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}

              {/* Start Button */}
              <Link
                to="/disease"
                onClick={() => setOpen(false)}
                className="mt-4 block text-center w-full px-4 py-3 rounded-xl text-white font-medium"
                style={{ background: "var(--brand-primary)" }}
              >
                Start Image Check
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
