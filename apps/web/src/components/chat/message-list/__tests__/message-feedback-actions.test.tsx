// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// 2026-10-28 reaction 三态闭环取证。证的是四件事,**不是**"按钮能点":
// ① 读面真的接上了(initialRating → aria-pressed):原稿只有本地态,刷新后点赞就没了;
// ② 再点已选中 = 撤销,且走 DELETE 而不是把同一票重投一次(服务端 upsert 下两者
//    行为不同:重投会保持有票,撤销才是回到未表态);
// ③ 父组件带"操作前旧快照"重渲染时,不能把用户刚投的票洗掉 —— 这条是最容易被
//    忽略的坑:无条件下 setRating(initialRating) 在真实列表刷新里必然踩到;
// ④ MessageItem 渲染位真的把 m.rating 传进来了(漏挂渲染位正是 D64⑤ 当年的根因)。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockFetchApi, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockFetchApi: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

// 只替换 fetchApi,其余导出保持真身
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchApi: mockFetchApi,
}))

// toast 只关心"有没有报",不关心样式
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ error: mockToastError, success: mockToastSuccess }),
}))

import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { hydrateHistoryMessage } from '@/hooks/use-chat/history-message'
import { MessageFeedbackActions } from '../message-feedback-actions'
import { MessageItem } from '../MessageItem'

const MID = 'msg-rating-1'

const likeBtn = () => screen.getByTestId(`message-feedback-like-${MID}`)
const dislikeBtn = () => screen.getByTestId(`message-feedback-dislike-${MID}`)
const pressed = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true'

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
  mockFetchApi.mockReset()
  mockToastError.mockReset()
  mockToastSuccess.mockReset()
})

describe('MessageFeedbackActions 三态闭环(2026-10-28)', () => {
  it('① 读面注入即回显:initialRating=like ⇒ like 按下', () => {
    render(<MessageFeedbackActions messageId={MID} initialRating="like" />)
    expect(pressed(likeBtn())).toBe(true)
    expect(pressed(dislikeBtn())).toBe(false)
  })

  it('② 再点已选中 = 撤销:走 DELETE,不把同一票重投一次', async () => {
    mockFetchApi.mockResolvedValue({ success: true })
    render(<MessageFeedbackActions messageId={MID} initialRating="like" />)
    expect(pressed(likeBtn())).toBe(true)

    await act(async () => {
      fireEvent.click(likeBtn())
    })

    expect(mockFetchApi).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetchApi.mock.calls[0] as [string, { method?: string }]
    expect(url).toBe(`/api/chat/messages/${MID}/feedback`)
    expect(init.method).toBe('DELETE')
    // 撤销后回到未表态:两枚都不按下
    expect(pressed(likeBtn())).toBe(false)
    expect(pressed(dislikeBtn())).toBe(false)
  })

  it('③ 点另一枚 = 改判:走 POST 且载荷是目标值', async () => {
    mockFetchApi.mockResolvedValue({ success: true })
    render(<MessageFeedbackActions messageId={MID} initialRating="like" />)

    await act(async () => {
      fireEvent.click(dislikeBtn())
    })

    const [url, init] = mockFetchApi.mock.calls[0] as [
      string,
      { method?: string; body?: string },
    ]
    expect(url).toBe('/api/chat/messages/feedback')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ messageId: MID, rating: 'dislike' })
    expect(pressed(dislikeBtn())).toBe(true)
    expect(pressed(likeBtn())).toBe(false)
  })

  it('④ 父组件带旧快照重渲染,不得洗掉用户刚投的票', async () => {
    mockFetchApi.mockResolvedValue({ success: true })
    const { rerender } = render(
      <MessageFeedbackActions messageId={MID} initialRating={null} />,
    )

    await act(async () => {
      fireEvent.click(likeBtn())
    })
    expect(pressed(likeBtn())).toBe(true)

    // 服务端尚未回填,父组件手里仍是操作前的 null —— 真列表刷新就是这个时序
    rerender(<MessageFeedbackActions messageId={MID} initialRating={null} />)
    expect(pressed(likeBtn())).toBe(true)
  })

  it('⑤ 读面迟到(值真的变了)时跟随服务端', () => {
    const { rerender } = render(
      <MessageFeedbackActions messageId={MID} initialRating={null} />,
    )
    expect(pressed(dislikeBtn())).toBe(false)

    rerender(<MessageFeedbackActions messageId={MID} initialRating="dislike" />)
    expect(pressed(dislikeBtn())).toBe(true)
  })

  it('⑥ 撤销失败不假装成功:选中态保持原样并报错', async () => {
    mockFetchApi.mockResolvedValue({ success: false, error: 'boom' })
    render(<MessageFeedbackActions messageId={MID} initialRating="like" />)

    await act(async () => {
      fireEvent.click(likeBtn())
    })

    expect(pressed(likeBtn())).toBe(true)
    expect(mockToastError).toHaveBeenCalledTimes(1)
  })

  it('⑦ disabled(流式中)不发任何请求', async () => {
    render(<MessageFeedbackActions messageId={MID} initialRating={null} disabled />)

    await act(async () => {
      fireEvent.click(likeBtn())
    })

    expect(mockFetchApi).not.toHaveBeenCalled()
  })
})

describe('rating 读回映射链(2026-10-28)', () => {
  it('hydrateHistoryMessage 把 row.rating 带进 store 消息,缺席折成 null', () => {
    const withVote = hydrateHistoryMessage({
      id: 'm-1',
      role: 'assistant',
      content: 'x',
      createdAt: new Date().toISOString(),
      rating: 'like',
    })
    expect(withVote.rating).toBe('like')

    const noVote = hydrateHistoryMessage({
      id: 'm-2',
      role: 'assistant',
      content: 'y',
      createdAt: new Date().toISOString(),
    })
    // 缺席(老服务端)与明确无票在渲染上等价,但必须被折成 null 而不是丢掉字段
    expect(noVote.rating).toBeNull()
  })
})

describe('MessageItem 渲染位接线(2026-10-28)', () => {
  it('AI 消息带 rating ⇒ 操作行里的轻评分按下态与服务端一致', () => {
    const m: ChatMessage = {
      id: MID,
      role: 'assistant',
      content: '这是一条回复正文',
      createdAt: Date.now(),
      rating: 'dislike',
    }
    useChatStore.setState({ messages: [m] })
    render(
      <TooltipProvider>
        <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
      </TooltipProvider>,
    )
    expect(pressed(dislikeBtn())).toBe(true)
    expect(pressed(likeBtn())).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
