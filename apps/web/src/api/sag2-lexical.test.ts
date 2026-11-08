// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiOrThrow } from '@/lib/api'

import {
  sag2AddDocument,
  sag2Fuse,
  sag2RemoveDocument,
  sag2Retrieve,
  sag2Search,
  sag2Status,
  type Sag2ResultRow,
} from './sag2-lexical'

vi.mock('@/lib/api', () => ({ apiOrThrow: vi.fn() }))

const mocked = vi.mocked(apiOrThrow)

beforeEach(() => {
  mocked.mockReset()
  mocked.mockResolvedValue({} as never)
})

describe('sag2-lexical API 封装', () => {
  it('状态端点走 GET 且不带多余参数', async () => {
    await sag2Status()
    expect(mocked).toHaveBeenCalledWith('/api/v1/ai/sag2/status')
  })

  it('登记文档发送 POST JSON 且零模型字段由后端返回', async () => {
    await sag2AddDocument({ path: 'kb/a.txt', content: 'A公司收购了B公司。' })
    const [url, init] = mocked.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/ai/sag2/documents')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      path: 'kb/a.txt',
      content: 'A公司收购了B公司。',
    })
  })

  it('移除文档走 DELETE 且路径进 body', async () => {
    await sag2RemoveDocument('kb/a.txt')
    const [url, init] = mocked.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/ai/sag2/documents')
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(String(init.body))).toEqual({ path: 'kb/a.txt' })
  })

  it('快速搜索默认分页为 1/20', async () => {
    await sag2Search('收购')
    const [, init] = mocked.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ query: '收购', page: 1, per_page: 20 })
  })

  it('多跳检索把选项合进同一个 body', async () => {
    await sag2Retrieve('谁是CTO', { max_hops: 1, top_k: 5 })
    const [url, init] = mocked.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/ai/sag2/retrieve')
    expect(JSON.parse(String(init.body))).toEqual({
      query: '谁是CTO',
      max_hops: 1,
      top_k: 5,
    })
  })

  it('RRF 融合携带两通道与 k', async () => {
    const rows: Sag2ResultRow[] = [
      { key: 'a', path: 'kb/a.txt', content: 'x', score: 1, bm25: 1, hop: 0 },
    ]
    await sag2Fuse(rows, [{ path: 'kb/b.txt' }], 42)
    const [url, init] = mocked.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/ai/sag2/fuse')
    expect(JSON.parse(String(init.body))).toEqual({
      sag2_results: rows,
      rag_sources: [{ path: 'kb/b.txt' }],
      k: 42,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
