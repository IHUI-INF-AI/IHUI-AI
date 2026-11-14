// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BUG-67 回归锁:AI 主动提问卡必须挂在共享屏既有 overlaySlot,
 * 不得再以页级浮层形式写回 chat.tsx(门299 会把它计成业务 JSX 而判红)。
 *
 * 改前该缺陷必红:页内 return 树含 7 个标签,且卡节点直接写在页面里。
 * 改后:页面只剩 ThemeRoot + SharedChatScreen;卡节点整体在
 * chat-shell-extras 的 overlaySlot 片段内,业务态经 shellCtx 传入。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const END_ROOT = resolve(HERE, '..', '..', '..', '..')

const src = (rel: string): string => readFileSync(join(END_ROOT, rel), 'utf8')
const CHAT_SRC = src('src/pkg-ai/ai/chat.tsx')
const SHELL_SRC = src('src/pkg-ai/ai/chat-shell-extras.tsx')

// 页内最终 return 树(从最后一个 `return (` 到文件尾)
const PAGE_RETURN = CHAT_SRC.slice(CHAT_SRC.lastIndexOf('  return ('))
// overlaySlot 片段(从声明到 `return {` 之前)
const OVERLAY_BLOCK = SHELL_SRC.slice(
  SHELL_SRC.indexOf('const overlaySlot = ('),
  SHELL_SRC.indexOf('\n  return {'),
)

describe('BUG-67 提问卡:页级浮层 → 共享屏 overlaySlot', () => {
  it('页内 return 树只剩 ThemeRoot + SharedChatScreen 两个节点', () => {
    const tags = [...PAGE_RETURN.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/gu)].map((m) => m[1])
    expect(new Set(tags)).toEqual(new Set(['ThemeRoot', 'SharedChatScreen']))
    expect(PAGE_RETURN).not.toContain('pendingQuestion')
    expect(PAGE_RETURN).not.toContain('<View')
  })

  it('浮层的两个业务态经 shellCtx 传入共享壳装配层', () => {
    expect(CHAT_SRC).toMatch(/\n\s+pendingQuestion,/u)
    expect(CHAT_SRC).toMatch(/\n\s+setPendingQuestion,/u)
    expect(SHELL_SRC).toMatch(/\n\s+pendingQuestion,/u)
    expect(SHELL_SRC).toMatch(/\n\s+setPendingQuestion,/u)
  })

  it('6 个节点整体挂在 overlaySlot 内,定位与层级与原页级浮层等价', () => {
    expect(OVERLAY_BLOCK).toContain('{pendingQuestion ? (')
    expect(OVERLAY_BLOCK).toContain("position: 'fixed'")
    expect(OVERLAY_BLOCK).toContain('zIndex: 999')
    expect(OVERLAY_BLOCK).toContain("left: '16px'")
    expect(OVERLAY_BLOCK).toContain("right: '16px'")
    expect(OVERLAY_BLOCK).toContain("bottom: '96px'")
    expect(OVERLAY_BLOCK).toContain('{pendingQuestion.prompt}')
    expect(OVERLAY_BLOCK).toContain('{pendingQuestion.options.map(')
    expect(OVERLAY_BLOCK).toContain('{o.label}')
    expect(OVERLAY_BLOCK).toMatch(/key=\{o\.id\}/u)
  })

  it('无 sessionId 旧链路:选项写回输入框并收卡(用户点发送续流);关闭走 dismissQuestionCard', () => {
    // 旧链路分支:帧无 sessionId 时点选项 → 回写输入框 + 收卡(原 BUG-67 行为保留)
    expect(OVERLAY_BLOCK).toMatch(/setInputValue\(o\.label\)\s*\n\s*setPendingQuestion\(null\)/u)
    // 关闭/摘卡统一走 dismissQuestionCard(阻塞式与旧链路共用,同时清状态)
    expect(OVERLAY_BLOCK).toMatch(/onClick=\{dismissQuestionCard\}/u)
  })

  it('D135:帧带 sessionId 时走阻塞式作答(选中态 + 提交/跳过 + 自定义输入)', () => {
    // 选项点选走 selectQuestionOption(切换选中态),不再写回输入框
    expect(OVERLAY_BLOCK).toContain('selectQuestionOption(o.id)')
    // 选中态高亮 + 只读(非 idle 时点选无效)
    expect(OVERLAY_BLOCK).toContain('const selected = questionAnswer.selectedIds.includes(o.id)')
    expect(OVERLAY_BLOCK).toContain("const readOnly = questionPhase !== 'idle'")
    // 提交/跳过双键 + 自定义输入框
    expect(OVERLAY_BLOCK).toContain("void submitQuestion('answer')")
    expect(OVERLAY_BLOCK).toContain("void submitQuestion('withdraw')")
    expect(OVERLAY_BLOCK).toContain('setQuestionCustomText')
    // 旧链路仅当帧无 sessionId 时启用
    expect(OVERLAY_BLOCK).toContain('pendingQuestion.sessionId ?')
  })

  it('可多选 / 可自定义 / 关闭三态文案与 BUG-67 原文逐字相同', () => {
    expect(OVERLAY_BLOCK).toContain('可多选 / 自行输入,也可关闭')
    expect(OVERLAY_BLOCK).toContain('可自行输入,也可关闭')
    expect(OVERLAY_BLOCK).toContain(": '关闭'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
