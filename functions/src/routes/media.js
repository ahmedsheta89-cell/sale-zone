const express = require('express');
const { v2: cloudinary } = require('cloudinary');

const { assertReplayNotSeen } = require('../lib/replayGuard');
const { toTrimmedString } = require('../lib/validators');

function assertCloudinarySecrets(secrets = {}) {
  const cloudName = toTrimmedString(secrets.CLOUDINARY_CLOUD_NAME);
  const apiKey = toTrimmedString(secrets.CLOUDINARY_API_KEY);
  const apiSecret = toTrimmedString(secrets.CLOUDINARY_API_SECRET);
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Cloudinary secrets are missing.');
    error.code = 'cloudinary/missing-config';
    throw error;
  }
  return { cloudName, apiKey, apiSecret };
}

function sanitizeFolder(input) {
  const folder = toTrimmedString(input || 'sale-zone/products');
  if (!folder.startsWith('sale-zone/')) return 'sale-zone/products';
  return folder.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 120) || 'sale-zone/products';
}

function buildPublicId(uid, publicIdHint, timestamp) {
  const safeUid = String(uid || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36) || 'anon';
  const safeHint = String(publicIdHint || 'asset').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'asset';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${safeUid}_${safeHint}_${timestamp}_${rand}`;
}

function createMediaRouter({ db, logging, secretsProvider }) {
  const router = express.Router();

  router.post('/cloudinary-signature', async (req, res, next) => {
    try {
      const secrets = assertCloudinarySecrets(await secretsProvider());
      cloudinary.config({
        cloud_name: secrets.cloudName,
        api_key: secrets.apiKey,
        api_secret: secrets.apiSecret,
        secure: true
      });

      const uid = String(req.user && req.user.uid || '');
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = sanitizeFolder(req.body && req.body.folder);
      const publicIdHint = toTrimmedString(req.body && req.body.publicId).replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 40);
      const publicId = buildPublicId(uid, publicIdHint, timestamp);
      const replayKey = `${uid}:${folder}:${publicIdHint || 'asset'}`;

      await assertReplayNotSeen({
        db,
        scope: 'media-signature',
        key: replayKey,
        windowMs: 45 * 1000,
        metadata: {
          uid,
          folder,
          publicIdHint
        }
      });

      const signaturePayload = {
        folder,
        public_id: publicId,
        overwrite: 'false',
        timestamp
      };

      const signature = cloudinary.utils.api_sign_request(signaturePayload, secrets.apiSecret);

      await logging.adminActivity(req, {
        action: 'CLOUDINARY_SIGNATURE_ISSUED',
        details: {
          folder,
          publicId,
          overwrite: false,
          expiresAt: new Date((timestamp + 60) * 1000).toISOString()
        }
      });

      return res.json({
        ok: true,
        data: {
          signature,
          timestamp,
          cloudName: secrets.cloudName,
          apiKey: secrets.apiKey,
          folder,
          publicId,
          overwrite: false,
          expiresAt: new Date((timestamp + 60) * 1000).toISOString()
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createMediaRouter
};
