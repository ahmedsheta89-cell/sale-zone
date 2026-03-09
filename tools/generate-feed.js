#!/usr/bin/env node
/**
 * generate-feed.js
 * Builds feed.xml by reading live published products through the same browser/Firebase SDK path
 * used by the storefront, then reuses assets/js/feed-generator.js to emit XML.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const FeedGenerator = require(path.join(__dirname, '..', 'assets', 'js', 'feed-generator.js'));

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.FEED_PORT || 4173);
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const OUTPUT_FILE = path.join(ROOT, 'feed.xml');

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

function startStaticServer(rootDir) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            try {
                const requestUrl = new URL(req.url, BASE_URL);
                const requestPath = decodeURIComponent(requestUrl.pathname === '/' ? '/feed.html' : requestUrl.pathname);
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

async function fetchProductsInBrowser() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors = [];

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    try {
        await page.goto(`${BASE_URL}/feed.html?nocache=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForFunction(() => window.__FEED_READY__ === true || Boolean(window.__FEED_ERROR__), null, { timeout: 45000 });
        const payload = await page.evaluate(() => ({
            ready: window.__FEED_READY__ === true,
            error: window.__FEED_ERROR__ || '',
            products: Array.isArray(window.__FEED_PRODUCTS__) ? window.__FEED_PRODUCTS__ : []
        }));

        if (!payload.ready) {
            throw new Error(payload.error || 'feed page did not become ready');
        }

        if (consoleErrors.length > 0) {
            console.warn('[feed] browser console errors observed:', consoleErrors.join(' | '));
        }

        return payload.products;
    } finally {
        await browser.close();
    }
}

function validateFeed(xml) {
    if (!xml.includes('<?xml version="1.0"')) {
        throw new Error('Invalid feed: missing XML declaration');
    }
    if (!xml.includes('xmlns:g="http://base.google.com/ns/1.0"')) {
        throw new Error('Invalid feed: missing Google namespace');
    }
    if (!xml.includes('<g:id>')) {
        throw new Error('Invalid feed: no <g:id> entries');
    }
    if (!xml.includes('<g:price>')) {
        throw new Error('Invalid feed: no <g:price> entries');
    }
    if (!xml.includes('<g:availability>')) {
        throw new Error('Invalid feed: no <g:availability> entries');
    }
    if (!xml.includes('</rss>')) {
        throw new Error('Invalid feed: missing </rss>');
    }
}

async function main() {
    console.log('?? Starting local feed build...');
    const server = await startStaticServer(ROOT);

    try {
        const products = await fetchProductsInBrowser();
        const xml = FeedGenerator.generateFeedXML(products);
        const itemCount = (xml.match(/<item>/g) || []).length;

        if (itemCount === 0) {
            throw new Error('Feed contains zero published products');
        }

        validateFeed(xml);
        fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
        console.log('? feed.xml generated successfully');
        console.log(`?? Products in feed: ${itemCount}`);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

main().catch((error) => {
    console.error('? Feed generation failed:', error && error.stack ? error.stack : error);
    process.exit(1);
});
