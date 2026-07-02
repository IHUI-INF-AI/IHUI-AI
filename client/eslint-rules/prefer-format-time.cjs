/**
 * ESLint 自定义规则：偏好使用统一时间格式化工具，而非直接 new Date(input)
 *
 * 规则名：ihui/prefer-format-time
 * 场景：项目中 formatTime/formatDateTime 散落 119+ 文件，存在大量重复的
 *       `new Date(xxx).getFullYear()` 式手写格式化，维护困难且 i18n 不一致。
 *       项目已提供 composables/useFormatTime.ts 与 utils/format/date.ts 作为统一 API。
 *
 * 规则逻辑：
 * 1. 检测 `new Date(arg)` 调用（带至少一个参数，即解析时间字符串/时间戳的场景）
 * 2. 若位于应用代码中（非 utils/format 与 composables/useFormatTime 自身），报 warn
 * 3. 提示改用 useFormatTime / formatTime 统一工具
 *
 * 豁免：
 * - `new Date()`（无参数，获取当前时间）不报，因为这是获取 Date 对象的合法用途
 * - utils/format/** 与 composables/useFormatTime.ts 自身不报（它们是格式化工具的实现）
 * - 测试文件（*.spec.ts / *.test.ts）不报
 *
 * 严重级别：warn（不阻塞 CI，仅作为新代码迁移指引）
 */

'use strict'

// 实现统一格式化工具的文件路径（这些文件内 new Date(arg) 是合法的）
const TOOL_FILE_PATTERNS = [
  /[/\\]utils[/\\]format[/\\]/, // utils/format/** 所有格式化工具
  /[/\\]composables[/\\]useFormatTime\.ts$/, // useFormatTime composable 自身
]

// 测试文件模式
const TEST_FILE_PATTERNS = [/\.spec\.(ts|js|vue)$/, /\.test\.(ts|js)$/, /[/\\]__tests__[/\\]/]

/**
 * 判断当前文件是否为豁免文件（工具实现或测试）
 */
function isExempt(filename) {
  if (!filename) return false
  if (TOOL_FILE_PATTERNS.some((re) => re.test(filename))) return true
  if (TEST_FILE_PATTERNS.some((re) => re.test(filename))) return true
  return false
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '偏好使用 useFormatTime / formatTime 统一工具，而非直接 new Date(input) 手写格式化',
      recommended: false,
    },
    messages: {
      preferFormatTime:
        '直接 new Date({{arg}}) 解析时间可能产生散落的格式化逻辑，建议改用 useFormatTime composable 或 @/utils/format/date 中的 formatTime / formatDateTime 统一工具',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename && context.getFilename()

    // 豁免文件不处理
    if (isExempt(filename)) {
      return {}
    }

    return {
      NewExpression(node) {
        // 仅处理 new Date(...)
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Date') return

        // 无参数的 new Date()（获取当前时间）不报
        if (node.arguments.length === 0) return

        // 带参数的 new Date(input) 是解析时间字符串/时间戳的场景，属于规则范围
        const argNode = node.arguments[0]
        let argText = ''
        if (argNode.type === 'Literal') {
          argText = String(argNode.value)
        } else if (argNode.type === 'Identifier') {
          argText = argNode.name
        } else {
          argText = '...'
        }

        context.report({
          node,
          messageId: 'preferFormatTime',
          data: { arg: argText },
        })
      },
    }
  },
}
