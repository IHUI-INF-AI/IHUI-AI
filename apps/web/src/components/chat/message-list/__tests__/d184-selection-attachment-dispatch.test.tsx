// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D184「选中文本作为附件」MessageItem 出口装车证明(2026-09-29 立,对标竞品 chatSession.selectionActions)。
//
// 判据全部挂渲染结果,不读源码:
//   ① assistant 非错误消息选中正文后,消息尾部浮现选区动作组:role=group + aria-label
//      (选中文本操作),组内双出口并存 —— D22「引用选中」+ D184「作为附件添加」;
//   ② 点「作为附件添加」派发 ihui:add-selection-attachment(detail.text=选中文本)、清原生
//      选区、组撤收 —— 附件入 chip 通道不弹 toast(chip 可见即反馈,票面仅三个文案键);
//   ③ 引用出口回归:仍只派发 ihui:add-text-reference,与附件出口互不串线;
//   ④ 负例:选区塌陷不浮现;user / error 消息永不浮现(防上下文注入面扩大)。
// 消费端(MessageInput 包装 .txt 走 G-833)由 d184-selection-attachment-consumer.test.tsx 合围。
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// i18n mock 只回键名:断言挂在 aria-label/文案的键位与结构位上,不依赖具体语言文案。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string): string => `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 8, 29, 3, 4, 5)
const BODY = 'LEAF-ANCHOR-9Q 正文段'
const SELECTED = '选中的正文文本'

function assistantMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 's1',
    role: 'assistant',
    content: BODY,
    createdAt: NOW,
    ...over,
  }
}

function renderMessage(m: ChatMessage) {
  return render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

/** jsdom 的 window.getSelection 桩:anchorNode 必须落在消息内容区内(组件判据),isCollapsed=!anchor */
function stubSelection(anchor: Node | null, text: string): { removeAllRanges: () => void } {
  const removeAllRanges = vi.fn()
  vi.spyOn(window, 'getSelection').mockImplementation(
    () =>
      ({
        isCollapsed: !anchor,
        anchorNode: anchor,
        toString: () => text,
        removeAllRanges,
      }) as unknown as Selection,
  )
  return { removeAllRanges }
}

function captureWindowEvent(name: string): Array<unknown> & { release: () => void } {
  const received: unknown[] = []
  const listener = (e: Event): void => {
    received.push((e as CustomEvent).detail)
  }
  window.addEventListener(name, listener)
  return Object.assign(received, {
    release: () => window.removeEventListener(name, listener),
  }) as Array<unknown> & { release: () => void }
}

/** 正文最内层节点:选区锚点须为 contentAreaRef 后代,contains(锚点) 判据才成立 */
function bodyLeaf(container: HTMLElement): Node {
  const matches = [...container.querySelectorAll<HTMLElement>('*')].filter((el) =>
    (el.textContent ?? '').includes(BODY),
  )
  const leaf = matches[matches.length - 1]
  if (!leaf) throw new Error(`正文(${BODY})应渲染在消息内容区内`)
  return leaf
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useChatStore.setState({ messages: [] })
})

describe('D184 选区动作组:双出口并存且结构位齐备', () => {
  it('选中文本 → role=group + aria-label=[selectionActions.ariaLabel],D22 引用与 D184 附件双按钮同组', () => {
    const { container } = renderMessage(assistantMessage())
    // 未选中:组不浮现
    expect(container.querySelector('[data-testid="message-selection-actions-s1"]')).toBeNull()
    stubSelection(bodyLeaf(container), SELECTED)
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    const group = container.querySelector('[data-testid="message-selection-actions-s1"]')
    expect(group).not.toBeNull()
    expect(group!.getAttribute('role')).toBe('group')
    expect(group!.getAttribute('aria-label')).toBe('[selectionActions.ariaLabel]')
    const add = group!.querySelector('[data-testid="message-selection-attachment-s1"]')
    expect(add).not.toBeNull()
    expect(add!.textContent).toContain('[selectionActions.addAsAttachment]')
    // D22 出口未被顶替(同组并存)
    expect(group!.querySelector('[data-testid="message-quote-selection-s1"]')).not.toBeNull()
  })

  it('点击「作为附件添加」→ 派发 ihui:add-selection-attachment(detail.text=选中文本)+ 清选区 + 组撤收', () => {
    const { container } = renderMessage(assistantMessage())
    const sel = stubSelection(bodyLeaf(container), SELECTED)
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    const received = captureWindowEvent('ihui:add-selection-attachment')
    const add = container.querySelector(
      '[data-testid="message-selection-attachment-s1"]',
    ) as HTMLButtonElement
    act(() => {
      fireEvent.click(add)
    })
    expect(received).toHaveLength(1)
    expect((received[0] as { text?: string }).text).toBe(SELECTED)
    expect(sel.removeAllRanges).toHaveBeenCalledTimes(1)
    // 附件出口静默入 chip(不弹 toast),组随选区清除而撤收
    expect(container.querySelector('[data-testid="message-selection-actions-s1"]')).toBeNull()
    received.release()
  })

  it('引用出口回归:点「引用选中」仍只派发 ihui:add-text-reference(与附件出口互不串线)', () => {
    const { container } = renderMessage(assistantMessage())
    stubSelection(bodyLeaf(container), SELECTED)
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    const refReceived = captureWindowEvent('ihui:add-text-reference')
    const attReceived = captureWindowEvent('ihui:add-selection-attachment')
    const quote = container.querySelector(
      '[data-testid="message-quote-selection-s1"]',
    ) as HTMLButtonElement
    act(() => {
      fireEvent.click(quote)
    })
    expect(refReceived).toHaveLength(1)
    expect((refReceived[0] as { text?: string }).text).toBe(SELECTED)
    expect(attReceived).toHaveLength(0)
    refReceived.release()
    attReceived.release()
  })

  it('负例:选区塌陷不浮现;user / error 消息永不浮现(防上下文注入面扩大)', () => {
    const collapsed = renderMessage(assistantMessage())
    stubSelection(null, '')
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    expect(
      collapsed.container.querySelector('[data-testid="message-selection-actions-s1"]'),
    ).toBeNull()

    const user = renderMessage(assistantMessage({ id: 'u1', role: 'user' }))
    stubSelection(user.container.firstElementChild, SELECTED)
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    expect(
      user.container.querySelector('[data-testid="message-selection-actions-u1"]'),
    ).toBeNull()

    const errored = renderMessage(assistantMessage({ id: 'e1', error: true }))
    stubSelection(errored.container.firstElementChild, SELECTED)
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    expect(
      errored.container.querySelector('[data-testid="message-selection-actions-e1"]'),
    ).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
