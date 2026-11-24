// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-105 回归锁(2026-11-08)。
 *
 * 缺陷:一键视频编排用平台 Key 四步串行、零计费;taskStore 只增不删;
 *      callVendor 失败已 send 502 后调用方仍 send success(二次回包)。
 * 判据:余额<=0 → 402;成功后扣 30 分;失败只回包一次且为 502;过期任务被清理。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUserPoints: vi.fn(),
  spendPoints: vi.fn(),
  callVendor: vi.fn(),
  seq: 0,
}))

vi.mock('../src/db/gamification-queries.js', () => ({ findUserPoints: mocks.findUserPoints }))
vi.mock('../src/services/points-service.js', () => ({ spendPoints: mocks.spendPoints }))
vi.mock('../src/routes/ai-vendors/_shared.js', () => ({
  requireAuth: vi.fn(async () => true),
  callVendor: mocks.callVendor,
  recordUsage: vi.fn(),
  genId: (prefix: string) => `${prefix}_${++mocks.seq}`,
}))

import {
  aiVideoComposeRoutes,
  pruneTaskStore,
  TASK_TTL_MS,
} from '../src/routes/ai-video-compose.js'

type ReplyMock = {
  statusCode: number
  body: unknown
  sent: boolean
  sendCount: number
  status(c: number): ReplyMock
  send(b: unknown): ReplyMock
}

function makeReply(): ReplyMock {
  return {
    statusCode: 200,
    body: undefined,
    sent: false,
    sendCount: 0,
    status(c: number) {
      this.statusCode = c
      return this
    },
    send(b: unknown) {
      this.sendCount += 1
      this.body = b
      this.sent = true
      return this
    },
  }
}

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const server = {
  addHook: () => undefined,
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
}
await aiVideoComposeRoutes(server as never, {} as never)

const REQUEST = { userId: 'u1', id: 'req-v' }

beforeEach(() => {
  mocks.findUserPoints.mockReset().mockResolvedValue({ points: 100 })
  mocks.spendPoints.mockReset().mockResolvedValue({ balance: 70 })
  mocks.callVendor.mockReset()
})

describe('F-105 余额闸与结算', () => {
  it('余额 0 → 402 且不调用上游', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const reply = makeReply()
    await handlers.get('POST /')!({ ...REQUEST, body: { prompt: '做一条视频' } }, reply)
    expect(reply.statusCode).toBe(402)
    expect(mocks.callVendor).not.toHaveBeenCalled()
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })

  it('四步全部成功 → 201 且扣 30 分一次', async () => {
    mocks.callVendor.mockResolvedValue({ output: { ok: true } })
    const reply = makeReply()
    await handlers.get('POST /')!({ ...REQUEST, body: { prompt: '做一条视频' } }, reply)
    expect(reply.statusCode).toBe(201)
    expect(mocks.callVendor).toHaveBeenCalledTimes(4)
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      30,
      'ai_call',
      expect.stringContaining('视频编排'),
      'req-v',
    )
  })
})

describe('F-105 失败路径', () => {
  it('首步失败:上游已回 502,handler 不得二次回包', async () => {
    mocks.callVendor.mockImplementation(async (_v: string, _u: string, reply: ReplyMock) => {
      reply.status(502).send({ code: 502, message: '上游失败' })
      return null
    })
    const reply = makeReply()
    await handlers.get('POST /')!({ ...REQUEST, body: { prompt: '做一条视频' } }, reply)
    expect(reply.statusCode).toBe(502)
    expect(reply.sendCount).toBe(1)
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })
})

describe('F-105 taskStore 回收', () => {
  it('超过 TTL 的任务被清理,查询返回 404', async () => {
    mocks.callVendor.mockResolvedValue({ output: { ok: true } })
    const createReply = makeReply()
    await handlers.get('POST /')!({ ...REQUEST, body: { prompt: '做一条视频' } }, createReply)
    const id = (createReply.body as { data: { id: string } }).data.id

    const before = makeReply()
    await handlers.get('GET /:id')!({ userId: 'u1', params: { id } }, before)
    expect(before.statusCode).toBe(200)

    pruneTaskStore(Date.now() + TASK_TTL_MS + 1)

    const after = makeReply()
    await handlers.get('GET /:id')!({ userId: 'u1', params: { id } }, after)
    expect(after.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
