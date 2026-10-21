// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 票60 普查@2026-10-21:业务表单的"切会话回收"必须按本窗格见过的消息集收窄。
 * 改前 MessageList 调的是整表 `clearForms()` ⇒ 任一窗格一切换,别的窗格填到一半的表单一起被抹掉
 * (用户可见的数据丢失)。这里问两件事:
 *   ① 正向:本窗格切会话回收自己那批;同刻另一窗格正在填的那张表单**不许被牵连**;
 *   ② 反证:Provider 外(单窗格调用面)行为与改前等价 —— 切会话照样回收,只是范围本来就是自己这一份。
 */
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

import { TooltipProvider } from '@/components/feedback'
import { MessageList } from '@/components/chat/message-list/MessageList'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane, resetChatPaneStores } from '@/stores/chat-panes'
import { useBusinessFormStore } from '@/stores/business-forms'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage } from '@/stores/chat'

const T0 = 1_760_000_000_000
// jsdom 没有 scrollIntoView,而消息一变动滚动 hook 就会调它(同 scroll-to-message-pane-gate 那一族的既有做法)
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

function msg(id: string): ChatMessage {
  return { id, role: 'assistant', content: `正文-${id}`, createdAt: T0 } as ChatMessage
}

function formOf(messageId: string) {
  return {
    requestId: `req-${messageId}`,
    // kind 必须是 BUSINESS_FORM_KINDS 里的真档('email' / 'calendarEvent'):
    // 卡片按 kind 取字段表,未知 kind 取不到 fields 就渲染崩(第一版我就栽在自造 'confirm' 上)
    kind: 'email' as const,
    messageId,
    actions: ['approve', 'reject'],
    status: 'pending' as const,
  }
}

function mountPane(paneId: string, messages: ChatMessage[]) {
  return render(
    <TooltipProvider>
      <ChatPaneProvider paneId={paneId}>
        <MessageList
          messages={messages}
          isStreaming={false}
          emptyTitle="空"
          emptyHint="空"
          assistantLabel="AI"
        />
      </ChatPaneProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  resetChatPaneStores()
  useBusinessFormStore.setState({ byMessage: {} })
  useChatStore.setState({ messages: [], conversationId: null })
})

afterEach(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  cleanup()
  resetChatPaneStores()
  useBusinessFormStore.setState({ byMessage: {} })
})

describe('业务表单回收按窗格收窄(票60 普查)', () => {
  it('① 正向:本窗格切会话只回收自己那批,别窗格填到一半的不受牵连', () => {
    const a = getChatStoreForPane('pane-bf-a')
    const b = getChatStoreForPane('pane-bf-b')
    a.setState({ conversationId: 'conv-a', messages: [msg('mA')] })
    b.setState({ conversationId: 'conv-b', messages: [msg('mB')] })

    mountPane('pane-bf-a', [msg('mA')])
    mountPane('pane-bf-b', [msg('mB')])

    useBusinessFormStore.getState().appendFormRequest(formOf('mA'))
    useBusinessFormStore.getState().appendFormRequest(formOf('mB'))
    expect(Object.keys(useBusinessFormStore.getState().byMessage).sort()).toEqual(['mA', 'mB'])

    // 窗格 A 换会话(消息集也换):只该回收 mA
    act(() => {
      a.setState({ conversationId: 'conv-a2', messages: [msg('mA2')] })
    })
    const view = mountPane('pane-bf-a', [msg('mA2')])
    view.unmount()

    expect(useBusinessFormStore.getState().byMessage.mA).toBeUndefined()
    expect(useBusinessFormStore.getState().byMessage.mB?.[0]?.requestId).toBe('req-mB')
  })

  it('② 反证:Provider 外(单窗格)切会话照样回收自己那批 —— 与改前等价', () => {
    useChatStore.setState({ conversationId: 'conv-root', messages: [msg('mRoot')] })
    render(
      <TooltipProvider>
        <MessageList
          messages={[msg('mRoot')]}
          isStreaming={false}
          emptyTitle="空"
          emptyHint="空"
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )
    useBusinessFormStore.getState().appendFormRequest(formOf('mRoot'))
    expect(useBusinessFormStore.getState().byMessage.mRoot).toBeTruthy()

    act(() => {
      useChatStore.setState({ conversationId: 'conv-root2', messages: [msg('mRoot2')] })
    })
    render(
      <TooltipProvider>
        <MessageList
          messages={[msg('mRoot2')]}
          isStreaming={false}
          emptyTitle="空"
          emptyHint="空"
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )
    expect(useBusinessFormStore.getState().byMessage.mRoot).toBeUndefined()
  })

  it('③ 形状锁:整表 clear 这一档已从 API 里去掉(留两条清法必然漂移)', () => {
    const store = useBusinessFormStore.getState()
    expect(typeof store.clearFormsForMessages).toBe('function')
    expect(Object.hasOwn(store, 'clearForms')).toBe(false)
    // 未命中任何键时不产生新对象(否则每次切换都白渲染一轮)
    const before = useBusinessFormStore.getState().byMessage
    useBusinessFormStore.getState().clearFormsForMessages(['不存在'])
    expect(useBusinessFormStore.getState().byMessage).toBe(before)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
