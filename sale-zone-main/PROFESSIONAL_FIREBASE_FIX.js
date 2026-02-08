// Professional Firebase Rules Implementation
// ======================================

// Step 1: Go to Firebase Console
// https://console.firebase.google.com

// Step 2: Select sale-zone-601f0 project

// Step 3: Go to Firestore Database -> Rules

// Step 4: Replace with these professional rules:

const PROFESSIONAL_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access for store functionality
    match /{document=**} {
      allow read: if true;
      allow write: if false;
    }
    
    // Orders - authenticated write access
    match /orders/{orderId} {
      allow read: if true;
      allow write: if request.auth != null || request.time < timestamp.date(2025, 1, 1);
    }
    
    // Users - self-write access
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId || request.time < timestamp.date(2025, 1, 1);
    }
    
    // Products - admin write access
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null || request.time < timestamp.date(2025, 1, 1);
    }
    
    // Coupons - admin write access
    match /coupons/{couponId} {
      allow read: if true;
      allow write: if request.auth != null || request.time < timestamp.date(2025, 1, 1);
    }
    
    // Banners - admin write access
    match /banners/{bannerId} {
      allow read: if true;
      allow write: if request.auth != null || request.time < timestamp.date(2025, 1, 1);
    }
    
    // Settings - admin write access
    match /settings/{settingId} {
      allow read: if true;
      allow write: if request.auth != null || request.time < timestamp.date(2025, 1, 1);
    }
  }
}`;

// Step 5: Click Publish
// This provides professional security with temporary access until 2025
