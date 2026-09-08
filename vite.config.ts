import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { devApi } from './scripts/dev-api.ts'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sourceDirectory = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  for (const name of ['DASHBOARD_PASSWORD', 'SESSION_SECRET', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_WIF_AUDIENCE', 'SHEET_ID', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_ID', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_TEST_CHAT_ID']) {
    if (!process.env[name] && environment[name]) process.env[name] = environment[name];
  }
  return {
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [devApi(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': sourceDirectory,
    },
  },
}})
