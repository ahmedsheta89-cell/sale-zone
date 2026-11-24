/**
 * Independent Firebase Admin SDK helper for the Real Emulator E2E Suite.
 * Connects strictly to local Auth & Firestore Emulators (`demo-sale-zone-e2e`).
 * Used ONLY for test setup, cleanup, and independent Track C post-action verification.
 */

'use strict';

const http = require('http');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const EMULATOR_PROJECT_ID = 'demo-sale-zone-e2e';

function assertEmulatorEnv() {
  const firestoreHost = String(process.env.FIRESTORE_EMULATOR_HOST || '').trim();
  const authHost = String(process.env.FIREBASE_AUTH_EMULATOR_HOST || '').trim();
  if (!firestoreHost || !authHost) {
    throw new Error(
      `Emulator environment variables missing (FIRESTORE_EMULATOR_HOST="${firestoreHost}", FIREBASE_AUTH_EMULATOR_HOST="${authHost}"). Run under firebase emulators:exec --only auth,firestore.`
    );
  }
  if (!EMULATOR_PROJECT_ID.startsWith('demo-')) {
    throw new Error('Refusing to initialize emulator Admin helper on non-demo projectId');
  }
  return { firestoreHost, authHost };
}

function getAdminInstances() {
  assertEmulatorEnv();
  if (!getApps().length) {
    initializeApp({ projectId: EMULATOR_PROJECT_ID });
  }
  return {
    adminAuth: getAuth(),
    adminDb: getFirestore()
  };
}

function httpDelete(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: Number(parsed.port),
      path: parsed.pathname + parsed.search,
      method: 'DELETE'
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function clearEmulatorState() {
  const { firestoreHost, authHost } = assertEmulatorEnv();
  await Promise.all([
    httpDelete(`http://${firestoreHost}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`),
    httpDelete(`http://${authHost}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`)
  ]);
}

function getTestSecret(roleTag) {
  return ['sz', 'emu', roleTag, '2026'].join('_');
}

async function seedBaselineScenario() {
  await clearEmulatorState();
  const { adminAuth, adminDb } = getAdminInstances();

  const custCred = getTestSecret('cust');
  const adminCred = getTestSecret('adm');

  await adminAuth.createUser({
    uid: 'emu_cust_1',
    email: 'customer@emulator.local',
    password: custCred,
    displayName: 'أحمد مصطفى',
    emailVerified: true
  });

  await adminAuth.createUser({
    uid: 'emu_admin_1',
    email: 'admin1@emulator.local',
    password: adminCred,
    displayName: 'مدير المتجر',
    emailVerified: true
  });
  await adminAuth.setCustomUserClaims('emu_admin_1', { admin: true, role: 'admin' });

  await adminAuth.createUser({
    uid: 'emu_admin_2',
    email: 'admin2@emulator.local',
    password: adminCred,
    displayName: 'مدير مناوب',
    emailVerified: true
  });
  await adminAuth.setCustomUserClaims('emu_admin_2', { admin: true, role: 'admin' });

  const nowIso = new Date().toISOString();

  await adminDb.collection('products').doc('prod_shampoo_argan').set({
    id: 'prod_shampoo_argan',
    name: 'شامبو الأرجان المغربي الأصلي',
    desc: 'شامبو طبيعي مغذي للشعر بخلاصة الأرجان',
    price: 250,
    retailPrice: 250,
    stock: 15,
    trackInventory: true,
    isPublished: true,
    category: 'hair-care',
    image: 'icon-192.png',
    images: ['icon-192.png'],
    createdAt: nowIso
  });

  await adminDb.collection('products').doc('prod_collagen_cream').set({
    id: 'prod_collagen_cream',
    name: 'كريم الكولاجين للوجه',
    desc: 'ترطيب عميق وعناية بالبشرة',
    price: 180,
    retailPrice: 180,
    stock: 8,
    trackInventory: true,
    isPublished: true,
    category: 'skin-care',
    image: 'icon-192.png',
    images: ['icon-192.png'],
    createdAt: nowIso
  });

  await adminDb.collection('products').doc('prod_unavailable_lotion').set({
    id: 'prod_unavailable_lotion',
    name: 'لوشن ترطيب عميق',
    price: 90,
    retailPrice: 90,
    stock: 0,
    trackInventory: true,
    isPublished: true,
    category: 'skin-care',
    image: 'icon-192.png',
    createdAt: nowIso
  });

  await adminDb.collection('products').doc('prod_draft_unreleased').set({
    id: 'prod_draft_unreleased',
    name: 'سيروم غير معتمد',
    price: 300,
    retailPrice: 300,
    stock: 10,
    trackInventory: true,
    isPublished: false,
    category: 'skin-care',
    image: 'icon-192.png',
    createdAt: nowIso
  });

  await adminDb.collection('product_commercial').doc('prod_shampoo_argan').set({
    productId: 'prod_shampoo_argan',
    costPrice: 150,
    supplierId: 'sup_main'
  });

  await adminDb.collection('coupons').doc('coupon_sale10').set({
    id: 'coupon_sale10',
    code: 'SALE10',
    type: 'percentage',
    discount: 10,
    value: 10,
    minOrderAmount: 100,
    active: true,
    usageLimit: 10,
    usedCount: 0,
    desc: 'خصم 10% على جميع المنتجات'
  });

  await adminDb.collection('coupons').doc('coupon_expired').set({
    id: 'coupon_expired',
    code: 'EXPIRED20',
    type: 'percentage',
    discount: 20,
    value: 20,
    minOrderAmount: 50,
    active: true,
    expiresAt: '2020-01-01T00:00:00.000Z'
  });

  await adminDb.collection('customers').doc('emu_cust_1').set({
    uid: 'emu_cust_1',
    email: 'customer@emulator.local',
    phone: '01012345678',
    address: '15 شارع الجمهورية، مدينة نصر، القاهرة',
    displayName: 'أحمد مصطفى',
    role: 'customer',
    loyaltyPoints: 100,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso
  });

  await adminDb.collection('settings').doc('store').set({
    loyalty: {
      enabled: true,
      rate: 5,
      pointValue: 0.1
    }
  });

  return { custCred, adminCred };
}

async function listOrders() {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('orders').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getOrder(orderId) {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('orders').doc(orderId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getReturnsByOrder(orderId) {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('returns').where('orderId', '==', orderId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getProduct(productId) {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('products').doc(productId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getCoupon(couponId) {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('coupons').doc(couponId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getCustomer(uid) {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('customers').doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getLoyaltyLedger(uid) {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('customers').doc(uid).collection('loyalty_ledger').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getLedgerByReference(referenceId) {
  const { adminDb } = getAdminInstances();
  const snap = await adminDb.collection('inventory_ledger').where('referenceId', '==', referenceId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = {
  EMULATOR_PROJECT_ID,
  assertEmulatorEnv,
  getAdminInstances,
  clearEmulatorState,
  seedBaselineScenario,
  listOrders,
  getOrder,
  getReturnsByOrder,
  getProduct,
  getCoupon,
  getCustomer,
  getLoyaltyLedger,
  getLedgerByReference
};
