import reactConfig from '@ihui/eslint-config/react'
import crossEndConfig from '@ihui/eslint-config/cross-end'

export default [
  ...reactConfig,
  ...crossEndConfig,
  {
    ignores: ['dist/**', 'dist-alipay/**', '.swc/**', 'config/**', 'babel.config.js', 'scripts/**'],
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
]
