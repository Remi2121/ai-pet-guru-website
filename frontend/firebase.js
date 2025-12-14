// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBKg2zAG2DjY7YhvI0cbB62jqExIA4mNx4",
  authDomain: "ai-pet-guru.firebaseapp.com",
  projectId: "ai-pet-guru",
  // IMPORTANT: use appspot.com bucket
  storageBucket: "ai-pet-guru.appspot.com",
  messagingSenderId: "866841156236",
  appId: "1:866841156236:web:8b281b184da3732c0439a9",
  measurementId: "G-GPXRKWHL4J",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Optional offline cache
enableIndexedDbPersistence(db).catch(() => {});

// Ensure there is a user (anonymous ok)
export const ensureSignedIn = () =>
  new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        unsub();
        resolve(u);
        return;
      }
      try {
        const cred = await signInAnonymously(auth);
        unsub();
        resolve(cred.user);
      } catch (e) {
        unsub();
        reject(e);
      }
    });
  });
