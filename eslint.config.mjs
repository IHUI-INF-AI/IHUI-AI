import base from '@ihui/eslint-config'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

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
  // lint-staged 兜底:注册 web 包使用的插件,使 eslint-disable 注释生效
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      '@next/next/no-img-element': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['apps/web/**/*.{tsx,jsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: { ...jsxA11y.configs.recommended.rules },
  },
]
