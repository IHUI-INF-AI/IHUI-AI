// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ⑤(2026-09-26)接线端到端取证:证的是 **MessageItem 渲染位** 真的监听点踩展开事件、
// 挂载 FeedbackSurveyCard 并把三选答复折算成扩展载荷发到 /messages/feedback。
// 只测卡本体(feedback-survey-card.test.tsx)发现不了"渲染位漏挂"(2026-09 前的生产态就是零消费点)。
import { act, cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0)

const { mockFetchApi } = vi.hoisted(() => ({ mockFetchApi: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

// 只替换 fetchApi,其余导出保持真身(子组件可能引用同模块其它成员)
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchApi: mockFetchApi,
}))

import { toast } from '@/components/common'
import { TooltipProvider } from '@/components/feedback'
import { MessageItem } from '../MessageItem'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const TARGET_ID = 'fb-survey-target'

function assistantMsg(): ChatMessage {
  return { id: TARGET_ID, role: 'assistant', content: '这是一条回复正文', createdAt: NOW }
}

function renderMessage(m: ChatMessage) {
  useChatStore.setState({ messages: [m] })
  // 操作按钮区带 Tooltip(操作区在 content 非空时渲染),必须包 Provider
  render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

function dispatchSurveyOpen(messageId: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent('ihui:feedback-survey-open', { detail: { messageId } }))
  })
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
  vi.restoreAllMocks()
  mockFetchApi.mockReset()
})

describe('MessageItem 反馈问卷卡接线(D64 ⑤)', () => {
  it('本消息点踩事件 → 挂载问卷卡(免打扰门全开态可渲染);他消息事件不挂', () => {
    renderMessage(assistantMsg())
    expect(screen.queryByTestId(`feedback-survey-${TARGET_ID}`)).toBeNull()
    dispatchSurveyOpen('fb-survey-other')
    expect(screen.queryByTestId(`feedback-survey-${TARGET_ID}`)).toBeNull()
    dispatchSurveyOpen(TARGET_ID)
    const card = screen.getByTestId(`feedback-survey-${TARGET_ID}`)
    expect(card.getAttribute('data-feedback-survey')).toBe('open')
  })

  it('三选 solved + 无评论 → 提交 {messageId, rating:"like"}(改票纠正),载荷不带 comment 键', async () => {
    mockFetchApi.mockResolvedValueOnce({ success: true, data: { rated: true } })
    renderMessage(assistantMsg())
    dispatchSurveyOpen(TARGET_ID)
    fireEvent.click(screen.getByRole('radio', { name: 'feedbackSurvey.answer.solved' }))
    fireEvent.click(document.querySelector('[data-feedback-action="submit"]') as HTMLButtonElement)
    await waitFor(() => expect(mockFetchApi).toHaveBeenCalledTimes(1))
    expect(mockFetchApi).toHaveBeenCalledWith(
      '/api/chat/messages/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ messageId: TARGET_ID, rating: 'like' }),
      }),
    )
  })

  it('三选 partial + 评论 → 提交 {messageId, rating:"dislike", comment},维持点踩原票', async () => {
    mockFetchApi.mockResolvedValueOnce({ success: true, data: { rated: true } })
    renderMessage(assistantMsg())
    dispatchSurveyOpen(TARGET_ID)
    fireEvent.click(screen.getByRole('radio', { name: 'feedbackSurvey.answer.partial' }))
    fireEvent.change(document.querySelector('[data-feedback-comment]') as HTMLInputElement, {
      target: { value: '少了最后一步' },
    })
    fireEvent.click(document.querySelector('[data-feedback-action="submit"]') as HTMLButtonElement)
    await waitFor(() => expect(mockFetchApi).toHaveBeenCalledTimes(1))
    expect(mockFetchApi).toHaveBeenCalledWith(
      '/api/chat/messages/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messageId: TARGET_ID,
          rating: 'dislike',
          comment: '少了最后一步',
        }),
      }),
    )
  })

  it('提交失败(res.success=false)→ toast.error 兜底,不静默吞', async () => {
    mockFetchApi.mockResolvedValueOnce({ success: false, error: '参数错误' })
    // toast.error 返回 sonner 风格 id(string|number),桩返回空串对齐签名
    const errSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    renderMessage(assistantMsg())
    dispatchSurveyOpen(TARGET_ID)
    fireEvent.click(screen.getByRole('radio', { name: 'feedbackSurvey.answer.notSolved' }))
    fireEvent.click(document.querySelector('[data-feedback-action="submit"]') as HTMLButtonElement)
    await waitFor(() => expect(errSpy).toHaveBeenCalledTimes(1))
  })

  it('失败消息(m.error)不挂问卷卡:失败轮次走错误链路,不掺满意度', () => {
    renderMessage({ ...assistantMsg(), error: true })
    dispatchSurveyOpen(TARGET_ID)
    expect(screen.queryByTestId(`feedback-survey-${TARGET_ID}`)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
