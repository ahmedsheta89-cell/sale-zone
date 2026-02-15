#!/usr/bin/env node
'use strict';

// Set Firebase Auth custom claims (admin role) using a Service Account.
//
// Why this exists:
// - Firestore rules and admin UI rely on server-issued custom claims (enterprise-grade).
// - Claims must be set from a trusted environment (service account), never from the frontend.
//
// Usage examples:
//   node tools/set-admin-claim.js --service-account C:\\keys\\svc.json --email you@domain.com
//   node tools/set-admin-claim.js --service-account ./svc.json --uid YOUR_UID --role admin
//   node tools/set-admin-claim.js --service-account ./svc.json --uid YOUR_UID --clear
//
// Notes:
// - The user must re-authenticate or force-refresh the ID token to receive updated claims.
// - This script uses the Google Identity Toolkit API with an OAuth2 service account token.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ID_TOOLKIT_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

function usage(exitCode = 1) {
  const msg = `
Usage:
  node tools/set-admin-claim.js --service-account <path> (--uid <uid> | --email <email>) [options]

Options:
  --service-account, --serviceAccount, -k   Path to service account JSON key (required)
  --project-id, --projectId                 Firebase/Google Cloud project id (defaults from key)
  --uid                                     Target Firebase Auth UID
  --email                                   Target user email (will lookup UID)
  --role                                    Role to set (default: admin)
  --claims                                  JSON string for exact claims (overrides --role)
  --compat-admin-bool                        Also set { admin: true } for legacy compatibility
  --clear                                   Clear all custom claims (sets to {})
  --dry-run                                 Print planned action only
  --help, -h                                Show help
`.trim();

  // eslint-disable-next-line no-console
  console.error(msg);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    serviceAccountPath: '',
    projectId: '',
    uid: '',
    email: '',
    role: 'admin',
    claimsJson: '',
    compatAdminBool: false,
    clear: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === '--help' || a === '-h') usage(0);

    if (a === '--service-account' || a === '--serviceAccount' || a === '-k') {
      args.serviceAccountPath = String(argv[++i] || '');
      continue;
    }

    if (a === '--project-id' || a === '--projectId') {
      args.projectId = String(argv[++i] || '');
      continue;
    }

    if (a === '--uid') {
      args.uid = String(argv[++i] || '');
      continue;
    }

    if (a === '--email') {
      args.email = String(argv[++i] || '');
      continue;
    }

    if (a === '--role') {
      args.role = String(argv[++i] || '');
      continue;
    }

    if (a === '--claims') {
      args.claimsJson = String(argv[++i] || '');
      continue;
    }

    if (a === '--compat-admin-bool') {
      args.compatAdminBool = true;
      continue;
    }

    if (a === '--clear') {
      args.clear = true;
      continue;
    }

    if (a === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    // Unknown arg
    // eslint-disable-next-line no-console
    console.error(`Unknown argument: ${a}`);
    usage(2);
  }

  return args;
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwtRs256({ clientEmail, privateKey, scope }) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60; // 1 hour

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
    scope,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const errMsg = json?.error?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(`${options?.method || 'GET'} ${url} failed: ${errMsg}`);
  }

  return json;
}

async function getAccessToken(serviceAccount) {
  const jwt = signJwtRs256({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
    scope: ID_TOOLKIT_SCOPE,
  });

  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', jwt);

  const json = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!json?.access_token) throw new Error('OAuth token response missing access_token');
  return json.access_token;
}

async function lookupUidByEmail({ projectId, accessToken, email }) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`;
  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: [email] }),
  });

  const uid = json?.users?.[0]?.localId;
  if (!uid) throw new Error(`No Firebase Auth user found for email: ${email}`);
  return uid;
}

async function updateCustomClaims({ projectId, accessToken, uid, claims }) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`;
  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      localId: uid,
      // API expects a STRING containing JSON.
      customAttributes: JSON.stringify(claims),
    }),
  });

  return json;
}

function loadServiceAccount(serviceAccountPath) {
  const resolved = path.resolve(process.cwd(), serviceAccountPath);
  const raw = fs.readFileSync(resolved, 'utf8');
  const json = JSON.parse(raw);

  if (!json?.client_email || !json?.private_key) {
    throw new Error('Invalid service account JSON: missing client_email/private_key');
  }

  return json;
}

function buildClaims(args) {
  if (args.clear) return {};

  if (args.claimsJson) {
    let parsed;
    try {
      parsed = JSON.parse(args.claimsJson);
    } catch (err) {
      throw new Error(`--claims must be valid JSON: ${err?.message || err}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('--claims must be a JSON object');
    }
    return parsed;
  }

  const role = String(args.role || '').trim();
  if (!role) throw new Error('--role must be a non-empty string');

  const claims = { role };
  if (args.compatAdminBool) claims.admin = true;
  return claims;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.serviceAccountPath) usage(2);
  if (!args.uid && !args.email) usage(2);
  if (args.uid && args.email) {
    // eslint-disable-next-line no-console
    console.error('Provide only one of --uid or --email (not both).');
    usage(2);
  }

  const serviceAccount = loadServiceAccount(args.serviceAccountPath);
  const projectId = String(args.projectId || serviceAccount.project_id || '').trim();
  if (!projectId) throw new Error('Missing project id. Provide --project-id or use a key containing project_id.');

  const claims = buildClaims(args);

  // eslint-disable-next-line no-console
  console.log('[INFO] Project:', projectId);
  // eslint-disable-next-line no-console
  console.log('[INFO] Claims :', JSON.stringify(claims));

  const accessToken = await getAccessToken(serviceAccount);
  const uid = args.uid || (await lookupUidByEmail({ projectId, accessToken, email: args.email }));

  // eslint-disable-next-line no-console
  console.log('[INFO] UID    :', uid);

  if (args.dryRun) {
    // eslint-disable-next-line no-console
    console.log('[DRY RUN] No changes were made.');
    return;
  }

  await updateCustomClaims({ projectId, accessToken, uid, claims });

  // eslint-disable-next-line no-console
  console.log('[OK] Custom claims updated. User must refresh ID token (logout/login).');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[ERROR]', err?.message || err);
  process.exit(1);
});

