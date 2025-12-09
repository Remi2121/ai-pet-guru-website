import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-[color:var(--brand-primary)]/10">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <img
                src="/ai-pet-guru-logo.png"
                alt="AI Pet Guru"
                className="h-10 w-10 rounded-lg object-contain"
              />
              <span className="text-lg font-semibold" style={{ color: "var(--brand-primary)" }}>
                AI Pet Guru
              </span>
            </Link>
            <p className="text-sm text-slate-600">
              Gentle AI help for pet parents — quick checks, breed ID, food advice,
              and training tips. Not a substitute for a vet.
            </p>
            <div className="flex items-center gap-3 mt-1">
              {/* Simple social icons */}
              <a
                href="#"
                aria-label="Twitter"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-slate-100 hover:bg-slate-200"
              >
                <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 19c7 0 10.8-5.8 10.8-10.8 0-.2 0-.5 0-.7A7.6 7.6 0 0 0 20 6.6a7.3 7.3 0 0 1-2.1.6 3.7 3.7 0 0 0 1.6-2 7.4 7.4 0 0 1-2.4.9 3.7 3.7 0 0 0-6.3 3.4A10.5 10.5 0 0 1 5.6 5.4a3.7 3.7 0 0 0 1.1 4.9 3.6 3.6 0 0 1-1.7-.5v.1a3.7 3.7 0 0 0 3 3.6 3.7 3.7 0 0 1-1.7.1 3.7 3.7 0 0 0 3.4 2.6A7.4 7.4 0 0 1 4 17.6 10.4 10.4 0 0 0 8 19" />
                </svg>
              </a>

              <a
                href="#"
                aria-label="Instagram"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-slate-100 hover:bg-slate-200"
              >
                <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.2A4.8 4.8 0 1 0 16.8 13 4.8 4.8 0 0 0 12 8.2zM18.5 6.3a1.1 1.1 0 1 1-1.1-1.1 1.1 1.1 0 0 1 1.1 1.1z" />
                </svg>
              </a>

              <a
                href="#"
                aria-label="Facebook"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-slate-100 hover:bg-slate-200"
              >
                <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2.6v-2.9H10.5V9.3c0-2.6 1.5-4 3.7-4 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.7-1.6 1.4v1.7h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12" />
                </svg>
              </a>
            </div>
          </div>

          {/* Useful links */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link to="/disease" className="hover:underline">AI Disease Detector</Link></li>
              <li><Link to="/breed" className="hover:underline">Breed Finder</Link></li>
              <li><Link to="/food" className="hover:underline">Food Analyzer</Link></li>
              <li><Link to="/train" className="hover:underline">Training AI</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link to="/about" className="hover:underline">About</Link></li>
              <li><a href="#" className="hover:underline">Help Center</a></li>
              <li><a href="#" className="hover:underline">Privacy</a></li>
              <li><a href="#" className="hover:underline">Terms</a></li>
            </ul>
          </div>

          {/* Contact / small newsletter */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Stay in touch</h4>
            <p className="text-sm text-slate-600 mb-3">Get occasional tips & product updates.</p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <label htmlFor="f_email" className="sr-only">Email</label>
              <input
                id="f_email"
                type="email"
                placeholder="you@domain.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)]"
                aria-label="Email address"
              />
              <button
                type="submit"
                className="inline-flex items-center px-3 py-2 rounded-lg text-white text-sm"
                style={{ background: "var(--brand-primary)" }}
              >
                Subscribe
              </button>
            </form>

            <div className="text-xs text-slate-500 mt-3">
              <p>Need urgent help? Contact your local vet.</p>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-600">© {year} AI Pet Guru. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-sm text-slate-600 hover:underline">Privacy</Link>
            <Link to="/terms" className="text-sm text-slate-600 hover:underline">Terms</Link>
            <span className="text-sm text-slate-500">Made with ♥</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
