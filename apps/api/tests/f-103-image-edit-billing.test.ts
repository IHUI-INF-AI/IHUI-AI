// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-103 回归锁(2026-11-08)。
 *
 * 缺陷:图片编辑 8 个生成端点直用平台 Key(DOUBAO/DASHSCOPE),无余额闸、无结算,
 *      model 由客户端任意指定,上游 200 但无图仍回 success。
 * 判据:余额<=0 → 402 且不打上游;成功 → 按次扣 10 分;非白名单模型 → 400;
 *      上游无图 → 502 且不扣分。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUserPoints: vi.fn(),
  spendPoints: vi.fn(),
  egress: vi.fn(),
}))

vi.mock('../src/db/gamification-queries.js', () => ({ findUserPoints: mocks.findUserPoints }))
vi.mock('../src/services/points-service.js', () => ({ spendPoints: mocks.spendPoints }))
vi.mock('../src/utils/proxy-dispatcher.js', () => ({
  directEgressFetch: mocks.egress,
  boundedOptionsFromRequestInit: (o: unknown) => o,
}))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => undefined),
}))
vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn(async () => [{ id: 'h1' }]) },
}))
vi.mock('@ihui/database', () => ({ zhsUserAgentImage: {} }))
vi.mock('drizzle-orm', () => ({
  sql: Object.assign(() => ({ tag: 'sql' }), { join: () => ({ tag: 'join' }) }),
  eq: () => ({ op: 'eq' }),
  and: () => ({ op: 'and' }),
  desc: () => ({ op: 'desc' }),
}))
vi.mock('../src/config/body-limits.js', () => ({ MEDIA_BASE64_BODY_LIMIT: 1024 }))

import { aiImageEditRoutes } from '../src/routes/ai-image-edit.js'

type ReplyMock = {
  statusCode: number
  body: unknown
  sent: boolean
  status(c: number): ReplyMock
  send(b: unknown): ReplyMock
}

function makeReply(): ReplyMock {
  return {
    statusCode: 200,
    body: undefined,
    sent: false,
    status(c: number) {
      this.statusCode = c
      return this
    },
    send(b: unknown) {
      this.body = b
      this.sent = true
      return this
    },
  }
}

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const server = {
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
  delete: (p: string, ...a: unknown[]) => handlers.set(`DELETE ${p}`, a[a.length - 1] as Handler),
}
await aiImageEditRoutes(server as never, {} as never)

const REQUEST = { userId: 'u1', id: 'req-1' }

beforeEach(() => {
  process.env.DOUBAO_API_KEY = 'test-doubao'
  process.env.DASHSCOPE_API_KEY = 'test-dashscope'
  mocks.findUserPoints.mockReset().mockResolvedValue({ points: 100 })
  mocks.spendPoints.mockReset().mockResolvedValue({ balance: 90 })
  mocks.egress.mockReset()
})

describe('F-103 余额闸', () => {
  it('余额为 0 → 402 且不调用上游', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const reply = makeReply()
    await handlers.get('POST /ai-image/doubao/edit')!(
      { ...REQUEST, body: { imageUrl: 'https://img/x.png', prompt: '蓝色背景' } },
      reply,
    )
    expect(reply.statusCode).toBe(402)
    expect(mocks.egress).not.toHaveBeenCalled()
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })
})

describe('F-103 成功结算', () => {
  it('豆包图片编辑成功 → 按次扣 10 分', async () => {
    mocks.egress.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://out/x.png' }] }),
    })
    const reply = makeReply()
    await handlers.get('POST /ai-image/doubao/edit')!(
      { ...REQUEST, body: { imageUrl: 'https://img/x.png', prompt: '蓝色背景' } },
      reply,
    )
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      10,
      'ai_call',
      expect.stringContaining('图片编辑'),
      'req-1',
    )
  })

  it('通义文生图成功 → 同样扣 10 分', async () => {
    mocks.egress.mockResolvedValue({
      ok: true,
      json: async () => ({ output: { task_id: 't1' } }),
    })
    const reply = makeReply()
    await handlers.get('POST /ai-image/tongyi/text-to-image')!(
      { ...REQUEST, body: { prompt: '海边日落' } },
      reply,
    )
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      10,
      'ai_call',
      expect.stringContaining('文生图'),
      'req-1',
    )
  })
})

describe('F-103 模型白名单与空结果', () => {
  it('非白名单模型 → 400,不打上游也不扣分', async () => {
    const reply = makeReply()
    await handlers.get('POST /ai-image/doubao/edit')!(
      { ...REQUEST, body: { imageUrl: 'https://img/x.png', prompt: 'x', model: 'gpt-5.6' } },
      reply,
    )
    expect(reply.statusCode).toBe(400)
    expect(mocks.egress).not.toHaveBeenCalled()
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })

  it('上游 200 但无图片地址 → 502 且不扣分', async () => {
    mocks.egress.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    const reply = makeReply()
    await handlers.get('POST /ai-image/doubao/edit')!(
      { ...REQUEST, body: { imageUrl: 'https://img/x.png', prompt: 'x' } },
      reply,
    )
    expect(reply.statusCode).toBe(502)
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })
})
