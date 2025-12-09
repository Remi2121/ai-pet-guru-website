/* eslint-disable no-unused-vars */
// src/pages/Voice/Voice.jsx
import React, { useState, useRef } from "react";

export default function Voice() {
  const [recording, setRecording] = useState(false);
  const [audioB64, setAudioB64] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      audioChunks.current = [];

      recorder.ondataavailable = (e) => audioChunks.current.push(e.data);
      recorder.onstop = handleStop;

      recorder.start();
      setRecording(true);
      setResult(null);
    } catch (err) {
      alert("Microphone permission denied.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  // Convert blob to base64
  const handleStop = async () => {
    const blob = new Blob(audioChunks.current, { type: "audio/webm" });

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1];
      setAudioB64(base64String);
    };
    reader.readAsDataURL(blob);
  };

  // Mock analysis
  const analyze = async () => {
    if (!audioB64) {
      alert("Record voice before analyzing.");
      return;
    }

    setLoading(true);
    setResult(null);

    await new Promise((r) => setTimeout(r, 1500)); // simulate AI

    setResult({
      disease: "Cough / Throat Irritation",
      confidence: 0.72,
      advice: [
        "Provide warm water",
        "Avoid cold outdoor climate",
        "Monitor breathing sound",
      ],
      danger: "low",
    });

    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: "var(--brand-primary)" }}
      >
        Voice Symptom Checker
      </h1>
      <p className="text-slate-600 mb-6 text-sm">
        Record your pet’s coughing, breathing, or whining sound. AI will gently suggest possibilities.
      </p>

      {/* Recording Box */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6 text-center">
        <div className="text-lg font-semibold mb-4">
          {recording ? "Recording…" : "Press the button to start"}
        </div>

        {/* Audio animated circle */}
        <div className="flex justify-center mb-6">
          <div
            className={`h-24 w-24 rounded-full border-4 ${
              recording
                ? "border-red-500 animate-pulse"
                : "border-slate-300"
            }`}
          ></div>
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
      </div>

      {/* Audio Preview */}
      {audioB64 && (
        <div className="bg-white rounded-2xl shadow p-5 mb-6">
          <h3 className="font-semibold mb-2">Preview</h3>
          <audio controls src={`data:audio/webm;base64,${audioB64}`} className="w-full"></audio>
        </div>
      )}

      {/* Analyze Button */}
      {audioB64 && (
        <button
          onClick={analyze}
          disabled={loading}
          className="w-full px-4 py-3 mt-2 rounded-xl text-white font-medium"
          style={{ background: "var(--brand-primary)" }}
        >
          {loading ? "Analyzing…" : "Analyze Voice"}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <h2 className="text-xl font-bold mb-2">{result.disease}</h2>
          <p className="text-slate-600 mb-3">
            Confidence: {(result.confidence * 100).toFixed(0)}%
          </p>

          <h4 className="font-medium mb-1">Advice</h4>
          <ul className="list-disc ml-6 text-sm text-slate-700 space-y-1">
            {result.advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>

          <div className="mt-4">
            <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm">
              Danger Level: {result.danger.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
