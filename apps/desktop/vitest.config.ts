import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10_000,
    retry: 2,
  },
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@ihui/api-client': path.resolve(root, '../../packages/api-client/src/index.ts'),
    },
  },
})
