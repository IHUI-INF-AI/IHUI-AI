import nextConfig from '@ihui/eslint-config/next'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'e2e/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: '.js files are not allowed in src/. Use .ts or .tsx instead.',
        },
      ],
    },
  },
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: { ...jsxA11y.configs.recommended.rules },
  },
  {
    files: ['src/components/media/ThreeDViewer.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
]
