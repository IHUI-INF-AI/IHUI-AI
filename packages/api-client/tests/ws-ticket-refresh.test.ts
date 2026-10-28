// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WS 换票遇 access 过期时续期一次(2026-10-26 立)。
 *
 * 病灶:换票端点 POST /ws/ticket 只认 Bearer access token(15 分钟)。旧逻辑换票失败
 * 直接拿**过期** access 降级建连 ⇒ 服务端 4003 拒绝 ⇒ 重连循环(通知/agent 通道反复断)。
 * 本轮契约:第一次换票失败 ⇒ 静默续期一次 ⇒ 用新 token 再换;续期失败才降级。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const refreshAccessTokenOnce = vi.hoisted(() => vi.fn<() => Promise<string | null>>())

vi.mock('../src/client.js', () => ({ refreshAccessTokenOnce }))

import { WebSocketClient, type WebSocketLike } from '../src/ws-client.js'

function makeSocket(url: string): WebSocketLike & { url: string } {
  return {
    url,
    readyState: 0,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send() {},
    close() {},
  }
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

let clients: WebSocketClient<{ kind: string }>[] = []

function makeClient(ticketProvider: (token: string) => Promise<string | null>): string[] {
  const urls: string[] = []
  const client = new WebSocketClient<{ kind: string }>(
    {
      urlBuilder: (token) => `wss://example.test/ws?token=${token}`,
      tokenProvider: () => 'old-access',
      ticketProvider,
      messageGuard: () => true,
      webSocketFactory: (url) => {
        urls.push(url)
        return makeSocket(url)
      },
    },
    {},
  )
  clients.push(client)
  client.connect()
  return urls
}

beforeEach(() => {
  refreshAccessTokenOnce.mockReset()
  clients = []
})

afterEach(() => {
  for (const c of clients) c.disconnect()
})

describe('WebSocketClient 换票失败 ⇒ 续期一次再换', () => {
  it('首次换票失败 + 续期成功 ⇒ 用新 token 换到 ticket 建连', async () => {
    refreshAccessTokenOnce.mockResolvedValue('new-access')
    const seen: string[] = []
    const urls = makeClient(async (token) => {
      seen.push(token)
      return token === 'new-access' ? 'ticket-1' : null
    })

    await flush()

    expect(seen).toEqual(['old-access', 'new-access'])
    expect(urls).toEqual(['wss://example.test/ws?token=ticket-1'])
  })

  it('首次换票成功 ⇒ 不触发续期', async () => {
    const urls = makeClient(async () => 'ticket-ok')

    await flush()

    expect(refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(urls).toEqual(['wss://example.test/ws?token=ticket-ok'])
  })

  it('续期也失败 ⇒ 维持旧行为:用原 access 降级建连', async () => {
    refreshAccessTokenOnce.mockResolvedValue(null)
    const urls = makeClient(async () => null)

    await flush()

    expect(urls).toEqual(['wss://example.test/ws?token=old-access'])
  })

  it('续期换了新 token 但换票仍失败 ⇒ 用新 token 降级(不再拿过期凭据)', async () => {
    refreshAccessTokenOnce.mockResolvedValue('new-access')
    const urls = makeClient(async () => null)

    await flush()

    expect(urls).toEqual(['wss://example.test/ws?token=new-access'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
