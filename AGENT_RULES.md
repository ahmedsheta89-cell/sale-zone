# 🔴 Sale Zone — Agent Rules (إلزامية)
## اقرأ هذا أولاً قبل أي عمل — لا استثناءات

### القاعدة الذهبية
> لا تكسر ما يعمل.
> لا تحذف — أخفِ إذا احتجت.
> DIAGNOSE أولاً — دائماً.

### قبل أي تغيير
```
1. اقرأ هذا الملف كاملاً
2. شغّل PHASE 1 diagnosis
3. اعرض ما ستفعله على المالك
4. انتظر التأكيد
```

### قواعد الحذف — صارمة جداً
```
❌ لا تحذف function تُستدعى في أي مكان
❌ لا تحذف UI يعمل — أضف class="feature-hidden"
❌ لا تحذف أكثر من 10 سطر بدون موافقة صريحة
❌ لا تستخدم --no-verify أبداً
✅ تحقق من كل استدعاء قبل الحذف
✅ أخبر المالك بحجم التغيير قبل التنفيذ
```

### الـ Features — إخفاء لا حذف
```
لو طُلب منك "حذف" feature:
1. أضف class="feature-hidden" للـ UI
2. أبقِ الكود كاملاً
3. اربطه بـ featureFlags في Firebase
4. المالك يتحكم من الأدمن
```

### هيكل المشروع
```
متجر_2.HTML    → Store (لا تغير الاسم)
ادمن_2.HTML    → Admin (لا تغير الاسم)
assets/js/     → كل الـ JS modules
tools/         → أدوات التطوير
monitoring/    → ملفات المراقبة
docs/          → التوثيق
لا تبنِ خارج هذا الهيكل
```

### Governance إلزامي قبل كل commit
```
node tools/usage-check.js      ← MUST PASS
node tools/contracts-check.js  ← MUST PASS
node tools/snapshot-check.js   ← MUST PASS
node tools/smoke-check.js      ← MUST PASS
```

### Feature Flags — طريقة التحكم
```
كل feature لها flag في Firebase:
/storeSettings/featureFlags/[featureName]: true/false

المتجر يقرأ الـ flags عند التحميل
الأدمن يغيرها من لوحة التحكم
```

### ?? Governance Tools � SACRED RULES
```
1. NEVER modify governance tools unless explicitly asked
2. ALWAYS run npm ci before running tools
3. NEVER commit a registry with fewer functions
4. If governance fails, fix YOUR code, not the tools
5. Protected files: tools/*.js, .github/workflows/*.yml
```

## LIVE VALIDATION GATE — MANDATORY

Before declaring any branch "ready to merge",
ALL of the following must be confirmed by the
store owner on the actual live/deployed environment:

□ CREATE: new record appears on storefront
□ EDIT: changes persist after page refresh
□ DELETE: record gone after page refresh
□ No new console errors on admin or storefront
□ No regression on existing features

A branch is NOT ready to merge based on:
- Local governance checks alone
- Code review alone
- Simulated or mocked tests alone
- Agent judgment alone without owner confirmation

BLOCKED status is honest and acceptable.
"Ready" without live CRUD evidence is not acceptable.

This rule applies to ALL branches, not just banners.
