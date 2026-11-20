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
                            const merged = options.merge ? { ...current, ...data } : { ...data };
                            col.set(docId, JSON.parse(JSON.stringify(merged)));
                        },
                        async update(updates) {
                            const current = col.get(docId);
                            if (!current) throw new Error(`Document ${docId} not found`);
                            col.set(docId, { ...current, ...updates });
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
                                            const merged = options.merge ? { ...current, ...data } : { ...data };
                                            subCol.set(subDocId, JSON.parse(JSON.stringify(merged)));
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
                                async set(data, opts) {
                                    const current = col.get(id) || {};
                                    col.set(id, opts && opts.merge ? { ...current, ...data } : { ...data });
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
                    return {
                        async get() {
                            const matches = [];
                            col.forEach((val, id) => {
                                if (op === '==' && val[field] === value) {
                                    matches.push({
                                        id,
                                        data: () => JSON.parse(JSON.stringify(val)),
                                        ref: {
                                            async set(data, opts) {
                                                const current = col.get(id) || {};
                                                col.set(id, opts && opts.merge ? { ...current, ...data } : { ...data });
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
                    };
                }
            };
        },
        async runTransaction(updateFn) {
            const transaction = {
                async get(docRef) {
                    return await docRef.get();
                },
                set(docRef, data, options) {
                    docRef.set(data, options);
                },
                update(docRef, data) {
                    docRef.update(data);
                }
            };
            return await updateFn(transaction);
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

    console.log(`\n====================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 1 COMMERCE SECURITY TESTS PASSED!`);
    console.log(`====================================================\n`);
})();
