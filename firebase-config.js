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

// Initialize Firebase with CORS fix for GitHub Pages
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore with CORS settings
const db = firebase.firestore();

// Fix for GitHub Pages CORS issues
if (window.location.hostname === 'ahmedsheta89-cell.github.io') {
    // Disable Firebase real-time features on GitHub Pages to avoid CORS errors
    console.log('?? GitHub Pages detected - using localStorage fallback to avoid CORS errors');

    // Override Firebase functions to use localStorage
    window.getAllProducts = async () => {
        const products = localStorage.getItem('sale_zone_products');
        return products ? JSON.parse(products) : [];
    };

    window.getCoupons = async () => {
        const coupons = localStorage.getItem('sale_zone_coupons');
        return coupons ? JSON.parse(coupons) : [];
    };

    window.getBanners = async () => {
        const banners = localStorage.getItem('sale_zone_banners');
        return banners ? JSON.parse(banners) : [];
    };
} else {
    console.log('? Firebase initialized');
}
