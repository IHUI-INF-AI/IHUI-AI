import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts', 'entrypoints/**/*.test.ts'],
    passWithNoTests: true,
  },
})
