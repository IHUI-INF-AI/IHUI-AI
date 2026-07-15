import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 测试环境启动前加载 .env.test(指向 ihui_test 库)
    setupFiles: ['./tests/setup-env.ts'],
    // 默认跑 mock 测试:tests/ 与 src/routes/__tests__/ 下的 *.test.ts
    include: ['tests/**/*.test.ts', 'src/routes/__tests__/**/*.test.ts'],
    // 排除真实 DB 集成测试(用 vitest.real.config.ts 单独跑)
    exclude: [
      'dist/**',
      'node_modules/**',
      'tests/**/*.real.test.ts',
      'src/routes/__tests__/**/*.real.test.ts',
    ],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // mock 测试不连真实 DB,可并行跑(真实 DB 测试在 vitest.real.config.ts 中串行)
    fileParallelism: true,
  },
})
