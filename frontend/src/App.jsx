import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

/* Global chrome */
import Navbar from "./components/Navbar/Navbar.jsx";
import Footer from "./components/Footer/Footer.jsx";

/* Pages — adjust these paths if your folders differ exactly */
import Home from "./pages/Home/Home.jsx";
import Breed from "./pages/Breed/Breed.jsx";
import Disease from "./pages/Disease/Disease.jsx";
import Food from "./pages/Food/Food.jsx";
import Recommend from "./pages/Recommend/Recommend.jsx";
import Train from "./pages/Train/Train.jsx";
import Health from "./pages/health/Health.jsx";
import Vaccines from "./pages/Vaccines/Vaccines.jsx";
import Lost from "./pages/Lost/Lost.jsx";
import Voice from "./pages/Voice/Voice.jsx";
import About from "./pages/About/About.jsx"; // <--- ensure folder is "About"

import DangerMeter from "./components/DangerMeter/DangerMeter.jsx";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/disease" element={<Disease />} />
          <Route path="/voice" element={<Voice />} />
          <Route path="/breed" element={<Breed />} />
          <Route path="/food" element={<Food />} />
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/train" element={<Train />} />
          <Route path="/health" element={<Health />} />
          <Route path="/vaccines" element={<Vaccines />} />
          <Route path="/lost" element={<Lost />} />
          <Route path="/about" element={<About />} />

          <Route path="/danger-meter" element={<DangerMeter />} />
          <Route path="/home" element={<Navigate to="/" replace />} />

          <Route
            path="*"
            element={
              <div className="p-10 text-center">
                Page not found — <a href="/" className="text-indigo-600">Go home</a>
              </div>
            }
          />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
