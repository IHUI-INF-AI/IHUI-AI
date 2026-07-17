import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'lib/**/*.test.ts',
      'entrypoints/**/*.test.ts',
      'entrypoints/**/*.test.tsx',
    ],
    passWithNoTests: true,
  },
})
