#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCOPES = [
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/datastore'
];

function usage(exitCode = 1) {
  console.error('Usage: node scripts/verify-setup.js <email-or-uid>');
  process.exit(exitCode);
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwtRs256({ clientEmail, privateKey, scope }) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
    scope
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64url(signer.sign(privateKey))}`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  if (!res.ok) {
    const message = json && json.error && (json.error.message || json.error.status)
      ? `${json.error.status || 'ERROR'}: ${json.error.message || ''}`.trim()
      : (text || `HTTP ${res.status}`);
    throw new Error(message);
  }
  return json;
}

function loadServiceAccount() {
  const keyPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'service-account-key.json')).trim();
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Service account key not found at ${keyPath}`);
  }
  const json = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  if (!json || !json.client_email || !json.private_key || !json.project_id) {
    throw new Error('Invalid service account key: missing client_email/private_key/project_id');
  }
  return { keyPath, json };
}

async function getAccessToken(serviceAccount) {
  const jwt = signJwtRs256({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
    scope: SCOPES.join(' ')
  });
  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', jwt);
  const json = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!json || !json.access_token) {
    throw new Error('OAuth token response missing access_token');
  }
  return json.access_token;
}

async function lookupUser({ projectId, accessToken, input }) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`;
  const body = input.includes('@') ? { email: [input] } : { localId: [input] };
  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const user = json && Array.isArray(json.users) ? json.users[0] : null;
  if (!user || !user.localId) {
    throw new Error(`User not found: ${input}`);
  }
  let claims = {};
  if (user.customAttributes) {
    try {
      claims = JSON.parse(String(user.customAttributes || '{}'));
    } catch (_) {
      claims = {};
    }
  }
  return {
    uid: String(user.localId || ''),
    email: String(user.email || ''),
    displayName: String(user.displayName || ''),
    customClaims: claims
  };
}

async function fetchDocument({ projectId, accessToken, documentPath }) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${documentPath}`;
  return fetchJson(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
}

async function runCollectionGroupProbe({ projectId, accessToken }) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'notifications', allDescendants: true }],
      limit: 1
    }
  };
  const rows = await fetchJson(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return Array.isArray(rows) ? rows.filter((row) => row.document).length : 0;
}

async function main() {
  const input = String(process.argv[2] || '').trim();
  if (!input) usage(1);

  const { keyPath, json: serviceAccount } = loadServiceAccount();
  const projectId = String(serviceAccount.project_id || '').trim();
  const accessToken = await getAccessToken(serviceAccount);

  console.log('=======================================');
  console.log(' Sale Zone Setup Verification');
  console.log('=======================================');
  console.log(`Key path: ${keyPath}`);
  console.log(`Project : ${projectId}`);
  console.log('');

  let passed = 0;
  let failed = 0;

  let user = null;
  try {
    user = await lookupUser({ projectId, accessToken, input });
    console.log(`PASS user exists: ${user.email || '(no email)'} (${user.uid})`);
    passed += 1;
  } catch (error) {
    console.log(`FAIL user lookup: ${error.message}`);
    console.log(`Remediation: node scripts/set-admin-claim.js ${input}`);
    failed += 1;
  }

  if (user) {
    const claims = user.customClaims || {};
    if (claims.admin === true || claims.role === 'admin') {
      console.log(`PASS admin claims: ${JSON.stringify(claims)}`);
      passed += 1;
    } else {
      console.log(`FAIL admin claims missing: ${JSON.stringify(claims)}`);
      console.log(`Remediation: node scripts/set-admin-claim.js ${input}`);
      failed += 1;
    }
  }

  try {
    const doc = await fetchDocument({
      projectId,
      accessToken,
      documentPath: 'settings/store'
    });
    const exists = !!(doc && doc.name);
    console.log(`PASS Firestore settings/store: ${exists ? 'reachable' : 'empty response'}`);
    passed += 1;
  } catch (error) {
    console.log(`FAIL Firestore settings/store: ${error.message}`);
    console.log('Remediation: bash scripts/deploy-firebase.sh');
    failed += 1;
  }

  try {
    const sampled = await runCollectionGroupProbe({ projectId, accessToken });
    console.log(`PASS notifications collectionGroup: reachable (${sampled} sampled docs)`);
    passed += 1;
  } catch (error) {
    console.log(`FAIL notifications collectionGroup: ${error.message}`);
    console.log('Remediation: firebase deploy --project sale-zone-601f0 --only firestore:rules,firestore:indexes');
    failed += 1;
  }

  console.log('');
  console.log('=======================================');
  if (failed === 0) {
    console.log(`All ${passed} checks passed.`);
  } else {
    console.log(`${passed} passed, ${failed} failed.`);
  }
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`Verification failed: ${error.message || error}`);
  process.exit(1);
});
