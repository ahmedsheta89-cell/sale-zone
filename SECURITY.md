# 🔐 سياسة الأمان - Sale Zone Store

## 📌 نظرة عامة

أمان بيانات عملائنا ومستخدمينا هو أولويتنا القصوى. هذا المستند يوضح التدابير الأمنية المطبقة وأفضل الممارسات.

---

## ⚠️ إجراءات أمنية حرجة (يجب تطبيقها فوراً)

### 1. **تغيير كلمة مرور الأدمن**

**كلمة المرور الافتراضية:**
```
SaleZone@2024!Admin
```

**⚠️ يجب تغييرها فوراً بعد أول تسجيل دخول!**

**خطوات التغيير:**
1. سجل دخول إلى لوحة التحكم
2. اذهب إلى "النظام" → "إعدادات النظام"
3. املأ النموذج:
   - كلمة المرور الحالية
   - كلمة المرور الجديدة (قوية)
   - تأكيد كلمة المرور
4. احفظ التغييرات

**متطلبات كلمة المرور القوية:**
- 12 حرف على الأقل
- أحرف كبيرة وصغيرة
- أرقام
- رموز خاصة (@#$%^&*)
- لا تستخدم معلومات شخصية

**أمثلة على كلمات مرور قوية:**
```
SZ@2024!SecureAdmin#99
MyStore$ecure2024!PWD
Admin#SaleZone2024$Strong
```

---

### 2. **تفعيل HTTPS**

**لماذا HTTPS ضروري:**
- حماية بيانات العملاء
- تشفير المعلومات الحساسة
- متطلب إلزامي لـ PWA
- تحسين ترتيب SEO

**كيفية التفعيل (مجاناً):**

```bash
# استخدام Let's Encrypt
sudo apt-get update
sudo apt-get install certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
```

**التجديد التلقائي:**
```bash
sudo certbot renew --dry-run
```

---

### 3. **حماية ملف لوحة التحكم**

**الطريقة 1: Password Protection**

إنشاء `.htpasswd`:
```bash
htpasswd -c /path/to/.htpasswd admin
```

إضافة إلى `.htaccess`:
```apache
<Files "ادمن_2.HTML">
    AuthType Basic
    AuthName "Admin Area"
    AuthUserFile /path/to/.htpasswd
    Require valid-user
</Files>
```

**الطريقة 2: IP Whitelisting**

في `.htaccess`:
```apache
<Files "ادمن_2.HTML">
    Order Deny,Allow
    Deny from all
    Allow from 123.456.789.0  # استبدل بـ IP الخاص بك
    Allow from 192.168.1.0/24 # شبكتك المحلية
</Files>
```

---

### 4. **النسخ الاحتياطية الدورية**

**جدول النسخ الاحتياطي الموصى به:**
- يومياً: قبل إضافة/تعديل منتجات مهمة
- أسبوعياً: كحد أدنى
- شهرياً: نسخة طويلة المدى

**كيفية عمل نسخة احتياطية:**
1. لوحة التحكم → النظام
2. "تصدير جميع البيانات (JSON)"
3. احفظ الملف باسم واضح: `backup-2024-02-01.json`
4. خزّن في أماكن متعددة:
   - جهازك المحلي
   - Google Drive / Dropbox
   - خادم منفصل

**استعادة النسخة الاحتياطية:**
1. لوحة التحكم → النظام
2. "استيراد البيانات (JSON)"
3. اختر الملف
4. تأكيد الاستيراد

---

### 5. **تشفير البيانات الحساسة**

**حالياً، البيانات مخزنة في LocalStorage بدون تشفير.**

**للتحسين المستقبلي:**
```javascript
// مثال: تشفير بسيط
function encryptData(data, key) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

function decryptData(encrypted, key) {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}
```

---

## 🛡️ تدابير أمنية إضافية

### 1. **إعدادات .htaccess**

```apache
# منع الوصول لملفات النظام
<FilesMatch "^\.">
    Require all denied
</FilesMatch>

# حماية الملفات الحساسة
<FilesMatch "(^#.*#|\.(bak|conf|log|sql)|~)$">
    Require all denied
</FilesMatch>

# منع directory listing
Options -Indexes

# رؤوس أمنية
<IfModule mod_headers.c>
    Header set X-XSS-Protection "1; mode=block"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-Content-Type-Options "nosniff"
</IfModule>
```

### 2. **مراقبة الوصول**

راقب سجلات الخادم بانتظام:
```bash
# Apache access log
tail -f /var/log/apache2/access.log | grep "ادمن"

# Error log
tail -f /var/log/apache2/error.log
```

### 3. **تحديثات منتظمة**

- ✅ تحديث المتصفحات
- ✅ تحديث الخادم
- ✅ تحديث نسخة المتجر
- ✅ مراجعة الأكواد

---

## 🚨 الإبلاغ عن الثغرات الأمنية

إذا اكتشفت ثغرة أمنية، يرجى:

1. **لا تنشرها علناً**
2. راسلنا فوراً على:
   - 📧 security@salezone.com
   - 📱 واتساب: 01018108979

3. اذكر:
   - وصف الثغرة
   - خطوات إعادة الإنتاج
   - التأثير المحتمل
   - اقتراحات للحل (إن وُجدت)

**سنرد خلال 48 ساعة**

---

## ✅ قائمة تحقق أمنية

استخدم هذه القائمة للتأكد من تطبيق جميع الإجراءات:

### الإلزامية (قبل النشر):
- [ ] تغيير كلمة مرور الأدمن
- [ ] تفعيل HTTPS
- [ ] حماية ملف الأدمن (.htaccess)
- [ ] إعداد النسخ الاحتياطية
- [ ] اختبار Service Worker

### الموصى بها:
- [ ] IP Whitelisting للأدمن
- [ ] مراقبة السجلات
- [ ] تشفير البيانات الحساسة
- [ ] Two-Factor Authentication (مستقبلاً)
- [ ] Firewall (WAF)

### الصيانة الدورية:
- [ ] نسخ احتياطية أسبوعية
- [ ] مراجعة السجلات شهرياً
- [ ] تحديث كلمة المرور كل 3 أشهر
- [ ] فحص الثغرات كل 6 أشهر

---

## 🔍 أدوات الفحص الأمني

### 1. **SSL/TLS Checker**
```
https://www.ssllabs.com/ssltest/
```

### 2. **Security Headers**
```
https://securityheaders.com/
```

### 3. **Website Security Scan**
```
https://sitecheck.sucuri.net/
```

---

## 📚 موارد إضافية

### التعلم:
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Web Security Academy: https://portswigger.net/web-security

### الأدوات:
- Let's Encrypt: https://letsencrypt.org/
- Cloudflare (مجاني): https://www.cloudflare.com/

---

## 📞 الدعم الأمني

لأي استفسارات أمنية:
- 📧 security@salezone.com
- 📱 01018108979 (طوارئ فقط)

---

## 📝 سجل التغييرات الأمنية

### النسخة 2.0 (فبراير 2024)
- ✅ تحسين كلمة المرور الافتراضية
- ✅ إضافة Service Worker محسّن
- ✅ رؤوس أمنية محدثة
- ✅ HTTPS إلزامي

### النسخة 1.0 (يناير 2024)
- إطلاق أولي

---

**تذكّر: الأمان هو عملية مستمرة، وليس وجهة نهائية! 🔐**

**آخر تحديث: فبراير 2024**
