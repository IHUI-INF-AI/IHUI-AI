/**
 * stylelint 自定义插件：禁止 column flex 按钮容器未加 .el-button-stack 标记
 *
 * 检测规则:
 *   当一个 CSS 规则同时满足以下条件时报警:
 *     1. 规则块内含 .el-button 嵌套子规则 (SCSS 嵌套写法, 确认容器确实含 button 子元素)
 *     2. declarations 中含 `display: flex` + `flex-direction: column`
 *     3. 选择器不含 .el-button-stack 标记
 *
 * 设计原则 (2026-07-02 立, 见 project_memory.md):
 *   Element Plus theme-chalk 默认全局规则 `.el-button + .el-button { margin-left: 12px }`
 *   (特异性 0,2,0) 会污染任何 column flex 容器内的第二个按钮, 造成 +12px 错位.
 *   项目约定: 任何 `display:flex; flex-direction:column;` 的按钮容器必须加
 *   `.el-button-stack` opt-in 标记, 配合反向排除规则
 *   `:root .<container>:is(.el-button-stack) .el-button + .el-button { margin-left: 0 !important }`
 *   (特异性 0,5,0 + !important 强压 Element Plus).
 *
 * 检测策略说明 (避免误报):
 *   - 仅检测"规则块内含 .el-button 嵌套子规则"的容器, 这是 SCSS 嵌套写法
 *     能确认容器确实含 button 子元素, 避免误报纯布局容器 (.actions / .toolbar 等)
 *   - 不检测跨文件 button 容器 (stylelint 静态分析不支持跨文件), 改由
 *     Playwright 运行时审计 scripts/debug/audit-column-flex-buttons.cjs 覆盖
 *   - 模板已加 .el-button-stack 标记但样式选择器不含该类的情况不报警
 *     (如 .ai-side-panel-empty-actions 在 App.vue 模板加标记, 但样式选择器只定义 flex)
 *
 * 使用方式: 在 .stylelintrc.json 中添加
 *   "plugins": ["./stylelint-plugin-no-flex-column-el-button-without-stack.cjs"],
 *   "rules": { "aizhs/no-flex-column-el-button-without-stack": true }
 */
const stylelint = require('stylelint')

const ruleName = 'aizhs/no-flex-column-el-button-without-stack'
const messages = stylelint.utils.ruleMessages(ruleName, {
  missingStackMark: (selector) =>
    `禁止 column flex 按钮容器 "${selector}" 未加 .el-button-stack 标记。` +
    `规则块内含 .el-button 嵌套子规则, 会被 Element Plus 全局 .el-button+.el-button { margin-left: 12px } 污染第二个按钮 (12px 错位). ` +
    `请在选择器中追加 .el-button-stack 标记, 配合 _sidebar-layout.scss 的反排除规则 ` +
    `:root .<container>:is(.el-button-stack) .el-button + .el-button { margin-left: 0 !important }.`,
})

/**
 * 判断选择器是否含 .el-button-stack 标记
 */
function hasStackMark(selector) {
  if (!selector) return false
  return /\.el-button-stack\b/.test(selector)
}

/**
 * 从规则块中提取 display 和 flex-direction 的值
 * 仅提取直接声明 (不递归到嵌套规则), 因为 flex 布局通常直接定义在容器上
 */
function extractFlexProps(ruleNode) {
  let display = null
  let flexDirection = null

  // 仅遍历直接子声明 (非嵌套规则内的声明)
  ruleNode.nodes.forEach((child) => {
    if (child.type !== 'decl') return
    if (child.prop === 'display') {
      display = child.value.trim()
    } else if (child.prop === 'flex-direction') {
      flexDirection = child.value.trim()
    }
  })

  return { display, flexDirection }
}

/**
 * 判断是否为 column flex 布局
 */
function isColumnFlex(display, flexDirection) {
  return display === 'flex' && flexDirection === 'column'
}

/**
 * 判断规则块内是否含 .el-button 嵌套子规则
 * (排除 .el-button-stack 自身, 避免自引用误报)
 */
function hasNestedElButton(ruleNode) {
  let found = false
  ruleNode.nodes.forEach((child) => {
    if (found) return
    if (child.type !== 'rule') return
    const sel = child.selector || ''
    // 选择器内含 .el-button 但不含 .el-button-stack (避免自引用)
    if (/\.el-button\b/.test(sel) && !/\.el-button-stack/.test(sel)) {
      found = true
    }
  })
  return found
}

module.exports = stylelint.createPlugin(ruleName, (primary) => {
  return (root, result) => {
    if (primary !== true) return

    root.walk((node) => {
      if (node.type !== 'rule') return

      const selector = node.selector
      if (!selector) return
      // 排除 SCSS 插值 / 变量
      if (selector.includes('#{') || selector.includes('$')) return

      // 1. 选择器不能已含 .el-button-stack 标记
      if (hasStackMark(selector)) return

      // 2. 规则块内必须含 .el-button 嵌套子规则 (避免误报纯布局容器)
      if (!hasNestedElButton(node)) return

      // 3. 提取 display + flex-direction
      const { display, flexDirection } = extractFlexProps(node)

      // 4. 必须是 column flex
      if (!isColumnFlex(display, flexDirection)) return

      // 5. 报警: column flex 按钮容器缺 .el-button-stack 标记
      stylelint.utils.report({
        message: messages.missingStackMark(selector),
        node,
        result,
        ruleName,
      })
    })
  }
})

module.exports.ruleName = ruleName
module.exports.messages = messages
