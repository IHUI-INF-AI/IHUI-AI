import base from '@ihui/eslint-config'

export default [
  ...base,
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: '.js files are not allowed in src/. Use .ts instead.',
        },
      ],
    },
  },
  {
    /**
     * 运维/调试脚本:scripts/ 目录、probe-*.ts/ts 调试脚本、spawn-server.cjs 启动器
     * 这些文件需要 console.log/console.table 打日志,允许 any(快速探测未知结构)
     */
    files: [
      'scripts/**/*.{js,mjs,cjs,ts}',
      'scripts/probe-*.{ts,mjs}',
      'probe-*.{ts,mjs}',
      'spawn-server.cjs',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]

