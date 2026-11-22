// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fetchWsTicket 的 401 续期语义下沉(2026-10-26)。
 *
 * 病灶:换票端点 POST /ws/ticket 只认 Bearer access token(15 分钟)。这段
 * 「access 过期 ⇒ 续期一次再换」的语义原先只住在 WebSocketClient 的调用侧,
 * 于是**直调 fetchWsTicket 的调用方**(web 的 use-ai-ws-business)拿不到续期 ——
 * 换票恒 401 ⇒ 拿旧 access 降级直连 ⇒ 服务端 4003 拒 ⇒ 重连循环。
 *
 * 本轮契约(逐条钉住):
 *  - 换票 401 ⇒ 静默续期一次 + 用新 access 重换一次 ⇒ 返回新票;
 *  - 续期失败 ⇒ 返回 null(调用方降级直连),不得无限重换;
 *  - 重换后仍 401/失败 ⇒ 返回 null;
 *  - 非 401(5xx/403)⇒ **不**触发续期(照旧 null 降级);
 *  - 网络异常 ⇒ 返回 null,不抛;
 *  - 换票成功 ⇒ 全程不触发续期。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRefreshStateForTest, setTokenProvider } from '../src/client.js'
import { fetchWsTicket } from '../src/ws-client.js'

const OLD = 'old-access'
const NEW = 'new-access'

/** 记录每次 fetch 的 Authorization,按脚本返回响应。 */
function scriptedFetch(
  respond: (call: number) => { ok: boolean; status: number; json: () => Promise<unknown> },
): { auths: string[]; calls: () => number } {
  const auths: string[] = []
  let call = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { headers: { Authorization: string } }) => {
      auths.push(init.headers.Authorization)
      call++
      return respond(call)
    }),
  )
  return { auths, calls: () => call }
}

const ticketBody = (wsToken: string) => ({ data: { wsToken } })

beforeEach(() => {
  __resetRefreshStateForTest()
})

afterEach(() => {
  __resetRefreshStateForTest()
  setTokenProvider({ getToken: () => null })
  vi.unstubAllGlobals()
})

function installProvider(refresh: () => Promise<string | null>): void {
  setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })
}

describe('fetchWsTicket:401 ⇒ 续期一次重换(单一出口)', () => {
  it('首次 401 ⇒ 续期后用新 access 重换,返回新票', async () => {
    installProvider(async () => NEW)
    const { auths } = scriptedFetch((call) =>
      call === 1
        ? { ok: false, status: 401, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ticketBody('ticket-new') },
    )

    const ticket = await fetchWsTicket('https://api.example.com', OLD)

    expect(ticket).toBe('ticket-new')
    expect(auths).toEqual([`Bearer ${OLD}`, `Bearer ${NEW}`])
  })

  it('续期失败 ⇒ 返回 null(降级直连),不重换', async () => {
    installProvider(async () => null)
    const { auths, calls } = scriptedFetch(() => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    }))

    const ticket = await fetchWsTicket('https://api.example.com', OLD)

    expect(ticket).toBeNull()
    expect(auths).toEqual([`Bearer ${OLD}`])
    expect(calls()).toBe(1)
  })

  it('重换后仍 401 ⇒ 返回 null(只续一次,不无限重换)', async () => {
    installProvider(async () => NEW)
    const { calls } = scriptedFetch(() => ({ ok: false, status: 401, json: async () => ({}) }))

    const ticket = await fetchWsTicket('https://api.example.com', OLD)

    expect(ticket).toBeNull()
    expect(calls()).toBe(2)
  })

  it('非 401(5xx)⇒ 不触发续期', async () => {
    const refresh = vi.fn(async () => NEW)
    installProvider(refresh)
    const { auths, calls } = scriptedFetch(() => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }))

    const ticket = await fetchWsTicket('https://api.example.com', OLD)

    expect(ticket).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
    expect(auths).toEqual([`Bearer ${OLD}`])
    expect(calls()).toBe(1)
  })

  it('换票成功 ⇒ 全程不触发续期', async () => {
    const refresh = vi.fn(async () => NEW)
    installProvider(refresh)
    const { calls } = scriptedFetch(() => ({
      ok: true,
      status: 200,
      json: async () => ticketBody('ticket-ok'),
    }))

    const ticket = await fetchWsTicket('https://api.example.com', OLD)

    expect(ticket).toBe('ticket-ok')
    expect(refresh).not.toHaveBeenCalled()
    expect(calls()).toBe(1)
  })

  it('网络异常 ⇒ 返回 null(不抛),不触发续期', async () => {
    const refresh = vi.fn(async () => NEW)
    installProvider(refresh)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    const ticket = await fetchWsTicket('https://api.example.com', OLD)

    expect(ticket).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('响应体无 wsToken ⇒ 返回 null', async () => {
    installProvider(async () => NEW)
    scriptedFetch(() => ({ ok: true, status: 200, json: async () => ({ data: {} }) }))

    const ticket = await fetchWsTicket('https://api.example.com', OLD)

    expect(ticket).toBeNull()
  })
})
