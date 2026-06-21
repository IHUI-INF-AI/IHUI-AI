import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts', 'packages/**/__tests__/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'packages/**',
        'packages/*/dist/**',
        'packages/*/node_modules/**',
        '**/*.config.ts',
        '**/*.config.js',
        '**/*.d.ts',
        'src/test-setup.ts',
        'src/**/__tests__/**',
        'src/api/generated-client.ts',
        'e2e/**',
        'scripts/**',
        'electron/**',
        'miniapp/**',
        'storybook-static/**',
        'coverage/**',
        'public/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // 历史遗留测试引用的源文件已废弃，映射到一个空模块避免 vitest transform 失败
      '../retry': resolve(__dirname, './src/utils/__tests__/_stubs/retry-stub.ts'),
      '../themeShare': resolve(__dirname, './src/utils/__tests__/_stubs/themeShare-stub.ts'),
      '../themeVersionControl': resolve(__dirname, './src/utils/__tests__/_stubs/themeVersionControl-stub.ts'),
    },
  },
})
