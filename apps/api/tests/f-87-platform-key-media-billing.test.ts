// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-87 平台 Key 媒体端点计费回归锁(2026-11-11)。
 *
 * 病灶:proxy-openai-compat 的 images / speech / transcriptions 走平台 Key,
 *      上游响应没有 token usage ⇒ 旧的 chargePointsForCall 恒被跳过,只挡零余额不扣分;
 *      GET /openai/responses/:id 更是连余额闸都没有。
 * 判据:
 *   - 媒体类端点(images/speech/transcriptions)调用前 ensurePointsAvailable(不看 model 名);
 *   - 成功后按 points-guard 的固定单价扣费:images = FLAT_POINTS.image * n,音频 = FLAT_POINTS.audio;
 *   - GET /openai/responses/:id 只做余额闸、不额外扣费。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'

const mocks = vi.hoisted(() => ({
  spendPoints: vi.fn(async () => ({ balance: 0 })),
  findUserPoints: vi.fn(async () => ({ points: 100 })),
  callVendor: vi.fn(),
  fetchWithTimeout: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({ spendPoints: mocks.spendPoints }))
vi.mock('../src/db/gamification-queries.js', () => ({ findUserPoints: mocks.findUserPoints }))
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
    callVendor: mocks.callVendor,
    fetchWithTimeout: mocks.fetchWithTimeout,
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
  // 路由本身不挂全局鉴权(生产由父插件注入),这里直接补 userId
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
  mocks.findUserPoints.mockReset().mockResolvedValue({ points: 100 })
  mocks.spendPoints.mockReset().mockResolvedValue({ balance: 90 })
  mocks.callVendor.mockReset().mockResolvedValue({ data: [{ url: 'https://img/1.png' }] })
  mocks.fetchWithTimeout.mockReset()
})

describe('F-87 平台 Key 媒体端点余额闸(不依赖 model 名)', () => {
  it('images 零余额 + 免费模型名 → 402 且不打上游、不扣费', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/openai/images',
      payload: { prompt: 'cat', model: 'ollama/llama', n: 1 },
    })
    expect(res.statusCode).toBe(402)
    expect(mocks.callVendor).not.toHaveBeenCalled()
    expect(mocks.spendPoints).not.toHaveBeenCalled()
    await app.close()
  })

  it('speech 零余额 → 402 且不打上游', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/openai/speech',
      payload: { model: 'tts-1', input: '你好' },
    })
    expect(res.statusCode).toBe(402)
    expect(mocks.fetchWithTimeout).not.toHaveBeenCalled()
    expect(mocks.spendPoints).not.toHaveBeenCalled()
    await app.close()
  })

  it('GET /openai/responses/:id 零余额 → 402 且不打上游', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/openai/responses/resp_123' })
    expect(res.statusCode).toBe(402)
    expect(mocks.fetchWithTimeout).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('F-87 成功后按固定单价扣费', () => {
  it('images 成功 → 扣 FLAT_POINTS.image * n(10 * 2 = 20)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/openai/images',
      payload: { prompt: 'cat', model: 'gpt-image-1', n: 2 },
    })
    expect(res.statusCode).toBe(200)
    expect(mocks.callVendor).toHaveBeenCalledTimes(1)
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    const [userId, amount, kind, reason, referenceId] = mocks.spendPoints.mock.calls[0] as unknown[]
    expect(userId).toBe('u-f87')
    expect(amount).toBe(20)
    expect(kind).toBe('ai_call')
    expect(String(reason)).toContain('gpt-image-1')
    expect(String(reason)).toContain('n=2')
    expect(typeof referenceId).toBe('string')
    expect(referenceId).toBeTruthy()
    await app.close()
  })

  it('非 openai 厂商(xai)的 images 同样扣费(固定价在 vendor 循环内生效)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/xai/images',
      payload: { prompt: 'cat', model: 'grok-2-image' },
    })
    expect(res.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    const [, amount, , reason] = mocks.spendPoints.mock.calls[0] as unknown[]
    expect(amount).toBe(10)
    expect(String(reason)).toContain('vendor=xai')
    await app.close()
  })

  it('speech 成功 → 扣 FLAT_POINTS.audio(2),reason 写 model', async () => {
    mocks.fetchWithTimeout.mockResolvedValue({
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
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    const [userId, amount, kind, reason] = mocks.spendPoints.mock.calls[0] as unknown[]
    expect(userId).toBe('u-f87')
    expect(amount).toBe(2)
    expect(kind).toBe('ai_call')
    expect(String(reason)).toContain('tts-1')
    await app.close()
  })

  it('GET /openai/responses/:id 余额充足 → 200 且不额外扣费', async () => {
    mocks.fetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resp_123', status: 'completed' }),
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/openai/responses/resp_123' })
    expect(res.statusCode).toBe(200)
    expect(mocks.fetchWithTimeout).toHaveBeenCalledTimes(1)
    expect(mocks.spendPoints).not.toHaveBeenCalled()
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

  it('成功转写 → 扣 FLAT_POINTS.audio(2),reason 写 model', async () => {
    mocks.fetchWithTimeout.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ text: '转写结果' }),
    })
    const reply = makeReply()
    await handlers.get('POST /openai/transcriptions')!(makeTranscriptionRequest(), reply)
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    const [userId, amount, kind, reason] = mocks.spendPoints.mock.calls[0] as unknown[]
    expect(userId).toBe('u-f87')
    expect(amount).toBe(2)
    expect(kind).toBe('ai_call')
    expect(String(reason)).toContain('whisper-1')
  })

  it('零余额 → 402 且不打上游', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const reply = makeReply()
    await handlers.get('POST /openai/transcriptions')!(makeTranscriptionRequest(), reply)
    expect(reply.statusCode).toBe(402)
    expect(mocks.fetchWithTimeout).not.toHaveBeenCalled()
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })
})

describe('F-87 源码形状(防止回退成只 recordUsage 不扣费)', () => {
  const imagesSection = section('if (cap.images) {', '// ---- 2026-09-20 n12c')
  const speechSection = section("'/openai/speech'", '// POST /openai/transcriptions')
  const transcriptionSection = section("'/openai/transcriptions'", '// ---- 2026-09-21 n15a')
  const responsesGetSection = source.slice(source.indexOf("'/openai/responses/:responseId'"))

  it('images 走固定单价,且不再保留 token 计费(口径单一)', () => {
    expect(imagesSection).toContain('ensurePointsAvailable(request, reply)')
    expect(imagesSection).toContain('chargeFlatPoints(')
    expect(imagesSection).toContain('FLAT_POINTS.image * imageCount')
    expect(imagesSection).not.toContain('chargePointsForCall(')
    expect(imagesSection).not.toContain('ensurePointsBalance(')
  })

  it('speech / transcriptions 成功后都调用 chargeFlatPoints(FLAT_POINTS.audio)', () => {
    for (const body of [speechSection, transcriptionSection]) {
      expect(body).toContain('ensurePointsAvailable(request, reply)')
      expect(body).toContain('chargeFlatPoints(')
      expect(body).toContain('FLAT_POINTS.audio')
      expect(body).not.toContain('ensurePointsBalance(')
      // recordUsage 只是内存计数,后面必须跟固定价扣费
      expect(body).toMatch(/recordUsage\([\s\S]*?chargeFlatPoints\(/)
    }
  })

  it('GET /openai/responses/:id 有余额闸且不额外扣费', () => {
    expect(responsesGetSection).toContain('ensurePointsAvailable(request, reply)')
    expect(responsesGetSection).not.toContain('chargeFlatPoints(')
    expect(responsesGetSection).not.toContain('chargePointsForCall(')
  })

  it('全文件口径:媒体端点 4 处 ensurePointsAvailable、固定价扣费 3 处', () => {
    expect(source.match(/ensurePointsAvailable\(request, reply\)/g) ?? []).toHaveLength(4)
    expect(source.match(/chargeFlatPoints\(/g) ?? []).toHaveLength(3)
    // 仅 chat / embeddings / responses(POST)仍走 token 计费
    expect(source.match(/chargePointsForCall\(request,/g) ?? []).toHaveLength(3)
    expect(source.match(/ensurePointsBalance\(request, reply,/g) ?? []).toHaveLength(3)
  })
})
