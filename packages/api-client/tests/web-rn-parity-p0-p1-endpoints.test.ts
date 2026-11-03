// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'

import { setTransport, type Transport } from '../src/transport.js'
import { getMarginFlows } from '../src/endpoints/wallet.js'
import { rotateDeveloperApiKey } from '../src/endpoints/developer.js'
import { getDistributionTree } from '../src/endpoints/distribution.js'
import { getSignInHistory } from '../src/endpoints/sign-in.js'

function okTransport(payload: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => '',
    json: async () => ({ code: 0, message: 'ok', data: payload }),
  })) as unknown as Transport
}

function callOf(transport: Transport) {
  const mock = transport as unknown as {
    mock: { calls: Array<[string, Record<string, unknown> | undefined]> }
  }
  return mock.mock.calls[0]
}

describe('web→RN P0/P1 端点', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('getMarginFlows 拼接 page/limit 并透传 {items,total}', async () => {
    const transport = okTransport({
      items: [
        {
          id: 'f1',
          opType: 5,
          quantity: 1234,
          balanceAfter: 5678,
          remark: null,
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      total: 41,
    })
    setTransport(transport)

    const res = await getMarginFlows({ page: 2, limit: 20 })
    expect(res.success).toBe(true)
    expect(res.data?.total).toBe(41)
    expect(res.data?.items[0]?.quantity).toBe(1234)
    const [url, init] = callOf(transport)!
    expect(url).toBe('/api/finance/margin/flows?page=2&limit=20')
    expect(init?.method).toBeUndefined()
  })

  it('rotateDeveloperApiKey 以 POST 打 /developer/keys/:id/reset', async () => {
    const transport = okTransport({ apiKey: 'ak_live_x', secret: 's3cret' })
    setTransport(transport)

    const res = await rotateDeveloperApiKey('k1')
    expect(res.success).toBe(true)
    expect(res.data?.secret).toBe('s3cret')
    const [url, init] = callOf(transport)!
    expect(url).toBe('/api/developer/keys/k1/reset')
    expect(init?.method).toBe('POST')
  })

  it('getDistributionTree 拉 /api/distribution/tree 并透传三层 children', async () => {
    const transport = okTransport({
      tree: [
        {
          id: 'u1',
          username: 'a',
          nickname: 'A',
          avatar: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          level: 1,
          children: [
            {
              id: 'u2',
              username: 'b',
              nickname: null,
              avatar: null,
              createdAt: '2026-02-01T00:00:00.000Z',
              level: 2,
              children: [],
            },
          ],
        },
      ],
      totalLevels: 3,
    })
    setTransport(transport)

    const res = await getDistributionTree()
    expect(res.success).toBe(true)
    expect(res.data?.totalLevels).toBe(3)
    expect(res.data?.tree[0]?.children?.[0]?.id).toBe('u2')
    expect(callOf(transport)![0]).toBe('/api/distribution/tree')
  })

  it('getSignInHistory 透传分页查询与 {list,total,page,pageSize}', async () => {
    const transport = okTransport({
      list: [{ signInDate: '2026-11-01', rewardPoints: 7, consecutiveDays: 3 }],
      total: 25,
      page: 2,
      pageSize: 20,
    })
    setTransport(transport)

    const res = await getSignInHistory({ page: 2, pageSize: 20 })
    expect(res.success).toBe(true)
    expect(res.data?.list[0]?.rewardPoints).toBe(7)
    expect(res.data?.total).toBe(25)
    expect(callOf(transport)![0]).toBe('/api/sign-in/history?page=2&pageSize=20')
  })

  it('getSignInHistory 传 yearMonth 时进入 query string', async () => {
    const transport = okTransport({ list: [], total: 0, page: 1, pageSize: 20 })
    setTransport(transport)

    await getSignInHistory({ page: 1, pageSize: 20, yearMonth: '2026-11' })
    expect(callOf(transport)![0]).toBe('/api/sign-in/history?page=1&pageSize=20&yearMonth=2026-11')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
