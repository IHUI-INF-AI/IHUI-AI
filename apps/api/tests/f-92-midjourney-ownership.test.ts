// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-92 回归 —— Midjourney 任务状态/操作端点必须校验任务归属。
 *
 * 缺陷:任意 API Key(generation:write)可用平台 MJ Key 查询/操作**任意** taskId,
 * 跨租户读取他人 prompt 与图片 URL。
 *
 * 本文件钉住:
 *  ① 本人提交后可按 taskId 查询(含同一 userId 的另一把 Key —— 归属判据是 userId);
 *  ② 他人查询/action/upscale 一律 404,且**不触达上游**;
 *  ③ 无归属映射的历史任务 fail-closed 404;
 *  ④ action/upscale 产生的新子任务绑定到调用者,本人后续可查;
 *  ⑤ 归属读写异常(Redis 不可用)也 fail-closed;
 *  ⑥ 上游去重返回同一 taskId 时,NX 写入保证先提交者不被后来者顶掉归属。
 *
 * 零连库、零真实 Redis、零真实上游:归属落点在既有 Redis,测试用仓内唯一内存替身
 * `src/testing/fake-redis.ts` 挂到 fastify 实例的 redis 属性上(与 f-72 同形)。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import type { AuthenticatedApiKey } from '@ihui/types'
import { createFakeRedisState, makeFakeRedisClass } from '../src/testing/fake-redis.js'

const { mockRequireApiKeyAuth, mockQuotaGate, mockCapabilityRule, mockRecordCall } = vi.hoisted(
  () => ({
    mockRequireApiKeyAuth: vi.fn(),
    mockQuotaGate: vi.fn(),
    mockCapabilityRule: vi.fn(),
    mockRecordCall: vi.fn(),
  }),
)

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: mockRequireApiKeyAuth,
  requireApiKeyQuota: () => mockQuotaGate,
}))

vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapabilityRules: () => mockCapabilityRule,
}))

vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: mockRecordCall,
}))

// 路由模块在 import 期读取上游 env(模块级常量),必须先落值再动态 import。
process.env.MIDJOURNEY_PROXY_BASE = 'http://mj.test'
process.env.MIDJOURNEY_PROXY_API_KEY = 'mj-test-key'
const { default: midjourneyRoutes } = await import('../src/routes/v1-midjourney.js')

const redisState = createFakeRedisState()
const FakeRedisClass = makeFakeRedisClass(redisState)
const fakeRedis = new FakeRedisClass()

function apiKeyOf(id: string, userId: string): AuthenticatedApiKey {
  return { id, userId } as unknown as AuthenticatedApiKey
}

const KEY_A = apiKeyOf('key-a', 'user-a')
/** 同一用户的另一把 Key:归属按 userId,轮换 Key 不应误伤本人。 */
const KEY_A2 = apiKeyOf('key-a2', 'user-a')
const KEY_B = apiKeyOf('key-b', 'user-b')

let currentApiKey: AuthenticatedApiKey = KEY_A
let app: FastifyInstance

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

/** 上游固定返回:提交类端点各自给一个新 taskId,task 详情按 URL 里的 id 回显。 */
const fetchMock = vi.fn(async (input: string): Promise<Response> => {
  if (input.endsWith('/mj/submit/imagine')) {
    return jsonResponse({ code: 1, description: 'ok', result: 'task-imagine' })
  }
  if (input.endsWith('/mj/submit/action')) {
    return jsonResponse({ code: 1, description: 'ok', result: 'task-action-child' })
  }
  if (input.endsWith('/mj/submit/upscale')) {
    return jsonResponse({ code: 1, description: 'ok', result: 'task-upscale-child' })
  }
  const m = /\/mj\/task\/(.+)$/.exec(input)
  if (m) {
    return jsonResponse({
      id: decodeURIComponent(m[1] ?? ''),
      status: 'SUCCESS',
      imageUrl: 'https://cdn.test/img.png',
      progress: '100%',
    })
  }
  throw new Error(`未预期的上游请求: ${input}`)
})

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  app = Fastify({ logger: false })
  await app.register(midjourneyRoutes)
  // handler 在请求期读 server.redis;生产由 redis 插件 decorate,测试注入内存替身。
  ;(app as unknown as { redis?: unknown }).redis = fakeRedis
  await app.ready()
})

afterAll(async () => {
  await app.close()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  redisState.store.clear()
  redisState.calls.length = 0
  redisState.failures.clear()
  fetchMock.mockClear()
  currentApiKey = KEY_A
  mockRequireApiKeyAuth.mockImplementation(async (request: FastifyRequest) => {
    request.apiKey = currentApiKey
  })
  // 三个闸位显式给 async 实现:未实现的 vi.fn() 在此版 Fastify 的 preHandler 链上不会续行
  mockQuotaGate.mockImplementation(async () => {})
  mockCapabilityRule.mockImplementation(async () => {})
  mockRecordCall.mockResolvedValue({
    logId: 'log-1',
    costCents: 0,
    newTokenBalance: 0,
    newCostBalanceCents: 0,
  })
})

async function submitImagine(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/midjourney/imagine',
    payload: { prompt: 'a cat' },
  })
  expect(res.statusCode).toBe(200)
  const body = res.json() as { code: number; data: { task_id: string } }
  expect(body.code).toBe(0)
  return body.data.task_id
}

describe('F-92 Midjourney 任务归属校验', () => {
  it('本人提交后可按 taskId 查询自己的任务', async () => {
    const taskId = await submitImagine()
    expect(taskId).toBe('task-imagine')

    fetchMock.mockClear()
    const res = await app.inject({ method: 'GET', url: `/v1/midjourney/tasks/${taskId}` })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; data: { task_id: string; image_url: string } }
    expect(body.code).toBe(0)
    expect(body.data.task_id).toBe(taskId)
    expect(body.data.image_url).toBe('https://cdn.test/img.png')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('同一 userId 的另一把 API Key 仍可查询(归属判据是 userId)', async () => {
    const taskId = await submitImagine()

    currentApiKey = KEY_A2
    fetchMock.mockClear()
    const res = await app.inject({ method: 'GET', url: `/v1/midjourney/tasks/${taskId}` })

    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('他人查询 → 404 且不触达上游', async () => {
    const taskId = await submitImagine()

    currentApiKey = KEY_B
    fetchMock.mockClear()
    const res = await app.inject({ method: 'GET', url: `/v1/midjourney/tasks/${taskId}` })

    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('无归属映射的历史任务 fail-closed → 404 且不触达上游', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/midjourney/tasks/legacy-task-without-mapping',
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('他人的任务不能 action/upscale → 404 且不触达上游', async () => {
    const taskId = await submitImagine()

    currentApiKey = KEY_B
    fetchMock.mockClear()

    const actionRes = await app.inject({
      method: 'POST',
      url: '/v1/midjourney/action',
      payload: { task_id: taskId, action_type: 'upscale', index: 1 },
    })
    expect(actionRes.statusCode).toBe(404)
    expect(actionRes.json().code).toBe(404)

    const upscaleRes = await app.inject({
      method: 'POST',
      url: '/v1/midjourney/upscale',
      payload: { task_id: taskId, index: 1 },
    })
    expect(upscaleRes.statusCode).toBe(404)
    expect(upscaleRes.json().code).toBe(404)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('本人 action 成功,新子任务绑定到本人并可继续查询', async () => {
    const taskId = await submitImagine()

    const actionRes = await app.inject({
      method: 'POST',
      url: '/v1/midjourney/action',
      payload: { task_id: taskId, action_type: 'variation', index: 1 },
    })
    expect(actionRes.statusCode).toBe(200)
    const actionBody = actionRes.json() as { data: { task_id: string } }
    expect(actionBody.data.task_id).toBe('task-action-child')

    const childRes = await app.inject({
      method: 'GET',
      url: `/v1/midjourney/tasks/${actionBody.data.task_id}`,
    })
    expect(childRes.statusCode).toBe(200)
    expect(childRes.json().data.task_id).toBe('task-action-child')
  })

  it('归属读取异常(Redis 不可用)按 fail-closed → 404', async () => {
    const taskId = await submitImagine()

    redisState.failures.add('get')
    fetchMock.mockClear()
    const res = await app.inject({ method: 'GET', url: `/v1/midjourney/tasks/${taskId}` })

    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('上游去重返回同一 taskId 时,后来者不能顶掉先提交者的归属', async () => {
    const first = await submitImagine()
    expect(first).toBe('task-imagine')

    // user-b 提交后上游去重返回了同一个 taskId
    currentApiKey = KEY_B
    const second = await submitImagine()
    expect(second).toBe('task-imagine')

    // 先行者仍是 owner,后来者查询 404
    currentApiKey = KEY_A
    const ownerRes = await app.inject({ method: 'GET', url: '/v1/midjourney/tasks/task-imagine' })
    expect(ownerRes.statusCode).toBe(200)

    currentApiKey = KEY_B
    const otherRes = await app.inject({ method: 'GET', url: '/v1/midjourney/tasks/task-imagine' })
    expect(otherRes.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
