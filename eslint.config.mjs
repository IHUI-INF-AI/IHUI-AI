import base from '@ihui/eslint-config'

// 根级 ESLint 配置
// 各 app 有独立的 eslint.config.js，此配置仅用于根目录脚本和 lint-staged 兜底
export default [
  ...base,
  {
    ignores: [
      'apps/*/dist/**',
      'apps/*/.next/**',
      'apps/*/.swc/**',
      'apps/*/node_modules/**',
      'packages/*/dist/**',
      'packages/*/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
    ],
  },
]
