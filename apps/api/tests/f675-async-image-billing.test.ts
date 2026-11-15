// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-675 回归锁 —— 异步生图创建必须按次扣费,不得零计费。
 *
 * 缺陷:POST /v1/images/generations/async 只有 requireApiKeyQuota 余额校验,
 * 全程无 recordCall/charge ⇒ 持 images:write 的 Key 可无限提交异步生图,
 * 平台承担 100% 上游成本,无 llm_call_logs、无扣费、无审计。
 *
 * 修法:创建任务成功后立即乐观按次扣费(callType=image,billingUnits=1,
 * metadata.task_id 挂任务号对账),与 3D(F-276)/视频分支同口径。
 *
 * 本夹具零连库、零真实 Redis、零真实上游:任务存储用 FakeRedis,recordCall mock。
 */
import type { Redis } from 'ioredis'
import type * as RelayBilling from '../src/services/relay-billing-service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

const KEY_ID = 'key-img-675-4000-8000-000000000001'
const USER_ID = 'user-img-675-4000-8000-0000000000aa'

process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: async (request: { apiKey?: unknown }) => {
    request.apiKey = { id: KEY_ID, userId: USER_ID }
  },
  requireApiKeyQuota: () => async () => undefined,
}))
vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapability: () => async () => undefined,
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbScoped: {}, dbReadScoped: {} }))

const spies = vi.hoisted(() => ({
  recordCall: vi.fn(async () => ({
    logId: 'log-1',
    costCents: 0,
    newTokenBalance: 0,
    newCostBalanceCents: 0,
  })),
}))

vi.mock('../src/services/relay-billing-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RelayBilling>()
  return { ...actual, recordCall: spies.recordCall }
})

const v1Multimodal = await import('../src/routes/v1-multimodal.js')
const v1MultimodalRoutes = v1Multimodal.default
const __setImageTaskRedisForTest = v1Multimodal.__setImageTaskRedisForTest

/** 仅实现本票用到的命令:set / get / del / keys。 */
class FakeRedis {
  readonly store = new Map<string, string>()
  async set(key: string, value: string, ..._rest: unknown[]): Promise<'OK' | null> {
    this.store.set(key, value)
    return 'OK'
  }
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }
  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern
    return [...this.store.keys()].filter((k) => k.startsWith(prefix))
  }
}

describe('F-675 /v1/images/generations/async 创建按次扣费', () => {
  const server = Fastify({ logger: false })
  let redis: FakeRedis

  beforeEach(async () => {
    redis = new FakeRedis()
    __setImageTaskRedisForTest(redis as unknown as Redis)
    spies.recordCall.mockClear()
    if (!server.hasRoute({ method: 'POST', url: '/v1/images/generations/async' })) {
      await server.register(v1MultimodalRoutes, { prefix: '/v1' })
      await server.ready()
    }
  })

  it('创建任务成功 → recordCall 按次扣费(callType=image, billingUnits=1, task_id 挂任务号)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/images/generations/async',
      body: { model: 'gpt-image-1', prompt: 'a cube' },
    })
    expect(res.statusCode).toBe(202)
    const body = res.json() as { id: string; status: string }
    expect(body.status).toBe('pending')
    await vi.waitFor(() => expect(spies.recordCall).toHaveBeenCalledTimes(1))
    expect(spies.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: KEY_ID,
        userId: USER_ID,
        model: 'gpt-image-1',
        callType: 'image',
        billingUnits: 1,
        metadata: expect.objectContaining({
          endpoint: 'v1_images_generations_async',
          task_id: body.id,
        }),
      }),
    )
    // 任务确实已落存储,且记录了 apiKeyId 便于对账
    const raw = redis.store.get(`imgtask:${body.id}`)
    expect(raw).toBeTruthy()
    const task = JSON.parse(raw!) as { apiKeyId?: string; userId?: string }
    expect(task.apiKeyId).toBe(KEY_ID)
    expect(task.userId).toBe(USER_ID)
  })

  it('连续创建两单 → 两次独立扣费(不再零计费漏损)', async () => {
    await server.inject({
      method: 'POST',
      url: '/v1/images/generations/async',
      body: { model: 'gpt-image-1', prompt: 'a' },
    })
    await server.inject({
      method: 'POST',
      url: '/v1/images/generations/async',
      body: { model: 'gpt-image-1', prompt: 'b' },
    })
    await vi.waitFor(() => expect(spies.recordCall).toHaveBeenCalledTimes(2))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
