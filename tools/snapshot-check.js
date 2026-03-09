#!/usr/bin/env node
/**
 * snapshot-check.js
 * Detects if any critical function disappears between PRs
 * MODE: --update ? save new snapshot
 * MODE: --check  ? compare against saved snapshot
 */

const fs = require('fs');
const crypto = require('crypto');

const FILES = {
  '\u0645\u062a\u062c\u0631_2.HTML': 'store',
  '\u0627\u062f\u0645\u0646_2.HTML': 'admin'
};

const SNAPSHOT_FILE = 'monitoring/function-snapshot.json';

const registry = JSON.parse(
  fs.readFileSync('monitoring/feature-registry.json', 'utf8')
);

function extractDefinitions(content, functions) {
  const result = {};
  for (const fn of functions) {
    const patterns = [
      new RegExp(`async\\s+function\\s+${fn}\\s*\\(`),
      new RegExp(`function\\s+${fn}\\s*\\(`),
      new RegExp(`const\\s+${fn}\\s*=\\s*async`),
      new RegExp(`const\\s+${fn}\\s*=\\s*function`),
    ];
    const found = patterns.some(p => p.test(content));
    result[fn] = {
      found,
      hash: found
        ? crypto.createHash('md5')
            .update(content.match(
              new RegExp(`.{0,20}function\\s+${fn}[^{]+\\{`)
            )?.[0] || fn)
            .digest('hex')
        : null
    };
  }
  return result;
}

const mode = process.argv[2] || '--check';

// Build current snapshot
const current = {};
for (const [file, key] of Object.entries(FILES)) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const fns = registry.must_be_defined?.[file] ||
              registry.critical_functions?.[key] || [];
  current[file] = extractDefinitions(content, fns);
}

// --update mode: save snapshot
if (mode === '--update') {
  fs.mkdirSync('monitoring', { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(current, null, 2));
  console.log('\u2705 Snapshot saved \u2192', SNAPSHOT_FILE);
  const total = Object.values(current)
    .flatMap(f => Object.values(f))
    .filter(v => v.found).length;
  console.log(`\u{1F4CA} ${total} function definitions captured`);
  process.exit(0);
}

// --check mode: compare
if (!fs.existsSync(SNAPSHOT_FILE)) {
  console.log('\u26A0\uFE0F  No snapshot found.');
  console.log('   Run: node tools/snapshot-check.js --update');
  console.log('\u26A0\uFE0F  Skipping check \u2192 not blocking.');
  process.exit(0);
}

const saved = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
let failed = 0;
let checked = 0;

for (const [file, functions] of Object.entries(saved)) {
  console.log(`\n\u{1F4CB} ${file}:`);
  for (const [fn, savedData] of Object.entries(functions)) {
    if (!savedData.found) continue;
    checked++;
    const currentData = current[file]?.[fn];
    if (!currentData?.found) {
      console.error(`  \u274C DISAPPEARED: function ${fn}`);
      failed++;
    } else {
      console.log(`  \u2705 ${fn}`);
    }
  }
}

console.log('\n' + '\u2500'.repeat(50));
console.log(`\u{1F4CA} Checked: ${checked} | Failed: ${failed}`);

if (failed > 0) {
  console.error(`\n\u{1F6A8} ${failed} critical function(s) DISAPPEARED`);
  console.error('\u{1F6D1} RELEASE GATE: BLOCKED');
  process.exit(1);
} else {
  console.log('\n\u{1F7E2} SNAPSHOT CHECK: ALL PRESENT');
  process.exit(0);
}
