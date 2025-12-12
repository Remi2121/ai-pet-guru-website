/* eslint-disable no-unused-vars */
// src/pages/Voice/Voice.jsx
import React, { useState, useRef } from "react";

export default function Voice() {
  const [recording, setRecording] = useState(false);
  const [audioB64, setAudioB64] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const mimePreferred = React.useRef(
    (() => {
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
        if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
      }
      return "audio/webm"; // fallback
    })()
  );

  // --- Start recording
  const startRecording = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mimePreferred.current });
      mediaRecorderRef.current = rec;
      audioChunks.current = [];
      rec.ondataavailable = (e) => audioChunks.current.push(e.data);
      rec.onstop = handleStop;
      rec.start();
      setRecording(true);
      setResult(null);
    } catch (e) {
      console.error(e);
      setErr("Microphone permission denied or unsupported.");
      alert("Microphone permission denied or unsupported.");
    }
  };

  // --- Stop recording
  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch { /* empty */ }
    setRecording(false);
  };

  // --- Convert blob -> base64
  const handleStop = async () => {
    try {
      const blob = new Blob(audioChunks.current, { type: mimePreferred.current });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = String(reader.result || "").split(",")[1];
        setAudioB64(base64String || null);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error(e);
      setErr("Could not read recorded audio.");
    }
  };

  // --- Call backend
  const analyze = async () => {
    if (!audioB64) {
      alert("Record voice before analyzing.");
      return;
    }
    setLoading(true);
    setResult(null);
    setErr("");

    try {
      const res = await fetch("http://localhost:8000/api/voice/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_b64: audioB64,
          mime: mimePreferred.current.includes("webm") ? "audio/webm" : "audio/webm",
        }),
      });

      if (!res.ok) {
        let msg = "Server error";
        try {
          const j = await res.json();
          msg = j?.detail || JSON.stringify(j);
        } catch { /* empty */ }
        setErr(msg);
        alert(msg);
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
      setErr("Network/Server error");
      alert("Network/Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
        Voice Symptom Checker
      </h1>
      <p className="text-slate-600 mb-6 text-sm">
        Record your pet’s coughing, breathing, or whining sound. AI will gently suggest possibilities.
      </p>

      <div className="bg-white rounded-2xl shadow p-6 mb-6 text-center">
        <div className="text-lg font-semibold mb-4">
          {recording ? "Recording…" : "Press the button to start"}
        </div>

        <div className="flex justify-center mb-6">
          <div
            className={`h-24 w-24 rounded-full border-4 ${
              recording ? "border-red-500 animate-pulse" : "border-slate-300"
            }`}
          />
        </div>

        {!recording ? (
          <button
            onClick={startRecording}
            className="px-6 py-3 rounded-xl text-white font-medium"
            style={{ background: "var(--brand-primary)" }}
          >
            🎤 Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-6 py-3 rounded-xl bg-red-500 text-white font-medium"
          >
            ⏹ Stop Recording
          </button>
        )}

        {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
      </div>

      {audioB64 && (
        <>
          <div className="bg-white rounded-2xl shadow p-5 mb-6">
            <h3 className="font-semibold mb-2">Preview</h3>
            <audio
              controls
              src={`data:${mimePreferred.current};base64,${audioB64}`}
              className="w-full"
            />
          </div>

          <button
            onClick={analyze}
            disabled={loading}
            className="w-full px-4 py-3 mt-2 rounded-xl text-white font-medium"
            style={{ background: "var(--brand-primary)" }}
          >
            {loading ? "Analyzing…" : "Analyze Voice"}
          </button>
        </>
      )}

      {result && result.disease && (
        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <h2 className="text-xl font-bold mb-2">{result.disease}</h2>

          {"confidence" in result && (
            <p className="text-slate-600 mb-3">
              Confidence: {Math.round((result.confidence || 0) * 100)}%
            </p>
          )}

          {Array.isArray(result.advice) && result.advice.length > 0 && (
            <>
              <h4 className="font-medium mb-1">Advice</h4>
              <ul className="list-disc ml-6 text-sm text-slate-700 space-y-1">
                {result.advice.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}

          {result.danger && (
            <div className="mt-4">
              <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm">
                Danger Level: {String(result.danger).toUpperCase()}
              </span>
            </div>
          )}

          {/* Optional: show raw predictions for debugging */}
          {Array.isArray(result.raw) && result.raw.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-slate-600">Raw model output</summary>
              <pre className="text-xs bg-slate-50 p-3 rounded-xl overflow-auto">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
