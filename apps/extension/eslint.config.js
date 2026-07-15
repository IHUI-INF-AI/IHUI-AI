import base from '@ihui/eslint-config'

export default [
  ...base,
  {
    ignores: ['.output/**', '.wxt/**', 'dist/**'],
  },
]
