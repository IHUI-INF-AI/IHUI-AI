// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 遍历朋友圈成功后，归档面板必须被 invalidate，否则仍显示抓取前的旧归档。
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

beforeEach(() => {
  vi.mocked(wechatHubApi.fetchMoments).mockReset()
  vi.mocked(wechatHubApi.publishMoment).mockReset()
})

afterEach(() => {
  cleanup()
})

describe('MomentCard', () => {
  it('抓取成功后失效归档查询缓存', async () => {
    vi.mocked(wechatHubApi.fetchMoments).mockResolvedValue({
      moments: [],
      fetched: 1,
      pages: 1,
      source: 'db',
      partial: false,
      stopReason: 'no-more-data',
      limitReached: false,
      occludedBy: null,
      reason: null,
      result: { ok: true, status: 'accepted', data: {} },
    } as never)

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    render(
      <QueryClientProvider client={client}>
        <MomentCard accountId="account-1" />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '遍历朋友圈' }))

    await waitFor(() => expect(wechatHubApi.fetchMoments).toHaveBeenCalled())
    expect(wechatHubApi.fetchMoments).toHaveBeenCalledWith('account-1', { maxPages: 10 })
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['wechat-hub', 'moments-archive', 'account-1'],
      }),
    )
  })

  it('只读账号仍显示归档，但隐藏发布表单', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MomentCard accountId="account-1" readOnly />
      </QueryClientProvider>,
    )

    expect(screen.getByText('archive-panel')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '发布朋友圈' })).toBeNull()
    expect(screen.getByRole('button', { name: '遍历朋友圈' })).toBeTruthy()
  })
})
