// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票60 片4(2026-10-21):`ihui:scroll-to-message` 的窗格门控装车证明。
// 改造前:消费侧不判 paneId,且"目标不在本列表也照样 flashHighlight" ⇒ 多窗格并存时每个列表都滚动 + 都高亮。
//   ① 正向:事件带本窗格 paneId 且消息在场 ⇒ 滚动的就是那条消息的元素,且调用 flashHighlight;
//   ② 门控:事件属于别的窗格 ⇒ 本列表既不滚动它,也不调用 flashHighlight;
//   ③ 未命中:事件属本窗格但消息不在此列表 ⇒ 不高亮(旧形态是"照样高亮")。
// 观测面挂在真实机制上:滚动 = 元素自己的 scrollIntoView;高亮 = store 的 flashHighlight 动作。

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageList } from '@/components/chat/message-list/MessageList'
import { TooltipProvider } from '@/components/feedback'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import {
  getProgressJumpStoreForPane,
  resetProgressJumpPaneStores,
} from '@/stores/progress-jump-store'
import type { ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 10, 21, 1, 2, 3)
const originalScroll = HTMLElement.prototype.scrollIntoView

function msg(id: string): ChatMessage {
  return { id, role: 'user', content: `正文-${id}`, createdAt: NOW }
}

let scrolled: HTMLElement[]
let flash: ReturnType<typeof vi.fn>

// 票60 残余(2026-10-21):高亮动作现在住在`该窗格那一份`store 上,替身必须装在同一次解析出的实例里
// (注册表按 paneId 懒建并复用 ⇒ 先取实例装替身,再 render,消费面读到的就是它)
function spyFlash(paneId: string) {
  flash = vi.fn()
  getProgressJumpStoreForPane(paneId).setState({ flashHighlight: flash } as never)
}

function renderInPane(paneId: string, messages: ChatMessage[]) {
  spyFlash(paneId)
  return render(
    <TooltipProvider>
      <ChatPaneProvider paneId={paneId}>
        <MessageList
          messages={messages}
          isStreaming={false}
          emptyTitle="空"
          emptyHint="空提示"
          assistantLabel="助手"
        />
      </ChatPaneProvider>
    </TooltipProvider>,
  )
}

function dispatchScroll(detail: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new CustomEvent('ihui:scroll-to-message', { detail }))
  })
}

beforeEach(() => {
  scrolled = []
  HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
    scrolled.push(this)
  }) as typeof HTMLElement.prototype.scrollIntoView
  resetProgressJumpPaneStores()
})

afterEach(() => {
  cleanup()
  resetProgressJumpPaneStores()
  HTMLElement.prototype.scrollIntoView = originalScroll
})

describe('MessageList 的 scroll-to-message 窗格门控(票60 片4)', () => {
  it('① 正向:本窗格 + 消息在场 ⇒ 滚动那条消息并高亮', () => {
    const { container } = renderInPane('pane-gate-a', [msg('m1')])
    const el = container.querySelector('[data-message-id="m1"]') as HTMLElement
    scrolled = []
    dispatchScroll({ messageId: 'm1', paneId: 'pane-gate-a' })
    expect(scrolled).toContain(el)
    expect(flash).toHaveBeenCalledWith('m1')
  })

  it('② 门控:事件属于别的窗格 ⇒ 本列表不滚动、不高亮', () => {
    const { container } = renderInPane('pane-gate-b', [msg('m1')])
    const el = container.querySelector('[data-message-id="m1"]') as HTMLElement
    scrolled = []
    dispatchScroll({ messageId: 'm1', paneId: 'pane-somewhere-else' })
    expect(scrolled).not.toContain(el)
    expect(flash).not.toHaveBeenCalled()
  })

  it('③ 未命中:本窗格但消息不在此列表 ⇒ 不滚动、不高亮(旧形态照样高亮)', () => {
    const { container } = renderInPane('pane-gate-c', [msg('m1')])
    const el = container.querySelector('[data-message-id="m1"]') as HTMLElement
    scrolled = []
    dispatchScroll({ messageId: '不在这条列表里的-id', paneId: 'pane-gate-c' })
    expect(scrolled).not.toContain(el)
    expect(flash).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
