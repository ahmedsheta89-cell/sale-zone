// firebase-config.js - Firebase Configuration
// ==========================================

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAtV6lPQkLfnchSPg1dwhAxh_2A-ZjzXuo",
  authDomain: "sale-zone-601f0.firebaseapp.com",
  projectId: "sale-zone-601f0",
  storageBucket: "sale-zone-601f0.firebasestorage.app",
  messagingSenderId: "2446302178",
  appId: "1:2446302178:web:2f25a3a4181ee6dcf137bb",
  measurementId: "G-V3JC43VQBC"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore
const db = firebase.firestore();

console.log('✅ Firebase initialized');
