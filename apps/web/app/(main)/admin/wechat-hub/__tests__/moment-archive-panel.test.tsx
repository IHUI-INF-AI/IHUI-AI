// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 归档面板：数据库行 id 是 UUID，本地媒体接口必须拿到平台 momentKey，
 * 否则会把 UUID 当 momentId 去查媒体并 404。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MomentArchivePanel from '../MomentArchivePanel'
import { wechatHubApi } from '../wechat-hub-api'

vi.mock('../wechat-hub-api', () => ({
  wechatHubApi: {
    fetchMomentArchive: vi.fn(),
  },
}))

vi.mock('../MomentLocalMedia', () => ({
  default: ({ momentId }: { momentId: string }) => (
    <div data-testid="local-media">momentId:{momentId}</div>
  ),
}))

beforeEach(() => {
  vi.mocked(wechatHubApi.fetchMomentArchive).mockReset()
})

afterEach(() => {
  cleanup()
})

describe('MomentArchivePanel', () => {
  it('本地媒体使用归档的 momentKey，而不是数据库行 id', async () => {
    vi.mocked(wechatHubApi.fetchMomentArchive).mockResolvedValue({
      storage: 'database',
      total: 1,
      limit: 50,
      offset: 0,
      reason: null,
      moments: [
        {
          id: 'row-uuid-1',
          momentKey: 'sns-123',
          authorId: 'wxid_a',
          authorName: '张三',
          authorResolved: true,
          content: '周末聚餐',
          mediaUrls: ['https://example.com/a.jpg'],
          createdAt: 1_760_000_000,
          source: 'db',
          firstSeenAt: '2026-11-25T00:00:00.000Z',
          lastSeenAt: '2026-11-25T01:00:00.000Z',
          seenCount: 2,
          mediaLocalDir: 'C:\\caches\\temp\\wechat-db-media\\sns-123',
          mediaDownloaded: true,
        },
      ],
    })

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MomentArchivePanel accountId="account-1" />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('local-media')).toBeTruthy())
    expect(screen.getByTestId('local-media').textContent).toBe('momentId:sns-123')
  })

  it('点击加载更多后按 offset 取下一页，并继续用 momentKey 查媒体', async () => {
    vi.mocked(wechatHubApi.fetchMomentArchive).mockImplementation(async (_accountId, input = {}) => {
      const page = input.offset ?? 0
      const items =
        page === 0
          ? [
              {
                id: 'row-uuid-1',
                momentKey: 'sns-123',
                authorId: 'wxid_a',
                authorName: '张三',
                authorResolved: true,
                content: '第一页',
                mediaUrls: ['https://example.com/a.jpg'],
                createdAt: 1_760_000_000,
                source: 'db',
                firstSeenAt: '2026-11-25T00:00:00.000Z',
                lastSeenAt: '2026-11-25T01:00:00.000Z',
                seenCount: 2,
                mediaLocalDir: 'C:\\caches\\temp\\wechat-db-media\\sns-123',
              },
            ]
          : [
              {
                id: 'row-uuid-2',
                momentKey: 'sns-456',
                authorId: 'wxid_b',
                authorName: '李四',
                authorResolved: true,
                content: '第二页',
                mediaUrls: [],
                createdAt: 1_759_000_000,
                source: 'db',
                firstSeenAt: '2026-11-24T00:00:00.000Z',
                lastSeenAt: '2026-11-24T01:00:00.000Z',
                seenCount: 1,
                mediaLocalDir: 'C:\\caches\\temp\\wechat-db-media\\sns-456',
              },
            ]
      return { storage: 'database', total: 2, limit: 50, offset: page, reason: null, moments: items }
    })

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MomentArchivePanel accountId="account-1" />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getAllByTestId('local-media')).toHaveLength(1))
    expect(screen.getByText(/已显示 1 \/ 共 2 条/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))

    await waitFor(() => expect(screen.getAllByTestId('local-media')).toHaveLength(2))
    expect(screen.getByText(/已显示 2 \/ 共 2 条/)).toBeTruthy()
    expect(vi.mocked(wechatHubApi.fetchMomentArchive)).toHaveBeenLastCalledWith('account-1', {
      limit: 50,
      offset: 1,
    })
  })
})

