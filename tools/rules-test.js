// Firestore rules policy checks (static gate).
// Run: node tools/rules-test.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const rulesPath = path.join(root, 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

const failures = [];

function requirePattern(label, pattern, details) {
  if (!pattern.test(rules)) {
    failures.push(`${label}: ${details}`);
  }
}

function forbidPattern(label, pattern, details) {
  if (pattern.test(rules)) {
    failures.push(`${label}: ${details}`);
  }
}

requirePattern(
  'rules-helper',
  /function\s+isVerifiedUser\(\)\s*\{[\s\S]*request\.auth\.token\.email_verified\s*==\s*true[\s\S]*\}/,
  'isVerifiedUser() must require email_verified == true'
);

requirePattern(
  'scenario-anonymous-client-error',
  /match\s+\/client_error_logs\/\{logId\}[\s\S]*allow\s+create:\s*if\s+isVerifiedUser\(\)\s*&&\s*isValidClientErrorCreate\(\)\s*;/,
  'client_error_logs create must require verified auth'
);

requirePattern(
  'scenario-anonymous-store-events',
  /match\s+\/store_events\/\{eventId\}[\s\S]*allow\s+create:\s*if\s+isAdmin\(\)\s*\|\|\s*\(isVerifiedUser\(\)\s*&&\s*isValidStoreEventCreate\(\)\)\s*;/,
  'store_events create must require admin or verified user'
);

requirePattern(
  'scenario-auth-store-live-sessions',
  /match\s+\/store_live_sessions\/\{sessionId\}[\s\S]*allow\s+create,\s*update:\s*if[\s\S]*isSignedIn\(\)/,
  'store_live_sessions create/update must require signed-in user'
);

requirePattern(
  'scenario-path-binding-store-live-sessions',
  /match\s+\/store_live_sessions\/\{sessionId\}[\s\S]*request\.resource\.data\.sessionId\s*==\s*sessionId/,
  'store_live_sessions must bind payload sessionId to document path'
);

requirePattern(
  'scenario-admin-read-telemetry',
  /match\s+\/client_error_logs\/\{logId\}[\s\S]*allow\s+read,\s*update,\s*delete:\s*if\s+isAdmin\(\)\s*;/,
  'client_error_logs read/update/delete must stay admin-only'
);

requirePattern(
  'scenario-admin-read-store-events',
  /match\s+\/store_events\/\{eventId\}[\s\S]*allow\s+read,\s*update,\s*delete:\s*if\s+isAdmin\(\)\s*;/,
  'store_events read/update/delete must stay admin-only'
);

requirePattern(
  'scenario-admin-read-store-live-sessions',
  /match\s+\/store_live_sessions\/\{sessionId\}[\s\S]*allow\s+read,\s*delete:\s*if\s+isAdmin\(\)\s*;/,
  'store_live_sessions read/delete must stay admin-only'
);

forbidPattern(
  'forbid-open-client-error-create',
  /match\s+\/client_error_logs\/\{logId\}[\s\S]*allow\s+create:\s*if\s+true\s*;/,
  'open write detected on client_error_logs'
);

forbidPattern(
  'forbid-open-store-events-create',
  /match\s+\/store_events\/\{eventId\}[\s\S]*allow\s+create:\s*if\s+true\s*;/,
  'open write detected on store_events'
);

forbidPattern(
  'forbid-open-store-live-sessions-create-update',
  /match\s+\/store_live_sessions\/\{sessionId\}[\s\S]*allow\s+create,\s*update:\s*if\s+true\s*;/,
  'open write detected on store_live_sessions'
);

if (failures.length) {
  console.error('Rules gate FAILED:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('Rules gate OK: telemetry and admin access policy checks passed.');
