const fs = require('fs');
const path = require('path');

console.log('Security Regression Check v1.0');
console.log('================================');

const checks = [];
let failures = 0;

// Check 1: No hardcoded secrets
function checkNoSecrets(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const patterns = [
    /['"]sk_live_[a-zA-Z0-9]+['"]/,
    /['"]sk_test_[a-zA-Z0-9]+['"]/,
    /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
    /private_key\s*[:=]\s*['"][^'"]+['"]/i,
  ];
  for (const p of patterns) {
    if (p.test(content)) {
      console.error(`FAIL: Potential secret in ${file}`);
      failures++;
      return;
    }
  }
  checks.push(`PASS: No secrets in ${file}`);
}

// Check 2: No eval() in production code
function checkNoEval(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const evalMatch = content.match(/[^a-zA-Z]eval\s*\(/g);
  if (evalMatch && evalMatch.length > 0) {
    console.error(`FAIL: eval() found in ${file} (${evalMatch.length} occurrences)`);
    failures++;
    return;
  }
  checks.push(`PASS: No eval in ${file}`);
}

// Check 3: document.write check
function checkNoDocumentWrite(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  if (/document\.write\s*\(/.test(content)) {
    console.warn(`WARN: document.write found in ${file}`);
    checks.push(`WARN: document.write in ${file}`);
    return;
  }
  checks.push(`PASS: No document.write in ${file}`);
}

// Check 4: Firestore rules safety
function checkFirestoreRules() {
  const rulesFile = 'firestore.rules';
  if (!fs.existsSync(rulesFile)) {
    checks.push('SKIP: No firestore.rules found');
    return;
  }
  const content = fs.readFileSync(rulesFile, 'utf8');
  if (/allow\s+read\s*:\s*if\s+true/.test(content) &&
      /allow\s+write\s*:\s*if\s+true/.test(content)) {
    console.error('FAIL: Firestore rules allow unrestricted read AND write');
    failures++;
    return;
  }
  checks.push('PASS: Firestore rules have restrictions');
}

// Run checks on key files
const jsFiles = fs.readdirSync('.').filter(f => f.endsWith('.js'));
const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.HTML') || f.endsWith('.html'));

jsFiles.forEach(f => { checkNoSecrets(f); checkNoEval(f); });
htmlFiles.forEach(f => { checkNoSecrets(f); checkNoDocumentWrite(f); });
checkFirestoreRules();

console.log('');
checks.forEach(c => console.log(c));
console.log('');
console.log(`Results: ${checks.length} checks, ${failures} failures`);

if (failures > 0) {
  console.error('Security regression check FAILED');
  process.exit(1);
}
console.log('Security regression check PASSED');
