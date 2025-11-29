// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


// TODO: PASTE YOUR COPIED CONFIG OBJECT HERE
// (It should look like the lines below)
const firebaseConfig = {
 apiKey: "AIzaSyCro9-bliMi3R0hh6wf-F6-7COCj7ldZTE",
  authDomain: "lost-and-found-5f8b4.firebaseapp.com",
  projectId: "lost-and-found-5f8b4",
  storageBucket: "lost-and-found-5f8b4.firebasestorage.app",
  messagingSenderId: "779960867118",
  appId: "1:779960867118:web:e6c3c7abb87187492fc2bf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the "Electricity" so other files can use it
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
