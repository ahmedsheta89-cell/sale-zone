// Preflight checks to prevent recurring encoding/JS syntax regressions.
// Run: node tools/preflight.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const errors = [];
const sourceExtRegex = /\.(html?|js|css)$/i;
const htmlExtRegex = /\.html?$/i;
const ignoredDirs = new Set(['.git', 'node_modules', 'tools']);

function hasUtf8Bom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath);

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...walk(fullPath));
      }
      continue;
    }

    if (sourceExtRegex.test(entry.name)) {
      files.push(relPath);
    }
  }

  return files;
}

function checkMojibake(file, text) {
  const checks = [
    { regex: /\uFFFD/, message: 'contains replacement character (�)' },
    { regex: /\u00A7/, message: 'contains illegal U+00A7 (§)' },
    { regex: /[Ãâ][\u0080-\u024F]/, message: 'contains mojibake marker (Ã/â...)' },
    { regex: /(?:[طظ][\u0600-\u06FF]){4,}/, message: 'contains probable Arabic mojibake sequence' },
    { regex: /ًں/, message: 'contains emoji mojibake marker (ًں...)' },
    { regex: /ï»¿|ï؟½/, message: 'contains UTF mojibake marker (ï...)' }
  ];

  for (const check of checks) {
    if (check.regex.test(text)) {
      errors.push(`${file}: ${check.message}`);
    }
  }
}

const sourceFiles = walk(root);

for (const file of sourceFiles) {
  const filePath = path.join(root, file);
  const buf = fs.readFileSync(filePath);
  const text = buf.toString('utf8');

  checkMojibake(file, text);

  if (htmlExtRegex.test(file)) {
    if (!hasUtf8Bom(buf)) {
      errors.push(`${file}: missing UTF-8 BOM`);
    }

    if (!/<meta\s+charset=["']?utf-8["']?/i.test(text)) {
      errors.push(`${file}: missing <meta charset="UTF-8">`);
    }

    const arabicKeyRegex = /[,{]\s*([\u0600-\u06FF]+)\s*:/g;
    if (arabicKeyRegex.test(text)) {
      errors.push(`${file}: contains unquoted Arabic object keys`);
    }
  }
}

if (errors.length) {
  console.error('\nPreflight FAILED:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

console.log('Preflight OK: encoding and syntax guards passed.');
