import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 测试环境启动前加载 .env.test(指向 ihui_test 库)
    setupFiles: ['./tests/setup-env.ts'],
    // 默认跑 mock 测试:tests/ 与 src/{routes,services,jobs}/__tests__/ 下的 *.test.ts
    include: [
      'tests/**/*.test.ts',
      'src/routes/__tests__/**/*.test.ts',
      'src/services/__tests__/**/*.test.ts',
      'src/jobs/__tests__/**/*.test.ts',
    ],
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
    // 全局重试 2 次:容忍 admin-missing-routes.test.ts 等套件在全量并发时偶发的资源争抢失败
    // vitest 2.1.9 不支持 it.retry() 方法,只能通过 test.retry 全局配置
    retry: 2,
  },
})
