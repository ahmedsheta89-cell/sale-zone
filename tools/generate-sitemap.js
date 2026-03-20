#!/usr/bin/env node
/**
 * generate-sitemap.js
 * Builds sitemap.xml from Firebase products using the same browser/Firebase SDK path
 * available to the storefront.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SITEMAP_PORT || 4174);
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const OUTPUT_FILE = path.join(ROOT, 'sitemap.xml');
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
    try {
        await page.goto(`${BASE_URL}/feed.html?nocache=1&tool=sitemap`, {
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

function buildSitemapXml(products, enhanceProductImageUrl) {
    const today = new Date().toISOString().slice(0, 10);
    const eligibleProducts = (Array.isArray(products) ? products : []).filter((product) => (
        product && product.isPublished !== false && String(product.nameAr || product.name || '').trim()
    ));

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <url>
    <loc>${BASE_STORE_URL}/متجر_2.HTML</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${today}</lastmod>
  </url>`;

    eligibleProducts.forEach((product) => {
        const imageUrl = enhanceProductImageUrl(product.imageUrl || product.image || '', 'feed');
        const hasImage = Boolean(imageUrl && !/placeholder\.svg$/i.test(imageUrl));
        xml += `
  <url>
    <loc>${escapeXml(`${BASE_STORE_URL}/متجر_2.HTML#product/${encodeURIComponent(String(product.id || ''))}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
    ${hasImage ? `<image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(product.nameAr || product.name || '')}</image:title>
    </image:image>` : ''}
  </url>`;
    });

    xml += `
</urlset>
`;
    return { xml, urlCount: eligibleProducts.length + 1 };
}

async function main() {
    console.log('Starting sitemap build...');
    const server = await startStaticServer(ROOT);

    try {
        const enhanceProductImageUrl = loadCloudinaryEnhancer();
        const products = await fetchAllProductsForTools();
        const { xml, urlCount } = buildSitemapXml(products, enhanceProductImageUrl);
        fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
        console.log(`Sitemap URLs: ${urlCount}`);
        console.log('sitemap.xml generated successfully');
    } finally {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
}

main().catch((error) => {
    console.error('Sitemap generation failed:', error && error.stack ? error.stack : error);
    process.exit(1);
});
