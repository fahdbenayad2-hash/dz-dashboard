# ربط Google بدون مفتاح JSON

تم إثبات في واجهة Google أن `iam.disableServiceAccountKeyCreation` تمنع إنشاء المفاتيح. لم يتم تعطيل السياسة، ولم ينشأ مفتاح JSON.

## ما تم فعلياً

- إنشاء `dz-dashboard-reader@t-flow-orders.iam.gserviceaccount.com` بدون أدوار إدارة للمشروع.
- التحقق من منح هوية Vercel للإنتاج فقط دور Utilisateur Workload Identity على حساب الخدمة يوم 2026-09-07، دون منح دور على مستوى المشروع.
- تم التحقق من حفظ متغيرات GOOGLE_SERVICE_ACCOUNT_EMAIL وSHEET_ID وGOOGLE_WIF_AUDIENCE في Production، وحفظ المالك DASHBOARD_PASSWORD وSESSION_SECRET كـSecret. لم تُكشف القيم السرية.
- Google Sheets API وIAM Service Account Credentials API وSecurity Token Service API كلها مفعّلة حسب صفحات Google يوم 2026-09-07.
- منح هذا الحساب صلاحية Lecteur فقط على شيت dz-dashboarb، بعد موافقة المالك؛ تم التحقق من قائمة المشاركين.
- تعديل طبقة الخادم لاستبدال Vercel OIDC بـGoogle STS ثم رمز حساب خدمة لمدة ساعة وبنطاق spreadsheets.readonly.
- إزالة الاعتماد على GOOGLE_PRIVATE_KEY من الكود. اختبارات الشبكة تستخدم قيماً اصطناعية، ولا تثبت نجاح الربط الحي.

## إعداد الثقة المطلوب

في Google Workload Identity Federation، مشروع `t-flow-orders`:

- تم إنشاء Pool: `dz-dashboard-vercel` والتحقق من رسالة نجاح Google يوم 2026-09-07.
- تم إنشاء Provider: `vercel`، نوع OIDC. رقم المشروع: `890921781957`.
- Issuer المثبت في إعداد Vercel: `https://oidc.vercel.com/fahdbenayad2-hashs-projects`.
- Allowed audience: `https://vercel.com/fahdbenayad2-hashs-projects`.
- google.subject = assertion.sub.
- شرط القبول للإنتاج فقط:
  `assertion.sub == "owner:fahdbenayad2-hashs-projects:project:dz-dashboard:environment:production"`.
- منح هوية subject المحددة فقط دور roles/iam.workloadIdentityUser على حساب القراءة. لا تمنح الدور للمجموعة كاملة ولا أدوار Editor/Owner/Storage Admin.
- أي توسيع إلى Preview يتطلب تحديد تلك البيئة صراحة. الكود التجريبي المحلي يمكن اختباره بالبيانات الاصطناعية دون صلاحية الشيت.
- تفعيل Google Sheets API وSecurity Token Service API وIAM Service Account Credentials API حسب حالة المشروع.

متغيرات Vercel: GOOGLE_SERVICE_ACCOUNT_EMAIL، SHEET_ID، GOOGLE_WIF_AUDIENCE (المسار الذي يضم رقم مشروع Google الفعلي، لا معرف النص t-flow-orders).
قيمة GOOGLE_WIF_AUDIENCE: `//iam.googleapis.com/projects/890921781957/locations/global/workloadIdentityPools/dz-dashboard-vercel/providers/vercel`.
إنشاء الموفّر لا يثبت اكتمال تفويض حساب الخدمة أو نجاح قراءة الشيت من Vercel؛ يلزم التحقق منهما منفصلين.
متغيرات الدخول: DASHBOARD_PASSWORD وSESSION_SECRET تُدخل من المالك. لا تستعمل بادئة VITE_ للأسرار.

## شروط التفعيل

1. إعداد مزامنة ResumableSync على نسخة اختبار وإثبات pagination قبل تشغيلها على المصدر الحقيقي.
2. وجود SyncStatus لجيل مكتمل قبل تفعيل /api/data الجديد؛ لا تزور metadata على البيانات القديمة.
3. اختبار وصول الخادم بالشيت وصلاحيات جلسة الدخول.
4. اكتمل: أُغلقت المشاركة العامة للشيت يوم 2026-09-08، وبقي المالك وحساب الخدمة القارئ فقط. أُعيد تحميل الموقع بعد التغيير وتأكد استمرار القراءة الخاصة عبر WIF.
5. ضبط rate limit لمسار POST /api/session عبر Vercel Firewall قبل نشره للعامة.

المراجع: [Vercel GCP OIDC](https://vercel.com/docs/oidc/gcp)، [Vercel request identity](https://vercel.com/docs/oidc/reference)، [Google STS](https://docs.cloud.google.com/iam/docs/reference/sts/rest/v1/TopLevel/token).

هذا الربط خاص بـGoogle؛ مفاتيح Octomatic تحتاج مسار Authentication.gs مستقلاً واختبار تجديد فعلي.
