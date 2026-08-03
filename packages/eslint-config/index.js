/**
 * @ihui/eslint-config base
 * TypeScript recommended + 基础最佳实践,无框架规则。
 * 适配 ESLint 9 flat config。
 */
import tseslint from 'typescript-eslint'

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
    rules: {
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
      // zod 4 防回归：禁止已废弃 API，防止迁移后再次引入
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.type='Identifier'][callee.property.name='preprocess']",
          message: 'z.preprocess() 已在 zod 4 中废弃。请改用 z.transform(fn).pipe(schema)。',
        },
        {
          selector: "CallExpression[callee.property.name='datetime'][callee.object.callee.property.name='string']",
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
