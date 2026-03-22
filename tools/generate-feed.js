#!/usr/bin/env node
/**
 * generate-feed.js
 * Builds feed.xml from Firebase products using the same browser/Firebase SDK path
 * available to the storefront, then emits a Google Shopping RSS 2.0 feed.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.FEED_PORT || 4173);
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const OUTPUT_FILE = path.join(ROOT, 'feed.xml');
const CLOUDINARY_FILE = path.join(ROOT, 'assets', 'js', 'cloudinary-service.js');
const BASE_STORE_URL = 'https://ahmedsheta89-cell.github.io/sale-zone';

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

function getMimeType(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startStaticServer(rootDir, defaultPath = '/feed.html') {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            try {
                const requestUrl = new URL(req.url, BASE_URL);
                const requestPath = decodeURIComponent(requestUrl.pathname === '/' ? defaultPath : requestUrl.pathname);
                const filePath = path.join(rootDir, requestPath);
                const normalized = path.normalize(filePath);
                if (!normalized.startsWith(rootDir)) {
                    res.writeHead(403);
                    res.end('Forbidden');
                    return;
                }
                if (!fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
                res.writeHead(200, { 'Content-Type': getMimeType(normalized) });
                fs.createReadStream(normalized).pipe(res);
            } catch (error) {
                res.writeHead(500);
                res.end(String(error && error.message ? error.message : error));
            }
        });

        server.once('error', reject);
        server.listen(PORT, HOST, () => resolve(server));
    });
}

function loadCloudinaryEnhancer() {
    const source = fs.readFileSync(CLOUDINARY_FILE, 'utf8');
    const context = {
        console,
        URL,
        window: {},
        setTimeout,
        clearTimeout,
        encodeURIComponent
    };
    vm.createContext(context);
    new vm.Script(source, { filename: 'cloudinary-service.js' }).runInContext(context);
    if (context.window && typeof context.window.enhanceProductImageUrl === 'function') {
        return context.window.enhanceProductImageUrl;
    }
    return (imageName) => imageName || `${BASE_STORE_URL}/assets/placeholder.svg`;
}

async function fetchAllProductsForTools() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    try {
        await page.goto(`${BASE_URL}/feed.html?nocache=1&tool=feed`, {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });
        await page.waitForFunction(() => typeof getAllProducts === 'function', null, { timeout: 45000 });
        const products = await page.evaluate(async () => {
            function normalizeRows(rows) {
                return (Array.isArray(rows) ? rows : []).map((product) => ({
                    ...product,
                    isPublished: product && product.isPublished !== false
                }));
            }

            async function queryPublishedCollection() {
                if (!(window.firebase && firebase.firestore)) return [];
                const db = firebase.firestore();
                const sources = [];

                try {
                    if (typeof getPublishedProducts === 'function') {
                        sources.push(normalizeRows(await getPublishedProducts()));
                    }
                } catch (_) {}

                try {
                    const snapshot = await db.collection('products')
                        .where('visibilityState', '==', 'published')
                        .get();
                    sources.push(normalizeRows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
                } catch (_) {}

                try {
                    const snapshot = await db.collection('products')
                        .where('isPublished', '==', true)
                        .get();
                    sources.push(normalizeRows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
                } catch (_) {}

                return sources.sort((a, b) => b.length - a.length)[0] || [];
            }

            return await queryPublishedCollection();
        });

        if (consoleErrors.length > 0) {
            console.warn('[feed] browser console errors observed:', consoleErrors.join(' | '));
        }

        return Array.isArray(products) ? products : [];
    } finally {
        await browser.close();
    }
}

function escapeXml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function mapCategory(category) {
    const normalized = String(category || '').trim().toLowerCase();
    const mapping = {
        skincare: '2975',
        'skin-care': '2975',
        haircare: '1848',
        'hair-care': '1848',
        supplements: '5909',
        bodycare: '567',
        'body-care': '567',
        babycare: '537',
        'baby-care': '537',
        dental: '526',
        makeup: '2975'
    };
    return mapping[normalized] || '1841';
}

function normalizePrice(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function resolveFeedPrice(product) {
    return normalizePrice(
        product && (
            product.price ??
            product.sellPrice ??
            product.salePrice ??
            product.retailPrice ??
            product.listPrice ??
            product.costPrice
        )
    );
}

function resolveFeedTitle(product) {
    return String(
        (product && (product.nameAr || product.name || product.title || product.productName))
        || ''
    ).trim();
}

function resolveFeedDescription(product) {
    return String(
        (product && (product.descriptionAr || product.description || product.desc || product.details))
        || ''
    ).trim();
}

function resolveAvailability(stockValue) {
    const numeric = Number(stockValue);
    if (!Number.isFinite(numeric)) return 'in stock';
    if (numeric === -1) return 'in stock';
    return numeric > 0 ? 'in stock' : 'out of stock';
}

function buildFeedXml(products, enhanceProductImageUrl) {
    const eligibleProducts = (Array.isArray(products) ? products : []).filter((product) => {
        const price = resolveFeedPrice(product);
        const title = resolveFeedTitle(product);
        return Boolean(product && product.isPublished !== false && title && price > 0);
    });

    const items = eligibleProducts.map((product) => {
        const imageUrl = enhanceProductImageUrl(product.imageUrl || product.image || '', 'feed');
        const price = resolveFeedPrice(product).toFixed(2);
        const title = resolveFeedTitle(product);
        const description = resolveFeedDescription(product);
        return `
  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(`${BASE_STORE_URL}/متجر_2.HTML#product/${encodeURIComponent(String(product.id || ''))}`)}</link>
    <description>${escapeXml(description)}</description>
    <g:id>${escapeXml(product.id)}</g:id>
    <g:price>${price} EGP</g:price>
    <g:availability>${escapeXml(resolveAvailability(product.stock))}</g:availability>
    <g:image_link>${escapeXml(imageUrl)}</g:image_link>
    <g:brand>${escapeXml(product.brand || 'Sale Zone')}</g:brand>
    <g:condition>new</g:condition>
    <g:google_product_category>${escapeXml(mapCategory(product.category))}</g:google_product_category>
  </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Sale Zone</title>
    <link>${BASE_STORE_URL}</link>
    <description>Sale Zone - متجر التجميل والعناية الأول في مصر</description>
    <language>ar</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

function validateFeed(xml, itemCount) {
    if (!xml.includes('<?xml version="1.0"')) throw new Error('Invalid feed: missing XML declaration');
    if (!xml.includes('xmlns:g="http://base.google.com/ns/1.0"')) throw new Error('Invalid feed: missing Google namespace');
    if (!xml.includes('<g:id>')) throw new Error('Invalid feed: no <g:id> entries');
    if (!xml.includes('<g:price>')) throw new Error('Invalid feed: no <g:price> entries');
    if (!xml.includes('<g:availability>')) throw new Error('Invalid feed: no <g:availability> entries');
    if (!xml.includes('</rss>')) throw new Error('Invalid feed: missing </rss>');
    if (itemCount <= 0) throw new Error('Invalid feed: zero products');
}

async function main() {
    console.log('Starting Google Shopping feed build...');
    const server = await startStaticServer(ROOT);

    try {
        const enhanceProductImageUrl = loadCloudinaryEnhancer();
        const products = await fetchAllProductsForTools();
        console.log(`Fetched products for feed: ${Array.isArray(products) ? products.length : 0}`);
        if (!Array.isArray(products) || products.length === 0) {
            if (fs.existsSync(OUTPUT_FILE)) {
                const existingXml = fs.readFileSync(OUTPUT_FILE, 'utf8');
                const existingItemCount = (existingXml.match(/<item>/g) || []).length;
                validateFeed(existingXml, existingItemCount);
                console.warn('Feed source returned zero products. Keeping existing feed.xml as a safe fallback.');
                console.log(`Products in feed: ${existingItemCount}`);
                console.log('feed.xml kept from previous successful generation');
                return;
            }
        }
        const xml = buildFeedXml(products, enhanceProductImageUrl);
        const itemCount = (xml.match(/<item>/g) || []).length;
        if (itemCount <= 0 && fs.existsSync(OUTPUT_FILE)) {
            const existingXml = fs.readFileSync(OUTPUT_FILE, 'utf8');
            const existingItemCount = (existingXml.match(/<item>/g) || []).length;
            validateFeed(existingXml, existingItemCount);
            console.warn('Feed build produced zero valid items. Keeping existing feed.xml as a safe fallback.');
            console.log(`Products in feed: ${existingItemCount}`);
            console.log('feed.xml kept from previous successful generation');
            return;
        }
        validateFeed(xml, itemCount);
        fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
        console.log(`Products in feed: ${itemCount}`);
        console.log('feed.xml generated successfully');
    } finally {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
}

main().catch((error) => {
    console.error('Feed generation failed:', error && error.stack ? error.stack : error);
    process.exit(1);
});

