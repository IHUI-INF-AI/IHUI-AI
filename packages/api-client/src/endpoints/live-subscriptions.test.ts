// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// A 方案闸:路径与真实路由逐字一致。
// - GET  /api/live/subscriptions      → apps/api/src/routes/live.ts:444-449
// - DELETE /api/live/:id/subscribe    → apps/api/src/routes/live.ts:489-499
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client.js', () => ({ fetchApi: vi.fn() }))

import { fetchApi } from '../client.js'
import { getLiveSubscriptions, unsubscribeLive } from './live'

const mockedFetchApi = vi.mocked(fetchApi)
const CHANNEL_ID = '5f0c1a9e-3b2d-4c8e-9a1f-7d6e5c4b3a29'

beforeEach(() => {
  mockedFetchApi.mockReset()
})

describe('live 订阅端点 — 路径逐字', () => {
  it('getLiveSubscriptions 打 GET /api/live/subscriptions,响应取 list', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: { list: [] } })

    await getLiveSubscriptions()

    expect(mockedFetchApi).toHaveBeenCalledTimes(1)
    expect(mockedFetchApi.mock.calls[0]?.[0]).toBe('/api/live/subscriptions')
    expect(mockedFetchApi.mock.calls[0]?.[1]).toBeUndefined()
  })

  it('unsubscribeLive 打 DELETE /api/live/:id/subscribe', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: { ok: true } })

    await unsubscribeLive(CHANNEL_ID)

    expect(mockedFetchApi).toHaveBeenCalledTimes(1)
    expect(mockedFetchApi.mock.calls[0]?.[0]).toBe(`/api/live/${CHANNEL_ID}/subscribe`)
    expect(mockedFetchApi.mock.calls[0]?.[1]).toEqual({ method: 'DELETE' })
  })
})
