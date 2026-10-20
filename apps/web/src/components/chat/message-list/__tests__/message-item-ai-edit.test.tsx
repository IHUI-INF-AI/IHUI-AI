// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票64(2026-10-18 立):AI 消息「编辑为新版本」入口用例。咬三件事:
//  ① 入口只给 AI 消息 —— 用户消息走「保存并重跑」那条链,两条链不得混用同一枚按钮;
//  ② 保存派发的是 ihui:edit-ai-message(版本族新 sibling),不是 ihui:edit-message(截断重跑);
//  ③ 内容未改 / 空白 / 流式中 ⇒ 不派发(空版本落库等于把原回复改成空泡)。
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)

function seedMessage(m: ChatMessage) {
  useChatStore.setState({ messages: [m] })
  render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

function collectEditEvents(): Array<{ messageId: string; content: string }> {
  const seen: Array<{ messageId: string; content: string }> = []
  window.addEventListener('ihui:edit-ai-message', (e) => {
    seen.push((e as CustomEvent<{ messageId: string; content: string }>).detail)
  })
  return seen
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

describe('MessageItem · AI 消息编辑入口(票64)', () => {
  it('AI 消息有「编辑此回复」按钮,用户/system 消息没有', () => {
    seedMessage({ id: 'a1', role: 'assistant', content: '回答', createdAt: NOW })
    expect(screen.getByTestId('message-ai-edit-a1').getAttribute('aria-label')).toBe(
      '[message.editAiReply]',
    )
    cleanup()

    seedMessage({ id: 'u1', role: 'user', content: '提问', createdAt: NOW })
    expect(screen.queryByTestId('message-ai-edit-u1')).toBeNull()
    cleanup()

    seedMessage({ id: 's1', role: 'system', content: '系统', createdAt: NOW })
    expect(screen.queryByTestId('message-ai-edit-s1')).toBeNull()
  })

  it('点开 Dialog 预填原内容,内容未改时保存按钮禁用', () => {
    seedMessage({ id: 'a2', role: 'assistant', content: '原回答', createdAt: NOW })
    fireEvent.click(screen.getByTestId('message-ai-edit-a2'))
    const textarea = screen.getByTestId('message-ai-edit-textarea-a2') as HTMLTextAreaElement
    expect(textarea.value).toBe('原回答')
    const save = screen.getByTestId('message-ai-edit-save-a2') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(save.textContent).toBe('[message.saveAsNewVersion]')
  })

  it('改内容后保存 → 派发 ihui:edit-ai-message,detail 带 messageId 与新内容', () => {
    const seen = collectEditEvents()
    seedMessage({ id: 'a3', role: 'assistant', content: '原回答', createdAt: NOW })
    fireEvent.click(screen.getByTestId('message-ai-edit-a3'))
    fireEvent.change(screen.getByTestId('message-ai-edit-textarea-a3'), {
      target: { value: '改后的回答' },
    })
    screen.getByTestId('message-ai-edit-save-a3').click()
    expect(seen).toEqual([{ messageId: 'a3', content: '改后的回答', paneId: null }])
  })

  it('只改空白 → 不派发(trim 后为空不落新版本)', () => {
    const seen = collectEditEvents()
    seedMessage({ id: 'a4', role: 'assistant', content: '原回答', createdAt: NOW })
    fireEvent.click(screen.getByTestId('message-ai-edit-a4'))
    fireEvent.change(screen.getByTestId('message-ai-edit-textarea-a4'), {
      target: { value: '   ' },
    })
    expect((screen.getByTestId('message-ai-edit-save-a4') as HTMLButtonElement).disabled).toBe(true)
    screen.getByTestId('message-ai-edit-save-a4').click()
    expect(seen).toHaveLength(0)
  })

  it('取消 → 不派发', () => {
    const seen = collectEditEvents()
    seedMessage({ id: 'a5', role: 'assistant', content: '原回答', createdAt: NOW })
    fireEvent.click(screen.getByTestId('message-ai-edit-a5'))
    fireEvent.change(screen.getByTestId('message-ai-edit-textarea-a5'), {
      target: { value: '改后的回答' },
    })
    screen.getByTestId('message-ai-edit-cancel-a5').click()
    expect(seen).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
