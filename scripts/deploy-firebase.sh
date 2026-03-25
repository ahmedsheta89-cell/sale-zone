#!/bin/bash
set -euo pipefail

PROJECT_ID="sale-zone-601f0"

echo "======================================="
echo " Sale Zone Firebase Deployment Helper"
echo "======================================="
echo

if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI not found."
  echo "Install it with: npm install -g firebase-tools"
  echo "Then run: firebase login"
  exit 1
fi

echo "Using Firebase project: ${PROJECT_ID}"
if firebase use "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Firebase alias is available locally."
else
  echo "Firebase alias is not configured locally. Deploy commands will use --project ${PROJECT_ID}."
fi

echo
echo "[1/2] Deploying Firestore rules..."
firebase deploy --project "${PROJECT_ID}" --only firestore:rules
echo "Rules deployed."

echo
echo "[2/2] Deploying Firestore indexes..."
firebase deploy --project "${PROJECT_ID}" --only firestore:indexes
echo "Indexes submitted. Firebase may take a few minutes to build them."

echo
echo "Deployment finished."
echo "Next steps:"
echo "  1. node scripts/set-admin-claim.js <admin-email-or-uid>"
echo "  2. node scripts/verify-setup.js <admin-email-or-uid>"
echo "  3. Logout and login again in the admin panel"
