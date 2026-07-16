import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { configMock } = vi.hoisted(() => ({
  configMock: { TENCENT_LIVE_CALLBACK_KEY: 'test-callback-key' },
}))

vi.mock('../../config/index.js', () => ({ config: configMock }))

const { mockUpdateStatus } = vi.hoisted(() => ({
  mockUpdateStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/live-queries.js', () => {
  return new Proxy({ updateLiveChannelStatusByStreamName: mockUpdateStatus }, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      if (prop === 'then') return undefined
      if (prop in target) return (target as Record<string, unknown>)[prop]
      return vi.fn()
    },
  })
})

import { liveRoutes } from '../live.js'
import {
  computeCallbackSignature,
  __resetProcessedEventIdsForTest,
} from '../../services/tencent-live-service.js'

const CALLBACK_KEY = 'test-callback-key'

function buildHeaders(rawBody: string, opts?: { timestamp?: string; nonce?: string; key?: string; tamper?: boolean }) {
  const timestamp = opts?.timestamp ?? String(Date.now())
  const nonce = opts?.nonce ?? 'nonce-abc'
  const key = opts?.key ?? CALLBACK_KEY
  let signature = computeCallbackSignature(timestamp, nonce, rawBody, key)
  if (opts?.tamper) {
    signature = signature.slice(0, -1) + (signature.slice(-1) === 'a' ? 'b' : 'a')
  }
  return {
    'content-type': 'application/json',
    'x-signature': signature,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
  }
}

function buildPayload(streamName: string, eventType: string): string {
  return JSON.stringify({ stream_id: streamName, event_type: eventType, t: String(Date.now()) })
}

describe('Tencent Live Callback Signature (P0-5)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(liveRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    configMock.TENCENT_LIVE_CALLBACK_KEY = CALLBACK_KEY
    mockUpdateStatus.mockClear()
    __resetProcessedEventIdsForTest()
  })

  it('正确签名通过 (200)', async () => {
    const body = buildPayload('stream-ok', 'stream_begin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers: buildHeaders(body),
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    const json = JSON.parse(res.payload)
    expect(json.code).toBe(0)
    expect(json.data.ok).toBe(true)
    expect(json.data.event).toBe('stream_begin')
  })

  it('错误签名拒绝 (403)', async () => {
    const body = buildPayload('stream-bad', 'stream_begin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers: {
        'content-type': 'application/json',
        'x-signature': 'invalid-signature-value',
        'x-timestamp': String(Date.now()),
        'x-nonce': 'nonce-bad',
      },
      payload: body,
    })
    expect(res.statusCode).toBe(403)
  })

  it('签名篡改(改 1 字符)验签失败 (403)', async () => {
    const body = buildPayload('stream-tamper', 'stream_begin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers: buildHeaders(body, { tamper: true }),
      payload: body,
    })
    expect(res.statusCode).toBe(403)
  })

  it('时间戳过期(超过 5 分钟)拒绝 (403)', async () => {
    const body = buildPayload('stream-expired', 'stream_begin')
    const expired = String(Date.now() - 6 * 60 * 1000)
    const res = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers: buildHeaders(body, { timestamp: expired }),
      payload: body,
    })
    expect(res.statusCode).toBe(403)
  })

  it('未配置回调密钥返回 503 (优雅降级)', async () => {
    configMock.TENCENT_LIVE_CALLBACK_KEY = ''
    const body = buildPayload('stream-nocfg', 'stream_begin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers: buildHeaders(body),
      payload: body,
    })
    expect(res.statusCode).toBe(503)
  })

  it('stream_begin 事件处理(更新直播状态为 isLive=true)', async () => {
    const body = buildPayload('stream-begin-evt', 'stream_begin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers: buildHeaders(body),
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpdateStatus).toHaveBeenCalledWith('stream-begin-evt', true)
  })

  it('stream_end 事件处理(更新直播状态为 isLive=false)', async () => {
    const body = buildPayload('stream-end-evt', 'stream_end')
    const res = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers: buildHeaders(body),
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpdateStatus).toHaveBeenCalledWith('stream-end-evt', false)
  })

  it('重复事件 ID 幂等(不重复更新状态)', async () => {
    const body = buildPayload('stream-dup', 'stream_begin')
    const headers = buildHeaders(body)
    const first = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers,
      payload: body,
    })
    expect(first.statusCode).toBe(200)
    expect(mockUpdateStatus).toHaveBeenCalledTimes(1)

    const second = await app.inject({
      method: 'POST',
      url: '/api/live/tencent/callback',
      headers,
      payload: body,
    })
    expect(second.statusCode).toBe(200)
    expect(mockUpdateStatus).toHaveBeenCalledTimes(1)
    const json = JSON.parse(second.payload)
    expect(json.data.duplicated).toBe(true)
  })
})
