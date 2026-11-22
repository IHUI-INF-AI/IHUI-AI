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

  it('浮层的业务态经 shellCtx 传入共享壳装配层', () => {
    expect(CHAT_SRC).toMatch(/\n\s+pendingQuestion,/u)
    expect(SHELL_SRC).toMatch(/\n\s+pendingQuestion,/u)
    // 2026-11-13 改判:`setPendingQuestion` **不再**经 shellCtx 传。
    // 旧版把 setter 直接交给浮层,于是选项点击只能 `setInputValue(label)` + `setPendingQuestion(null)`
    // —— 那是"填回输入框让用户手动再发"的错链路(见下一个用例的注释)。
    // 现在壳层拿的是两个语义回调,不再持有 state setter(也顺带收窄了壳层能改的状态面)。
    expect(SHELL_SRC).not.toMatch(/\n\s+setPendingQuestion,/u)
    expect(SHELL_SRC).toMatch(/\n\s+onSubmitQuestionAnswer,/u)
    expect(SHELL_SRC).toMatch(/\n\s+onWithdrawQuestion,/u)
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

  /**
   * 2026-11-13 改判:旧断言锁的是**错链路**,必须换掉。
   *
   * 旧实现:选项点击 `setInputValue(o.label)` + `setPendingQuestion(null)` ——
   * 把 label 填回输入框,让用户手动再发一轮**普通对话**。后果三条:
   *   ① 没调 `/question-response` 续流,服务端那条挂着的流仍在等答复(最终超时);
   *   ② `questionId` 被丢掉,服务端无从配对;
   *   ③ 原 assistant 的 pendingQuestion 状态永不清除。
   * 也就是说"点了有反应",但反应与"回答这个提问"无关 —— 比不给卡片更糟。
   *
   * 现断言:点击走 `onSubmitQuestionAnswer`(提交答复并续流),关闭走 `onWithdrawQuestion`
   * (让服务端把这一问结算成 withdrawn,流才能及时收场,而不是等满超时)。
   */
  it('选项点击提交答复并续流;关闭提交撤回(不再"填回输入框")', () => {
    expect(OVERLAY_BLOCK).toMatch(/onSubmitQuestionAnswer\(\[o\.id\], ''\)/u)
    expect(OVERLAY_BLOCK).toMatch(/onWithdrawQuestion\(\)/u)
    // 反向:不得再出现"填回输入框"的旧链路,也不得只在前端清卡片
    expect(OVERLAY_BLOCK).not.toMatch(/setInputValue\(o\.label\)/u)
    expect(OVERLAY_BLOCK).not.toMatch(/onClick=\{\(\) => setPendingQuestion\(null\)\}/u)
  })

  it('可多选 / 可自定义 / 关闭三态文案与 BUG-67 原文逐字相同', () => {
    expect(OVERLAY_BLOCK).toContain('可多选 / 自行输入,也可关闭')
    expect(OVERLAY_BLOCK).toContain('可自行输入,也可关闭')
    expect(OVERLAY_BLOCK).toContain(": '关闭'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
