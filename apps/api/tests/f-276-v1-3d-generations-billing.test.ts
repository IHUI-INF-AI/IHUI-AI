/**
 * F-276 回归锁(2026-11-12,apps/api 安全子集 B)。
 *
 * 缺陷:/v1/3d/generations 只有次数窗口(requireApiKeyQuota),无 recordCall/退款 ——
 * 平台替调用者付腾讯混元 3D 调用费(漏损),且内部提交失败时无计费口径。
 * 判据:
 *  - 提交成功 → recordCall 按次扣费,metadata.task_id 挂内部 JobId;
 *  - 提交响应 Status=FAILED → 先扣后退,refundTaskCall(taskId);
 *  - 内部转发失败(5xx) → 不产生任何计费流水(失败零费用)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const KEY_ID = 'key-3d-0000-4000-8000-000000000001'
const USER_ID = 'user-3d-0000-4000-8000-0000000000aa'

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
  refundTaskCall: vi.fn(async () => ({ ok: true })),
  fetch: vi.fn(),
}))

vi.mock('../src/services/relay-billing-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/relay-billing-service.js')>()
  return { ...actual, recordCall: spies.recordCall, refundTaskCall: spies.refundTaskCall }
})

import v1MultimodalRoutes from '../src/routes/v1-multimodal.js'

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('F-276 /v1/3d/generations 3D 生成按次计费', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(v1MultimodalRoutes, { prefix: '/v1' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    spies.recordCall.mockClear()
    spies.refundTaskCall.mockClear()
    spies.fetch.mockReset()
    vi.stubGlobal('fetch', spies.fetch)
  })

  it('提交成功 → recordCall 按次扣费(metadata.task_id = 内部 JobId)', async () => {
    spies.fetch.mockResolvedValue(
      jsonResp(200, {
        code: 0,
        message: 'success',
        data: { JobId: 'job-abc-123', Status: 'SUCCESS' },
      }),
    )
    const res = await server.inject({
      method: 'POST',
      url: '/v1/3d/generations',
      body: { model: 'hunyuan-3d', input: 'a cube' },
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(spies.recordCall).toHaveBeenCalledTimes(1))
    expect(spies.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: KEY_ID,
        userId: USER_ID,
        model: 'hunyuan-3d',
        callType: 'image',
        billingUnits: 1,
        metadata: expect.objectContaining({
          endpoint: 'v1_3d_generations',
          task_id: 'job-abc-123',
        }),
      }),
    )
    expect(spies.refundTaskCall).not.toHaveBeenCalled()
  })

  it('内部提交失败(5xx) → 不产生任何计费流水(失败零费用)', async () => {
    spies.fetch.mockResolvedValue(jsonResp(502, { code: 502, message: 'upstream down' }))
    const res = await server.inject({
      method: 'POST',
      url: '/v1/3d/generations',
      body: { model: 'hunyuan-3d', input: 'a cube' },
    })
    expect(res.statusCode).toBe(502)
    expect(spies.recordCall).not.toHaveBeenCalled()
    expect(spies.refundTaskCall).not.toHaveBeenCalled()
  })

  it('提交响应 Status=FAILED → 先扣后退(refundTaskCall 立即全额退)', async () => {
    spies.fetch.mockResolvedValue(
      jsonResp(200, {
        code: 0,
        message: 'success',
        data: { JobId: 'job-failed-9', Status: 'FAILED' },
      }),
    )
    const res = await server.inject({
      method: 'POST',
      url: '/v1/3d/generations',
      body: { model: 'hunyuan-3d', input: 'a cube' },
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(spies.refundTaskCall).toHaveBeenCalledWith('job-failed-9'))
    expect(spies.recordCall).toHaveBeenCalledTimes(1)
  })
})
