const fs = require('fs');

const FILES = [
  'متجر_2.HTML',
  'ادمن_2.HTML',
  'assets/js/firebase-config.js',
  'assets/js/firebase-api.js',
  'assets/js/firebase-data.js',
  'assets/js/cloudinary-service.js',
  'assets/js/product-router.js',
  'assets/js/nav-history.js',
  'assets/js/toast.js',
  'assets/js/faq-bot.js',
  'assets/js/feed-generator.js'
];

const CRITICAL_FUNCTIONS = [
  'setupAutoTooltips',
  'loadProducts',
  'renderProducts',
  'toggleCart',
  'toggleWishlist',
  'updateCartBadge',
  'sendCartToWhatsApp',
  'NavHistory',
  'openFAQBot',
  'closeFAQBot',
  'openTawkChat',
  'askFAQ',
  'Toast',
  'enhanceProductImageUrl',
  'uploadToCloudinary',
  'getAllProducts',
  'updateProduct',
  'applyFeatureFlags',
  'getStoreSettings',
  'updateStoreSettings',
  'loadControlCenter',
  'saveFeatureFlag'
];

function readAll() {
  let content = '';
  FILES.forEach(function(file) {
    try {
      content += fs.readFileSync(file, 'utf8') + '\n';
    } catch (_) {}
  });
  return content;
}

const content = readAll();
const missing = [];

CRITICAL_FUNCTIONS.forEach(function(fn) {
  const found =
    content.includes('function ' + fn) ||
    content.includes('window.' + fn) ||
    content.includes('const ' + fn) ||
    content.includes('var ' + fn) ||
    content.includes(fn + ' =') ||
    content.includes(fn + '=');
  if (!found) missing.push(fn);
});

if (missing.length > 0) {
  console.error('❌ USAGE CHECK FAILED');
  console.error('Missing critical functions:');
  missing.forEach((fn) => console.error('  ⚠️  ' + fn));
  console.error('\nDo NOT commit. Restore these functions first.');
  process.exit(1);
}

console.log('✅ Usage Check PASSED — all ' + CRITICAL_FUNCTIONS.length + ' critical functions present');
process.exit(0);
