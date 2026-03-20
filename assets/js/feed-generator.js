(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root && typeof root === 'object') {
        root.FeedGenerator = api;
        root.regenerateFeed = api.regenerateFeed;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const FEED_CONFIG = {
        storeUrl: 'https://ahmedsheta89-cell.github.io/sale-zone',
        storeName: 'Sale Zone',
        storeDescription: '???? ???????? ??????? ??????? ????????? ????????',
        language: 'ar',
        country: 'EG',
        currency: 'EGP',
        feedUrl: 'https://ahmedsheta89-cell.github.io/sale-zone/feed.xml'
    };

    function escapeXML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function normalizeText(value, fallback = '') {
        const text = String(value || '').trim();
        return text || fallback;
    }

    function normalizePrice(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const STORE_PAGE_PATH = '%D9%85%D8%AA%D8%AC%D8%B1_2.HTML';

    function getProductUrl(product) {
        return `${FEED_CONFIG.storeUrl}/${STORE_PAGE_PATH}?product=${encodeURIComponent(product && product.id ? product.id : '')}`;
    }

    function getOptimizedCloudinaryUrl(url, width = 800) {
        const rawUrl = String(url || '').trim();
        if (!rawUrl.includes('cloudinary.com')) return rawUrl;
        return rawUrl.replace('/upload/', `/upload/f_auto,q_auto,w_${Math.max(200, Number(width) || 800)},c_fill/`);
    }

    function getImageUrl(product) {
        const url = normalizeText(product && (product.imageUrl || product.image), '');
        if (url) {
            return getOptimizedCloudinaryUrl(url, 800);
        }
        return `${FEED_CONFIG.storeUrl}/assets/placeholder.svg`;
    }

    function getAvailability(product) {
        const stock = Number(product && product.stock);
        if (!Number.isFinite(stock)) return 'in stock';
        if (stock === -1) return 'in stock';
        if (stock <= 0) return 'out of stock';
        return 'in stock';
    }

    function getCondition() {
        return 'new';
    }

    function getCategoryPath(category) {
        const normalized = normalizeText(category, '');
        const categoryMap = {
            '????????': 'Health & Beauty > Health Care > Fitness & Nutrition > Vitamins & Supplements',
            '??????': 'Health & Beauty > Personal Care > Skin Care',
            '?????': 'Health & Beauty > Personal Care > Hair Care',
            '?????': 'Health & Beauty > Health Care > Medical Supplies',
            '?????': 'Baby & Toddler > Baby Health',
            '??????? ???????': 'Health & Beauty > Personal Care',
            'General': 'Health & Beauty'
        };
        return categoryMap[normalized] || 'Health & Beauty';
    }

    function resolveDescription(product) {
        return normalizeText(product && (product.description || product.desc || product.name), '');
    }

    function resolveBrand(product) {
        return normalizeText(product && product.brand, 'Sale Zone');
    }

    function isEligibleProduct(product) {
        const price = normalizePrice(product && (product.price || product.sellPrice));
        return Boolean(
            product &&
            product.isPublished === true &&
            normalizeText(product.name, '') &&
            price > 0
        );
    }

    function generateProductXML(product) {
        const currentPrice = normalizePrice(product && (product.price || product.sellPrice));
        const originalPrice = normalizePrice(product && product.oldPrice);
        const hasSalePrice = originalPrice > currentPrice && currentPrice > 0;
        const finalPrice = hasSalePrice ? originalPrice : currentPrice;
        const salePrice = hasSalePrice ? currentPrice : null;

        return `
    <item>
      <g:id>${escapeXML(product.id)}</g:id>
      <g:title>${escapeXML(normalizeText(product.name, 'Unnamed Product'))}</g:title>
      <g:description>${escapeXML(resolveDescription(product))}</g:description>
      <g:link>${escapeXML(getProductUrl(product))}</g:link>
      <g:image_link>${escapeXML(getImageUrl(product))}</g:image_link>
      <g:availability>${getAvailability(product)}</g:availability>
      <g:price>${finalPrice.toFixed(2)} ${FEED_CONFIG.currency}</g:price>
      ${salePrice !== null ? `<g:sale_price>${salePrice.toFixed(2)} ${FEED_CONFIG.currency}</g:sale_price>` : ''}
      <g:condition>${getCondition()}</g:condition>
      <g:brand>${escapeXML(resolveBrand(product))}</g:brand>
      <g:google_product_category>${escapeXML(getCategoryPath(product.category))}</g:google_product_category>
      <g:product_type>${escapeXML(normalizeText(product.category, 'General'))}</g:product_type>
      <g:identifier_exists>no</g:identifier_exists>
      <g:shipping>
        <g:country>${FEED_CONFIG.country}</g:country>
        <g:service>Standard</g:service>
        <g:price>0 ${FEED_CONFIG.currency}</g:price>
      </g:shipping>
    </item>`;
    }

    function generateFeedXML(products) {
        const list = Array.isArray(products) ? products : [];
        const publishedProducts = list.filter(isEligibleProduct);
        if (publishedProducts.length <= 1 && typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('[Feed] Products in feed:', publishedProducts.length);
        }
        const itemsXML = publishedProducts.map(generateProductXML).join('\n');
        const now = new Date().toUTCString();

        return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXML(FEED_CONFIG.storeName)}</title>
    <link>${escapeXML(FEED_CONFIG.storeUrl)}</link>
    <description>${escapeXML(FEED_CONFIG.storeDescription)}</description>
    <language>${escapeXML(FEED_CONFIG.language)}</language>
    <lastBuildDate>${escapeXML(now)}</lastBuildDate>
    ${itemsXML}
  </channel>
</rss>`;
    }

    async function regenerateFeed(products = null) {
        const explicitProducts = Array.isArray(products) ? products : null;
        let sourceProducts = explicitProducts;

        if (!sourceProducts && typeof globalThis !== 'undefined') {
            if (typeof globalThis.getPublishedProducts === 'function') {
                sourceProducts = await globalThis.getPublishedProducts();
            } else if (typeof globalThis.getProducts === 'function') {
                sourceProducts = await globalThis.getProducts();
            } else if (Array.isArray(globalThis.products)) {
                sourceProducts = globalThis.products;
            }
        }

        const xml = generateFeedXML(Array.isArray(sourceProducts) ? sourceProducts : []);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('cachedFeed', xml);
            localStorage.setItem('feedLastUpdated', new Date().toISOString());
        }
        return xml;
    }

    return {
        FEED_CONFIG,
        escapeXML,
        getProductUrl,
        getImageUrl,
        getAvailability,
        getCondition,
        getCategoryPath,
        generateProductXML,
        generateFeedXML,
        isEligibleProduct,
        regenerateFeed
    };
});
