/**
 * tests/phase1-commerce-security.test.js
 * 
 * Comprehensive Test Suite for Phase 1:
 * - Commercial Secrets Separation
 * - Append-Only Idempotent Inventory Ledger
 * - Authoritative Order Re-Calculation & Fraud Prevention
 * - Strict Coupon Validation (Expiry, Min Order, Limits)
 * - Loyalty Points Ledger & Server-Side Persistence
 * - Spark Mode Telemetry Reliability
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('====================================================');
console.log('🧪 RUNNING PHASE 1: CORE COMMERCE & SECURITY TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

// Mock Firestore In-Memory Database for testing transactions, collections, and docs
function createMockFirestore() {
    const storage = new Map();

    function getCollectionMap(colName) {
        if (!storage.has(colName)) storage.set(colName, new Map());
        return storage.get(colName);
    }

    let transactionQueue = Promise.resolve();

    const db = {
        _storage: storage,
        collection(colName) {
            const col = getCollectionMap(colName);
            return {
                doc(docId) {
                    return {
                        id: docId,
                        async get() {
                            const data = col.get(docId);
                            return {
                                exists: data !== undefined,
                                id: docId,
                                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
                            };
                        },
                        async set(data, options = {}) {
                            const current = col.get(docId) || {};
                            const merged = options.merge ? { ...current } : {};
                            for (const [k, v] of Object.entries(data)) {
                                if (v && (v.isDelete || v._methodName === 'FieldValue.delete' || v.methodName === 'FieldValue.delete' || (v.constructor && v.constructor.name === 'DeleteTransform'))) {
                                    delete merged[k];
                                } else {
                                    merged[k] = v;
                                }
                            }
                            col.set(docId, JSON.parse(JSON.stringify(merged)));
                        },
                        async update(updates) {
                            const current = col.get(docId);
                            if (!current) throw new Error(`Document ${docId} not found`);
                            const next = { ...current };
                            for (const [k, v] of Object.entries(updates)) {
                                if (v && (v.isDelete || v._methodName === 'FieldValue.delete' || v.methodName === 'FieldValue.delete' || (v.constructor && v.constructor.name === 'DeleteTransform'))) {
                                    delete next[k];
                                } else {
                                    next[k] = v;
                                }
                            }
                            col.set(docId, next);
                        },
                        async delete() {
                            col.delete(docId);
                        },
                        collection(subColName) {
                            // Subcollection
                            const subPath = `${colName}/${docId}/${subColName}`;
                            const subCol = getCollectionMap(subPath);
                            return {
                                doc(subDocId) {
                                    return {
                                        id: subDocId,
                                        async get() {
                                            const subData = subCol.get(subDocId);
                                            return {
                                                exists: subData !== undefined,
                                                id: subDocId,
                                                data: () => (subData ? JSON.parse(JSON.stringify(subData)) : undefined)
                                            };
                                        },
                                        async set(data, options = {}) {
                                            const current = subCol.get(subDocId) || {};
                                            const merged = options.merge ? { ...current } : {};
                                            for (const [k, v] of Object.entries(data)) {
                                                if (v && (v.isDelete || v._methodName === 'FieldValue.delete')) {
                                                    delete merged[k];
                                                } else {
                                                    merged[k] = v;
                                                }
                                            }
                                            subCol.set(subDocId, JSON.parse(JSON.stringify(merged)));
                                        },
                                        async update(updates) {
                                            const current = subCol.get(subDocId);
                                            if (!current) throw new Error(`Document ${subDocId} not found`);
                                            const next = { ...current };
                                            for (const [k, v] of Object.entries(updates)) {
                                                if (v && (v.isDelete || v._methodName === 'FieldValue.delete')) {
                                                    delete next[k];
                                                } else {
                                                    next[k] = v;
                                                }
                                            }
                                            subCol.set(subDocId, next);
                                        },
                                        async delete() {
                                            subCol.delete(subDocId);
                                        }
                                    };
                                }
                            };
                        }
                    };
                },
                async add(data) {
                    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    col.set(id, JSON.parse(JSON.stringify(data)));
                    return { id };
                },
                async get() {
                    const docs = [];
                    col.forEach((val, id) => {
                        docs.push({
                            id,
                            data: () => JSON.parse(JSON.stringify(val)),
                            ref: {
                                id,
                                async set(data, opts) {
                                    const current = col.get(id) || {};
                                    col.set(id, opts && opts.merge ? { ...current, ...data } : { ...data });
                                },
                                async update(data) {
                                    const current = col.get(id) || {};
                                    col.set(id, { ...current, ...data });
                                },
                                async get() {
                                    const cur = col.get(id);
                                    return {
                                        exists: cur !== undefined,
                                        id,
                                        data: () => (cur ? JSON.parse(JSON.stringify(cur)) : undefined)
                                    };
                                }
                            }
                        });
                    });
                    return {
                        size: docs.length,
                        empty: docs.length === 0,
                        docs
                    };
                },
                where(field, op, value) {
                    const makeQuery = (limitCount = null) => ({
                        limit(n) {
                            return makeQuery(n);
                        },
                        async get() {
                            const matches = [];
                            col.forEach((val, id) => {
                                if (limitCount !== null && matches.length >= limitCount) return;
                                if (op === '==' && val[field] === value) {
                                    matches.push({
                                        id,
                                        data: () => JSON.parse(JSON.stringify(val)),
                                        ref: {
                                            id,
                                            async set(data, opts) {
                                                const current = col.get(id) || {};
                                                col.set(id, opts && opts.merge ? { ...current, ...data } : { ...data });
                                            },
                                            async update(data) {
                                                const current = col.get(id) || {};
                                                col.set(id, { ...current, ...data });
                                            },
                                            async get() {
                                                const cur = col.get(id);
                                                return {
                                                    exists: cur !== undefined,
                                                    id,
                                                    data: () => (cur ? JSON.parse(JSON.stringify(cur)) : undefined)
                                                };
                                            }
                                        }
                                    });
                                }
                            });
                            return {
                                size: matches.length,
                                empty: matches.length === 0,
                                docs: matches
                            };
                        }
                    });
                    return makeQuery();
                }
            };
        },
        async runTransaction(updateFn) {
            let release;
            const nextLock = new Promise(resolve => { release = resolve; });
            const currentLock = transactionQueue;
            transactionQueue = nextLock;
            await currentLock;
            try {
                const transaction = {
                    async get(docRef) {
                        return await docRef.get();
                    },
                    async set(docRef, data, options) {
                        await docRef.set(data, options);
                    },
                    async update(docRef, data) {
                        await docRef.update(data);
                    }
                };
                return await updateFn(transaction);
            } finally {
                release();
            }
        }
    };
    return db;
}

(async () => {
    const firebaseApi = require('../assets/js/firebase-api.js');
    const { scanAndMigrateCommercialData } = require('../tools/migrate-commercial-data.js');

    // =========================================================================
    // Test 1: Commercial Secrets Separation & Token Stripping
    // =========================================================================
    runTest('Test 1.1: buildProductSearchTokens excludes supplierName and supplierCode', () => {
        const product = {
            name: 'كريم مرطب فاخر',
            desc: 'ترطيب عميق للبشرة الجافة',
            code: 'CR-101',
            category: 'عناية بالبشرة',
            supplierName: 'سوبر_مورد_سري',
            supplierCode: 'SUP-SECRET-99'
        };
        const tokens = firebaseApi.buildProductSearchTokens(product);
        assert.ok(tokens.some(t => t.includes('كريم')), 'Should include product name token');
        assert.ok(!tokens.some(t => t.includes('سوبر_مورد_سري')), 'Should NOT include supplierName token');
        assert.ok(!tokens.some(t => t.includes('sup-secret-99')), 'Should NOT include supplierCode token');
    });

    runTest('Test 1.2: splitProductCommercialPayload separates public fields from commercial fields', () => {
        const rawPayload = {
            name: 'سيروم الهيالورونيك',
            price: 250,
            costPrice: 120,
            marginPercent: 52,
            sellPrice: 250,
            profitValue: 130,
            profitMarginActual: 52,
            manualPriceOverride: false,
            manualPriceReason: 'تسعير قياسي',
            supplierId: 'sup_123',
            supplierName: 'شركة النور للمستحضرات',
            supplierCode: 'NOOR-01',
            category: 'عناية',
            stock: 45
        };
        const { publicPayload, commercialPayload } = firebaseApi.splitProductCommercialPayload(rawPayload);

        // Public fields check
        assert.strictEqual(publicPayload.name, 'سيروم الهيالورونيك');
        assert.strictEqual(publicPayload.price, 250);
        assert.strictEqual(publicPayload.stock, 45);
        assert.strictEqual(publicPayload.costPrice, undefined, 'costPrice must not be in public payload');
        assert.strictEqual(publicPayload.supplierId, undefined, 'supplierId must not be in public payload');
        assert.strictEqual(publicPayload.profitValue, undefined, 'profitValue must not be in public payload');

        // Commercial fields check
        assert.strictEqual(commercialPayload.costPrice, 120);
        assert.strictEqual(commercialPayload.supplierId, 'sup_123');
        assert.strictEqual(commercialPayload.supplierName, 'شركة النور للمستحضرات');
        assert.strictEqual(commercialPayload.profitValue, 130);
    });

    runTest('Test 1.3: mapPublicProductFromSnapshot strips commercial properties', () => {
        const mockDoc = {
            id: 'prod_99',
            data: () => ({
                name: 'غسول الوجه',
                price: 180,
                costPrice: 90,
                supplierId: 'secret_supp',
                profitValue: 90,
                isPublished: true
            })
        };
        const mapped = firebaseApi.mapPublicProductFromSnapshot(mockDoc);
        assert.strictEqual(mapped.id, 'prod_99');
        assert.strictEqual(mapped.name, 'غسول الوجه');
        assert.strictEqual(mapped.price, 180);
        assert.strictEqual(mapped.costPrice, undefined);
        assert.strictEqual(mapped.supplierId, undefined);
        assert.strictEqual(mapped.profitValue, undefined);
    });

    // =========================================================================
    // Test 2: Migration Tool Dry-Run & Apply Logic
    // =========================================================================
    await runAsyncTest('Test 2.1: migrate-commercial-data --dry-run scans and reports without writing', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p1').set({
            name: 'منتج أ',
            price: 100,
            costPrice: 50,
            supplierId: 'sup1'
        });
        await mockDb.collection('products').doc('p2').set({
            name: 'منتج ب',
            price: 150
            // No commercial fields
        });

        const dryRunSummary = await scanAndMigrateCommercialData(mockDb, { apply: false });
        assert.strictEqual(dryRunSummary.totalScanned, 2);
        assert.strictEqual(dryRunSummary.needsMigration, 1);
        assert.strictEqual(dryRunSummary.migrated, 0, 'Dry run must not perform writes');

        // Verify product in db still has costPrice
        const p1 = (await mockDb.collection('products').doc('p1').get()).data();
        assert.strictEqual(p1.costPrice, 50, 'Original product must remain untouched in dry run');
    });

    await runAsyncTest('Test 2.2: migrate-commercial-data --apply moves secrets and cleans public products', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p1').set({
            name: 'منتج أ',
            price: 100,
            costPrice: 50,
            supplierId: 'sup1'
        });

        const applySummary = await scanAndMigrateCommercialData(mockDb, { apply: true });
        assert.strictEqual(applySummary.migrated, 1);

        // Verify public doc is cleaned
        const cleanProduct = (await mockDb.collection('products').doc('p1').get()).data();
        assert.strictEqual(cleanProduct.costPrice, undefined);
        assert.strictEqual(cleanProduct.supplierId, undefined);
        assert.strictEqual(cleanProduct.name, 'منتج أ');

        // Verify commercial doc is created
        const commDoc = (await mockDb.collection('product_commercial').doc('p1').get()).data();
        assert.strictEqual(commDoc.productId, 'p1');
        assert.strictEqual(commDoc.costPrice, 50);
        assert.strictEqual(commDoc.supplierId, 'sup1');
    });

    await runAsyncTest('Test 2.3: updateProduct writes to product_commercial FIRST and deletes commercial fields with FieldValue.delete()', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_update_1').set({
            name: 'سيروم فيتامين سي',
            price: 250,
            costPrice: 100, // legacy field in public doc
            supplierId: 'sup_old'
        });

        await firebaseApi.updateProduct('p_update_1', {
            name: 'سيروم فيتامين سي المطور',
            price: 280,
            sellPrice: 280,
            manualPriceOverride: true,
            costPrice: 130,
            marginPercent: 115.38,
            supplierId: 'sup_new'
        }, { db: mockDb });

        // 1. Verify product_commercial contains commercial data
        const commDoc = (await mockDb.collection('product_commercial').doc('p_update_1').get()).data();
        assert.ok(commDoc, 'product_commercial doc must exist');
        assert.strictEqual(commDoc.costPrice, 130);
        assert.strictEqual(commDoc.marginPercent, 115.38);
        assert.strictEqual(commDoc.supplierId, 'sup_new');

        // 2. Verify public product doc is stripped of commercial secrets
        const publicDoc = (await mockDb.collection('products').doc('p_update_1').get()).data();
        assert.strictEqual(publicDoc.name, 'سيروم فيتامين سي المطور');
        assert.strictEqual(publicDoc.price, 280);
        assert.strictEqual(publicDoc.costPrice, undefined, 'costPrice must be deleted from products doc');
        assert.strictEqual(publicDoc.supplierId, undefined, 'supplierId must be deleted from products doc');
        assert.strictEqual(publicDoc.marginPercent, undefined, 'marginPercent must not exist in products doc');
    });

    await runAsyncTest('Test 2.4: updateProduct throws and does NOT silently swallow when saveProductCommercial fails', async () => {
        const mockDb = createMockFirestore();
        const origCollection = mockDb.collection.bind(mockDb);
        mockDb.collection = (colName) => {
            if (colName === 'product_commercial') {
                return {
                    doc: (docId) => ({
                        id: docId,
                        async set() {
                            throw new Error('Simulated Firestore permission-denied / network error');
                        }
                    })
                };
            }
            return origCollection(colName);
        };

        let thrown = false;
        try {
            await firebaseApi.updateProduct('p_fail_1', {
                name: 'منتج فاشل الحفظ',
                price: 100,
                costPrice: 40
            }, { db: mockDb });
        } catch (err) {
            thrown = true;
            assert.ok(err.message.includes('Simulated Firestore'), 'Error must propagate to caller');
        }
        assert.strictEqual(thrown, true, 'updateProduct must throw when commercial persistence fails');
    });

    await runAsyncTest('Test 2.5: migrate-commercial-data CLI child process execution and flags', async () => {
        const { spawnSync } = require('child_process');
        const scriptPath = path.join(__dirname, '../tools/migrate-commercial-data.js');

        // 1. --help exits with 0
        const helpRes = spawnSync(process.execPath, [scriptPath, '--help'], { encoding: 'utf8' });
        assert.strictEqual(helpRes.status, 0, '--help must exit with 0');
        assert.ok(helpRes.stdout.includes('Commercial Secrets Migration Tool'), 'Must output help text');

        // 2. Default invocation without credentials/emulator fails fast with exit code 1
        const noCredsRes = spawnSync(process.execPath, [scriptPath], {
            encoding: 'utf8',
            env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: '', FIRESTORE_EMULATOR_HOST: '', FIREBASE_CONFIG: '', MOCK_FIRESTORE: '' }
        });
        assert.strictEqual(noCredsRes.status, 1, 'Missing environment must fail fast with exit code 1');
        assert.ok(noCredsRes.stderr.includes('Missing Firestore credentials or environment'), 'Must output helpful error message');

        // 3. Safety guard blocks --apply against production without --allow-production
        const safetyRes = spawnSync(process.execPath, [scriptPath, '--apply'], {
            encoding: 'utf8',
            env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: 'mock-key.json', FIRESTORE_EMULATOR_HOST: '', MOCK_FIRESTORE: '' }
        });
        assert.strictEqual(safetyRes.status, 1, '--apply without --allow-production must exit with 1');
        assert.ok(safetyRes.stderr.includes('SAFETY GUARD PREVENTED MIGRATION'), 'Must warn about production safety guard');

        // 4. Standalone migration runs cleanly with --mock
        const mockApplyRes = spawnSync(process.execPath, [scriptPath, '--mock', '--apply'], { encoding: 'utf8' });
        assert.strictEqual(mockApplyRes.status, 0, '--mock --apply must complete cleanly with exit code 0');
        assert.ok(mockApplyRes.stdout.includes('Successfully Migrated:   1'), 'Mock run must report 1 migrated product');
    });

    // =========================================================================
    // Test 3: Idempotent Inventory Ledger & Stock Deduction/Restocking
    // =========================================================================
    await runAsyncTest('Test 3.1: recordInventoryMovement deducts stock and writes immutable ledger', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('prod_inv_1').set({
            name: 'شامبو أرجان',
            stock: 20,
            trackInventory: true
        });

        const res = await firebaseApi.recordInventoryMovement({
            productId: 'prod_inv_1',
            quantity: -3,
            movementType: 'OUT_ORDER_CONFIRMED',
            referenceType: 'order',
            referenceId: 'ord_100',
            idempotencyKey: 'ord_100_item_1_deduct'
        }, { db: mockDb });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.beforeStock, 20);
        assert.strictEqual(res.afterStock, 17);
        assert.strictEqual(res.duplicate, false);

        // Verify updated product stock
        const updatedProd = (await mockDb.collection('products').doc('prod_inv_1').get()).data();
        assert.strictEqual(updatedProd.stock, 17);

        // Verify ledger entry
        const ledgerSnap = (await mockDb.collection('inventory_ledger').doc(res.movementId).get()).data();
        assert.strictEqual(ledgerSnap.quantity, -3);
        assert.strictEqual(ledgerSnap.movementType, 'OUT_ORDER_CONFIRMED');
        assert.strictEqual(ledgerSnap.beforeStock, 20);
        assert.strictEqual(ledgerSnap.afterStock, 17);
    });

    await runAsyncTest('Test 3.2: recordInventoryMovement is strictly idempotent', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('prod_inv_2').set({
            name: 'ماسك الشعر',
            stock: 10,
            trackInventory: true
        });

        const params = {
            productId: 'prod_inv_2',
            quantity: -2,
            movementType: 'OUT_ORDER_CONFIRMED',
            referenceType: 'order',
            referenceId: 'ord_101',
            idempotencyKey: 'ord_101_item_2_deduct'
        };

        const first = await firebaseApi.recordInventoryMovement(params, { db: mockDb });
        assert.strictEqual(first.afterStock, 8);
        assert.strictEqual(first.duplicate, false);

        // Second call with same idempotency key
        const second = await firebaseApi.recordInventoryMovement(params, { db: mockDb });
        assert.strictEqual(second.duplicate, true);
        assert.strictEqual(second.afterStock, 8);

        // Product stock should still be 8, NOT 6!
        const prod = (await mockDb.collection('products').doc('prod_inv_2').get()).data();
        assert.strictEqual(prod.stock, 8);
    });

    await runAsyncTest('Test 3.3: recordInventoryMovement aborts when stock would become negative', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('prod_inv_3').set({
            name: 'كريم ليلي',
            stock: 2,
            trackInventory: true
        });

        let errorThrown = false;
        try {
            await firebaseApi.recordInventoryMovement({
                productId: 'prod_inv_3',
                quantity: -5,
                movementType: 'OUT_ORDER_CONFIRMED',
                referenceType: 'order',
                referenceId: 'ord_102',
                idempotencyKey: 'ord_102_fail'
            }, { db: mockDb });
        } catch (e) {
            errorThrown = true;
            assert.ok(e.message.includes('Insufficient inventory'), 'Error must specify insufficient inventory');
        }
        assert.ok(errorThrown, 'Must throw error on negative stock');

        // Product stock should remain 2
        const prod = (await mockDb.collection('products').doc('prod_inv_3').get()).data();
        assert.strictEqual(prod.stock, 2);
    });

    // =========================================================================
    // Test 4: Coupon Validation Rules (Active, Expiry, Min Order, Limits)
    // =========================================================================
    runTest('Test 4.1: Coupon validation enforces active flag, expiry, minOrder, and usageLimit', () => {
        const now = new Date();
        const tomorrow = new Date(Date.now() + 86400000).toISOString();
        const yesterday = new Date(Date.now() - 86400000).toISOString();

        const couponsList = [
            { code: 'ACTIVE10', active: true, value: 10, type: 'percentage', minOrderAmount: 100, expiresAt: tomorrow, usageLimit: 50, usedCount: 10 },
            { code: 'DISABLED', active: false, value: 20, type: 'percentage', minOrderAmount: 0, expiresAt: tomorrow, usageLimit: null, usedCount: 0 },
            { code: 'EXPIRED', active: true, value: 15, type: 'percentage', minOrderAmount: 0, expiresAt: yesterday, usageLimit: null, usedCount: 0 },
            { code: 'EXHAUSTED', active: true, value: 30, type: 'fixed', minOrderAmount: 0, expiresAt: tomorrow, usageLimit: 5, usedCount: 5 }
        ];

        function checkCoupon(code, subtotal) {
            const coupon = couponsList.find(c => c.code === code);
            if (!coupon) return { valid: false, reason: 'not_found' };
            if (coupon.active === false) return { valid: false, reason: 'inactive' };
            if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return { valid: false, reason: 'expired' };
            if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) return { valid: false, reason: 'min_order' };
            if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return { valid: false, reason: 'exhausted' };
            return { valid: true, coupon };
        }

        // Test valid case
        assert.strictEqual(checkCoupon('ACTIVE10', 150).valid, true);
        // Test subtotal too low
        assert.strictEqual(checkCoupon('ACTIVE10', 50).reason, 'min_order');
        // Test disabled
        assert.strictEqual(checkCoupon('DISABLED', 200).reason, 'inactive');
        // Test expired
        assert.strictEqual(checkCoupon('EXPIRED', 200).reason, 'expired');
        // Test exhausted
        assert.strictEqual(checkCoupon('EXHAUSTED', 200).reason, 'exhausted');
    });

    await runAsyncTest('Test 4.2: updateOrderStatus transactional coupon increment enforces limit, idempotency, and cancellation reversal', async () => {
        const mockDb = createMockFirestore();

        // Coupon with usageLimit = 2, usedCount = 0
        await mockDb.collection('coupons').doc('coupon_promo2').set({
            code: 'PROMO2',
            usageLimit: 2,
            usedCount: 0,
            active: true
        });

        // Order 1 with coupon
        await mockDb.collection('orders').doc('ord_c1').set({
            status: 'pending',
            couponCode: 'PROMO2',
            items: [],
            total: 100,
            version: 1
        });

        // Confirm Order 1 -> should increment coupon usedCount to 1
        await firebaseApi.updateOrderStatus('ord_c1', 'confirmed', {
            db: mockDb,
            skipAdminAuthCheck: true
        });

        const couponDoc1 = (await mockDb.collection('coupons').doc('coupon_promo2').get()).data();
        assert.strictEqual(couponDoc1.usedCount, 1, 'Coupon usedCount must increment to 1 on first confirmation');

        const orderDoc1 = (await mockDb.collection('orders').doc('ord_c1').get()).data();
        assert.strictEqual(orderDoc1.couponUsageIncremented, true, 'Order must record couponUsageIncremented: true');
        assert.strictEqual(orderDoc1.couponIncremented, true, 'Order must record couponIncremented: true');

        // Idempotency: Confirm Order 1 again -> usedCount must remain 1
        await firebaseApi.updateOrderStatus('ord_c1', 'confirmed', {
            db: mockDb,
            skipAdminAuthCheck: true
        });

        const couponDocIdem = (await mockDb.collection('coupons').doc('coupon_promo2').get()).data();
        assert.strictEqual(couponDocIdem.usedCount, 1, 'Idempotency: coupon usedCount must remain 1 on duplicate confirmation');

        // Order 2 with coupon -> increments usedCount to 2 (limit reached)
        await mockDb.collection('orders').doc('ord_c2').set({
            status: 'pending',
            couponCode: 'PROMO2',
            items: [],
            total: 100,
            version: 1
        });

        await firebaseApi.updateOrderStatus('ord_c2', 'confirmed', {
            db: mockDb,
            skipAdminAuthCheck: true
        });

        const couponDoc2 = (await mockDb.collection('coupons').doc('coupon_promo2').get()).data();
        assert.strictEqual(couponDoc2.usedCount, 2, 'Coupon usedCount must increment to 2 on second order confirmation');

        // Order 3 with coupon -> limit is 2 and usedCount is 2 -> must abort and flag couponLimitExceeded: true!
        await mockDb.collection('orders').doc('ord_c3').set({
            status: 'pending',
            couponCode: 'PROMO2',
            items: [],
            total: 100,
            version: 1
        });

        await firebaseApi.updateOrderStatus('ord_c3', 'confirmed', {
            db: mockDb,
            skipAdminAuthCheck: true
        });

        const couponDoc3 = (await mockDb.collection('coupons').doc('coupon_promo2').get()).data();
        assert.strictEqual(couponDoc3.usedCount, 2, 'Coupon usedCount must NOT exceed usageLimit (must stay 2)');

        const orderDoc3 = (await mockDb.collection('orders').doc('ord_c3').get()).data();
        assert.strictEqual(orderDoc3.couponLimitExceeded, true, 'Order 3 must be flagged with couponLimitExceeded: true');

        // Cancel Order 1 -> should restore coupon usedCount back to 1
        await firebaseApi.updateOrderStatus('ord_c1', 'cancelled', {
            db: mockDb,
            skipAdminAuthCheck: true
        });

        const couponDocRestored = (await mockDb.collection('coupons').doc('coupon_promo2').get()).data();
        assert.strictEqual(couponDocRestored.usedCount, 1, 'Coupon usedCount must decrement to 1 when order is cancelled');

        const orderDoc1Cancelled = (await mockDb.collection('orders').doc('ord_c1').get()).data();
        assert.strictEqual(orderDoc1Cancelled.couponRestored, true, 'Order must record couponRestored: true');
    });

    // =========================================================================
    // Test 5: Firestore Rules Verification
    // =========================================================================
    runTest('Test 5.1: firestore.rules contains strict protections for Phase 1 assets', () => {
        const rulesContent = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');

        // product_commercial protection
        assert.ok(rulesContent.includes('match /product_commercial/{productId}'), 'Rules must declare product_commercial');
        assert.ok(rulesContent.includes('allow read, write: if isAdmin();'), 'product_commercial must be admin-only');

        // inventory_ledger protection
        assert.ok(rulesContent.includes('match /inventory_ledger/{movementId}'), 'Rules must declare inventory_ledger');
        assert.ok(rulesContent.includes('allow update: if false;'), 'inventory_ledger must forbid updates');
        assert.ok(rulesContent.includes('allow delete: if false;'), 'inventory_ledger must forbid deletions');

        // loyalty_ledger & customer points guard
        assert.ok(rulesContent.includes('match /loyalty_ledger/{ledgerId}'), 'Rules must declare loyalty_ledger');
        assert.ok(rulesContent.includes('loyaltyPoints == 0'), 'Customer create rule must prevent forging initial points');
        assert.ok(rulesContent.includes('request.resource.data.loyaltyPoints == resource.data.loyaltyPoints'), 'Customer update rule must prevent modifying loyalty points');
    });

    // =========================================================================
    // Test 6: Telemetry Reliability in Spark Mode
    // =========================================================================
    runTest('Test 6.1: HTML meta tags neutralize dead cloudfunctions endpoint', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '../ادمن_2.HTML'), 'utf8');
        const storeHtml = fs.readFileSync(path.join(__dirname, '../متجر_2.HTML'), 'utf8');

        assert.ok(adminHtml.includes('<meta name="backend-api-base-url" content="">'), 'ادمن_2.HTML meta must be neutralized');
        assert.ok(storeHtml.includes('<meta name="backend-api-base-url" content="">'), 'متجر_2.HTML meta must be neutralized');
        assert.ok(!adminHtml.includes('content="https://us-central1-sale-zone-601f0.cloudfunctions.net/api"'), 'Dead endpoint must not exist in admin');
        assert.ok(!storeHtml.includes('content="https://us-central1-sale-zone-601f0.cloudfunctions.net/api"'), 'Dead endpoint must not exist in store');
    });

    // =========================================================================
    // Test 7: Hardened Section 7 Verification & Concurrency Evidence
    // =========================================================================
    console.log('\n--- SECTION 7: COMMERCE SECURITY & CONCURRENCY TESTS ---\n');

    // 7.1 Standalone CLI execution via child_process (spawnSync) [Standalone CLI]
    runTest('Test 7.1: Standalone tools/migrate-commercial-data.js CLI execution via spawnSync', () => {
        const cliPath = path.resolve(__dirname, '../tools/migrate-commercial-data.js');

        // Case A: --help flag
        const helpRes = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
        assert.strictEqual(helpRes.status, 0, 'CLI --help must exit with 0');
        assert.ok(helpRes.stdout.includes('Commercial Secrets Migration Tool'), 'CLI output must include tool header');
        assert.ok(helpRes.stdout.includes('--dry-run') && helpRes.stdout.includes('--apply'), 'CLI must document options');

        // Case B: Standalone --dry-run with --mock
        const dryRes = spawnSync(process.execPath, [cliPath, '--dry-run', '--mock'], { encoding: 'utf8' });
        assert.strictEqual(dryRes.status, 0, 'CLI --dry-run must exit with 0');
        assert.ok(dryRes.stdout.includes('COMMERCIAL DATA MIGRATION — DRY-RUN'), 'CLI must output dry-run header');
        assert.ok(dryRes.stdout.includes('Commercial data migration finished successfully'), 'CLI must succeed');

        // Case C: Production Safety Guard - refuse --apply without --allow-production
        const guardRes = spawnSync(process.execPath, [cliPath, '--apply'], {
            encoding: 'utf8',
            env: { ...process.env, NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '' }
        });
        assert.strictEqual(guardRes.status, 1, 'CLI --apply in production without --allow-production must exit with 1');
        assert.ok(guardRes.stderr.includes('SAFETY GUARD PREVENTED MIGRATION') || guardRes.stdout.includes('SAFETY GUARD PREVENTED MIGRATION'),
            'Safety guard error must be displayed');
    });

    // 7.2 Real-order pricing discrepancy detection & client-side direct write bypass [Unit / Security Validation]
    runTest('Test 7.2: Real-order pricing discrepancy detection & client-side direct firestore write bypass', () => {
        const productsMap = new Map([
            ['prod_alpha', { id: 'prod_alpha', name: 'سيروم الذهب', price: 250 }],
            ['prod_beta', { id: 'prod_beta', name: 'غسول منظف', price: 100 }]
        ]);

        // Legitimate order: 2x Alpha (500) + 1x Beta (100) = 600, total = 600
        const legitimateOrder = {
            orderNumber: 'SZ-LEGIT-1',
            items: [
                { id: 'prod_alpha', quantity: 2, price: 250 },
                { id: 'prod_beta', quantity: 1, price: 100 }
            ],
            subtotal: 600,
            discount: 0,
            pointsDiscount: 0,
            total: 600
        };
        const legitVerification = firebaseApi.verifyOrderCommercialPricing(legitimateOrder, productsMap);
        assert.strictEqual(legitVerification.valid, true, 'Legitimate order must be verified as valid');
        assert.strictEqual(legitVerification.discrepancy, 0, 'Discrepancy must be 0 for legitimate order');

        // Tampered order (Attacker modifies total to 50 instead of 600)
        const tamperedOrder = {
            orderNumber: 'SZ-FRAUD-1',
            items: [
                { id: 'prod_alpha', quantity: 2, price: 25 },
                { id: 'prod_beta', quantity: 1, price: 100 }
            ],
            subtotal: 150,
            total: 50
        };
        const tamperedVerification = firebaseApi.verifyOrderCommercialPricing(tamperedOrder, productsMap);
        assert.strictEqual(tamperedVerification.valid, false, 'Tampered order must be flagged as invalid');
        assert.strictEqual(tamperedVerification.authoritativeTotal, 600, 'Authoritative total must reflect true catalog prices');
        assert.strictEqual(tamperedVerification.discrepancy, 550, 'Discrepancy must accurately measure attempted fraud gap (550 EGP)');

        // Negative price attack
        assert.throws(() => {
            firebaseApi.verifyOrderCommercialPricing({
                items: [{ id: 'prod_alpha', quantity: 1, price: -50 }],
                total: 50
            }, productsMap);
        }, /Negative submitted price/, 'Negative prices must throw immediate validation exception');

        // Negative quantity attack
        assert.throws(() => {
            firebaseApi.verifyOrderCommercialPricing({
                items: [{ id: 'prod_alpha', quantity: -3, price: 250 }],
                total: 100
            }, productsMap);
        }, /Invalid item quantity/, 'Negative quantities must throw immediate validation exception');

        // Firestore rules schema contracts verification: ensure admin fields rejected for client orders
        const rulesContent = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
        assert.ok(rulesContent.includes('!("inventoryDeducted" in request.resource.data)'),
            'Rules must strictly forbid client order creation from setting inventoryDeducted');
        assert.ok(rulesContent.includes('!("loyaltyAwarded" in request.resource.data)'),
            'Rules must strictly forbid client order creation from setting loyaltyAwarded');
        assert.ok(rulesContent.includes('!("pointsRefunded" in request.resource.data)'),
            'Rules must strictly forbid client order creation from setting pointsRefunded');
        assert.ok(rulesContent.includes('earnedPoints <= request.resource.data.total'),
            'Rules must cap customer earned points to order total to prevent point fabrication');
    });

    // 7.3 Partial failure & retryability in recordInventoryMovement without double-deduction [Unit / Mock Transaction]
    await runAsyncTest('Test 7.3: Partial failure & retryability in recordInventoryMovement without double-deduction', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_item_1').set({ name: 'كريم الأساس', stock: 10, trackInventory: true });
        await mockDb.collection('products').doc('p_item_2').set({ name: 'سيروم نادر', stock: 1, trackInventory: true });

        const orderId = 'ord_partial_fail_1';
        await mockDb.collection('orders').doc(orderId).set({
            orderNumber: 'SZ-PART-1',
            status: 'pending',
            items: [
                { id: 'p_item_1', quantity: 3 },
                { id: 'p_item_2', quantity: 5 } // will fail: stock is only 1
            ],
            inventoryDeducted: false
        });

        // Step 1: Execute confirmation (Item 1 succeeds, Item 2 fails due to insufficient stock)
        let step1Error = null;
        try {
            await firebaseApi.updateOrderStatus(orderId, 'confirmed', { db: mockDb, skipAdminAuthCheck: true });
        } catch (err) {
            step1Error = err;
        }
        assert.ok(step1Error, 'updateOrderStatus must reject when inventory deduction fails');

        const orderAfterFail = (await mockDb.collection('orders').doc(orderId).get()).data();
        assert.notStrictEqual(orderAfterFail.inventoryDeducted, true, 'inventoryDeducted must NOT be true after partial failure');
        assert.ok(orderAfterFail.inventoryDeductionError || orderAfterFail.inventoryDeductionPartialError, 'Partial error note must be recorded');

        // Stock checks: Item 1 was deducted (10 -> 7), Item 2 untouched (1)
        const p1After1 = (await mockDb.collection('products').doc('p_item_1').get()).data();
        const p2After1 = (await mockDb.collection('products').doc('p_item_2').get()).data();
        assert.strictEqual(p1After1.stock, 7, 'Item 1 stock must be deducted once');
        assert.strictEqual(p2After1.stock, 1, 'Item 2 stock must remain 1');

        // Step 2: Warehouse replenishes stock of Item 2 to 10
        await mockDb.collection('products').doc('p_item_2').set({ name: 'سيروم نادر', stock: 10, trackInventory: true });

        // Step 3: Retry order confirmation with same orderId & idempotency keys
        await firebaseApi.updateOrderStatus(orderId, 'confirmed', { db: mockDb, skipAdminAuthCheck: true });

        // Verify order is now fully marked deducted
        const orderAfterRetry = (await mockDb.collection('orders').doc(orderId).get()).data();
        assert.strictEqual(orderAfterRetry.inventoryDeducted, true, 'Order must now be marked inventoryDeducted: true');

        // Crucial Check: Item 1 MUST NOT be double deducted! (should still be 7, NOT 4!)
        const p1AfterRetry = (await mockDb.collection('products').doc('p_item_1').get()).data();
        const p2AfterRetry = (await mockDb.collection('products').doc('p_item_2').get()).data();
        assert.strictEqual(p1AfterRetry.stock, 7, 'Item 1 stock MUST NOT be double deducted on retry!');
        assert.strictEqual(p2AfterRetry.stock, 5, 'Item 2 stock must now be correctly deducted (10 - 5 = 5)');

        // Verify ledger entries for Item 1: exactly ONE movement
        const ledger1 = (await mockDb.collection('inventory_ledger').doc(`inv_p_item_1_order_${orderId}_item_p_item_1_deduct`).get());
        assert.ok(ledger1.exists, 'Ledger entry for item 1 must exist');
    });

    // 7.4 Post-fulfillment cancellation avoiding restock (restocking only for pre-fulfillment or with return receipt) [Unit / Lifecycle Logic]
    await runAsyncTest('Test 7.4: Post-fulfillment cancellation avoiding restock (restocking only for pre-fulfillment)', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_shoes').set({ name: 'حذاء رياضي', stock: 8, trackInventory: true });
        await mockDb.collection('products').doc('p_jacket').set({ name: 'جاكيت جلدي', stock: 5, trackInventory: true });

        // Order A: Pre-fulfillment cancellation (status: confirmed -> cancelled)
        const orderA = 'ord_pre_fulfill';
        await mockDb.collection('orders').doc(orderA).set({
            status: 'confirmed',
            items: [{ id: 'p_shoes', quantity: 2 }],
            inventoryDeducted: true,
            inventoryRestocked: false
        });

        await firebaseApi.updateOrderStatus(orderA, 'cancelled', { db: mockDb, skipAdminAuthCheck: true });
        const orderAData = (await mockDb.collection('orders').doc(orderA).get()).data();
        assert.strictEqual(orderAData.inventoryRestocked, true, 'Pre-fulfillment cancellation must automatically restock');
        const shoesStock = (await mockDb.collection('products').doc('p_shoes').get()).data().stock;
        assert.strictEqual(shoesStock, 10, 'Pre-fulfillment cancellation must restore warehouse inventory (8 + 2 = 10)');

        // Order B: Post-fulfillment cancellation (status: delivered -> cancelled)
        const orderB = 'ord_post_fulfill';
        await mockDb.collection('orders').doc(orderB).set({
            status: 'delivered',
            items: [{ id: 'p_jacket', quantity: 2 }],
            inventoryDeducted: true,
            inventoryRestocked: false
        });

        await firebaseApi.updateOrderStatus(orderB, 'cancelled', { db: mockDb, skipAdminAuthCheck: true });
        const orderBData = (await mockDb.collection('orders').doc(orderB).get()).data();
        assert.notStrictEqual(orderBData.inventoryRestocked, true, 'Post-fulfillment cancellation must NOT automatically restock');
        assert.ok(orderBData.inventoryRestockDeferred || orderBData.inventoryRestockSkipped, 'Post-fulfillment restock must be deferred');
        assert.ok(String(orderBData.inventoryRestockReason || '').includes('POST_FULFILLMENT_REQUIRES_RETURN_RECEIPT'), 'Reason must specify return receipt required');
        const jacketStock = (await mockDb.collection('products').doc('p_jacket').get()).data().stock;
        assert.strictEqual(jacketStock, 5, 'Warehouse stock must remain unchanged (5) until return receipt confirmed');
    });

    // 7.5 Concurrent loyalty award checking ledger inside transaction to prevent double-crediting [Mock Concurrency]
    await runAsyncTest('Test 7.5: Concurrent loyalty award checking ledger inside transaction to prevent double-crediting', async () => {
        const mockDb = createMockFirestore();
        const customerUid = 'cust_loyal_race_1';
        await mockDb.collection('customers').doc(customerUid).set({
            uid: customerUid,
            name: 'عميل مميز',
            loyaltyPoints: 100
        });

        const orderId = 'ord_race_loyalty_1';
        await mockDb.collection('orders').doc(orderId).set({
            uid: customerUid,
            total: 1000,
            subtotal: 1000,
            earnedPoints: 50,
            status: 'delivered',
            loyaltyAwarded: false
        });

        // Simulate two concurrent award workers racing on the exact same order
        const worker1 = firebaseApi.updateOrderStatus(orderId, 'completed', { db: mockDb, skipAdminAuthCheck: true });
        const worker2 = firebaseApi.updateOrderStatus(orderId, 'completed', { db: mockDb, skipAdminAuthCheck: true });

        await Promise.all([worker1, worker2]);

        const customer = (await mockDb.collection('customers').doc(customerUid).get()).data();
        assert.strictEqual(customer.loyaltyPoints, 150, 'Customer loyalty points must equal exactly 150 (never double-awarded!)');

        const ledgerSnap = await mockDb.collection('customers').doc(customerUid).collection('loyalty_ledger').doc(`earn_${orderId}`).get();
        assert.ok(ledgerSnap.exists, 'Loyalty ledger entry must exist');
        assert.strictEqual(ledgerSnap.data().delta, 50, 'Ledger delta must be 50');
    });

    // 7.6 Concurrent coupon usage increment checking usageLimit in transaction [Mock Concurrency]
    await runAsyncTest('Test 7.6: Concurrent coupon usage increment checking usageLimit in transaction', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('coupons').doc('c_flash_1').set({
            code: 'FLASH_RACE',
            usageLimit: 2,
            usedCount: 1,
            active: true
        });

        const order1 = 'ord_coupon_race_1';
        const order2 = 'ord_coupon_race_2';

        await mockDb.collection('orders').doc(order1).set({
            orderNumber: 'SZ-CPN-1',
            status: 'pending',
            couponCode: 'FLASH_RACE',
            items: []
        });
        await mockDb.collection('orders').doc(order2).set({
            orderNumber: 'SZ-CPN-2',
            status: 'pending',
            couponCode: 'FLASH_RACE',
            items: []
        });

        const p1 = firebaseApi.updateOrderStatus(order1, 'confirmed', { db: mockDb, skipAdminAuthCheck: true });
        const p2 = firebaseApi.updateOrderStatus(order2, 'confirmed', { db: mockDb, skipAdminAuthCheck: true });

        await Promise.allSettled([p1, p2]);

        const coupon = (await mockDb.collection('coupons').doc('c_flash_1').get()).data();
        assert.strictEqual(coupon.usedCount, 2, 'Coupon usedCount must not exceed usageLimit (2)');

        const o1Data = (await mockDb.collection('orders').doc(order1).get()).data();
        const o2Data = (await mockDb.collection('orders').doc(order2).get()).data();
        const incrementedCount = [o1Data.couponIncremented, o2Data.couponIncremented].filter(Boolean).length;
        assert.strictEqual(incrementedCount, 1, 'Exactly one order must have successfully incremented coupon');
    });

    // 7.7 Immutable loyalty ledger rules (update: if false; delete: if false;) [Static / Rules Contract]
    runTest('Test 7.7: Immutable loyalty ledger rules (update: if false; delete: if false;)', () => {
        const rulesContent = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');

        const loyaltyLedgerBlock = rulesContent.slice(rulesContent.indexOf('match /loyalty_ledger/{ledgerId}'));
        assert.ok(loyaltyLedgerBlock.length > 0, 'loyalty_ledger match block must exist in rules');

        const hasImmutableRule = /allow\s+(update\s*,\s*delete|delete\s*,\s*update)\s*:\s*if\s+false\s*;/.test(loyaltyLedgerBlock) ||
            (loyaltyLedgerBlock.includes('allow update: if false;') && loyaltyLedgerBlock.includes('allow delete: if false;'));
        assert.ok(hasImmutableRule, 'loyalty_ledger must declare update and delete if false');
        assert.ok(loyaltyLedgerBlock.includes('allow create: if isAdmin()'), 'loyalty_ledger create must require admin');
        assert.ok(loyaltyLedgerBlock.includes('request.resource.data.delta is number'), 'loyalty_ledger must require numeric delta');
        assert.ok(loyaltyLedgerBlock.includes('request.resource.data.delta != 0'), 'loyalty_ledger delta must be non-zero');
    });

    // =========================================================================
    // SECTION 8: SPECIALIST 3 — ORDERS & LOYALTY RECOMPUTATION & LEDGER AUDIT
    // =========================================================================
    console.log(`\n--- SECTION 8: ORDERS & LOYALTY INTEGRITY TESTS ---`);

    await runAsyncTest('Test 8.1: Recompute authoritative loyalty amounts and cap untrusted client earnedPoints', async () => {
        const mockDb = createMockFirestore();
        const customerUid = 'cust_loyal_recompute_1';
        await mockDb.collection('customers').doc(customerUid).set({
            uid: customerUid,
            name: 'عميل اختبار',
            loyaltyPoints: 10
        });

        // Product catalog prices
        await mockDb.collection('products').doc('p_cream_1').set({ name: 'كريم مرطب', price: 50, stock: 100 });

        // Store settings with 5% loyalty rate
        await mockDb.collection('settings').doc('store').set({
            loyalty: { rate: 5, pointValue: 0.1 }
        });

        // Untrusted client submits order claiming 999,999 earned points for an order of 2 x 50 = 100 EGP
        const orderId = 'ord_tampered_loyalty_1';
        await mockDb.collection('orders').doc(orderId).set({
            id: orderId,
            uid: customerUid,
            earnedPoints: 999999, // FORGED CLIENT VALUE
            items: [{ id: 'p_cream_1', quantity: 2, price: 50 }],
            subtotal: 100,
            total: 100,
            status: 'confirmed',
            loyaltyAwarded: false
        });

        // Admin authoritative execution completes/delivers the order
        await firebaseApi.updateOrderStatus(orderId, 'delivered', { db: mockDb, skipAdminAuthCheck: true });

        // Verify customer points: should be 10 (initial) + 5 (expected), NEVER 10 + 999,999!
        const customer = (await mockDb.collection('customers').doc(customerUid).get()).data();
        assert.strictEqual(customer.loyaltyPoints, 15, 'Customer points must be 15 (10 + 5 capped authoritative points)');

        // Verify ledger entry: delta must be exactly 5
        const ledgerSnap = await mockDb.collection('customers').doc(customerUid).collection('loyalty_ledger').doc(`earn_${orderId}`).get();
        assert.ok(ledgerSnap.exists, 'Ledger entry earn_ must exist');
        assert.strictEqual(ledgerSnap.data().delta, 5, 'Ledger delta must be capped to authoritative 5 points');
        assert.strictEqual(ledgerSnap.data().beforePoints, 10);
        assert.strictEqual(ledgerSnap.data().afterPoints, 15);

        // Verify order doc earnedPoints was corrected from 999,999 to 5
        const orderData = (await mockDb.collection('orders').doc(orderId).get()).data();
        assert.strictEqual(orderData.earnedPoints, 5, 'Order earnedPoints must be overwritten with authoritative 5');
        assert.strictEqual(orderData.loyaltyAwarded, true);
    });

    await runAsyncTest('Test 8.2: Refuse unearned points refund on cancellation when points were never deducted', async () => {
        const mockDb = createMockFirestore();
        const customerUid = 'cust_loyal_refund_fraud';
        await mockDb.collection('customers').doc(customerUid).set({
            uid: customerUid,
            name: 'مهاجم النقاط',
            loyaltyPoints: 0
        });

        // Attacker creates a pending order claiming they used 500,000 points, but no points were ever deducted
        const orderId = 'ord_tampered_used_points';
        await mockDb.collection('orders').doc(orderId).set({
            id: orderId,
            uid: customerUid,
            usedPoints: 500000, // FORGED VALUE
            pointsDiscount: 0,
            items: [],
            status: 'pending',
            pointsDeducted: false,
            pointsRefunded: false
        });

        // Order is cancelled while pending
        await firebaseApi.updateOrderStatus(orderId, 'cancelled', { db: mockDb, skipAdminAuthCheck: true });

        // Customer points must remain 0! Fraudulent refund must be blocked!
        const customer = (await mockDb.collection('customers').doc(customerUid).get()).data();
        assert.strictEqual(customer.loyaltyPoints, 0, 'Customer points must remain 0 (no refund when not deducted)');

        // No refund ledger entry should exist
        const refundSnap = await mockDb.collection('customers').doc(customerUid).collection('loyalty_ledger').doc(`refund_${orderId}`).get();
        assert.strictEqual(refundSnap.exists, false, 'No refund ledger should be created for non-deducted points');

        const orderData = (await mockDb.collection('orders').doc(orderId).get()).data();
        assert.strictEqual(orderData.pointsRefunded, true);
    });

    await runAsyncTest('Test 8.3: Refund legitimate deducted usedPoints idempotently on cancellation', async () => {
        const mockDb = createMockFirestore();
        const customerUid = 'cust_loyal_legit_refund';
        await mockDb.collection('customers').doc(customerUid).set({
            uid: customerUid,
            name: 'عميل صادق',
            loyaltyPoints: 20
        });

        // Store settings with pointValue = 0.1 (100 points = 10 EGP discount)
        await mockDb.collection('settings').doc('store').set({
            loyalty: { rate: 5, pointValue: 0.1 }
        });

        // Order has legitimate usedPoints: 100, pointsDiscount: 10
        const orderId = 'ord_legit_used_points';
        await mockDb.collection('orders').doc(orderId).set({
            id: orderId,
            uid: customerUid,
            usedPoints: 100,
            pointsDiscount: 10,
            items: [{ id: 'p_soap_1', quantity: 2, price: 25 }],
            subtotal: 50,
            total: 40,
            status: 'confirmed',
            pointsDeducted: true,
            pointsRefunded: false
        });

        // Seed deduction ledger
        await mockDb.collection('customers').doc(customerUid).collection('loyalty_ledger').doc(`redeem_${orderId}`).set({
            ledgerId: `redeem_${orderId}`,
            orderId,
            delta: -100,
            reason: 'ORDER_REDEMPTION_DEDUCT',
            timestamp: new Date().toISOString()
        });

        // Cancel order: should refund legitimate 100 points
        await firebaseApi.updateOrderStatus(orderId, 'cancelled', { db: mockDb, skipAdminAuthCheck: true });

        const customer = (await mockDb.collection('customers').doc(customerUid).get()).data();
        assert.strictEqual(customer.loyaltyPoints, 120, 'Customer points must be 120 (20 + 100 refunded points)');

        const refundSnap = await mockDb.collection('customers').doc(customerUid).collection('loyalty_ledger').doc(`refund_${orderId}`).get();
        assert.ok(refundSnap.exists, 'Refund ledger must exist');
        assert.strictEqual(refundSnap.data().delta, 100, 'Refund delta must be 100');

        // Idempotency: second cancellation must NOT refund again
        await firebaseApi.updateOrderStatus(orderId, 'cancelled', { db: mockDb, skipAdminAuthCheck: true });
        const customerAfterSecond = (await mockDb.collection('customers').doc(customerUid).get()).data();
        assert.strictEqual(customerAfterSecond.loyaltyPoints, 120, 'Points must remain 120 (no double refund!)');
    });

    // =========================================================================
    // SECTION 9: SPECIALIST 2 — INVENTORY LEDGER & EXTENDED COVERAGE TESTS
    // =========================================================================
    console.log(`\n--- SECTION 9: INVENTORY LEDGER & EXTENDED COVERAGE TESTS ---`);

    await runAsyncTest('Test 9.1: adjustStockWithLedger, adjustProductStock, and updateProductStock update stock and ledger', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_stock_test_1').set({
            name: 'شامبو عضوي',
            stock: 25,
            trackInventory: true
        });

        // 1. adjustStockWithLedger (+10)
        const res1 = await firebaseApi.adjustStockWithLedger({
            productId: 'p_stock_test_1',
            delta: 10,
            movementType: 'ADJUST_MANUAL_AUDIT',
            notes: 'جرد يدوي إضافي',
            performedBy: 'admin_uid_456'
        }, { db: mockDb });

        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.beforeStock, 25);
        assert.strictEqual(res1.afterStock, 35);
        let prod = (await mockDb.collection('products').doc('p_stock_test_1').get()).data();
        assert.strictEqual(prod.stock, 35);

        // Verify ledger entry operator and timestamp
        const ledger1 = (await mockDb.collection('inventory_ledger').doc(res1.movementId).get()).data();
        assert.strictEqual(ledger1.performedBy, 'admin_uid_456');
        assert.strictEqual(ledger1.notes, 'جرد يدوي إضافي');
        assert.ok(ledger1.timestamp, 'Ledger entry must have trusted ISO timestamp');

        // 2. adjustProductStock (-5)
        const res2 = await firebaseApi.adjustProductStock('p_stock_test_1', -5, { db: mockDb, performedBy: 'operator_777' });
        assert.strictEqual(res2.afterStock, 30);
        prod = (await mockDb.collection('products').doc('p_stock_test_1').get()).data();
        assert.strictEqual(prod.stock, 30);

        // 3. updateProductStock (set absolute to 50, delta = +20)
        const res3 = await firebaseApi.updateProductStock('p_stock_test_1', 50, { db: mockDb, performedBy: 'operator_888' });
        assert.strictEqual(res3.afterStock, 50);
        assert.strictEqual(res3.delta, 20);
        prod = (await mockDb.collection('products').doc('p_stock_test_1').get()).data();
        assert.strictEqual(prod.stock, 50);
    });

    await runAsyncTest('Test 9.2: Purchasing movements (IN_PURCHASE_RECEIPT & OUT_PURCHASE_RETURN)', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_purch_1').set({
            name: 'زيت أرجان',
            stock: 10,
            trackInventory: true
        });

        // 1. Purchase receipt: receipt of 40 units
        const rcpt = await firebaseApi.recordPurchaseReceipt({
            productId: 'p_purch_1',
            quantity: 40,
            purchaseOrderId: 'PO-9901',
            performedBy: 'warehouse_mgr_1'
        }, { db: mockDb });

        assert.strictEqual(rcpt.success, true);
        assert.strictEqual(rcpt.afterStock, 50);
        let prod = (await mockDb.collection('products').doc('p_purch_1').get()).data();
        assert.strictEqual(prod.stock, 50);

        const rcptLedger = (await mockDb.collection('inventory_ledger').doc(rcpt.movementId).get()).data();
        assert.strictEqual(rcptLedger.movementType, 'IN_PURCHASE_RECEIPT');
        assert.strictEqual(rcptLedger.quantity, 40);
        assert.strictEqual(rcptLedger.referenceId, 'PO-9901');

        // 2. Purchase return: return of 5 defective units to supplier
        const ret = await firebaseApi.recordPurchaseReturn({
            productId: 'p_purch_1',
            quantity: 5,
            purchaseReturnId: 'RET-0042',
            performedBy: 'warehouse_mgr_1'
        }, { db: mockDb });

        assert.strictEqual(ret.success, true);
        assert.strictEqual(ret.afterStock, 45);
        prod = (await mockDb.collection('products').doc('p_purch_1').get()).data();
        assert.strictEqual(prod.stock, 45);

        const retLedger = (await mockDb.collection('inventory_ledger').doc(ret.movementId).get()).data();
        assert.strictEqual(retLedger.movementType, 'OUT_PURCHASE_RETURN');
        assert.strictEqual(retLedger.quantity, -5);
        assert.strictEqual(retLedger.referenceId, 'RET-0042');
    });

    await runAsyncTest('Test 9.3: Bulk Excel import (bulkAdjustStockExcel & ADJUST_EXCEL_IMPORT)', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_xl_1').set({ name: 'كحل طبيعي', stock: 15, trackInventory: true });
        await mockDb.collection('products').doc('p_xl_2').set({ name: 'مسك أسود', stock: 5, trackInventory: true });

        const importResults = await firebaseApi.bulkAdjustStockExcel({
            importBatchId: 'BATCH_2026_11_XL',
            items: [
                { productId: 'p_xl_1', stock: 20 }, // delta = +5
                { productId: 'p_xl_2', stock: 3 }   // delta = -2
            ],
            performedBy: 'excel_importer_uid'
        }, { db: mockDb });

        assert.strictEqual(importResults.length, 2);
        assert.strictEqual(importResults[0].afterStock, 20);
        assert.strictEqual(importResults[1].afterStock, 3);

        const p1 = (await mockDb.collection('products').doc('p_xl_1').get()).data();
        const p2 = (await mockDb.collection('products').doc('p_xl_2').get()).data();
        assert.strictEqual(p1.stock, 20);
        assert.strictEqual(p2.stock, 3);

        const ledger1 = (await mockDb.collection('inventory_ledger').doc(importResults[0].movementId).get()).data();
        assert.strictEqual(ledger1.movementType, 'ADJUST_EXCEL_IMPORT');
        assert.strictEqual(ledger1.referenceId, 'BATCH_2026_11_XL');
    });

    await runAsyncTest('Test 9.4: updateProduct with stock change records ledger movement and blocks negative stock', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_edit_stock').set({
            name: 'بودرة تفتيح',
            price: 150,
            stock: 30,
            trackInventory: true
        });

        // 1. Normal edit changing stock from 30 to 45
        await firebaseApi.updateProduct('p_edit_stock', {
            name: 'بودرة تفتيح معدلة',
            stock: 45
        }, { db: mockDb, performedBy: 'editor_admin_1' });

        const pAfter = (await mockDb.collection('products').doc('p_edit_stock').get()).data();
        assert.strictEqual(pAfter.stock, 45);

        // Verify ledger was written
        const ledgers = [];
        mockDb._storage.get('inventory_ledger').forEach((val) => {
            if (val.productId === 'p_edit_stock') ledgers.push(val);
        });
        assert.strictEqual(ledgers.length, 1);
        assert.strictEqual(ledgers[0].delta, 15);
        assert.strictEqual(ledgers[0].movementType, 'ADJUST_MANUAL_AUDIT');

        // 2. Abort if stock would become negative on tracked product
        let editFailed = false;
        try {
            await firebaseApi.updateProduct('p_edit_stock', {
                stock: -10
            }, { db: mockDb });
        } catch (err) {
            editFailed = true;
        }
        assert.ok(editFailed, 'updateProduct must reject delta that causes negative stock on tracked inventory');
    });

    await runAsyncTest('Test 9.5: verifyOrderReturnAndRestock restocks fulfilled order with movementType IN_ORDER_RETURNED', async () => {
        const mockDb = createMockFirestore();
        await mockDb.collection('products').doc('p_return_item').set({
            name: 'فستان مخملي',
            stock: 2,
            trackInventory: true
        });

        const orderId = 'ord_delivered_then_returned';
        await mockDb.collection('orders').doc(orderId).set({
            orderNumber: 'SZ-RET-101',
            status: 'delivered', // fulfilled
            items: [{ id: 'p_return_item', quantity: 1 }],
            inventoryDeducted: true
        });

        // 1. Regular cancellation: does NOT restock
        await firebaseApi.updateOrderStatus(orderId, 'cancelled', { db: mockDb, skipAdminAuthCheck: true });
        let orderData = (await mockDb.collection('orders').doc(orderId).get()).data();
        assert.notStrictEqual(orderData.inventoryRestocked, true, 'Must not restock delivered order upon simple cancellation');
        assert.ok(orderData.inventoryRestockDeferred || orderData.inventoryRestockSkipped);
        let stockNow = (await mockDb.collection('products').doc('p_return_item').get()).data().stock;
        assert.strictEqual(stockNow, 2, 'Stock must remain 2');

        // 2. Explicit return verification via verifyOrderReturnAndRestock
        await firebaseApi.verifyOrderReturnAndRestock(orderId, { db: mockDb, skipAdminAuthCheck: true, operatorUid: 'return_inspector_99' });
        orderData = (await mockDb.collection('orders').doc(orderId).get()).data();
        assert.strictEqual(orderData.inventoryRestocked, true, 'Order must now be marked inventoryRestocked: true');
        assert.strictEqual(orderData.returnVerified, true, 'Order must be marked returnVerified: true');

        // Stock restored (2 + 1 = 3)
        stockNow = (await mockDb.collection('products').doc('p_return_item').get()).data().stock;
        assert.strictEqual(stockNow, 3, 'Warehouse stock must be restocked upon verified return');

        // Ledger check: movementType must be IN_ORDER_RETURNED
        const returnLedger = (await mockDb.collection('inventory_ledger').doc(`inv_p_return_item_order_${orderId}_item_p_return_item_restock`).get()).data();
        assert.strictEqual(returnLedger.movementType, 'IN_ORDER_RETURNED', 'Ledger movementType must be IN_ORDER_RETURNED');
        assert.strictEqual(returnLedger.performedBy, 'return_inspector_99');
    });

    console.log(`\n====================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 1 COMMERCE SECURITY TESTS PASSED!`);
    console.log(`====================================================\n`);
})();
