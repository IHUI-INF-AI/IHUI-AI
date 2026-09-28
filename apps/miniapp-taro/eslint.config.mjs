// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import reactConfig from '@ihui/eslint-config/react'
import crossEndConfig from '@ihui/eslint-config/cross-end'

export default [
  ...reactConfig,
  ...crossEndConfig,
  {
    ignores: [
      'dist/**',
      'dist-alipay/**',
      '.swc/**',
      'config/**',
      'babel.config.js',
      'scripts/**',
      // i18n 生成文件超长 base64,跳过 lint(源由 scripts/gen-i18n-compressed.mjs 校验)
      'src/i18n/generated/**',
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
]
