import nextConfig from '@ihui/eslint-config/next'

export default [
  ...nextConfig,
  {
    ignores: ['.next/**', 'out/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'e2e/**'],
  },
]
