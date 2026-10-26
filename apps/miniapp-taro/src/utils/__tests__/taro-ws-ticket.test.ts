// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 WS ticket 换取(Taro.request 实现)单测。
 *
 * 覆盖 @ihui/api-client 包内 `fetchWsTicket` 的小程序同形实现:
 *  - 换到票 ⇒ 返回 data.wsToken 字符串;
 *  - 非 2xx / 响应体无 data.wsToken / wsToken 不是非空字符串 ⇒ 返回 null;
 *  - Taro.request 抛错(同步抛与 reject 两种)⇒ 返回 null,不抛给调用方;
 *  - 超时参数确实传给 Taro.request(小程序无 AbortSignal,只能靠 timeout 选项);
 *  - Authorization: Bearer <token> 头确实带上(access 不进 URL)。
 *
 * 另含接线自证:桥层必须把本实现注入 createNotificationClient
 * (摘掉注入 ⇒ 该用例必红)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  impl: null as ((options: Record<string, unknown>) => unknown) | null,
  token: 'access-token-1',
  taro: null as { request?: unknown } | null,
  defaultRequest: null as unknown,
}))

vi.mock('@tarojs/taro', () => {
  const taro: { request?: unknown } = {
    request: (options: Record<string, unknown>) => {
      mocks.calls.push(options)
      const impl = mocks.impl
      if (!impl) throw new Error('Taro.request 替身未安装')
      return impl(options)
    },
  }
  mocks.taro = taro
  mocks.defaultRequest = taro.request
  return { default: taro, request: taro.request }
})

// 端内唯一凭据出口(utils/auth.ts)—— 替身只提供 getToken,避免把 storage 拖进单测
vi.mock('@/utils/auth', () => ({
  getToken: () => mocks.token,
}))

import {
  createTaroWsTicketProvider,
  fetchTaroWsTicket,
  resolveWsTicketBaseUrl,
  WS_TICKET_REQUEST_TIMEOUT_MS,
} from '../taro-ws-ticket'

const BASE = 'https://api.example.com/api'

function okResponse(wsToken: unknown): Record<string, unknown> {
  return { statusCode: 200, data: { data: { wsToken } } }
}

/**
 * 取第 n 次请求的参数。
 *
 * 直接按下标取 `mocks.calls` 在 noUncheckedIndexedAccess 下是 TS2532
 * (Object is possibly 'undefined'),故统一走这个取用口。
 * 缺位时抛错(那本身就是要断言失败的场景,让断言读到明确的失败信息)。
 */
function callAt(n: number): Record<string, unknown> {
  const call = mocks.calls[n]
  if (!call) throw new Error(`第 ${n} 次请求不存在(实际 ${mocks.calls.length} 次)`)
  return call
}

beforeEach(() => {
  mocks.calls.length = 0
  mocks.impl = null
  mocks.token = 'access-token-1'
  // 前一条用例可能摘掉 Taro.request(无 Taro 那条),复原
  if (mocks.taro) mocks.taro.request = mocks.defaultRequest
})

describe('fetchTaroWsTicket — 换票主路径', () => {
  it('拿到票:返回响应体里的 wsToken 字符串', async () => {
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-abc'))
    await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBe('ws-ticket-abc')
    expect(mocks.calls).toHaveLength(1)
    // 换票端点在服务端**不在 /api 之下**(wsNotifications 无 prefix 注册),
    // 故 BASE_URL 的 /api 后缀必须剥掉 ⇒ URL 是 /ws/ticket,不是 /api/ws/ticket。
    expect(callAt(0).url).toBe('https://api.example.com/ws/ticket')
    expect(callAt(0).method).toBe('POST')
  })

  it('baseUrl 末尾斜杠不拼出双斜杠', async () => {
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-abc'))
    await fetchTaroWsTicket('https://api.example.com/api/', 'access-token-1')
    expect(callAt(0).url).toBe('https://api.example.com/ws/ticket')
  })

  it('baseUrl 不带 /api 后缀时也拼出根路径 /ws/ticket', async () => {
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-abc'))
    await fetchTaroWsTicket('https://api.example.com', 'access-token-1')
    expect(callAt(0).url).toBe('https://api.example.com/ws/ticket')
  })
})

describe('resolveWsTicketBaseUrl — 换票基址必须剥掉 /api', () => {
  it('剥掉 /api 路径前缀,只留 scheme + authority', () => {
    expect(resolveWsTicketBaseUrl('https://api.example.com/api')).toBe('https://api.example.com')
    expect(resolveWsTicketBaseUrl('http://localhost:8802/api')).toBe('http://localhost:8802')
    expect(resolveWsTicketBaseUrl('https://api.example.com/api/')).toBe('https://api.example.com')
    expect(resolveWsTicketBaseUrl('https://api.example.com')).toBe('https://api.example.com')
  })

  it('相对基址(H5 dev 的 /api)无法推导绝对 host ⇒ 空串(调用方降级直连)', () => {
    expect(resolveWsTicketBaseUrl('/api')).toBe('')
    expect(resolveWsTicketBaseUrl('')).toBe('')
  })

  it('相对基址 ⇒ 不发请求(不拿 /api/ws/ticket 去打 404)', async () => {
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-abc'))
    await expect(fetchTaroWsTicket('/api', 'access-token-1')).resolves.toBeNull()
    expect(mocks.calls).toHaveLength(0)
  })
})

describe('fetchTaroWsTicket — 失败一律 null(降级直连由 ws-client 兜住)', () => {
  it('非 2xx:返回 null(响应体里即便有 wsToken 也不采信)', async () => {
    for (const statusCode of [400, 401, 403, 404, 500, 502]) {
      mocks.impl = () =>
        Promise.resolve({ statusCode, data: { data: { wsToken: 'must-not-use' } } })
      await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBeNull()
    }
  })

  it('响应体里没有 data.wsToken:返回 null', async () => {
    mocks.impl = () => Promise.resolve({ statusCode: 200, data: {} })
    await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBeNull()
    mocks.impl = () => Promise.resolve({ statusCode: 200, data: { data: {} } })
    await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBeNull()
  })

  it('wsToken 不是非空字符串(空串/数字/null/对象):返回 null', async () => {
    for (const wsToken of ['', 123, null, undefined, { a: 1 }]) {
      mocks.impl = () => Promise.resolve(okResponse(wsToken))
      await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBeNull()
    }
  })

  it('Taro.request 同步抛错:返回 null(不抛给调用方)', async () => {
    mocks.impl = () => {
      throw new Error('network down')
    }
    await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBeNull()
  })

  it('Taro.request 返回 rejected promise:返回 null(不抛给调用方)', async () => {
    mocks.impl = () => Promise.reject(new Error('request timeout'))
    await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBeNull()
  })

  it('无 Taro.request:返回 null(不抛,且不发请求)', async () => {
    if (!mocks.taro) throw new Error('Taro 替身未安装')
    mocks.taro.request = undefined
    await expect(fetchTaroWsTicket(BASE, 'access-token-1')).resolves.toBeNull()
    expect(mocks.calls).toHaveLength(0)
  })

  it('没有凭据(accessToken 与 getToken() 都空):返回 null 且不发请求', async () => {
    mocks.token = ''
    await expect(fetchTaroWsTicket(BASE)).resolves.toBeNull()
    expect(mocks.calls).toHaveLength(0)
  })
})

describe('fetchTaroWsTicket — 请求形状', () => {
  it('超时参数确实传给 Taro.request(小程序无 AbortSignal,只能靠 timeout 选项)', async () => {
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-abc'))
    await fetchTaroWsTicket(BASE, 'access-token-1')
    expect(callAt(0).timeout).toBe(WS_TICKET_REQUEST_TIMEOUT_MS)
    expect(callAt(0).timeout).toBe(10_000)
  })

  it('请求带 Authorization: Bearer <token> 头(access 不进 URL)', async () => {
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-abc'))
    await fetchTaroWsTicket(BASE, 'access-token-1')
    const header = callAt(0).header as Record<string, string>
    expect(header.Authorization).toBe('Bearer access-token-1')
    expect(String(callAt(0).url)).not.toContain('access-token-1')
  })

  it('不传 accessToken 时回落到端内唯一凭据出口 getToken()', async () => {
    mocks.token = 'token-from-getter'
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-abc'))
    await expect(fetchTaroWsTicket(BASE)).resolves.toBe('ws-ticket-abc')
    const header = callAt(0).header as Record<string, string>
    expect(header.Authorization).toBe('Bearer token-from-getter')
  })
})

describe('createTaroWsTicketProvider — 注入适配器', () => {
  it('返回的函数按绑定的 baseUrl 换票', async () => {
    mocks.impl = () => Promise.resolve(okResponse('ws-ticket-xyz'))
    const provider = createTaroWsTicketProvider('https://api.example.com/api')
    await expect(provider('access-token-1')).resolves.toBe('ws-ticket-xyz')
    expect(callAt(0).url).toBe('https://api.example.com/ws/ticket')
    expect((callAt(0).header as Record<string, string>).Authorization).toBe('Bearer access-token-1')
  })

  it('换票失败时 provider 返回 null(供 ws-client 降级直连 access token)', async () => {
    mocks.impl = () => Promise.resolve({ statusCode: 500, data: {} })
    const provider = createTaroWsTicketProvider('https://api.example.com/api')
    await expect(provider('access-token-1')).resolves.toBeNull()
  })
})

describe('接线自证 — 桥层必须注入小程序换票实现', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const END_ROOT = resolve(HERE, '..', '..', '..')
  const BRIDGE_SRC = readFileSync(join(END_ROOT, 'src/hooks/use-ui-control-bridge.ts'), 'utf8')

  it('createNotificationClient 的 overrides 里注入了 ticketProvider', () => {
    // 取 createNotificationClient( 到该调用收尾括号之间的整段(调用块内还有
    // 嵌套的 { } 与 ),故用括号配平扫描而不是脆弱的空白形状正则)。
    const start = BRIDGE_SRC.indexOf('createNotificationClient(')
    expect(start).toBeGreaterThan(-1)
    let depth = 0
    let end = -1
    for (let i = start + 'createNotificationClient('.length - 1; i < BRIDGE_SRC.length; i++) {
      const ch = BRIDGE_SRC[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    expect(end).toBeGreaterThan(-1)
    const call = BRIDGE_SRC.slice(start, end + 1)
    expect(call).toContain('ticketProvider')
    expect(call).toMatch(/ticketProvider:\s*createTaroWsTicketProvider\(BASE_URL\)/)
  })

  it('桥层引入了小程序换票实现(不是包内默认的 fetch 实现)', () => {
    expect(BRIDGE_SRC).toMatch(/from '@\/utils\/taro-ws-ticket'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
