import nextConfig from '@ihui/eslint-config/next'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'e2e/**',
      'public/**',
      'scripts/**',
      'next-env.d.ts',
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
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: { ...jsxA11y.configs.recommended.rules },
  },
  {
    files: ['src/components/media/ThreeDViewer.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
  {
    files: ['app/(main)/admin/clawdbot/**/*.tsx'],
    rules: {
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
    },
  },
  {
    // 管理后台表格广泛展示用户/服务端上传的图片(URL 动态、尺寸不可控),
    // Next/Image 强制 width/height 难以适配;统一关闭此规则
    files: ['app/(main)/admin/**/*.{tsx,jsx}'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['src/components/sidebar.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
]
