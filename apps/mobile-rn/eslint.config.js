import reactConfig from '@ihui/eslint-config/react'
import crossEndConfig from '@ihui/eslint-config/cross-end'

export default [
  ...reactConfig,
  ...crossEndConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
      'ios/**',
      'android/**',
    ],
  },
]
