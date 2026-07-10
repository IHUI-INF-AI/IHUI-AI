import reactConfig from '@ihui/eslint-config/react'

export default [
  ...reactConfig,
  {
    ignores: ['dist/**', '.swc/**', 'config/**', 'babel.config.js', 'scripts/**'],
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
