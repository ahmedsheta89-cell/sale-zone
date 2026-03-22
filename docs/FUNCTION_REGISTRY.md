# Sale Zone — Function Registry
## ⚠️ اقرأ قبل حذف أي function

| Function | File | Critical | Purpose |
|----------|------|----------|---------|
| setupAutoTooltips | متجر_2.HTML | 🔴 YES | Product tooltips |
| loadProducts | متجر_2.HTML | 🔴 YES | Load all products |
| renderProducts | متجر_2.HTML | 🔴 YES | Render cards |
| toggleCart | متجر_2.HTML | 🔴 YES | Cart panel |
| toggleWishlist | متجر_2.HTML | 🔴 YES | Wishlist panel |
| updateCartBadge | متجر_2.HTML | 🔴 YES | Cart count |
| sendCartToWhatsApp | متجر_2.HTML | 🔴 YES | Order via WA |
| openFAQBot | متجر_2.HTML | 🔴 YES | FAQ widget |
| closeFAQBot | متجر_2.HTML | 🔴 YES | Close FAQ widget |
| openTawkChat | متجر_2.HTML | 🔴 YES | tawk.to |
| applyFeatureFlags | متجر_2.HTML | 🔴 YES | Feature control |
| showAnnouncementBar | متجر_2.HTML | 🟡 NO | Announcement |
| startFlashSaleTimer | متجر_2.HTML | 🟡 NO | Flash sale |
| NavHistory | assets/js/nav-history.js | 🔴 YES | Back button |
| Toast | assets/js/toast.js | 🔴 YES | Notifications |
| FAQBot | assets/js/faq-bot.js | 🔴 YES | Bot logic |
| enhanceProductImageUrl | assets/js/cloudinary-service.js | 🔴 YES | Images |
| uploadToCloudinary | assets/js/cloudinary-service.js | 🔴 YES | Upload |
| getAllProducts | assets/js/firebase-api.js | 🔴 YES | Fetch products |
| updateProduct | assets/js/firebase-api.js | 🔴 YES | Update product |
| getStoreSettings | assets/js/firebase-api.js | 🔴 YES | Settings |
| updateStoreSettings | assets/js/firebase-api.js | 🔴 YES | Save settings |
| loadControlCenter | ادمن_2.HTML | 🔴 YES | Admin controls |
| saveFeatureFlag | ادمن_2.HTML | 🔴 YES | Toggle features |

## Rules
```
🔴 Critical: لا تحذف أبداً — أخفِ إذا احتجت
🟡 Optional: يمكن إخفاؤها — لا تحذف
```
