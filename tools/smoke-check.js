// Lightweight structural smoke checks for critical store/admin flows.
// Run: node tools/smoke-check.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertContains(content, pattern, message, errors) {
  if (!pattern.test(content)) errors.push(message);
}

const errors = [];

const adminHtml = read('ادمن_2.HTML');
const storeHtml = read('متجر_2.HTML');
const firebaseApi = read('firebase-api.js');
const firebaseConfig = read('firebase-config.js');

assertContains(firebaseApi, /function\s+getSuppliers\s*\(/, 'firebase-api.js: missing getSuppliers()', errors);
assertContains(firebaseApi, /function\s+addSupplier\s*\(/, 'firebase-api.js: missing addSupplier()', errors);
assertContains(firebaseApi, /function\s+searchProductsIndexed\s*\(/, 'firebase-api.js: missing searchProductsIndexed()', errors);

assertContains(adminHtml, /id="suppliersSection"/, 'ادمن_2.HTML: missing suppliers section', errors);
assertContains(adminHtml, /id="productCostPrice"/, 'ادمن_2.HTML: missing product cost input', errors);
assertContains(adminHtml, /function\s+runProductsSchemaMigration\s*\(/, 'ادمن_2.HTML: missing schema migration action', errors);

assertContains(storeHtml, /product-search-worker\.js/, 'متجر_2.HTML: missing worker reference path', errors);
assertContains(storeHtml, /id="productsPagination"/, 'متجر_2.HTML: missing pagination container', errors);
assertContains(storeHtml, /function\s+runProductSearch\s*\(/, 'متجر_2.HTML: missing runProductSearch()', errors);
assertContains(storeHtml, /id="loginIdentifier"/, 'متجر_2.HTML: login identifier input not found', errors);

assertContains(firebaseConfig, /experimentalForceLongPolling:\s*true/, 'firebase-config.js: force long-polling not enabled', errors);

if (errors.length) {
  console.error('Smoke check FAILED:');
  for (const item of errors) console.error(` - ${item}`);
  process.exit(1);
}

console.log('Smoke check OK: core free-first features detected.');
