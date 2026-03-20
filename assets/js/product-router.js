(function (root) {
    'use strict';

    const STORE_URL = 'https://ahmedsheta89-cell.github.io/sale-zone/متجر_2.HTML';
    const DEFAULT_TITLE = 'Sale Zone | متجر التجميل';
    const PLACEHOLDER_IMAGE = 'assets/placeholder.svg';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function wait(ms) {
        return new Promise((resolve) => root.setTimeout(resolve, ms));
    }

    function getProductName(product) {
        return String(product?.nameAr || product?.name || '').trim();
    }

    function getProductDescription(product) {
        return String(product?.descriptionAr || product?.description || product?.desc || getProductName(product)).trim();
    }

    function getProductImage(product, width = 800) {
        if (typeof root.getSafeImageUrl === 'function') {
            return root.getSafeImageUrl(product, width) || PLACEHOLDER_IMAGE;
        }
        return String(product?.imageUrl || product?.image || PLACEHOLDER_IMAGE).trim() || PLACEHOLDER_IMAGE;
    }

    function getProductPriceValue(product) {
        if (typeof root.resolveDisplayPrice === 'function') {
            const resolved = Number(root.resolveDisplayPrice(product));
            if (Number.isFinite(resolved)) return resolved;
        }
        const direct = Number(product?.price);
        return Number.isFinite(direct) ? direct : 0;
    }

    function getProductPriceLabel(product) {
        const priceValue = getProductPriceValue(product);
        if (typeof root.formatPrice === 'function') {
            return root.formatPrice(priceValue);
        }
        return `${priceValue} جنيه`;
    }

    function getProductUrl(productId) {
        return `${STORE_URL}#product/${encodeURIComponent(String(productId || ''))}`;
    }

    async function resolveProductById(productId) {
        if (!productId) return null;

        if (typeof root.getProductById === 'function') {
            try {
                const directProduct = await root.getProductById(productId);
                if (directProduct) return directProduct;
            } catch (_) {}
        }

        const sources = [];
        if (Array.isArray(root.products)) sources.push(root.products);
        if (typeof root.getVisibleProductsList === 'function') {
            try {
                const visible = root.getVisibleProductsList();
                if (Array.isArray(visible)) sources.push(visible);
            } catch (_) {}
        }

        for (const list of sources) {
            const found = list.find((item) => String(item?.id || '') === String(productId));
            if (found) return found;
        }

        return null;
    }

    async function waitForProduct(productId, attempts = 20, delayMs = 500) {
        for (let index = 0; index < attempts; index += 1) {
            const found = await resolveProductById(productId);
            if (found) return found;
            await wait(delayMs);
        }
        return null;
    }

    function ensureStoreContainers() {
        const storeContainer = document.getElementById('storeContainer') || document.getElementById('main-content');
        if (!storeContainer) return { storeContainer: null, storeGrid: null };

        if (storeContainer.id !== 'storeContainer') {
            storeContainer.id = 'storeContainer';
        }

        let storeGrid = document.getElementById('storeGrid');
        if (!storeGrid) {
            storeGrid = document.createElement('div');
            storeGrid.id = 'storeGrid';

            const nodesToMove = Array.from(storeContainer.childNodes).filter((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return Boolean(String(node.textContent || '').trim());
                }
                return !(node.nodeType === Node.ELEMENT_NODE && node.id === 'productPage');
            });

            nodesToMove.forEach((node) => storeGrid.appendChild(node));
            storeContainer.appendChild(storeGrid);
        }

        return { storeContainer, storeGrid };
    }

    function setMetaTag(attr, key, content) {
        let element = document.querySelector(`meta[${attr}="${key}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attr, key);
            document.head.appendChild(element);
        }
        element.setAttribute('content', String(content || ''));
    }

    const ProductRouter = {
        _initialized: false,

        init() {
            if (this._initialized) return;
            this._initialized = true;
            root.addEventListener('hashchange', this.handleRoute.bind(this));
            this.handleRoute();
        },

        async handleRoute() {
            const hash = String(root.location.hash || '').trim();
            const match = hash.match(/^#product\/(.+)$/);
            if (match) {
                await this.showProductPage(decodeURIComponent(match[1]));
            } else {
                this.showStorePage();
            }
        },

        async showProductPage(productId) {
            const product = await waitForProduct(productId);
            if (!product) {
                root.location.hash = '';
                return;
            }

            const { storeContainer, storeGrid } = ensureStoreContainers();
            if (!storeContainer || !storeGrid) return;

            document.title = `${getProductName(product)} | Sale Zone`;
            this.updateOGTags(product);
            this.updateSchemaOrg(product);

            storeGrid.style.display = 'none';
            document.getElementById('productPage')?.remove();

            const page = document.createElement('div');
            page.id = 'productPage';
            page.innerHTML = this.renderProductPage(product);
            storeContainer.appendChild(page);

            page.querySelector('[data-action="back"]')?.addEventListener('click', () => {
                root.location.hash = '';
            });
            page.querySelector('[data-action="add-to-cart"]')?.addEventListener('click', () => {
                if (typeof root.addToCart === 'function') {
                    root.addToCart(String(product.id || ''));
                }
            });
            page.querySelector('[data-action="share-whatsapp"]')?.addEventListener('click', () => {
                if (typeof root.shareProductOnWhatsApp === 'function') {
                    root.shareProductOnWhatsApp(product);
                }
            });

            root.scrollTo({ top: 0, behavior: 'smooth' });
        },

        showStorePage() {
            const { storeGrid } = ensureStoreContainers();
            document.getElementById('productPage')?.remove();
            document.getElementById('schemaOrg')?.remove();
            if (storeGrid) {
                storeGrid.style.display = '';
            }
            document.title = DEFAULT_TITLE;
            setMetaTag('property', 'og:title', DEFAULT_TITLE);
            setMetaTag('property', 'og:description', 'متجر إلكتروني للعناية الشخصية والمكملات الغذائية');
            setMetaTag('property', 'og:image', `${root.location.origin}${root.location.pathname.replace(/[^/]+$/, '')}${PLACEHOLDER_IMAGE}`);
            setMetaTag('property', 'og:url', STORE_URL);
            setMetaTag('property', 'og:type', 'website');
        },

        updateOGTags(product) {
            const name = getProductName(product);
            const description = getProductDescription(product);
            const image = getProductImage(product);
            const url = getProductUrl(product.id);

            setMetaTag('property', 'og:title', name);
            setMetaTag('property', 'og:description', description);
            setMetaTag('property', 'og:image', image);
            setMetaTag('property', 'og:url', url);
            setMetaTag('property', 'og:type', 'product');
        },

        updateSchemaOrg(product) {
            document.getElementById('schemaOrg')?.remove();
            const script = document.createElement('script');
            script.id = 'schemaOrg';
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: getProductName(product),
                image: getProductImage(product),
                description: getProductDescription(product),
                brand: { '@type': 'Brand', name: product?.brand || 'Sale Zone' },
                offers: {
                    '@type': 'Offer',
                    price: getProductPriceValue(product),
                    priceCurrency: 'EGP',
                    availability: Number(product?.stock) === 0
                        ? 'https://schema.org/OutOfStock'
                        : 'https://schema.org/InStock',
                    url: getProductUrl(product.id)
                }
            });
            document.head.appendChild(script);
        },

        renderProductPage(product) {
            const discount = Number(product?.oldPrice) > getProductPriceValue(product)
                ? Math.round((1 - (getProductPriceValue(product) / Number(product.oldPrice))) * 100)
                : 0;
            const priceText = escapeHtml(getProductPriceLabel(product));
            const oldPriceText = Number(product?.oldPrice) > getProductPriceValue(product)
                ? (typeof root.formatPrice === 'function' ? root.formatPrice(Number(product.oldPrice)) : `${Number(product.oldPrice)} جنيه`)
                : '';
            const stockValue = Number(product?.stock);
            const lowStock = Number.isFinite(stockValue) && stockValue > 0 && stockValue <= 5;
            const outOfStock = Number.isFinite(stockValue) && stockValue === 0;

            return `
                <div style="max-width:900px;margin:0 auto;padding:16px">
                    <button type="button" data-action="back"
                        style="background:none;border:none;cursor:pointer;color:var(--color-text-secondary);margin-bottom:16px">
                        ← العودة للمتجر
                    </button>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;align-items:start">
                        <div>
                            <img src="${escapeHtml(getProductImage(product))}"
                                alt="${escapeHtml(getProductName(product))}"
                                style="width:100%;border-radius:12px;object-fit:cover"
                                onerror="handleStoreImageError(this)">
                        </div>
                        <div>
                            <h1 style="font-size:1.4rem;margin:0 0 8px">${escapeHtml(getProductName(product))}</h1>
                            ${product?.nameEn ? `<p style="color:var(--color-text-secondary);font-size:0.9rem">${escapeHtml(product.nameEn)}</p>` : ''}
                            <div style="margin:12px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                                <span style="font-size:1.6rem;font-weight:700;color:var(--color-text-info)">${priceText}</span>
                                ${discount > 0 ? `
                                    <span style="text-decoration:line-through;color:var(--color-text-tertiary);margin-right:8px">${escapeHtml(oldPriceText)}</span>
                                    <span style="background:#e53e3e;color:#fff;border-radius:6px;padding:2px 8px;font-size:0.8rem">خصم ${discount}%</span>
                                ` : ''}
                            </div>
                            ${lowStock ? `<p style="color:#dd6b20;font-size:0.85rem">⚠️ باقى ${stockValue} قطع فقط</p>` : ''}
                            ${outOfStock ? `<p style="color:#e53e3e;font-size:0.85rem">نفد من المخزون</p>` : ''}
                            <p style="color:var(--color-text-secondary);line-height:1.7;margin:12px 0">${escapeHtml(getProductDescription(product))}</p>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
                                <button type="button" data-action="add-to-cart"
                                    style="flex:1;background:var(--color-text-info);color:#fff;border:none;border-radius:8px;padding:12px;cursor:pointer;font-size:1rem"
                                    ${outOfStock ? 'disabled' : ''}>
                                    ${outOfStock ? 'نفد من المخزون' : 'أضف للسلة'}
                                </button>
                                <button type="button" data-action="share-whatsapp"
                                    style="background:#25D366;color:#fff;border:none;border-radius:8px;padding:12px 16px;cursor:pointer">
                                    واتساب
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    root.ProductRouter = ProductRouter;

    document.addEventListener('DOMContentLoaded', () => {
        ProductRouter.init();
    });
})(window);
