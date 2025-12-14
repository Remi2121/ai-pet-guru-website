// src/pages/Lost/Lost.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth, ensureSignedIn } from "../../../firebase";

export default function Lost() {
  // Form state
  const [mode, setMode] = useState("lost"); // "lost" | "found"
  const [file, setFile] = useState(null);
  const [imgB64, setImgB64] = useState(null);
  const [fileName, setFileName] = useState("");
  const [petName, setPetName] = useState("");
  const [color, setColor] = useState("");
  const [location, setLocation] = useState("");
  const [lastSeen, setLastSeen] = useState("");

  // UI state
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // NEW: my posts (realtime)
  const [myPosts, setMyPosts] = useState([]);
  const [myLoading, setMyLoading] = useState(true);

  const normalize = (s) => (s || "").trim().toLowerCase();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFileName(f.name);
    setResults([]);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      setImgB64(base64);
    };
    reader.readAsDataURL(f);
  };

  const uploadImageIfAny = async () => {
    if (!file) return null; // photo optional
    const folder = mode === "lost" ? "lostPets" : "foundPets";
    const path = `${folder}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const saveReport = async () => {
    if (!location) {
      alert("Please enter the last seen / found location.");
      return;
    }
    setSaving(true);
    try {
      await ensureSignedIn();

      const photoURL = await uploadImageIfAny();
      const col = mode === "lost" ? "lostPets" : "foundPets";

      await addDoc(collection(db, col), {
        type: mode,
        petName: petName || null,
        petName_lc: petName ? normalize(petName) : null,
        color: color || null,
        location,
        location_lc: normalize(location),
        lastSeen: lastSeen || null,
        photoURL: photoURL || null,
        createdAt: serverTimestamp(),
        byUid: auth?.currentUser?.uid || null,
      });

      setFile(null);
      setFileName("");
      setImgB64(null);
      alert("Posted successfully! ✅");
    } catch (e) {
      console.error("saveReport error:", e);
      alert(
        e?.code === "permission-denied"
          ? "Sign-in required. Please refresh and try again."
          : "Failed to post. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Search both collections for matches on petName/location
  const findMatches = async () => {
    setLoading(true);
    setResults([]);
    try {
      const wantName = normalize(petName);
      const wantLoc = normalize(location);

      const run = async (colName) => {
        const col = collection(db, colName);
        const batches = [];

        if (wantName && wantLoc) {
          batches.push(
            getDocs(
              query(
                col,
                where("petName_lc", "==", wantName),
                where("location_lc", "==", wantLoc),
                orderBy("createdAt", "desc"),
                limit(10)
              )
            )
          );
        }
        if (wantLoc) {
          batches.push(
            getDocs(
              query(
                col,
                where("location_lc", "==", wantLoc),
                orderBy("createdAt", "desc"),
                limit(10)
              )
            )
          );
        }
        if (wantName) {
          batches.push(
            getDocs(
              query(
                col,
                where("petName_lc", "==", wantName),
                orderBy("createdAt", "desc"),
                limit(10)
              )
            )
          );
        }
        if (!wantName && !wantLoc) {
          batches.push(
            getDocs(query(col, orderBy("createdAt", "desc"), limit(12)))
          );
        }

        const snaps = await Promise.all(batches);
        const items = [];
        snaps.forEach((snap) =>
          snap.forEach((doc) =>
            items.push({ id: doc.id, ...doc.data(), _col: colName })
          )
        );
        return items;
      };

      const [lostItems, foundItems] = await Promise.all([
        run("lostPets"),
        run("foundPets"),
      ]);

      const merged = [...lostItems, ...foundItems];
      merged.sort((a, b) => {
        const ta = a?.createdAt?.toMillis?.() || 0;
        const tb = b?.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });

      setResults(merged);
    } catch (e) {
      console.error(e);
      alert("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- NEW: Realtime "My Posts" below the form ----------
  useEffect(() => {
    let unsubscribes = [];
    let isMounted = true;

    const setup = async () => {
      try {
        setMyLoading(true);
        const user = await ensureSignedIn();
        const uid = user?.uid;
        if (!uid) {
          setMyPosts([]);
          setMyLoading(false);
          return;
        }

        const qLost = query(
          collection(db, "lostPets"),
          where("byUid", "==", uid),
          orderBy("createdAt", "desc"),
          limit(25)
        );
        const qFound = query(
          collection(db, "foundPets"),
          where("byUid", "==", uid),
          orderBy("createdAt", "desc"),
          limit(25)
        );

        const unsubLost = onSnapshot(qLost, (snap) => {
          const items = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            _col: "lostPets",
          }));
          if (!isMounted) return;
          setMyPosts((prev) => {
            // merge lost into existing found
            const foundOnly = prev.filter((x) => x._col === "foundPets");
            return sortByDate([...items, ...foundOnly]);
          });
        });

        const unsubFound = onSnapshot(qFound, (snap) => {
          const items = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            _col: "foundPets",
          }));
          if (!isMounted) return;
          setMyPosts((prev) => {
            const lostOnly = prev.filter((x) => x._col === "lostPets");
            return sortByDate([...lostOnly, ...items]);
          });
        });

        unsubscribes = [unsubLost, unsubFound];
      } finally {
        setMyLoading(false);
      }
    };

    setup();

    return () => {
      isMounted = false;
      unsubscribes.forEach((u) => u && u());
    };
  }, []);

  const sortByDate = (arr) =>
    [...arr].sort((a, b) => {
      const ta = a?.createdAt?.toMillis?.() || 0;
      const tb = b?.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

  // ---------- UI ----------
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: "var(--brand-primary)" }}
      >
        Lost Pet Finder
      </h1>

      <p className="text-slate-600 mb-6">
        Upload your pet’s photo and details. We’ll show similar reports already
        posted nearby.
      </p>

      {/* Mode Toggle */}
      <div className="mb-6 inline-flex rounded-xl overflow-hidden border">
        <button
          onClick={() => setMode("lost")}
          className={`px-4 py-2 ${
            mode === "lost"
              ? "bg-(--brand-primary) text-white"
              : "bg-white"
          }`}
        >
          I lost a pet
        </button>
        <button
          onClick={() => setMode("found")}
          className={`px-4 py-2 ${
            mode === "found"
              ? "bg-(--brand-primary) text-white"
              : "bg-white"
          }`}
        >
          I found a pet
        </button>
      </div>

      {/* Upload + Form */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {/* Upload section */}
        <div className="bg-white rounded-2xl shadow p-4">
          <label className="font-medium text-sm text-slate-700 mb-2 block">
            {mode === "lost" ? "Upload your pet image" : "Upload the found pet image"}
            <span className="text-slate-400"> (optional)</span>
          </label>

          <input type="file" accept="image/*" onChange={handleFile} />

          <div className="mt-4">
            {imgB64 ? (
              <img
                src={`data:image/png;base64,${imgB64}`}
                className="w-full h-64 object-cover rounded-xl border"
                alt="pet upload"
              />
            ) : (
              <div className="w-full h-48 border border-dashed rounded-xl grid place-items-center text-slate-400">
                No image selected
              </div>
            )}
          </div>

          {fileName && (
            <p className="text-xs text-slate-500 mt-2">{fileName}</p>
          )}
        </div>

        {/* Details form */}
        <div className="bg-white rounded-2xl shadow p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Pet name (optional)
            </label>
            <input
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="e.g., Bruno"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Color / markings
            </label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g., brown & white"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              {mode === "lost" ? "Last seen location" : "Found at location"}
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Colombo bus stand"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              {mode === "lost" ? "Last seen date" : "Found date"}
            </label>
            <input
              type="date"
              value={lastSeen}
              onChange={(e) => setLastSeen(e.target.value)}
              className="w-full mt-2 px-3 py-2 rounded-lg border"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={saveReport}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-white w-full"
              style={{ background: "var(--brand-primary)" }}
            >
              {saving
                ? "Posting…"
                : mode === "lost"
                ? "Post Lost Report"
                : "Post Found Report"}
            </button>

            <button
              onClick={findMatches}
              disabled={loading}
              className="px-4 py-2 rounded-xl border w-full"
            >
              {loading ? "Searching…" : "Find Matches"}
            </button>
          </div>
        </div>
      </div>

      {/* Realtime - My Posts */}
      <h2 className="text-xl font-semibold mb-3">My Posts</h2>
      {myLoading && <p className="text-slate-500">Loading your posts…</p>}
      {!myLoading && myPosts.length === 0 && (
        <p className="text-slate-500">You haven’t posted anything yet.</p>
      )}
      <div className="grid sm:grid-cols-2 gap-6 mt-4">
        {myPosts.map((r) => (
          <Card key={`mine-${r._col}-${r.id}`} item={r} />
        ))}
      </div>

      {/* Search Results */}
      <h2 className="text-xl font-semibold mt-10 mb-3">Possible matches</h2>
      {loading && <p className="text-slate-500">Searching reports…</p>}
      {!loading && results.length === 0 && (
        <p className="text-slate-500">
          No matches yet. Try posting or adjust your search.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-6 mt-4">
        {results.map((r) => (
          <Card key={`res-${r._col}-${r.id}`} item={r} />
        ))}
      </div>
    </div>
  );
}

function Card({ item: r }) {
  return (
    <div className="bg-white rounded-xl shadow p-3 hover:shadow-lg transition">
      <img
        src={
          r.photoURL ||
          "https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg"
        }
        className="w-full h-52 object-cover rounded-lg"
        alt="pet"
      />
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {r.petName || "Unnamed"} • {r._col === "lostPets" ? "Lost" : "Found"}
          </h3>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              r._col === "lostPets"
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {r._col === "lostPets" ? "Lost" : "Found"}
          </span>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          <span className="font-medium">Location:</span> {r.location || "-"}
        </p>
        {r.color && (
          <p className="text-sm text-slate-600">
            <span className="font-medium">Color:</span> {r.color}
          </p>
        )}
        {r.lastSeen && (
          <p className="text-sm text-slate-600">
            <span className="font-medium">
              {r._col === "lostPets" ? "Last seen" : "Date"}:
            </span>{" "}
            {r.lastSeen}
          </p>
        )}
        <button
          className="mt-3 w-full px-3 py-2 rounded-xl text-white"
          style={{ background: "var(--brand-primary)" }}
          onClick={() => {
            const info = `Report: ${r.petName || "Pet"}\nType: ${
              r._col === "lostPets" ? "Lost" : "Found"
            }\nLocation: ${r.location}\nDoc ID: ${r.id}\nCollection: ${r._col}`;
            navigator.clipboard.writeText(info);
            alert("Copied report details! Share with the finder/owner.");
          }}
        >
          Copy Report Details
        </button>
      </div>
    </div>
  );
}
