// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-119 回归锁(2026-11-08)。
 *
 * 缺陷:GET /kling/task/query/:taskId 每次轮询到 succeed 都扣 1500 token(无幂等),
 *      且不校验 taskId 归属,他人 taskId 可读结果。
 * 判据:同一任务多次轮询只扣一次;非创建者查询 → 404;未知 taskId → 404。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  fetchWithTimeout: vi.fn(),
  createTask: vi.fn((userId: string, vendor: string, type: string, payload: unknown) => ({
    taskId: 'internal-1',
    userId,
    vendor,
    type,
    status: 'pending',
    result: payload,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })),
  recordUsage: vi.fn(),
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({ wsUpgradeRequiresCredential: () => () => undefined }))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))
vi.mock('jose', () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this
    }
    setIssuer() {
      return this
    }
    setExpirationTime() {
      return this
    }
    setNotBefore() {
      return this
    }
    async sign() {
      return 'jwt'
    }
  },
}))
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((s: TemplateStringsArray) => ({ sql: s.join('') }), { raw: (x: string) => x }),
}))
vi.mock('../src/utils/swagger.js', () => ({ buildSchema: (o: unknown) => o }))
vi.mock('../src/utils/crypto-random.js', () => ({ generateCompactId: () => 'gen-id' }))
vi.mock('../src/utils/n8n-env.js', () => ({
  readN8nBaseUrl: () => undefined,
  n8nBaseHint: () => '',
  resolveN8nWebhookUrl: () => undefined,
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(async () => ({})),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('../src/db/video-task-queries.js', () => ({
  createVideoTask: vi.fn(),
  findVideoTasksByUser: vi.fn(),
  findVideoTaskById: vi.fn(),
  updateVideoTask: vi.fn(),
}))
vi.mock('../src/routes/ai-vendors/_shared.js', () => ({
  requireAuth: vi.fn(async () => true),
  callVendor: vi.fn(),
  recordUsage: mocks.recordUsage,
  createTask: mocks.createTask,
  requireVendorKey: vi.fn(() => true),
  requireVendorKeys: vi.fn(() => true),
  fetchWithTimeout: mocks.fetchWithTimeout,
  volcengineSign: vi.fn(),
  pollVolcengineTask: vi.fn(),
  pageSizeQuery: z.object({}),
  botIdParam: z.object({ botId: z.string() }),
  tokenQuery: z.object({ token: z.string().optional() }),
  jimengBody: z.object({}),
  taskIdParam: z.object({ taskId: z.string() }),
  n8nAgentStore: new Map(),
  genId: (p: string) => `${p}-id`,
}))
vi.mock('../src/config/body-limits.js', () => ({ MEDIA_BASE64_BODY_LIMIT: 1024 }))

import { toolsVendorRoutes } from '../src/routes/ai-vendors/proxy-tools.js'

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const deductTokens = vi.fn()
const server = {
  addHook: () => undefined,
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
  delete: (p: string, ...a: unknown[]) => handlers.set(`DELETE ${p}`, a[a.length - 1] as Handler),
  tokenBalance: { deductTokens },
}
await toolsVendorRoutes(server as never, {} as never)

function makeReply() {
  return {
    statusCode: 200,
    body: undefined as unknown,
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

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload }
}

let seq = 0
async function createTaskAs(userId: string): Promise<string> {
  const taskId = `ext-${++seq}`
  mocks.fetchWithTimeout.mockResolvedValueOnce(okJson({ code: 0, data: { task_id: taskId } }))
  const reply = makeReply()
  await handlers.get('POST /kling/task/create')!(
    { userId, body: { sessionId: 's1', faceChoose: [{ faceId: 'f1' }] } },
    reply,
  )
  expect(reply.statusCode).toBe(200)
  return taskId
}

beforeEach(() => {
  process.env.KLING_ACCESS_KEY = 'ak'
  process.env.KLING_SECRET_KEY = 'sk'
  mocks.fetchWithTimeout.mockReset()
  deductTokens.mockReset().mockResolvedValue({ balance: 8500 })
})

const SUCCEED = {
  code: 0,
  data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://v/1.mp4' }] } },
}

describe('F-119 轮询幂等扣费', () => {
  it('同一任务连续轮询两次,只扣一次 1500', async () => {
    const taskId = await createTaskAs('u1')
    mocks.fetchWithTimeout.mockResolvedValue(okJson(SUCCEED))
    for (let i = 0; i < 2; i++) {
      const reply = makeReply()
      await handlers.get('GET /kling/task/query/:taskId')!(
        { userId: 'u1', params: { taskId } },
        reply,
      )
      expect(reply.statusCode).toBe(200)
    }
    expect(deductTokens).toHaveBeenCalledTimes(1)
    expect(deductTokens).toHaveBeenCalledWith('u1', 1500, 'kling_lip_sync')
  })
})

describe('F-119 任务归属', () => {
  it('他人 taskId → 404 且不查上游、不扣费', async () => {
    const taskId = await createTaskAs('u1')
    mocks.fetchWithTimeout.mockClear()
    const reply = makeReply()
    await handlers.get('GET /kling/task/query/:taskId')!(
      { userId: 'u2', params: { taskId } },
      reply,
    )
    expect(reply.statusCode).toBe(404)
    expect(mocks.fetchWithTimeout).not.toHaveBeenCalled()
    expect(deductTokens).not.toHaveBeenCalled()
  })

  it('未知 taskId → 404', async () => {
    const reply = makeReply()
    await handlers.get('GET /kling/task/query/:taskId')!(
      { userId: 'u1', params: { taskId: 'never-created' } },
      reply,
    )
    expect(reply.statusCode).toBe(404)
    expect(mocks.fetchWithTimeout).not.toHaveBeenCalled()
  })
})
