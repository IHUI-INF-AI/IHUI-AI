/**
 * stylelint 自定义规则：检测 ":where(html.dark) { --xxx: ... }" 这种会静默失效的模式
 *
 * 问题：
 *   :where() 伪类特异性为 0,0,0,0。CSS 变量声明通常在 :root 上 (特异性 0,0,0,1)。
 *   如果暗色覆盖用 `:where(html.dark) { --ai-panel-content-bg: #1a1a1a; }`，
 *   它的特异性 0 < :root 的 0,0,0,1，按 CSS cascade 优先级被 :root 击败，
 *   导致暗色覆盖**静默失效**（--ai-panel-content-bg 仍然是 :root 声明的值）。
 *
 *   实际症状 (2026-07-01): AI 面板在暗色模式下整片变白 #ffffff，
 *   与暗色 sidebar (#6a6d77) 形成刺眼对比。
 *
 * 正常用法（不应报错）：
 *   :where(html.dark) .nav-item { color: white }  ← 应用于元素选择器，类选择器特异性 0,0,1,0 够用
 *
 * 错误用法（应报错）：
 *   :where(html.dark) { --ai-panel-content-bg: #1a1a1a }  ← 块内只有 CSS 变量，特异性 0 < :root
 *
 * 规则：只有当 `:where(html.dark)` / `:where(.dark)` 块内**只**含 CSS 变量声明时，才报错。
 */
const stylelint = require('stylelint')

const ruleName = 'aizhs/no-where-dark-css-var'
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (selector) =>
    `禁止在 ":where(html.dark)" / ":where(.dark)" 块内声明 CSS 变量 (如 --ai-panel-content-bg)。` +
    `:where() 特异性 0,0,0,0 会被 :root (0,0,0,1) 击败，导致暗色覆盖静默失效、` +
    `变量值仍然是 :root 声明的浅色值。` +
    `修复方案：把 ":where(html.dark)" 改成 "html.dark" (特异性 0,0,0,1) 即可。` +
    `参考 bug：_sidebar-layout.scss:1409 (AI 面板在暗色下整片变白 #ffffff)。` +
    `问题选择器：${selector}`,
})

// 匹配 ":where(html.dark)" / ":where(.dark)" 及其变体（允许空白）
const WHERE_DARK_RE = /:where\(\s*(?:html\.dark|html\[data-theme="?dark"?\]|\.dark)\b/

module.exports = stylelint.createPlugin(ruleName, (primary) => {
  return (root, result) => {
    if (primary !== true) return

    root.walkRules((rule) => {
      const selector = rule.selector
      if (!selector) return
      // 只针对 :where(html.dark) / :where(.dark) 等场景
      if (!WHERE_DARK_RE.test(selector)) return

      // 收集规则块内所有声明
      const decls = []
      rule.walkDecls((decl) => decls.push(decl))

      // 必须至少含一个 CSS 变量声明 (--xxx: ...)
      const hasCssVar = decls.some((d) => /^--[a-z0-9-]/i.test(d.prop))
      if (!hasCssVar) return

      // 必须全是 CSS 变量（允许夹杂 font-family / 自定义 fallback 等，但核心是 var 声明）
      // 简单判定：只要存在 CSS 变量且块体主要是 CSS 变量（>= 50%），就报警
      const cssVarCount = decls.filter((d) => /^--[a-z0-9-]/i.test(d.prop)).length
      if (cssVarCount < decls.length * 0.5) return

      stylelint.utils.report({
        message: messages.rejected(selector),
        node: rule,
        result,
        ruleName,
      })
    })
  }
})

module.exports.ruleName = ruleName
module.exports.messages = messages
