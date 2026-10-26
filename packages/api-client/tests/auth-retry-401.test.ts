// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 非 fetchApi 通道的 401 续期(2026-10-26 立)。
 *
 * 病灶:access JWT 只有 15 分钟,而 fetchAiServiceJson / fetchRaw / fetchText / SSE
 * 四条腿都只认 Bearer、遇 401 直接报错 ⇒ 签到、知识库、截图下载、聊天流在"待一会儿"
 * 之后表现为"功能突然不可用/聊一半提示登录过期",而 refresh(30 天)明明还能换。
 *
 * 本轮契约(逐条钉住):
 *  - 401 ⇒ 静默续期一次 + 用新凭据重放一次;
 *  - 续期失败 ⇒ 原样返回/抛出 401,不得无限重放;
 *  - 非 401(5xx/403 等) ⇒ 不触发续期;
 *  - SSE 的续期只在 HTTP 层(还没读流)发生,由调用方改写 headers,runner 原地重试。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTransport, type Transport, type TransportInit } from '../src/transport.js'
import {
  setStreamTransport,
  getStreamTransport,
  type StreamBodyReader,
  type StreamTransport,
  type StreamTransportResponse,
} from '../src/stream-transport.js'
import {
  __resetRefreshStateForTest,
  fetchAiServiceJson,
  fetchRaw,
  runResumableSSEStream,
  setBaseUrl,
  setTokenProvider,
} from '../src/client.js'

const OLD = 'old-access'
const NEW = 'new-access'

/** 记录每次请求的 Authorization,按脚本返回响应。 */
function scriptedTransport(
  respond: (call: number) => {
    ok: boolean
    status: number
    json?: () => Promise<unknown>
    text?: () => Promise<string>
    blob?: () => Promise<Blob>
  },
): { transport: Transport; auths: string[] } {
  const auths: string[] = []
  let call = 0
  const transport = vi.fn(async (_url: string, init: TransportInit) => {
    auths.push(init.headers?.Authorization ?? '')
    call++
    return respond(call)
  }) as unknown as Transport
  setTransport(transport)
  return { transport, auths }
}

function textBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/** 最小流式响应:逐行吐出,最后 done。 */
function sseResponse(lines: string[]): StreamTransportResponse {
  let i = 0
  const body = {
    getReader(): StreamBodyReader {
      return {
        read: async () =>
          i < lines.length
            ? { done: false, value: textBytes(`${lines[i++]!}\n`) }
            : { done: true, value: undefined },
        cancel: async () => {},
      }
    },
  }
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => '',
    body,
  }
}

function unauthorized(): StreamTransportResponse {
  return {
    ok: false,
    status: 401,
    headers: new Headers(),
    text: async () => '{"message":"expired"}',
    body: null,
  }
}

let originalStreamTransport: StreamTransport

beforeEach(() => {
  __resetRefreshStateForTest()
  setBaseUrl('')
  originalStreamTransport = getStreamTransport()
})

afterEach(() => {
  __resetRefreshStateForTest()
  setTransport(undefined as unknown as Transport)
  setStreamTransport(originalStreamTransport)
  setTokenProvider({ getToken: () => null })
  setBaseUrl('')
})

function installProvider(refresh: () => Promise<string | null>): void {
  setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })
}

describe('fetchAiServiceJson:401 续期一次并重放', () => {
  it('首次 401 ⇒ 续期后用新 Bearer 重放,返回成功', async () => {
    installProvider(async () => NEW)
    const { auths } = scriptedTransport((call) =>
      call === 1
        ? { ok: false, status: 401, text: async () => '{"message":"expired"}' }
        : { ok: true, status: 200, json: async () => ({ ok: true }) },
    )

    const res = await fetchAiServiceJson<{ ok: boolean }>('/api/checkin/accounts')

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ ok: true })
    expect(auths).toEqual([`Bearer ${OLD}`, `Bearer ${NEW}`])
  })

  it('续期失败 ⇒ 原样返回 401,只请求一次(不无限重放)', async () => {
    installProvider(async () => null)
    const { auths } = scriptedTransport(() => ({
      ok: false,
      status: 401,
      text: async () => '{"message":"expired"}',
    }))

    const res = await fetchAiServiceJson('/api/checkin/accounts')

    expect(res.success).toBe(false)
    expect(res.status).toBe(401)
    expect(auths).toEqual([`Bearer ${OLD}`])
  })

  it('非 401(5xx)不触发续期', async () => {
    const refresh = vi.fn(async () => NEW)
    installProvider(refresh)
    const { auths } = scriptedTransport(() => ({
      ok: false,
      status: 503,
      text: async () => '{"message":"unavailable"}',
    }))

    const res = await fetchAiServiceJson('/api/checkin/accounts')

    expect(res.status).toBe(503)
    expect(refresh).not.toHaveBeenCalled()
    expect(auths).toHaveLength(1)
  })
})

describe('fetchRaw:401 续期一次并重放', () => {
  it('首次 401 ⇒ 续期后重放,拿到 blob', async () => {
    installProvider(async () => NEW)
    const blob = new Blob(['png-bytes'])
    const { auths } = scriptedTransport((call) =>
      call === 1
        ? { ok: false, status: 401, text: async () => 'expired' }
        : { ok: true, status: 200, blob: async () => blob },
    )

    const out = await fetchRaw('/api/screenshot/1')

    expect(await out.text()).toBe('png-bytes')
    expect(auths).toEqual([`Bearer ${OLD}`, `Bearer ${NEW}`])
  })

  it('续期失败 ⇒ 原错误上抛(status 保留 401)', async () => {
    installProvider(async () => null)
    scriptedTransport(() => ({ ok: false, status: 401, text: async () => 'expired' }))

    await expect(fetchRaw('/api/screenshot/1')).rejects.toMatchObject({ status: 401 })
  })
})

describe('runResumableSSEStream:HTTP 401 由调用方续期后原地重试', () => {
  it('401 ⇒ refreshAuth 改写 Authorization,重试后正常读到流', async () => {
    const seen: string[] = []
    const headers: Record<string, string> = { Authorization: `Bearer ${OLD}` }
    let round = 0
    setStreamTransport((async (_url, init) => {
      seen.push(init.headers?.Authorization ?? '')
      round++
      return round === 1 ? unauthorized() : sseResponse(['data: {"delta":"hi"}', 'data: [DONE]'])
    }) as StreamTransport)

    const lines: string[] = []
    await runResumableSSEStream({
      url: 'https://example.test/api/ai/chat/stream',
      headers,
      onLine: (line) => {
        lines.push(line)
      },
      refreshAuth: async () => {
        headers['Authorization'] = `Bearer ${NEW}`
        return true
      },
    })

    expect(seen).toEqual([`Bearer ${OLD}`, `Bearer ${NEW}`])
    expect(lines).toContain('data: {"delta":"hi"}')
  })

  it('refreshAuth 返回 false ⇒ 维持旧行为:401 直接抛出,不重放', async () => {
    const headers: Record<string, string> = { Authorization: `Bearer ${OLD}` }
    let round = 0
    setStreamTransport((async () => {
      round++
      return unauthorized()
    }) as StreamTransport)

    await expect(
      runResumableSSEStream({
        url: 'https://example.test/api/ai/chat/stream',
        headers,
        onLine: () => {},
        refreshAuth: async () => false,
      }),
    ).rejects.toThrow(/expired/)

    // 首次 401 后调用方续期失败即终态:不再发第二次
    expect(round).toBe(1)
  })

  it('未注入 refreshAuth ⇒ 旧行为(401 业务错误),不触发任何续期', async () => {
    let round = 0
    setStreamTransport((async () => {
      round++
      return unauthorized()
    }) as StreamTransport)

    await expect(
      runResumableSSEStream({
        url: 'https://example.test/api/ai/chat/stream',
        headers: { Authorization: `Bearer ${OLD}` },
        onLine: () => {},
      }),
    ).rejects.toThrow(/expired/)
    expect(round).toBe(1)
  })

  it('续期后仍 401 ⇒ 不再续期(红线:一次流只续一次,新凭据也被拒=会话真死)', async () => {
    const headers: Record<string, string> = { Authorization: `Bearer ${OLD}` }
    let round = 0
    let refreshCalls = 0
    setStreamTransport((async () => {
      round++
      return unauthorized()
    }) as StreamTransport)

    await expect(
      runResumableSSEStream({
        url: 'https://example.test/api/ai/chat/stream',
        headers,
        onLine: () => {},
        refreshAuth: async () => {
          refreshCalls++
          headers['Authorization'] = `Bearer ${NEW}`
          return true
        },
      }),
    ).rejects.toThrow(/expired/)

    // 续期一次后重放的那一跳仍是 401 ⇒ 终态,不再发起第三次请求、不再续期
    expect(round).toBe(2)
    expect(refreshCalls).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
