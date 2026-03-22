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
