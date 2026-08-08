import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': resolve(
        __dirname,
        'tests/__mocks__/async-storage.ts',
      ),
      'react-native': resolve(__dirname, 'tests/__mocks__/react-native.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    server: {
      deps: {
        inline: ['react-native', '@react-navigation/native'],
      },
    },
  },
})
