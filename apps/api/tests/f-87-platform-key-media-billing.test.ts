// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-87 平台 Key 媒体端点计费回归锁(2026-11-25 收口后重写)。
 *
 * 判据:
 *   - images / speech / transcriptions 调用前走 `ensureMediaPointsBalance`(按本次报价);
 *   - 成功后走 `chargeMediaPoints`,模型/类别/单位数透传正确;
 *   - GET /openai/responses/:id 只做零积读取闸,不额外扣费;
 *   - 源码里不得再出现 `FLAT_POINTS` / `chargeFlatPoints` 第二套价。
 *
 * 具体金额由 `media-billing.test.ts` 的纯函数单测钉住;本文件只锁路由接线。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'

const mediaMocks = vi.hoisted(() => ({
  ensureMediaPointsBalance: vi.fn(async () => true),
  chargeMediaPoints: vi.fn(async () => 20),
}))

const guardMocks = vi.hoisted(() => ({
  ensurePointsAvailable: vi.fn(async () => true),
}))

const vendorMocks = vi.hoisted(() => ({
  callVendor: vi.fn(),
  fetchWithTimeout: vi.fn(),
}))

vi.mock('../src/services/media-billing.js', () => ({
  ensureMediaPointsBalance: mediaMocks.ensureMediaPointsBalance,
  chargeMediaPoints: mediaMocks.chargeMediaPoints,
}))
vi.mock('../src/services/points-guard.js', () => ({
  ensurePointsAvailable: guardMocks.ensurePointsAvailable,
}))
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'u-f87'
    return true
  }),
  authenticate: vi.fn(async () => undefined),
}))
vi.mock('../src/routes/ai-vendors/_shared.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    callVendor: vendorMocks.callVendor,
    fetchWithTimeout: vendorMocks.fetchWithTimeout,
    recordUsage: vi.fn(),
  }
})

import { openaiCompatVendorRoutes } from '../src/routes/ai-vendors/proxy-openai-compat.js'

const source = readFileSync(
  fileURLToPath(new URL('../src/routes/ai-vendors/proxy-openai-compat.ts', import.meta.url)),
  'utf8',
)

/** 取两个锚点之间的源码片段(锚点缺失直接失败,避免断言静默落空) */
function section(start: string, end: string): string {
  const from = source.indexOf(start)
  expect(from, `缺少起始锚点: ${start}`).toBeGreaterThan(-1)
  const to = source.indexOf(end, from)
  expect(to, `缺少结束锚点: ${end}`).toBeGreaterThan(from)
  return source.slice(from, to)
}

type Handler = (request: unknown, reply: unknown) => unknown
type ReplyMock = {
  statusCode: number
  body: unknown
  status(c: number): ReplyMock
  send(b: unknown): ReplyMock
}

function makeReply(): ReplyMock {
  return {
    statusCode: 200,
    body: undefined,
    status(c: number) {
      this.statusCode = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

async function buildApp() {
  const app = Fastify({ logger: false })
  app.addHook('onRequest', async (request) => {
    ;(request as { userId?: string }).userId = 'u-f87'
  })
  await app.register(openaiCompatVendorRoutes)
  await app.ready()
  return app
}

// transcriptions 是 multipart 端点,直接调用 handler 比拼 inject 载荷更稳
const handlers = new Map<string, Handler>()
const fakeServer = {
  get: (path: string, ...args: unknown[]) =>
    handlers.set(`GET ${path}`, args[args.length - 1] as Handler),
  post: (path: string, ...args: unknown[]) =>
    handlers.set(`POST ${path}`, args[args.length - 1] as Handler),
}
await openaiCompatVendorRoutes(fakeServer as never, {} as never)

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-openai-key'
  mediaMocks.ensureMediaPointsBalance.mockReset().mockResolvedValue(true)
  mediaMocks.chargeMediaPoints.mockReset().mockResolvedValue(20)
  guardMocks.ensurePointsAvailable.mockReset().mockResolvedValue(true)
  vendorMocks.callVendor.mockReset().mockResolvedValue({ data: [{ url: 'https://img/1.png' }] })
  vendorMocks.fetchWithTimeout.mockReset()
})

describe('F-87 平台 Key 媒体端点余额闸', () => {
  it('images 媒体闸拒绝 → 402 且不打上游、不扣费', async () => {
    mediaMocks.ensureMediaPointsBalance.mockImplementation(async (_req, reply) => {
      ;(reply as ReplyMock).status(402).send({ code: 402 })
      return false
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/openai/images',
      payload: { prompt: 'cat', model: 'gpt-image-1', n: 2 },
    })
    expect(res.statusCode).toBe(402)
    expect(vendorMocks.callVendor).not.toHaveBeenCalled()
    expect(mediaMocks.chargeMediaPoints).not.toHaveBeenCalled()
    await app.close()
  })

  it('speech 媒体闸拒绝 → 402 且不打上游', async () => {
    mediaMocks.ensureMediaPointsBalance.mockImplementation(async (_req, reply) => {
      ;(reply as ReplyMock).status(402).send({ code: 402 })
      return false
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/openai/speech',
      payload: { model: 'tts-1', input: '你好' },
    })
    expect(res.statusCode).toBe(402)
    expect(vendorMocks.fetchWithTimeout).not.toHaveBeenCalled()
    expect(mediaMocks.chargeMediaPoints).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET /openai/responses/:id 零余额 → 402 且不打上游', async () => {
    guardMocks.ensurePointsAvailable.mockImplementation(async (_req, reply) => {
      ;(reply as ReplyMock).status(402).send({ code: 402 })
      return false
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/openai/responses/resp_123' })
    expect(res.statusCode).toBe(402)
    expect(vendorMocks.fetchWithTimeout).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('F-87 成功后走媒体报价', () => {
  it('images 成功 → chargeMediaPoints(model, image, n)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/openai/images',
      payload: { prompt: 'cat', model: 'gpt-image-1', n: 2 },
    })
    expect(res.statusCode).toBe(200)
    expect(vendorMocks.callVendor).toHaveBeenCalledTimes(1)
    expect(mediaMocks.chargeMediaPoints).toHaveBeenCalledTimes(1)
    expect(mediaMocks.chargeMediaPoints.mock.calls[0]).toEqual([
      expect.anything(),
      'gpt-image-1',
      'image',
      2,
      expect.any(String),
    ])
    await app.close()
  })

  it('非 openai 厂商(xai)的 images 同样按媒体报价扣费', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/xai/images',
      payload: { prompt: 'cat', model: 'grok-2-image' },
    })
    expect(res.statusCode).toBe(200)
    expect(mediaMocks.chargeMediaPoints).toHaveBeenCalledTimes(1)
    expect(mediaMocks.chargeMediaPoints.mock.calls[0]?.[1]).toBe('grok-2-image')
    expect(mediaMocks.chargeMediaPoints.mock.calls[0]?.[2]).toBe('image')
    await app.close()
  })

  it('speech 成功 → chargeMediaPoints(tts model, audio, 1)', async () => {
    vendorMocks.fetchWithTimeout.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/openai/speech',
      payload: { model: 'tts-1', input: '你好' },
    })
    expect(res.statusCode).toBe(200)
    expect(mediaMocks.chargeMediaPoints).toHaveBeenCalledTimes(1)
    expect(mediaMocks.chargeMediaPoints.mock.calls[0]?.[1]).toBe('tts-1')
    expect(mediaMocks.chargeMediaPoints.mock.calls[0]?.[2]).toBe('audio')
    await app.close()
  })

  it('GET /openai/responses/:id 余额充足 → 200 且不额外扣费', async () => {
    vendorMocks.fetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resp_123', status: 'completed' }),
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/openai/responses/resp_123' })
    expect(res.statusCode).toBe(200)
    expect(vendorMocks.fetchWithTimeout).toHaveBeenCalledTimes(1)
    expect(mediaMocks.chargeMediaPoints).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('F-87 transcriptions(直接 handler:multipart)', () => {
  function makeTranscriptionRequest() {
    return {
      userId: 'u-f87',
      id: 'req-stt',
      body: { model: 'whisper-1' },
      file: async () => ({
        mimetype: 'audio/mpeg',
        filename: 'a.mp3',
        toBuffer: async () => Buffer.from('fake-audio'),
      }),
    }
  }

  it('成功转写 → chargeMediaPoints(whisper-1, audio, 1)', async () => {
    vendorMocks.fetchWithTimeout.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ text: '转写结果' }),
    })
    const reply = makeReply()
    await handlers.get('POST /openai/transcriptions')!(makeTranscriptionRequest(), reply)
    expect(reply.statusCode).toBe(200)
    expect(mediaMocks.chargeMediaPoints).toHaveBeenCalledTimes(1)
    expect(mediaMocks.chargeMediaPoints.mock.calls[0]?.[1]).toBe('whisper-1')
    expect(mediaMocks.chargeMediaPoints.mock.calls[0]?.[2]).toBe('audio')
  })

  it('媒体闸拒绝 → 402 且不打上游', async () => {
    mediaMocks.ensureMediaPointsBalance.mockImplementation(async (_req, reply) => {
      ;(reply as ReplyMock).status(402).send({ code: 402 })
      return false
    })
    const reply = makeReply()
    await handlers.get('POST /openai/transcriptions')!(makeTranscriptionRequest(), reply)
    expect(reply.statusCode).toBe(402)
    expect(vendorMocks.fetchWithTimeout).not.toHaveBeenCalled()
    expect(mediaMocks.chargeMediaPoints).not.toHaveBeenCalled()
  })
})

describe('F-87 源码形状(防止回退成只 recordUsage 不扣费)', () => {
  const imagesSection = section('if (cap.images) {', '// ---- 2026-09-20 n12c')
  const speechSection = section("'/openai/speech'", '// POST /openai/transcriptions')
  const transcriptionSection = section("'/openai/transcriptions'", '// ---- 2026-09-21 n15a')
  const responsesGetSection = source.slice(source.indexOf("'/openai/responses/:responseId'"))

  it('images / speech / transcriptions 全部走媒体闸+媒体扣费', () => {
    for (const body of [imagesSection, speechSection, transcriptionSection]) {
      expect(body).toContain('ensureMediaPointsBalance(')
      expect(body).toContain('chargeMediaPoints(')
      expect(body).not.toContain('chargePointsForCall(')
      expect(body).not.toContain('ensurePointsBalance(')
    }
  })

  it('GET /openai/responses/:id 有零积读取闸且不额外扣费', () => {
    expect(responsesGetSection).toContain('ensurePointsAvailable(request, reply)')
    expect(responsesGetSection).not.toContain('chargeMediaPoints(')
    expect(responsesGetSection).not.toContain('chargePointsForCall(')
  })

  it('全文件不再残留旧固定价', () => {
    expect(source).not.toContain('FLAT_POINTS')
    expect(source).not.toContain('chargeFlatPoints')
    expect(source.match(/ensureMediaPointsBalance\(/g) ?? []).toHaveLength(3)
    expect(source.match(/chargeMediaPoints\(/g) ?? []).toHaveLength(3)
    expect(source.match(/ensurePointsAvailable\(request, reply\)/g) ?? []).toHaveLength(1)
    expect(source.match(/chargePointsForCall\(request,/g) ?? []).toHaveLength(3)
    expect(source.match(/ensurePointsBalance\(request, reply,/g) ?? []).toHaveLength(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
