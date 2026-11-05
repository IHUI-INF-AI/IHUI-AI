// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// B3 parity 闸:`getNews` 必须把 `keyword` 归一成后端认的 `search` 键。
// 后端真源 = apps/api/src/routes/news.ts:65(`articlesQuerySchema.search`)。
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client.js', () => ({ fetchApi: vi.fn() }))

import { fetchApi } from '../client.js'
import type { PageData } from '../utils.js'
import type { News } from './community'
import { getNews } from './community'

const mockedFetchApi = vi.mocked(fetchApi)

const emptyPage: PageData<News> = { list: [], total: 0, page: 1, pageSize: 20 }

beforeEach(() => {
  mockedFetchApi.mockReset()
  mockedFetchApi.mockResolvedValue({ success: true, data: emptyPage })
})

describe('getNews — keyword 键名归一', () => {
  it('实际发出去的查询键是 search,不是 keyword', async () => {
    await getNews({ page: 1, pageSize: 20, keyword: 'AI 编程' })

    const url = String(mockedFetchApi.mock.calls[0]?.[0])
    expect(url).toContain('search=')
    expect(url).not.toContain('keyword=')
    // 键名带值断言(URL 编码后为 AI%20%E7%BC%96%E7%A8%8B)
    expect(url).toMatch(/search=AI/)
  })

  it('不传 keyword 时不带 search 键(保持全量列表)', async () => {
    await getNews({ page: 1, pageSize: 20 })

    const url = String(mockedFetchApi.mock.calls[0]?.[0])
    expect(url).not.toContain('search=')
    expect(url).not.toContain('keyword=')
  })
})
