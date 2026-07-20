import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // 全局默认 jsdom,所有 *.test.tsx / DOM API 触达测试无需再在文件顶部加 `// @vitest-environment jsdom`
    // 单测文件若有特殊需求(纯 node 算法测试)可在文件顶部用 directive 覆盖
    environment: 'jsdom',
    // tests/visual/*.spec.ts 由 Playwright 跑(playwright.config.ts),不归 vitest 管
    // 加上 tests/visual/** 排除,避免 vitest 把 `test.describe` 当作未知 API
    exclude: ['**/node_modules/**', '**/e2e/**', '**/tests/visual/**'],
  },
})
