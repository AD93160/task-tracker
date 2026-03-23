import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDDcyFIbAzZwlF3nFIlP9w2eMohZy6S8_A",
  authDomain: "task-tracker-2ea82.firebaseapp.com",
  projectId: "task-tracker-2ea82",
  storageBucket: "task-tracker-2ea82.firebasestorage.app",
  messagingSenderId: "348969776971",
  appId: "1:348969776971:web:ab132d0e1bca59db971ace"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
