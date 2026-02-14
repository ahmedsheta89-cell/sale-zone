/* eslint-disable no-restricted-globals */
let indexedProducts = [];

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[\u064b-\u065f]/g, '')
        .replace(/[\u0623\u0625\u0622]/g, '\u0627')
        .replace(/\u0629/g, '\u0647')
        .replace(/\u0649/g, '\u064a')
        .replace(/[^a-z0-9\u0621-\u064a\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildSearchBlob(product) {
    const tokens = Array.isArray(product.searchTokens) ? product.searchTokens : [];
    return normalizeText([
        product.name,
        product.desc,
        product.code,
        product.category,
        product.supplierName,
        product.supplierCode,
        ...tokens
    ].join(' '));
}

function sortRows(rows, sort) {
    switch (String(sort || 'default')) {
        case 'price-low':
            rows.sort((a, b) => Number(a.sellPrice || a.price || 0) - Number(b.sellPrice || b.price || 0));
            break;
        case 'price-high':
            rows.sort((a, b) => Number(b.sellPrice || b.price || 0) - Number(a.sellPrice || a.price || 0));
            break;
        case 'rating':
            rows.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
            break;
        case 'name':
            rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
            break;
        default:
            rows.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
            break;
    }
}

function runSearch(payload) {
    const query = normalizeText(payload && payload.query ? payload.query : '');
    const queryTokens = query ? query.split(' ').filter(Boolean) : [];
    const filters = payload && payload.filters && typeof payload.filters === 'object' ? payload.filters : {};
    const sort = payload && payload.sort ? payload.sort : 'default';
    const page = Math.max(1, Number(payload && payload.page) || 1);
    const pageSize = Math.max(1, Math.min(120, Number(payload && payload.pageSize) || 24));
    const category = String(payload && payload.currentCategory || 'all');

    const minPrice = Number(filters.minPrice);
    const maxPrice = Number(filters.maxPrice);
    const supplierId = String(filters.supplierId || '').trim();
    const inStockOnly = filters.inStockOnly === true;

    let rows = indexedProducts.filter((row) => {
        if (!row || row.isPublished === false) return false;
        if (category !== 'all' && String(row.category || '') !== category) return false;
        const priceValue = Number(row.sellPrice || row.price || 0);
        if (Number.isFinite(minPrice) && priceValue < minPrice) return false;
        if (Number.isFinite(maxPrice) && priceValue > maxPrice) return false;
        if (supplierId && String(row.supplierId || '') !== supplierId) return false;
        if (inStockOnly && Number(row.stock || 0) <= 0) return false;
        if (!queryTokens.length) return true;
        return queryTokens.every((token) => row.__searchBlob.includes(token));
    });

    sortRows(rows, sort);

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = rows.slice(start, start + pageSize).map(({ __searchBlob, ...rest }) => rest);

    return {
        items,
        total,
        page: safePage,
        pageSize,
        totalPages
    };
}

self.onmessage = (event) => {
    const message = event && event.data ? event.data : {};
    const type = message.type;

    if (type === 'build') {
        const products = Array.isArray(message.products) ? message.products : [];
        indexedProducts = products.map((product) => ({
            ...(product || {}),
            __searchBlob: buildSearchBlob(product || {})
        }));
        self.postMessage({
            type: 'built',
            count: indexedProducts.length
        });
        return;
    }

    if (type === 'search') {
        const requestId = message.requestId || '';
        const result = runSearch(message.payload || {});
        self.postMessage({
            type: 'search-result',
            requestId,
            result
        });
    }
};
