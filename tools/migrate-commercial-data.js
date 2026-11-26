/**
 * tools/migrate-commercial-data.js
 * 
 * Commercial Secrets Migration Tool
 * Splits commercial/cost data from public /products collection into admin-only /product_commercial collection.
 * 
 * Usage:
 *   node tools/migrate-commercial-data.js [--dry-run] [--project <id>] [--emulator [host:port]]
 *   node tools/migrate-commercial-data.js --apply --allow-production [--project <id>]
 *   node tools/migrate-commercial-data.js --apply --emulator [host:port]
 *   node tools/migrate-commercial-data.js --help
 */

const COMMERCIAL_FIELDS = [
    'costPrice',
    'marginPercent',
    'sellPrice',
    'profitValue',
    'profitMarginActual',
    'manualPriceOverride',
    'manualPriceReason',
    'supplierId',
    'supplierName',
    'supplierCode'
];

function getFirestoreFieldValue(options = {}) {
    if (options && options.FieldValue) return options.FieldValue;
    if (options && options.db && options.db.FieldValue) return options.db.FieldValue;
    try {
        const admin = require('firebase-admin');
        if (admin && admin.firestore && admin.firestore.FieldValue) {
            return admin.firestore.FieldValue;
        }
    } catch (_) {}
    try {
        const firestorePkg = require('@google-cloud/firestore');
        if (firestorePkg && firestorePkg.FieldValue) {
            return firestorePkg.FieldValue;
        }
    } catch (_) {}
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
        return firebase.firestore.FieldValue;
    }
    return {
        delete: () => ({ _methodName: 'FieldValue.delete', isDelete: true })
    };
}

function parseCliArgs(argv) {
    const args = {
        apply: false,
        dryRun: true,
        projectId: process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || '',
        emulator: process.env.FIRESTORE_EMULATOR_HOST || '',
        allowProduction: false,
        help: false,
        mock: process.env.MOCK_FIRESTORE === 'true'
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            args.help = true;
        } else if (arg === '--apply') {
            args.apply = true;
            args.dryRun = false;
        } else if (arg === '--dry-run') {
            args.dryRun = true;
            args.apply = false;
        } else if (arg === '--allow-production') {
            args.allowProduction = true;
        } else if (arg === '--project') {
            args.projectId = argv[++i] || '';
        } else if (arg.startsWith('--project=')) {
            args.projectId = arg.split('=')[1] || '';
        } else if (arg === '--emulator') {
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                args.emulator = next;
                i++;
            } else {
                args.emulator = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
            }
        } else if (arg.startsWith('--emulator=')) {
            args.emulator = arg.split('=')[1] || '127.0.0.1:8080';
        } else if (arg === '--mock' || arg === '--test-mock') {
            args.mock = true;
        }
    }
    return args;
}

function printHelp() {
    console.log(`
Commercial Secrets Migration Tool
=================================
Migrates commercial and supplier data from public /products collection
to protected, admin-only /product_commercial collection.

Usage:
  node tools/migrate-commercial-data.js [options]

Options:
  --dry-run             Simulate migration without modifying documents (default)
  --apply               Execute live migration writes
  --allow-production    Required safety flag when running --apply against production
  --emulator [host]     Target local Firestore emulator (e.g. 127.0.0.1:8080)
  --project <id>        Specify Google Cloud / Firebase Project ID
  --mock                Run against in-memory mock database (for testing)
  --help, -h            Show this help documentation

Examples:
  # Safe dry-run against emulator
  node tools/migrate-commercial-data.js --emulator localhost:8080 --dry-run

  # Apply migration on emulator
  node tools/migrate-commercial-data.js --emulator localhost:8080 --apply

  # Apply migration to production (requires safety flag and credentials)
  GOOGLE_APPLICATION_CREDENTIALS=key.json node tools/migrate-commercial-data.js --apply --allow-production
`);
}

function createCliMockFirestore() {
    const productsMap = new Map([
        ['prod_sample_1', {
            name: 'منتج تجريبي 1',
            price: 200,
            costPrice: 120,
            marginPercent: 40,
            supplierId: 'sup_99',
            supplierName: 'المورد الرئيسي'
        }],
        ['prod_sample_2', {
            name: 'منتج تجريبي 2 نظيف',
            price: 150
        }]
    ]);
    const commercialMap = new Map();

    const isDeleteSentinel = (val) => Boolean(
        val && (
            val._methodName === 'FieldValue.delete'
            || val.methodName === 'FieldValue.delete'
            || val.isDelete === true
            || (val.constructor && val.constructor.name === 'DeleteTransform')
        )
    );

    const mockDb = {
        FieldValue: {
            delete: () => ({ _methodName: 'FieldValue.delete', isDelete: true })
        },
        collection(colName) {
            const targetMap = colName === 'products' ? productsMap : commercialMap;
            return {
                async get() {
                    const docs = [];
                    for (const [id, data] of targetMap.entries()) {
                        docs.push({
                            id,
                            data: () => JSON.parse(JSON.stringify(data))
                        });
                    }
                    return {
                        size: docs.length,
                        docs
                    };
                },
                doc(docId) {
                    return {
                        id: docId,
                        async get() {
                            const data = targetMap.get(docId);
                            return {
                                exists: data !== undefined,
                                id: docId,
                                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
                            };
                        },
                        async set(data, options = {}) {
                            const current = targetMap.get(docId) || {};
                            const merged = options.merge ? { ...current } : {};
                            for (const [k, v] of Object.entries(data)) {
                                if (isDeleteSentinel(v)) {
                                    delete merged[k];
                                } else {
                                    merged[k] = v;
                                }
                            }
                            targetMap.set(docId, JSON.parse(JSON.stringify(merged)));
                        },
                        async update(updates) {
                            const current = targetMap.get(docId);
                            if (!current) throw new Error(`Document ${docId} not found`);
                            const next = { ...current };
                            for (const [k, v] of Object.entries(updates)) {
                                if (isDeleteSentinel(v)) {
                                    delete next[k];
                                } else {
                                    next[k] = v;
                                }
                            }
                            targetMap.set(docId, JSON.parse(JSON.stringify(next)));
                        }
                    };
                }
            };
        }
    };

    return { db: mockDb, FieldValue: mockDb.FieldValue };
}

function initFirestoreAdapter(args) {
    if (args.mock) {
        return createCliMockFirestore();
    }

    if (args.emulator) {
        process.env.FIRESTORE_EMULATOR_HOST = args.emulator;
    }

    const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
    const hasServiceAccount = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const hasFirebaseConfig = Boolean(process.env.FIREBASE_CONFIG);

    if (!isEmulator && !hasServiceAccount && !hasFirebaseConfig) {
        console.error('[ERROR] Missing Firestore credentials or environment.');
        console.error('Please configure one of the following:');
        console.error('  1. Local Emulator: pass --emulator or set FIRESTORE_EMULATOR_HOST');
        console.error('  2. Service Account: set GOOGLE_APPLICATION_CREDENTIALS=<path-to-json>');
        console.error('  3. In-memory testing: pass --mock\n');
        process.exit(1);
    }

    let admin = null;
    try {
        admin = require('firebase-admin');
    } catch (_) {}

    if (admin) {
        if (admin.apps.length === 0) {
            const config = {};
            if (args.projectId) config.projectId = args.projectId;
            admin.initializeApp(config);
        }
        return {
            db: admin.firestore(),
            FieldValue: admin.firestore.FieldValue
        };
    }

    let firestorePkg = null;
    try {
        firestorePkg = require('@google-cloud/firestore');
    } catch (_) {}

    if (firestorePkg) {
        const { Firestore, FieldValue } = firestorePkg;
        const db = new Firestore({
            projectId: args.projectId || process.env.GCLOUD_PROJECT || 'sale-zone-601f0'
        });
        return { db, FieldValue };
    }

    console.error('[ERROR] Firestore SDK not available: Neither "firebase-admin" nor "@google-cloud/firestore" is installed.');
    console.error('Install firebase-admin or run with --mock for standalone validation.\n');
    process.exit(1);
}

async function scanAndMigrateCommercialData(db, options = {}) {
    const isApply = options.apply === true;
    const FieldValue = getFirestoreFieldValue({ db, FieldValue: options.FieldValue });
    const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 3;
    const retryDelayMs = Number.isInteger(options.retryDelayMs) ? options.retryDelayMs : 50;

    const modeLabel = isApply ? 'APPLY (LIVE WRITES)' : 'DRY-RUN (SIMULATION ONLY)';
    console.log(`\n======================================================`);
    console.log(`  COMMERCIAL DATA MIGRATION — ${modeLabel}`);
    console.log(`======================================================\n`);

    const summary = {
        totalScanned: 0,
        needsMigration: 0,
        migrated: 0,
        skipped: 0,
        errors: 0,
        details: []
    };

    try {
        const productsSnapshot = await db.collection('products').get();
        summary.totalScanned = productsSnapshot.size;

        for (const doc of productsSnapshot.docs) {
            const data = doc.data() || {};
            const productId = doc.id;
            const extractedCommercial = {};
            let hasCommercial = false;

            for (const field of COMMERCIAL_FIELDS) {
                if (data[field] !== undefined) {
                    extractedCommercial[field] = data[field];
                    hasCommercial = true;
                }
            }

            if (!hasCommercial) {
                summary.skipped++;
                continue;
            }

            summary.needsMigration++;
            const detail = {
                productId,
                name: data.name || '-',
                commercialFields: Object.keys(extractedCommercial)
            };

            if (isApply) {
                let attempts = 0;
                let migratedSuccessfully = false;

                while (attempts < maxRetries && !migratedSuccessfully) {
                    attempts++;
                    try {
                        const nowIso = new Date().toISOString();

                        // 1. Write to product_commercial/{id} FIRST
                        await db.collection('product_commercial').doc(productId).set({
                            productId,
                            ...extractedCommercial,
                            updatedAt: nowIso
                        }, { merge: true });

                        // 2. Delete commercial fields from products/{id} using FieldValue.delete()
                        const deletionUpdate = {};
                        for (const field of Object.keys(extractedCommercial)) {
                            deletionUpdate[field] = FieldValue.delete();
                        }
                        deletionUpdate.updatedAt = nowIso;

                        const productRef = db.collection('products').doc(productId);
                        if (typeof productRef.update === 'function') {
                            await productRef.update(deletionUpdate);
                        } else {
                            await productRef.set(deletionUpdate, { merge: true });
                        }

                        migratedSuccessfully = true;
                        summary.migrated++;
                        detail.status = 'MIGRATED';
                    } catch (writeErr) {
                        if (attempts >= maxRetries) {
                            summary.errors++;
                            detail.status = 'ERROR';
                            detail.error = writeErr.message;
                            console.error(`[ERROR] Failed to migrate product ${productId} after ${attempts} attempts:`, writeErr.message);
                        } else {
                            console.warn(`[RETRY] Product ${productId} migration attempt ${attempts}/${maxRetries} failed: ${writeErr.message}. Retrying...`);
                            if (retryDelayMs > 0) {
                                await new Promise((res) => setTimeout(res, retryDelayMs * attempts));
                            }
                        }
                    }
                }
            } else {
                detail.status = 'WOULD_MIGRATE';
            }

            summary.details.push(detail);
        }

        console.log(`Migration Summary:`);
        console.log(` - Total Products Scanned:  ${summary.totalScanned}`);
        console.log(` - Products with Secrets:   ${summary.needsMigration}`);
        if (isApply) {
            console.log(` - Successfully Migrated:   ${summary.migrated}`);
            console.log(` - Errors Encountered:      ${summary.errors}`);
        } else {
            console.log(` - Products to Migrate:     ${summary.needsMigration}`);
            console.log(` - Dry run completed safely with 0 writes.`);
        }
        console.log(` - Untouched / Clean:       ${summary.skipped}\n`);

        return summary;
    } catch (err) {
        console.error('Migration failed with fatal error:', err);
        throw err;
    }
}

async function runCli(argv = process.argv.slice(2)) {
    const args = parseCliArgs(argv);

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    const isEmulator = Boolean(args.emulator || process.env.FIRESTORE_EMULATOR_HOST);
    const isTestEnv = args.mock || process.env.NODE_ENV === 'test';

    // Safety guard: refuse to mutate production without --allow-production
    if (args.apply && !isEmulator && !isTestEnv && !args.allowProduction) {
        console.error('\n[ERROR] SAFETY GUARD PREVENTED MIGRATION:');
        console.error('Refusing to execute live writes (--apply) against production without explicit --allow-production flag.');
        console.error('If you are intending to modify production, pass --allow-production.');
        console.error('If you are testing, use --emulator or --mock.\n');
        process.exit(1);
    }

    const { db, FieldValue } = initFirestoreAdapter(args);

    try {
        const summary = await scanAndMigrateCommercialData(db, {
            apply: args.apply,
            FieldValue
        });

        if (summary.errors > 0) {
            console.error(`[FAILURE] Migration completed with ${summary.errors} errors.`);
            process.exit(1);
        }

        console.log('[SUCCESS] Commercial data migration finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('[FATAL] Migration aborted:', err.message || err);
        process.exit(1);
    }
}

if (require.main === module) {
    runCli().catch((err) => {
        console.error('Unhandled CLI exception:', err);
        process.exit(1);
    });
}

module.exports = {
    COMMERCIAL_FIELDS,
    scanAndMigrateCommercialData,
    parseCliArgs,
    initFirestoreAdapter,
    runCli,
    getFirestoreFieldValue,
    createCliMockFirestore
};
