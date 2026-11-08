// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it, vi } from 'vitest'

import { loadRefundDetail, REFUND_FALLBACK_MAX_PAGES, REFUND_FALLBACK_PAGE_SIZE } from '../refund-detail'

interface R {
  id: string
}

function pageOf(ids: string[], page: number, total: number) {
  const start = (page - 1) * REFUND_FALLBACK_PAGE_SIZE
  const list = ids.slice(start, start + REFUND_FALLBACK_PAGE_SIZE).map((id) => ({ id }))
  return { ok: true as const, data: { list, total } }
}

describe('退款详情加载(W-03 不许静默降级)', () => {
  it('详情成功时直接返回,不触列表', async () => {
    const list = vi.fn()
    const res = await loadRefundDetail<R>({
      id: 'rf-1',
      notFoundMessage: 'not found',
      detail: async () => ({ ok: true, data: { refund: { id: 'rf-1' } } }),
      list,
    })
    expect(res).toEqual({ refund: { id: 'rf-1' }, degraded: false })
    expect(list).not.toHaveBeenCalled()
  })

  it('详情 5xx/401 时直接抛错,绝不拿列表冒充', async () => {
    const list = vi.fn()
    await expect(
      loadRefundDetail<R>({
        id: 'rf-1',
        notFoundMessage: 'not found',
        detail: async () => ({ ok: false, status: 500, error: 'boom' }),
        list,
      }),
    ).rejects.toThrow('boom')
    expect(list).not.toHaveBeenCalled()
  })

  it('只有 404 才降级到列表,并显式标记 degraded', async () => {
    const res = await loadRefundDetail<R>({
      id: 'rf-1',
      notFoundMessage: 'not found',
      detail: async () => ({ ok: false, status: 404 }),
      list: async (page) => pageOf(['rf-1'], page, 1),
    })
    expect(res).toEqual({ refund: { id: 'rf-1' }, degraded: true })
  })

  it('降级查询会按页翻到目标,不会只看第 1 页', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `rf-${i + 1}`)
    const calls: number[] = []
    const res = await loadRefundDetail<R>({
      id: 'rf-101',
      notFoundMessage: 'not found',
      detail: async () => ({ ok: false, status: 404 }),
      list: async (page) => {
        calls.push(page)
        return pageOf(ids, page, ids.length)
      },
    })
    expect(res.refund.id).toBe('rf-101')
    expect(res.degraded).toBe(true)
    expect(calls).toEqual([1, 2])
  })

  it('翻完 total 仍找不到就抛 notFound,不返回空壳', async () => {
    await expect(
      loadRefundDetail<R>({
        id: 'rf-999',
        notFoundMessage: 'not found',
        detail: async () => ({ ok: false, status: 404 }),
        list: async (page) => pageOf(['rf-1', 'rf-2'], page, 2),
      }),
    ).rejects.toThrow('not found')
  })

  it('降级列表本身失败时抛错,不吞掉错误', async () => {
    await expect(
      loadRefundDetail<R>({
        id: 'rf-1',
        notFoundMessage: 'not found',
        detail: async () => ({ ok: false, status: 404 }),
        list: async () => ({ ok: false, error: 'list down' }),
      }),
    ).rejects.toThrow('list down')
  })

  it('降级翻页有上限,不会无限打接口', async () => {
    // 每页都是满的且总数为天文数字:只能靠 REFUND_FALLBACK_MAX_PAGES 收口
    const fullPage = Array.from({ length: REFUND_FALLBACK_PAGE_SIZE }, (_, i) => ({
      id: `other-${i}`,
    }))
    const list = vi.fn(async () => ({
      ok: true as const,
      data: { list: fullPage, total: 999999 },
    }))
    await expect(
      loadRefundDetail<R>({
        id: 'rf-x',
        notFoundMessage: 'not found',
        detail: async () => ({ ok: false, status: 404 }),
        list,
      }),
    ).rejects.toThrow('not found')
    expect(list).toHaveBeenCalledTimes(REFUND_FALLBACK_MAX_PAGES)
  })
})
