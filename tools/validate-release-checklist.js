// Validate release checklist fields required by production gate.
// Run: node tools/validate-release-checklist.js [path]

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const inputPath = process.argv[2] || 'release/release-checklist.json';
const checklistPath = path.join(root, inputPath);

function fail(message) {
  console.error(`Release checklist FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(checklistPath)) {
  fail(`missing file "${inputPath}". Use "release/release-checklist.template.json" as template.`);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
} catch (error) {
  fail(`invalid JSON in "${inputPath}": ${error.message || String(error)}`);
}

const requiredStringFields = [
  'failureId',
  'rootCause',
  'fixCommit'
];

const placeholderPattern = /^(tbd|todo|na|n\/a|none|unknown)$/i;
for (const field of requiredStringFields) {
  const value = String((data && data[field]) || '').trim();
  if (!value) {
    fail(`field "${field}" is required`);
  }
  if (placeholderPattern.test(value)) {
    fail(`field "${field}" cannot be a placeholder`);
  }
}

if (!/^[0-9a-f]{7,40}$/i.test(String(data.fixCommit).trim())) {
  fail('field "fixCommit" must be a git commit SHA (7-40 hex chars)');
}

if (!Array.isArray(data.validationEvidence) || data.validationEvidence.length === 0) {
  fail('field "validationEvidence" must be a non-empty array');
}

for (const [index, item] of data.validationEvidence.entries()) {
  const value = String(item || '').trim();
  if (!value) {
    fail(`validationEvidence[${index}] is empty`);
  }
}

console.log(`Release checklist OK: "${inputPath}" is valid.`);
