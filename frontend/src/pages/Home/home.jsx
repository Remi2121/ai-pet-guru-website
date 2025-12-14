// src/pages/Home/Home.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import heroDog from "../../assets/pet-hero.png";

import { auth, db, storage, ensureSignedIn } from "../../../firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Home() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState({
    displayName: "",
    petPhotoUrl: "",
  });
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Sign in (anonymous) and subscribe to Firestore profile
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const user = await ensureSignedIn();
      setUid(user.uid);
      const dref = doc(db, "profiles", user.uid);
      unsub = onSnapshot(dref, (snap) => {
        if (snap.exists()) setProfile((p) => ({ ...p, ...snap.data() }));
      });
    })();
    return () => unsub();
  }, []);

  // Auto-save name
  const handleNameChange = async (val) => {
    setProfile((p) => ({ ...p, displayName: val }));
    if (!uid) return;
    await setDoc(
      doc(db, "profiles", uid),
      { displayName: val.trim(), updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  // Upload pet avatar
  const pickFile = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    try {
      setUploading(true);
      const ext = file.name.split(".").pop() || "jpg";
      const sref = storageRef(storage, `pet-avatars/${uid}.${ext}`);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      await setDoc(
        doc(db, "profiles", uid),
        { petPhotoUrl: url, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setProfile((p) => ({ ...p, petPhotoUrl: url }));
    } catch (err) {
      console.error(err);
      alert("Upload failed, try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const avatar =
    profile.petPhotoUrl ||
    "https://www.allianz.ie/blog/your-pet/choosing-a-pedigree-pet/_jcr_content/root/stage/stageimage.img.82.1920.jpeg/1727944382981/cute-happy-pup.jpeg";

  const name =
    (profile.displayName && profile.displayName.trim()) ||
    (auth.currentUser?.isAnonymous ? "" : auth.currentUser?.uid?.slice(0, 6)) ||
    "";

  return (
    <div className="min-h-[80vh] flex flex-col md:flex-row items-center justify-between px-6 md:px-16 mt-10">
      {/* LEFT SIDE */}
      <div className="w-full md:max-w-xl space-y-6">
        {/* Avatar + Name input */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={avatar}
              alt="Pet avatar"
              className="w-16 h-16 rounded-full border object-cover"
            />
            <button
              onClick={pickFile}
              className="absolute -bottom-1 -right-1 text-xs px-2 py-1 rounded-lg bg-black/80 text-white hover:opacity-90 cursor-pointer"
            >
              {uploading ? "..." : "📷"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <div className="flex-1">
            <div className="text-sm text-slate-500">Welcome 👋</div>
            {name ? (
              <div className="text-xl font-semibold">{name}</div>
            ) : (
              <input
                type="text"
                placeholder="Enter your name"
                value={profile.displayName || ""}
                onChange={(e) => handleNameChange(e.target.value)}
                className="px-3 py-2 border rounded-lg w-48"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* TITLE */}
        <h1
          className="text-4xl md:text-5xl font-bold leading-tight moving-text"
          style={{ color: "var(--brand-primary)" }}
        >
          <span>Intelligent</span> <span>Pet</span> <span>Care,</span>
          <br />
          <span>Made</span> <span>Simple</span> <span>❤️</span> <span>🐾</span>
        </h1>

        <p className="text-slate-600 text-lg">
          Upload a photo, describe symptoms, or ask questions.  
          Our AI helps you detect diseases, choose food, track vaccines,  
          and care for your pet like a pro.
        </p>

        <div className="flex flex-wrap gap-4 pt-4">
          <Link
            to="/disease"
            className="px-6 py-3 rounded-xl text-white font-medium shadow-md hover:opacity-90 cursor-pointer"
            style={{ background: "var(--brand-primary)" }}
          >
            Start Image Check
          </Link>

          <Link
            to="/recommend"
            className="px-6 py-3 rounded-xl border border-[color:var(--brand-primary)] text-[color:var(--brand-primary)] hover:bg-[color:var(--brand-primary)]/10 cursor-pointer"
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
