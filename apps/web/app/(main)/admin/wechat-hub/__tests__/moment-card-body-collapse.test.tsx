// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 长正文折叠：超过 120 字先出截断预览，展开/收起按 moment.id 独立切换，短正文不出现按钮。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MomentCard from '../MomentCard'
import { wechatHubApi } from '../wechat-hub-api'

vi.mock('../wechat-hub-api', () => ({
  wechatHubApi: {
    publishMoment: vi.fn(),
    fetchMoments: vi.fn(),
  },
}))

vi.mock('../MomentArchivePanel', () => ({
  default: () => <div>archive-panel</div>,
}))

vi.mock('../MomentLocalMedia', () => ({
  default: () => null,
}))

vi.mock('@/components/feedback', () => ({
  Alert: ({ title }: { title?: unknown }) => <div>{title as string}</div>,
}))

const LONG_BODY = '长'.repeat(121)
const SHORT_BODY = '短正文一条'

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MomentCard accountId="account-1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(wechatHubApi.fetchMoments).mockReset()
  vi.mocked(wechatHubApi.publishMoment).mockReset()
  vi.mocked(wechatHubApi.fetchMoments).mockResolvedValue({
    moments: [
      {
        id: 'm-long',
        authorId: null,
        authorName: '阿花',
        content: LONG_BODY,
        mediaUrls: [],
        createdAt: null,
        source: 'db',
      },
      {
        id: 'm-short',
        authorId: null,
        authorName: '大强',
        content: SHORT_BODY,
        mediaUrls: [],
        createdAt: null,
        source: 'db',
      },
    ],
    fetched: 2,
    pages: 1,
    source: 'db',
    partial: false,
    stopReason: 'no-more-data',
    limitReached: false,
    occludedBy: null,
    reason: null,
    result: { ok: true, status: 'accepted', data: {} },
  } as never)
})

afterEach(() => {
  cleanup()
})

describe('MomentCard 长文折叠', () => {
  it('长文截断为前 120 字加省略号，短文不出现展开按钮', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: '遍历朋友圈' }))
    await waitFor(() => expect(wechatHubApi.fetchMoments).toHaveBeenCalled())

    expect(await screen.findByText(`${'长'.repeat(120)}…`)).toBeTruthy()
    expect(screen.getByText(SHORT_BODY)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '展开全文' })).toHaveLength(1)
  })

  it('展开后显示完整正文，按钮变收起；再点回到截断态', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: '遍历朋友圈' }))
    await waitFor(() => expect(wechatHubApi.fetchMoments).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: '展开全文' }))
    expect(await screen.findByText(LONG_BODY)).toBeTruthy()
    expect(screen.getByRole('button', { name: '收起' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '收起' }))
    expect(await screen.findByText(`${'长'.repeat(120)}…`)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '收起' })).toBeNull()
  })

  it('展开状态按 moment.id 独立，点开长文不影响短文', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: '遍历朋友圈' }))
    await waitFor(() => expect(wechatHubApi.fetchMoments).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: '展开全文' }))
    expect(await screen.findByText(LONG_BODY)).toBeTruthy()
    expect(screen.getByText(SHORT_BODY)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '展开全文' })).toBeNull()
  })
})
