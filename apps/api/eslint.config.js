import base from '@ihui/eslint-config'

export default [
  ...base,
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: '.js files are not allowed in src/. Use .ts instead.',
        },
      ],
    },
  },
]
