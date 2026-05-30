import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 🔥 Your Firebase config (cleaned)
const firebaseConfig = {
  apiKey: "AIzaSyAE5tw9lndZf-kXz2ZV2ESMMHCzZVBVXSk",
  authDomain: "dripps-app.firebaseapp.com",
  projectId: "dripps-app",
  storageBucket: "dripps-app.firebasestorage.app",
  messagingSenderId: "1019121085121",
  appId: "1:1019121085121:web:7409ebac4ccd0e4cd84240",
  measurementId: "G-YRPJD2ZHZG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const db = getFirestore(app);
export const auth = getAuth(app);