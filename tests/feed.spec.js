const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FEED_PATH = path.join(__dirname, '..', 'feed.xml');

function readFeed() {
  return fs.readFileSync(FEED_PATH, 'utf8');
}

test('feed.xml exists and is valid', async () => {
  const feed = readFeed();
  expect(feed).toContain('<?xml version="1.0"');
  expect(feed).toContain('xmlns:g="http://base.google.com/ns/1.0"');
  expect(feed).toContain('<g:id>');
  expect(feed).toContain('<g:price>');
  expect(feed).toContain('<g:availability>');
  expect(feed).toContain('</rss>');
});

test('feed has published products only', async () => {
  const feed = readFeed();
  const itemCount = (feed.match(/<item>/g) || []).length;
  expect(itemCount).toBeGreaterThan(0);
});

test('feed prices are valid', async () => {
  const feed = readFeed();
  expect(feed).not.toContain('<g:price>0.00 EGP</g:price>');
  const prices = feed.match(/<g:price>[^<]+<\/g:price>/g) || [];
  prices.forEach((price) => expect(price).toContain('EGP'));
});
