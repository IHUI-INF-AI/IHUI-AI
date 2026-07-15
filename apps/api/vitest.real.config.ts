import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 加载 .env.test(指向 ihui_test 库)
    setupFiles: ['./tests/setup-env.ts'],
    // 只跑真实 DB 集成测试
    include: ['tests/**/*.real.test.ts', 'src/routes/__tests__/**/*.real.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    fileParallelism: false,
    // 路由代码的 db 连接池在模块导入时创建,不会被关闭,需强制退出
    forceExit: true,
  },
})
