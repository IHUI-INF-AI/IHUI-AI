/**
 * @ihui/eslint-config/react
 * 在 base 上叠加 react + react-hooks 插件。
 */
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import base from './index.js'

export default tseslint.config(...base, {
  files: ['**/*.{tsx,jsx}'],
  plugins: {
    react,
    'react-hooks': reactHooks,
  },
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
  settings: {
    // ESLint 10 移除了 context.getFilename() 等 deprecated API,
    // eslint-plugin-react@7.37.5 的版本自动检测('detect')会调用 getFilename() 导致崩溃。
    // 设成具体版本避免触发自动检测。miniapp-taro (React 18) 可在端内 config override。
    react: { version: '19.0' },
  },
  rules: {
    ...react.configs.recommended.rules,
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/self-closing-comp': 'error',
  },
})
