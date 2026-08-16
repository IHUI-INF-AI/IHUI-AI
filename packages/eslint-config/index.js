/**
 * @ihui/eslint-config base
 * TypeScript recommended + 基础最佳实践,无框架规则。
 * 适配 ESLint 9 flat config。
 */
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import ihuiRules from './rules/no-unpaired-card-content-padding.js'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    extends: [...tseslint.configs.recommended],
    plugins: {
      ihui: ihuiRules,
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      // 自定义规则:CardContent className 含 p-X (X ∈ {2,3,5,6,8} 等非默认) 时,
      // 若未来 CardContent 默认值引入 min-[640px]:p-Z 响应式,p-X 类会行为不可控。
      // 现状(2026-08-12):CardContent 默认统一 p-4,本规则为 warn 而非 error;
      // 不阻塞提交,但要求未来开发偏离默认 p-X 时加 min-[640px]:p-Y 限定。
      'ihui/no-unpaired-card-content-padding': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      // zod 4 防回归：禁止已废弃 API，防止迁移后再次引入
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.type='Identifier'][callee.property.name='preprocess']",
          message: 'z.preprocess() 已在 zod 4 中废弃。请改用 z.transform(fn).pipe(schema)。',
        },
        {
          selector:
            "CallExpression[callee.property.name='datetime'][callee.object.callee.property.name='string']",
          message: 'z.string().datetime() 已在 zod 4 中废弃。请改用 z.iso.datetime()。',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    // 测试文件豁免 no-explicit-any(mock/stub 需要类型断言)
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/tests/**',
      '**/test/**',
      '**/e2e/**',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
