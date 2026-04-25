import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TO DO: REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL FIREBASE WEB APP CONFIGURATION.
// 1. Go to Firebase Console -> Your Project -> Project Settings -> General.
// 2. Scroll down to "Your apps" and add a new "Web" app (</> icon).
const firebaseConfig = {
  apiKey: "AIzaSyAH5kicbZ_9Shhba4jYIoawTj8k9mz6Dfk",
  authDomain: "teno-21f35.firebaseapp.com",
  projectId: "teno-21f35",
  storageBucket: "teno-21f35.firebasestorage.app",
  messagingSenderId: "541939352779",
  appId: "1:541939352779:web:32c43c99dd8c187c3d074e",
  measurementId: "G-2JNSVHPNNG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();