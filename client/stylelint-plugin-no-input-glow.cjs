/**
 * stylelint 自定义插件：禁止输入框蓝色外环发光
 *
 * 检查范围：
 * 1. 在 .input-wrapper / .el-input__wrapper / .el-textarea__inner / .verification-code-digit
 *    等输入框相关选择器的 :focus / :focus-within / :focus-visible / .is-focus 状态下
 *    禁止使用 `box-shadow: 0 0 0 Npx rgba(blue)` 蓝色外环发光模式
 * 2. 检测的蓝色色系：#3b82f6 / #2563eb / #1d4ed8 / #60a5fa / #93c5fd / #a0c4ff 等
 *
 * 设计原则：项目采用"扁平化设计：no box-shadow, use border instead"（详见
 * src/styles/SHADOW_AND_BORDER_RULES.md）。输入框的状态反馈应通过 border-color
 * 变化（默认 → hover → focus）实现，禁止使用 Bootstrap 风格的蓝色 box-shadow 外环。
 *
 * 使用方式：在 .stylelintrc.json 中添加
 *   "plugins": ["./stylelint-plugin-no-input-glow.cjs"],
 *   "rules": { "aizhs/no-input-glow": true }
 */
const stylelint = require('stylelint')

const ruleName = 'aizhs/no-input-glow'
const messages = stylelint.utils.ruleMessages(ruleName, {
  inputBoxGlow: (selector, value) =>
    `禁止在输入框相关选择器 "${selector}" 的 focus/focus-within 状态下使用 box-shadow 蓝色外环发光模式（"${value}"）。` +
    `请改用 border-color 变化（默认 → #a0c4ff hover → #3b82f6 focus），详见 src/styles/SHADOW_AND_BORDER_RULES.md。`,
})

/**
 * 输入框相关选择器关键词
 * 匹配时检查选择器是否包含这些 class 或状态
 */
const INPUT_BOX_SELECTORS = [
  // Element Plus 输入框组件
  'el-input__wrapper',
  'el-textarea__inner',
  'el-select__wrapper',
  'el-cascader',
  // 验证输入框（项目自定义）
  'verification-code-digit',
  'captcha-image',
  'captcha-refresh-btn',
  // AI Chat / 通用输入包装器
  'input-wrapper',
  'chat-input',
  'message-input',
  'comment-input',
  'search-input',
  'quick-tool-input',
  // 账户绑定弹窗
  'account-bind-dialog',
  // 通用 .input- 前缀
]

/**
 * focus/focus-within 状态选择器
 */
const FOCUS_STATES = [
  ':focus',
  ':focus-within',
  ':focus-visible',
  '.is-focus',
  '.is-focused',
  '[data-focused="true"]',
]

/**
 * 检测值是否为"蓝色外环"模式
 * 模式：0 0 0 Npx rgba(R, G, B, alpha) — 必须是外环模式 + 蓝色系
 */
const BLUE_OUTER_RING_PATTERN = /^\s*0\s+0\s+0\s+\d+(?:\.\d+)?(?:px|rem|em)\s+rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i

/**
 * 判断 RGB 是否属于蓝色系（用于检测外环颜色）
 * 蓝色特征：B > R 且 B > G，且 B 至少是 R 的 1.3 倍
 */
function isBlueish(r, g, b) {
  return b > r && b > g && b >= r * 1.3
}

/**
 * 判断选择器是否为输入框相关
 */
function isInputBoxSelector(selector) {
  const lower = selector.toLowerCase()
  return INPUT_BOX_SELECTORS.some((keyword) => lower.includes(keyword))
}

/**
 * 判断选择器是否处于 focus/focus-within 状态
 * 同时支持当前选择器及父选择器链（嵌套规则中）
 */
function isInFocusState(selector) {
  return FOCUS_STATES.some((state) => selector.includes(state))
}

/**
 * 检测 box-shadow 值是否为蓝色外环
 * 支持多层 box-shadow（逗号分隔），但只检测第一层（最常用的模式）
 */
function findBlueOuterRing(value) {
  // 去除 CSS 变量引用 — 这些已经在上游被展开
  if (value.includes('var(')) {
    // 如果是 var(--global-box-shadow) 之类，无法静态判断，跳过
    return null
  }

  // 按逗号分割多层 box-shadow
  const layers = value.split(/,(?![^()]*\))/)

  for (const layer of layers) {
    const trimmed = layer.trim()
    const match = trimmed.match(BLUE_OUTER_RING_PATTERN)
    if (match) {
      const r = parseInt(match[1], 10)
      const g = parseInt(match[2], 10)
      const b = parseInt(match[3], 10)
      if (isBlueish(r, g, b)) {
        return trimmed
      }
    }
  }

  return null
}

module.exports = stylelint.createPlugin(ruleName, (primary) => {
  return (root, result) => {
    if (primary !== true) return

    // 递归遍历所有节点（包括 @media / @supports / 嵌套规则内的输入框）
    root.walk((node) => {
      if (node.type !== 'rule') return

      const selector = node.selector
      if (!selector || selector.includes('#{') || selector.includes('$')) return

      // 1. 选择器必须包含输入框相关 class
      if (!isInputBoxSelector(selector)) return

      // 2. 选择器必须处于 focus/focus-within 状态
      if (!isInFocusState(selector)) return

      // 3. 检查该规则内的所有 box-shadow 声明
      node.walkDecls('box-shadow', (decl) => {
        const offender = findBlueOuterRing(decl.value)
        if (offender) {
          stylelint.utils.report({
            message: messages.inputBoxGlow(selector, offender),
            node: decl,
            result,
            ruleName,
          })
        }
      })
    })
  }
})

module.exports.ruleName = ruleName
module.exports.messages = messages
