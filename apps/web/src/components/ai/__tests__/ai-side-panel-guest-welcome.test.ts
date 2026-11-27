// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 面板 · 游客欢迎面防回潮(2026-11-27 立)
 *
 * 用户报障:未登录时 AI 面板欢迎页(小方招手动画所在空态)整块不显示 ——
 * 原实现用 `!allow ? <AuthGatePrompt/> : 主体` 把欢迎面连登录门一起替换掉了。
 *
 * 口径:欢迎面(EmptyState + 小方 wave)对匿名用户照常渲染;登录门只收口在
 * 「发请求 / 发消息」两侧 —— 历史加载继续 `if (!allow) return` 短路,
 * 发送走 openLoginDialogOnce 弹登录并返回 false(MessageInput 保留草稿)。
 *
 * 这里做静态源码断言(组件依赖 useChat/router 等一整套运行时,直接渲染成本高,
 * 与同目录 chat-message-sync.test.ts 的静态契约口径一致)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = fs.readFileSync(path.resolve(__dirname, '../ai-side-panel.tsx'), 'utf8')

describe('AI 面板 · 游客欢迎面', () => {
  it('主体分支不得再按 !allow 整块替换成登录提示', () => {
    // 旧写法(回归目标):{!allow ? (<AuthGatePrompt .../>) : d73Expanded && ...}
    expect(SRC).not.toMatch(/!\s*allow\s*[\s\S]{0,40}<AuthGatePrompt/)
    // 新写法:欢迎面照常渲染,只有窗格树要求已登录
    expect(SRC).toMatch(/allow && d73Expanded && !floatMode/)
  })

  it('未登录发送统一弹登录并保留草稿;已登录不得被 ready 卡死', () => {
    // 回归目标:曾经 `if (!ready) return false` 放在 isAuthenticated 之前,
    // bootstrap ready 未翻真时已登录用户的发送被整块吞掉(无请求/无提示)。
    expect(SRC).not.toMatch(/if \(!ready\) return false/)
    expect(SRC).toMatch(/if \(!isAuthenticated\) \{/)
    expect(SRC).toMatch(/if \(ready\) \{/)
    expect(SRC).toMatch(/openLoginDialogOnce\(/)
    // 返回 false = MessageInput 不清空输入框(不静默丢字)
    expect(SRC).toMatch(/return false/)
  })

  it('未登录仍短路会话历史请求(不发注定 401 的请求)', () => {
    expect(SRC).toMatch(/if \(!allow\) return/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
