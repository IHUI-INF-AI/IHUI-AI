import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// 通过 base config 的 package 路径解析 plugin,避免 node-linker=isolated 模式下
// apps/desktop/node_modules 找不到 eslint-plugin-react-hooks
const baseConfigPkg = fileURLToPath(
  new URL('./node_modules/@ihui/eslint-config/package.json', import.meta.url),
)
const baseConfigRequire = createRequire(baseConfigPkg)
const reactHooks = baseConfigRequire('eslint-plugin-react-hooks')
const react = baseConfigRequire('eslint-plugin-react')

import baseConfig from '@ihui/eslint-config/react'

export default [
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        AbortController: 'readonly',
        fetch: 'readonly',
        React: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    // 显式覆盖 plugins,确保 react-hooks 规则在 desktop 上下文中可解析
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'src-tauri/**', 'node_modules/**'],
  },
]
