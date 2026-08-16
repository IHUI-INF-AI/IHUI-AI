import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@plugins-data': path.resolve(__dirname, './app/(main)/plugins/plugins-data'),
    },
  },
  test: {
    // 全局默认 happy-dom(Node 20.11 + jsdom@29 的 html-encoding-sniffer@6 ESM 不兼容,降级 happy-dom)
    environment: 'happy-dom',
    // tests/visual/*.spec.ts 由 Playwright 跑(playwright.config.ts),不归 vitest 管
    // 加上 tests/visual/** 排除,避免 vitest 把 `test.describe` 当作未知 API
    exclude: ['**/node_modules/**', '**/e2e/**', '**/tests/visual/**'],
    // 2026-08-06 根治 .vite-temp 缓存污染:vite 的 loadConfigFromBundledFile 把转译后的
    // TS 配置文件写入 node_modules/.vite-temp/,多 vitest 进程/worker 并发写同一目录时
    // 互相覆盖 → 残留损坏 mjs → 全量跑偶发"49 失败"/空输出。
    // fileParallelism=false 让测试文件串行执行,单 worker 写缓存,从源头杜绝并发冲突
    // (此前靠跑前手动清 .vite-temp 只能治标,重启测试又再生)。
    fileParallelism: false,
  },
})
