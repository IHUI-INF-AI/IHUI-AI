import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// 通过 base config 的 package 路径解析 plugin,避免 node-linker=isolated 模式下
// apps/extension/node_modules 找不到 eslint-plugin-react-hooks
const baseConfigPkg = fileURLToPath(
  new URL('./node_modules/@ihui/eslint-config/package.json', import.meta.url),
)
const baseConfigRequire = createRequire(baseConfigPkg)
const reactHooks = baseConfigRequire('eslint-plugin-react-hooks')
const react = baseConfigRequire('eslint-plugin-react')

import base from '@ihui/eslint-config/react'

export default [
  ...base,
  {
    ignores: ['.output/**', '.wxt/**', 'dist/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
  },
]
