// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCozeClient } from './coze.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(data: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify({ code: 0, msg: 'success', data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('Coze client bot config endpoints', () => {
  it('uses GET /v1/bots with all documented list params', async () => {
    const fetchMock = mockFetch({ items: [], total: 0 })
    const client = createCozeClient({ token: 't', baseUrl: 'https://api.coze.cn', botId: '', timeout: 1000 })

    await client.listBots('ws-1', {
      publishStatus: 'published_online',
      connectorId: 'connector-1',
      pageNum: 2,
      pageSize: 50,
    })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/v1/bots')
    expect(url.searchParams.get('workspace_id')).toBe('ws-1')
    expect(url.searchParams.get('publish_status')).toBe('published_online')
    expect(url.searchParams.get('connector_id')).toBe('connector-1')
    expect(url.searchParams.get('page_num')).toBe('2')
    expect(url.searchParams.get('page_size')).toBe('50')
  })

  it('uses GET /v1/bots/:bot_id?is_published=', async () => {
    const payload = { bot_id: 'b1', name: 'Bot 1', prompt_info: { prompt: 'p' } }
    const fetchMock = mockFetch(payload)
    const client = createCozeClient({ token: 't', baseUrl: 'https://api.coze.cn', botId: '', timeout: 1000 })

    const result = await client.getBotConfig('b1', false)

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/v1/bots/b1')
    expect(url.searchParams.get('is_published')).toBe('false')
    expect(result).toEqual(payload)
  })

  it('uses GET /v1/bot/get_online_info?bot_id= for the legacy endpoint', async () => {
    const fetchMock = mockFetch({ bot_id: 'b1', name: 'Bot 1' })
    const client = createCozeClient({ token: 't', baseUrl: 'https://api.coze.cn', botId: '', timeout: 1000 })

    await client.getBotOnlineInfo('b1')

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/v1/bot/get_online_info')
    expect(url.searchParams.get('bot_id')).toBe('b1')
  })
})
