import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // 全局默认 happy-dom(Node 20.11 + jsdom@29 的 html-encoding-sniffer@6 ESM 不兼容,降级 happy-dom)
    environment: 'happy-dom',
    // tests/visual/*.spec.ts 由 Playwright 跑(playwright.config.ts),不归 vitest 管
    // 加上 tests/visual/** 排除,避免 vitest 把 `test.describe` 当作未知 API
    exclude: ['**/node_modules/**', '**/e2e/**', '**/tests/visual/**'],
  },
})
