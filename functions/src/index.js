const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const { createApp } = require('./app');
const { createLogging } = require('./lib/logging');

const CLOUDINARY_CLOUD_NAME = defineSecret('CLOUDINARY_CLOUD_NAME');
const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const logging = createLogging({ db });

function getSecrets() {
  return {
    CLOUDINARY_CLOUD_NAME: CLOUDINARY_CLOUD_NAME.value(),
    CLOUDINARY_API_KEY: CLOUDINARY_API_KEY.value(),
    CLOUDINARY_API_SECRET: CLOUDINARY_API_SECRET.value()
  };
}

const app = createApp({
  admin,
  db,
  logging,
  secretsProvider: async () => getSecrets()
});

exports.api = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '512MiB',
    cors: true,
    secrets: [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]
  },
  app
);
