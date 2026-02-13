// Non-destructive product schema migration for exported JSON files.
// Usage: node tools/migrate-products-schema.js input.json output.json

const fs = require('fs');
const path = require('path');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\u064b-\u065f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[^a-z0-9\u0621-\u064a\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function roundMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function buildSearchTokens(row) {
  const set = new Set();
  const add = (value) => tokenize(value).forEach((token) => set.add(token));
  add(row.name);
  add(row.desc);
  add(row.code);
  add(row.category);
  add(row.supplierName);
  add(row.supplierCode);
  return Array.from(set).slice(0, 120);
}

function migrateProduct(row) {
  const price = Number.isFinite(Number(row.price)) ? Number(row.price) : 0;
  const costPrice = Number.isFinite(Number(row.costPrice)) ? Number(row.costPrice) : price;
  const marginPercent = Number.isFinite(Number(row.marginPercent)) ? Number(row.marginPercent) : 0;
  const manualPriceOverride = row.manualPriceOverride === true;
  const autoSellPrice = roundMoney(costPrice * (1 + (marginPercent / 100)));
  const manualSellPrice = Number.isFinite(Number(row.sellPrice)) ? Number(row.sellPrice) : autoSellPrice;
  const sellPrice = manualPriceOverride ? roundMoney(manualSellPrice) : autoSellPrice;
  const profitValue = roundMoney(sellPrice - costPrice);
  const profitMarginActual = sellPrice > 0 ? roundMoney((profitValue / sellPrice) * 100) : 0;

  return {
    ...row,
    supplierId: String(row.supplierId || ''),
    supplierName: String(row.supplierName || ''),
    supplierCode: String(row.supplierCode || ''),
    costPrice: roundMoney(Math.max(0, costPrice)),
    marginPercent: roundMoney(Math.max(0, Math.min(1000, marginPercent))),
    sellPrice: roundMoney(Math.max(0, sellPrice)),
    price: roundMoney(Math.max(0, sellPrice)),
    profitValue,
    profitMarginActual,
    manualPriceOverride,
    manualPriceReason: String(row.manualPriceReason || ''),
    searchTokens: Array.isArray(row.searchTokens) && row.searchTokens.length ? row.searchTokens : buildSearchTokens(row)
  };
}

function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    console.error('Usage: node tools/migrate-products-schema.js input.json output.json');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const content = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(content);
  const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.products) ? parsed.products : []);

  const report = {
    total: rows.length,
    migrated: 0,
    skipped: 0
  };

  const migratedRows = rows.map((row) => {
    if (!row || typeof row !== 'object') {
      report.skipped += 1;
      return row;
    }
    report.migrated += 1;
    return migrateProduct(row);
  });

  const output = Array.isArray(parsed)
    ? migratedRows
    : { ...parsed, products: migratedRows };

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log('Migration report:', report);
  console.log(`Output written to: ${outputPath}`);
}

main();
