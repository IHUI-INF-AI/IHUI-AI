/**
 * @ihui/eslint-config/cross-end
 *
 * 跨端重复实现守门 config(2026-07-28 立)
 *
 * 应用范围:apps/{mobile-rn,miniapp-taro}/src/{hooks,utils,stores} 下所有 .ts/.tsx 文件
 * 规则:ihui-cross-end/no-reimpl-when-shared-exists(error)
 *
 * 详见 plugins/ihui-cross-end.js 规则文档。
 *
 * 使用:
 * ```js
 * // apps/mobile-rn/eslint.config.js
 * import reactConfig from '@ihui/eslint-config/react'
 * import crossEndConfig from '@ihui/eslint-config/cross-end'
 * export default [...reactConfig, ...crossEndConfig]
 * ```
 */
import ihuiCrossEnd from './plugins/ihui-cross-end.js'

export default [
  {
    // files glob 相对于各端 cwd(eslint 在 apps/<端> 目录下运行)
    // 两端目录结构相同(src/hooks|utils|stores/),共用同一组 glob
    files: ['src/hooks/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}', 'src/stores/**/*.{ts,tsx}'],
    plugins: {
      'ihui-cross-end': ihuiCrossEnd,
    },
    rules: {
      'ihui-cross-end/no-reimpl-when-shared-exists': 'error',
    },
  },
]
