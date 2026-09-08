# DZ Commerce Intelligence

لوحة داخلية لتحليل طلبات Octomatic وحالات الشحن من Google Sheets. تعرض مؤشرات الأداء، تقارير الأشهر والسنوات، المنتجات، الوكلاء، الطلبات المعلقة، التتبع، المخاطر، والاتجاهات اليومية.

## البنية

- **Octomatic → Apps Script:** مزامنة مجزأة وقابلة للاستئناف إلى أوراق `Orders` و`Tracking` مع نشر ذري بعد التحقق.
- **Google Sheets → Vercel:** خادم Edge يقرأ الشيت بحساب خدمة للقراءة فقط عبر Workload Identity Federation، دون مفتاح JSON دائم.
- **Vercel → المتصفح:** جلسة موقعة في Cookie آمنة و`HttpOnly`. البيانات والأسرار لا تدخل حزمة React.

يعتمد الخادم على ورقة `SyncStatus` كي لا يعرض جيلاً ناقصاً أثناء المزامنة. تاريخ التتبع هو تاريخ سجل التتبع، وليس دليلاً على تاريخ التسليم.

## التشغيل المحلي

يتطلب Node.js 20 أو أحدث.

```bash
npm ci
npm run dev
```

في التطوير المحلي فقط، يقدّم Vite بيانات اصطناعية عبر محاكي API. لا تُستخدم بيانات العملاء الحقيقية ولا صلاحيات Google.

## التحقق

```bash
npm test
npm run lint
npm run build
```

## متغيرات Vercel

احفظ القيم التالية كأسرار في بيئة `Production`:

- `DASHBOARD_PASSWORD`: كلمة مرور لوحة التحكم، 16 حرفاً على الأقل.
- `SESSION_SECRET`: قيمة عشوائية لا تقل عن 32 حرفاً لتوقيع الجلسات.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: بريد حساب الخدمة القارئ.
- `GOOGLE_WIF_AUDIENCE`: مسار موفّر Workload Identity الكامل.
- `SHEET_ID`: معرّف Google Sheet.

ميزات Telegram الاختيارية تحتاج `TELEGRAM_BOT_TOKEN` و`TELEGRAM_ALLOWED_ID` و`TELEGRAM_WEBHOOK_SECRET`، ويمكن إضافة `TELEGRAM_TEST_CHAT_ID` للاختبار من الواجهة. لا تستخدم بادئة `VITE_` لأي سر.

## مزامنة Octomatic

ملفات Apps Script وتعليمات تركيبها موجودة في [`scripts/apps-script`](scripts/apps-script). يدعم `Authentication.gs` تجديد JWT تلقائياً عند قرب انتهائه أو بعد رد 401، بشرط تفعيل `OCTO_AUTO_LOGIN=true` وحفظ بيانات حساب تكامل مخصص في Script Properties. إذا كان الحساب يستعمل OTP أو CAPTCHA فستحتاج إعادة ربط يدوية.

التفاصيل التشغيلية والأمنية:

- [`GOOGLE_KEYLESS_SETUP_AR.md`](GOOGLE_KEYLESS_SETUP_AR.md)
- [`TOKEN_RENEWAL_PLAN_AR.md`](TOKEN_RENEWAL_PLAN_AR.md)
- [`SYNC_DEVELOPMENT_PLAN_AR.md`](SYNC_DEVELOPMENT_PLAN_AR.md)
- [`PROJECT_REVIEW_AR.md`](PROJECT_REVIEW_AR.md)

## النشر

الفرع `main` مرتبط بـVercel. كل دفع ناجح يشغّل بناء Production. بعد تغيير أسرار Vercel، أعد نشر آخر Deployment كي تدخل القيم الجديدة إلى الخادم.
