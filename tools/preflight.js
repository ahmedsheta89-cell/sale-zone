// Preflight checks to prevent recurring encoding/JS syntax regressions.
// Run: node tools/preflight.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const htmlFiles = fs.readdirSync(root).filter(f => /\.html$/i.test(f));

const errors = [];

function hasUtf8Bom(buf) {
  return buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
}

for (const file of htmlFiles) {
  const filePath = path.join(root, file);
  const buf = fs.readFileSync(filePath);
  const text = buf.toString('utf8');

  if (!hasUtf8Bom(buf)) {
    errors.push(`${file}: missing UTF-8 BOM`);
  }

  if (!/<meta\s+charset=["']?utf-8["']?/i.test(text)) {
    errors.push(`${file}: missing <meta charset="UTF-8">`);
  }

  if (text.includes('\uFFFD')) {
    errors.push(`${file}: contains replacement character (?)`);
  }

  if (text.includes('\u00A7')) {
    errors.push(`${file}: contains illegal U+00A7 (?)`);
  }

  const arabicKeyRegex = /[,{]\s*([\u0600-\u06FF]+)\s*:/g;
  if (arabicKeyRegex.test(text)) {
    errors.push(`${file}: contains unquoted Arabic object keys`);
  }
}

if (errors.length) {
  console.error('\nPreflight FAILED:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

console.log('Preflight OK: encoding and syntax guards passed.');
