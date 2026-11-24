// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ws-ai TTS 服务间凭证夹具(2026-11-08)。
 *
 * 修的是哪一格:ai-service 的 `/api/voice/tts` 已要求已验证主体后,ws-ai 仍用裸
 * `fetch` 直连、不带任何凭证 —— 原来是靠该端点匿名可达才通的。端点一收口,链路
 * 立刻 401,而失败被 catch 吞掉后静默降级 DashScope(线上看起来一切正常)。
 *
 * 本夹具把"改前必红"钉死:
 * - 服务端(这里用 fetch 替身)真的校验 `Authorization`,无凭证/过期/错误一律 401/403;
 *   把 `synthesizeTTS` 改回裸 fetch,第 1 组直接拿不到 audio.done(必红)。
 * - 失败必须显式:断言结构化告警里带稳定错误码,且 `fallback` 字段写明去向;
 *   未配 DashScope 时不得"静默成功",必须是 task.error。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import { WebSocket as WsWebSocket } from 'ws'
import { jwtVerify } from 'jose'

if (!globalThis.WebSocket) {
  ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = WsWebSocket
}

const { mockWsAuth, mockLoggerWarn } = vi.hoisted(() => ({
  mockWsAuth: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: mockWsAuth,
  WS_CLOSE: {
    MISSING_TOKEN: 4001,
    RATE_LIMITED: 4002,
    INVALID_TOKEN: 4003,
    ACCOUNT_CANCELLED: 4004,
    TOO_MANY_CONNECTIONS: 4005,
  },
  WsUserConnectionLimiter: vi.fn().mockImplementation(function () {
    return { acquire: vi.fn(() => true), release: vi.fn(), currentCount: vi.fn(() => 0) }
  }),
  WsRateLimiter: vi.fn().mockImplementation(function () {
    return { allow: vi.fn(() => true), reset: vi.fn() }
  }),
}))

const JWT_SECRET = 'test-jwt-secret-for-vitest-at-least-32-chars'

vi.mock('../src/config/index.js', () => ({
  // aiServiceFetch 在 WS 场景(无 Authorization 头、query.token 存在)会调用
  // getSystemAccessToken(),用 config.JWT_SECRET 现签系统服务凭证。
  config: {
    AI_SERVICE_URL: 'http://ai-service.test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-chars',
  },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: mockLoggerWarn, debug: vi.fn() },
}))

vi.mock('../src/routes/ai-vendors.js', () => ({
  cloneTimbre: vi.fn().mockResolvedValue(undefined),
}))

import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { wsAi } from '../src/plugins/ws-ai.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const SECRET = new TextEncoder().encode(JWT_SECRET)
const AUDIO = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00])

/** 模拟 ai-service 既定鉴权语义:校验 Bearer + issuer + audience。 */
async function authorize(headers: Record<string, string>): Promise<string | null> {
  const raw = headers.Authorization ?? headers.authorization
  if (!raw?.startsWith('Bearer ')) return 'missing_credential'
  try {
    await jwtVerify(raw.slice(7), SECRET, { issuer: 'ihui-ai', audience: 'ihui-ai-users' })
    return null
  } catch (e) {
    // jose 的过期与签名错误分开回报,和线上 401 的两种成因对得上
    const code = (e as { code?: string }).code ?? ''
    return code.includes('exp') ? 'expired_credential' : 'bad_credential'
  }
}

function audioResponse(): Response {
  return new Response(AUDIO, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
}

const mockFetch = vi.fn()

describe('ws-ai TTS — 服务间凭证与显式降级', () => {
  const server = Fastify({ logger: false })
  let url: string

  beforeAll(async () => {
    vi.stubGlobal('fetch', mockFetch)
    await server.register(websocket)
    await server.register(wsAi)
    await server.listen({ port: 0, host: '127.0.0.1' })
    url = `ws://127.0.0.1:${(server.server.address() as AddressInfo).port}/ws/tts/stream`
    mockWsAuth.mockImplementation(async () => USER_ID)
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await server.close()
  })

  beforeEach(() => {
    mockFetch.mockReset()
    mockLoggerWarn.mockReset()
    // 每条用例都从"未配置 DashScope"起步,避免降级把失败掩盖成成功
    delete process.env.DASHSCOPE_API_KEY
  })

  afterEach(() => {
    delete process.env.DASHSCOPE_API_KEY
  })

  /** 连上 WS,发一条 synthesize,收齐事件后断开。 */
  async function synthesizeOnce(
    events: Array<Record<string, unknown>>,
    withToken: boolean,
    text = '你好',
  ): Promise<void> {
    const ws = new WsWebSocket(`${url}${withToken ? '?token=ok' : ''}`)
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string) as never)
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ws open timeout')), 3000)
      ws.onopen = () => {
        clearTimeout(t)
        resolve()
      }
      ws.onerror = (e) => {
        clearTimeout(t)
        reject(e as never)
      }
    })
    await new Promise((r) => setTimeout(r, 30))
    ws.send(JSON.stringify({ action: 'synthesize', text, voice: 'longxiaochun' }))
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('等待终态事件超时')), 3000)
      const interval = setInterval(() => {
        if (events.some((e) => e.event === 'audio.done' || e.event === 'task.error')) {
          clearInterval(interval)
          clearTimeout(t)
          resolve()
        }
      }, 20)
    })
    ws.close()
    await new Promise((r) => setTimeout(r, 20))
  }

  it('带凭证 → ai-service 鉴权通过,audio.done 且请求确实打到 /api/voice/tts', async () => {
    mockFetch.mockImplementation(
      async (input: string, init: { headers?: Record<string, string> }) => {
        expect(String(input)).toBe('http://ai-service.test/api/voice/tts')
        expect(await authorize(init.headers ?? {})).toBeNull()
        return audioResponse()
      },
    )

    const events: Array<Record<string, unknown>> = []
    await synthesizeOnce(events, true)

    expect(events.some((e) => e.event === 'task.start')).toBe(true)
    expect(events.some((e) => e.event === 'audio.done')).toBe(true)
    expect(events.some((e) => e.event === 'task.error')).toBe(false)

    // 凭证是现签的服务主体 JWT,不是硬编码 token,也不是匿名
    const headers = (mockFetch.mock.calls[0]![1] as { headers: Record<string, string> }).headers
    const token = (headers.Authorization ?? '').replace(/^Bearer /, '')
    const payload = (
      await jwtVerify(token, SECRET, { issuer: 'ihui-ai', audience: 'ihui-ai-users' })
    ).payload
    expect(payload.sub).toBe('system-worker')
    expect(token.startsWith('ey')).toBe(true)

    // 成功路径不该出现免费引擎失败告警
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('凭证缺失 → 服务端 401,显式告警 + task.error,且不静默降级', async () => {
    mockFetch.mockImplementation(
      async (_input: string, init: { headers?: Record<string, string> }) => {
        const reason = await authorize(init.headers ?? {})
        return reason ? new Response(reason, { status: 401 }) : audioResponse()
      },
    )

    const events: Array<Record<string, unknown>> = []
    // 无 query.token:aiServiceFetch 不再注入系统凭证 —— 模拟配置缺失的裸奔形态
    await synthesizeOnce(events, false)

    expect(events.some((e) => e.event === 'task.error')).toBe(true)
    expect(events.some((e) => e.event === 'audio.done')).toBe(false)
    const warn = mockLoggerWarn.mock.calls.find(
      (c) => (c[1] as { code?: string } | undefined)?.code === 'TTS_FREE_ENGINE_AUTH_FAILED',
    )
    expect(warn).toBeDefined()
    expect(warn![1]).toMatchObject({
      code: 'TTS_FREE_ENGINE_AUTH_FAILED',
      endpoint: '/api/voice/tts',
      userId: USER_ID,
      degraded: false,
      fallback: 'none',
    })
    // 未配 DashScope 时只允许一次 ai-service 调用,不存在"偷偷换个通道成功"
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('凭证过期 → 服务端 401,失败原因带进日志(不是静默成功)', async () => {
    mockFetch.mockImplementation(async () => new Response('expired_credential', { status: 401 }))

    const events: Array<Record<string, unknown>> = []
    await synthesizeOnce(events, true)

    expect(events.some((e) => e.event === 'task.error')).toBe(true)
    const warn = mockLoggerWarn.mock.calls.find(
      (c) => (c[1] as { code?: string } | undefined)?.code === 'TTS_FREE_ENGINE_AUTH_FAILED',
    )
    expect(warn).toBeDefined()
    expect(String((warn![1] as { detail?: string }).detail)).toContain('expired_credential')
  })

  it('凭证错误(403)→ 归入鉴权失败码,不按引擎不可用处理', async () => {
    mockFetch.mockImplementation(async () => new Response('forbidden', { status: 403 }))

    const events: Array<Record<string, unknown>> = []
    await synthesizeOnce(events, true)

    expect(events.some((e) => e.event === 'task.error')).toBe(true)
    const warn = mockLoggerWarn.mock.calls.find(
      (c) => (c[1] as { code?: string } | undefined)?.code === 'TTS_FREE_ENGINE_AUTH_FAILED',
    )
    expect(warn).toBeDefined()
    expect(String((warn![1] as { detail?: string }).detail)).toContain('status=403')
  })

  it('配置 DashScope → 允许降级,但必须留下降级告警(含原因与去向)', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-dashscope-key'
    mockFetch.mockImplementation(async (input: string) => {
      if (String(input).includes('dashscope')) return audioResponse()
      return new Response('unauthorized', { status: 401 })
    })

    const events: Array<Record<string, unknown>> = []
    await synthesizeOnce(events, true)

    expect(events.some((e) => e.event === 'audio.done')).toBe(true)
    // 免费引擎失败 + 降级成功,两条告警都必须有(不能被"用户听到声音"掩盖)
    const authWarn = mockLoggerWarn.mock.calls.find(
      (c) => (c[1] as { code?: string } | undefined)?.code === 'TTS_FREE_ENGINE_AUTH_FAILED',
    )
    expect(authWarn).toBeDefined()
    expect(authWarn![1]).toMatchObject({ degraded: true, fallback: 'dashscope' })
    const degraded = mockLoggerWarn.mock.calls.find(
      (c) => (c[1] as { code?: string } | undefined)?.code === 'TTS_DEGRADED_TO_DASHSCOPE',
    )
    expect(degraded).toBeDefined()
    expect(degraded![1]).toMatchObject({
      cause: 'TTS_FREE_ENGINE_AUTH_FAILED',
      endpoint: '/api/voice/tts',
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
