// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * AgentRuntimePanel 的 IME 提交守卫(2026-11-08,同型根因 B 类)。
 *
 * 现实现只判 `e.key === 'Enter' && !e.shiftKey`,中文/日文输入法**确认候选词**的那次
 * Enter 会把半截文本直接提交。本组按三条腿逐一钉死:
 * ① 事件自带 isComposing;② keyCode 229;③ compositionend 后首个 Enter。
 * 前三例在修复前必红;第四例(普通 Enter 仍可提交)是防"守卫过宽把正常发送吃掉"。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: executeMock,
  sendToolApprovalResponse: vi.fn(),
  getWorkspacePermissionDefault: vi.fn(() => Promise.resolve({ success: false })),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'zh-CN' as const,
    setLocale: () => {},
  }),
}))

import { AgentRuntimePanel } from '../entrypoints/sidepanel/components/AgentRuntimePanel'

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  executeMock.mockReset()
  executeMock.mockResolvedValue(undefined)
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount()
    })
  }
  container?.remove()
  root = null
  container = null
})

async function typeInto(el: HTMLTextAreaElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  await act(async () => {
    setter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function mountPanel(): Promise<HTMLTextAreaElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<AgentRuntimePanel agentId="agent-ime-1" />)
  })
  const textarea = container.querySelector('[data-testid="agent-runtime-input"]') as HTMLTextAreaElement
  expect(textarea).toBeTruthy()
  await typeInto(textarea, '写一个计划')
  return textarea
}

async function pressEnter(
  el: HTMLTextAreaElement,
  opts?: { isComposing?: boolean; keyCode?: number },
): Promise<void> {
  const ev = new KeyboardEvent('keydown', {
    key: 'Enter',
    shiftKey: false,
    bubbles: true,
    cancelable: true,
  })
  if (opts?.isComposing) Object.defineProperty(ev, 'isComposing', { value: true })
  if (opts?.keyCode) Object.defineProperty(ev, 'keyCode', { value: opts.keyCode })
  await act(async () => {
    el.dispatchEvent(ev)
  })
}

async function compositionEvent(el: HTMLTextAreaElement, type: string): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new Event(type, { bubbles: true }))
  })
}

describe('AgentRuntimePanel IME 提交守卫', () => {
  it('组合期(isComposing=true)按 Enter 不得提交', async () => {
    const textarea = await mountPanel()
    await pressEnter(textarea, { isComposing: true })
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('keyCode 229(部分引擎不带 isComposing)按 Enter 不得提交', async () => {
    const textarea = await mountPanel()
    await pressEnter(textarea, { keyCode: 229 })
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('compositionend 之后的首个 Enter(确认候选词)不得提交,第二次 Enter 才提交', async () => {
    const textarea = await mountPanel()
    await compositionEvent(textarea, 'compositionstart')
    await compositionEvent(textarea, 'compositionend')
    await pressEnter(textarea)
    expect(executeMock).not.toHaveBeenCalled()

    await pressEnter(textarea)
    expect(executeMock).toHaveBeenCalledTimes(1)
  })

  it('无组合态的普通 Enter 仍按原语义提交(守卫不得过宽)', async () => {
    const textarea = await mountPanel()
    await pressEnter(textarea)
    expect(executeMock).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
