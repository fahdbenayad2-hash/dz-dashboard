#!/usr/bin/env node
/**
 * سكريبت لتسجيل webhook مع Telegram — شغّله مرة واحدة فقط
 *
 * الاستخدام:
 *   BOT_TOKEN=xxx VERCEL_URL=https://your-app.vercel.app node scripts/setup-webhook.mjs
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL;

if (!BOT_TOKEN || !VERCEL_URL) {
  console.error('❌ الاستخدام: BOT_TOKEN=xxx VERCEL_URL=https://your-app.vercel.app node scripts/setup-webhook.mjs');
  process.exit(1);
}

const WEBHOOK_URL = `${VERCEL_URL.replace(/\/$/, '')}/api/telegram-bot`;

async function run() {
  console.log(`🔗 تسجيل webhook على: ${WEBHOOK_URL}`);

  // 1. تعيين الـ webhook
  const setRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const setData = await setRes.json();
  if (setData.ok) {
    console.log('✅ Webhook مُسجَّل بنجاح');
  } else {
    console.error('❌ فشل تسجيل Webhook:', setData.description);
    process.exit(1);
  }

  // 2. التحقق من معلومات الـ webhook
  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log('\n📋 معلومات الـ Webhook:');
  console.log(`  URL: ${infoData.result.url}`);
  console.log(`  Pending updates: ${infoData.result.pending_update_count}`);
  if (infoData.result.last_error_message) {
    console.warn(`  ⚠️ آخر خطأ: ${infoData.result.last_error_message}`);
  }

  // 3. معلومات البوت
  const meRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
  const meData = await meRes.json();
  if (meData.ok) {
    console.log(`\n🤖 البوت: @${meData.result.username} (ID: ${meData.result.id})`);
  }

  console.log('\n🚀 جاهز! ابدأ محادثة مع البوت وجرّب /help');
}

run().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
