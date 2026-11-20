/**
 * tools/migrate-commercial-data.js
 * 
 * Commercial Secrets Migration Tool
 * Splits commercial/cost data from public /products collection into admin-only /product_commercial collection.
 * 
 * Usage:
 *   node tools/migrate-commercial-data.js --dry-run
 *   node tools/migrate-commercial-data.js --apply
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

async function scanAndMigrateCommercialData(db, options = {}) {
    const isApply = options.apply === true;
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
                try {
                    const nowIso = new Date().toISOString();
                    // 1. Write to product_commercial
                    await db.collection('product_commercial').doc(productId).set({
                        productId,
                        ...extractedCommercial,
                        updatedAt: nowIso
                    }, { merge: true });

                    // 2. Remove commercial fields from products
                    const cleanedProduct = { ...data };
                    for (const field of COMMERCIAL_FIELDS) {
                        delete cleanedProduct[field];
                    }
                    cleanedProduct.updatedAt = nowIso;

                    await db.collection('products').doc(productId).set(cleanedProduct);
                    summary.migrated++;
                    detail.status = 'MIGRATED';
                } catch (writeErr) {
                    summary.errors++;
                    detail.status = 'ERROR';
                    detail.error = writeErr.message;
                    console.error(`Error migrating product ${productId}:`, writeErr.message);
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

if (require.main === module) {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const isDryRun = args.includes('--dry-run') || !isApply;

    console.log(`Starting migration script (mode: ${isApply ? '--apply' : '--dry-run'})...`);
    console.log(`[INFO] For live database run, ensure Firebase Admin or service account is configured.`);
    console.log(`[INFO] In testing/CI, run with mock adapter.\n`);
}

module.exports = {
    COMMERCIAL_FIELDS,
    scanAndMigrateCommercialData
};
