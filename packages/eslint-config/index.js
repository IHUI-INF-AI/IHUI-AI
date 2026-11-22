// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @ihui/eslint-config base
 * TypeScript recommended + 基础最佳实践,无框架规则。
 * 适配 ESLint 9 flat config。
 */
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import ihuiRules from './rules/no-unpaired-card-content-padding.js'

const isInactiveSeverity = (severity) =>
  severity === 'off' ||
  severity === 0 ||
  (Array.isArray(severity) && (severity[0] === 'off' || severity[0] === 0))

/**
 * tseslint 的 eslint-recommended 块里带有 19 条 'off' 声明(用于关闭 eslint:recommended 的默认规则)。
 * 本仓从未启用 eslint:recommended,且其余配置块不会重新打开这些核心规则,因此这些 'off' 条目
 * 等价于"未声明"(规则默认即 off)。但每一条仍会触发一次 ESLint 核心规则模块加载,Windows 下
 * 实测约 40ms/条。这里只剔除"纯关闭"条目,任何生效规则都不动,判据等价。
 */
const dropInactiveRules = (block) => {
  if (!block || !block.rules) return block
  return {
    ...block,
    rules: Object.fromEntries(
      Object.entries(block.rules).filter(([, severity]) => !isInactiveSeverity(severity)),
    ),
  }
}

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
    extends: tseslint.configs.recommended.map(dropInactiveRules),
    plugins: {
      ihui: ihuiRules,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
