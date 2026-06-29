import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * vitest 配置（独立于 vite.config.ts，避免加载 uni-app 插件导致测试环境报错）
 *
 * 测试范围：
 * - utils/ 下的纯逻辑工具函数（uploadImage.js、push.js 等）
 * - 不测试 Vue 组件（组件依赖 uni-app 运行时，需 e2e 测试）
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // node 环境（不需要 DOM）
    environment: 'node',
    // 测试文件位置
    include: ['src/**/__tests__/**/*.test.{js,ts}'],
    // 覆盖率配置（可选）
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**/*.{js,ts}'],
    },
  },
})
