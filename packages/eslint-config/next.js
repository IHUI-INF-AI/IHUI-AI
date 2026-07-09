/**
 * @ihui/eslint-config/next
 * 在 react 上叠加 Next.js 特定规则。
 * 依赖 @next/eslint-plugin-next(随 eslint-config-next 安装)。
 */
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactConfig from './react.js'

export default tseslint.config(
  ...reactConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      '@next/next/no-img-element': 'warn',
      '@next/next/no-sync-scripts': 'error',
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-unwanted-polyfillio': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
)
