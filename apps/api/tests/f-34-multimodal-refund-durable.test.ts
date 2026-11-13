// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-34 回归锁(2026-11-13)。
 *
 * 病灶:多模态任务失败退款是 fire-and-forget —— 调用方 `void refundTaskCall(id)` 丢弃返回值,
 * 函数顶层 catch 只 logger.error 并返回 refunded:false,既没有重试也没有补偿入口。
 * 更糟的是旧实现「先打 refunded=true 再改余额」:打标成功、加钱失败时该行永久不可重试,
 * 用户的付费在账面上"已退款",实际一分钱没回。
 *
 * 本文件钉住:
 *  ① 打标 + 加钱在同一事务内完成(任一失败整体回滚,绝不会留下不可重试的"假退款");
 *  ② 瞬时写库失败有界重试后成功(attempts 语义不变);
 *  ③ 持续失败不再静默:返回 reason='error',并把待补偿事实写进本行 metadata(既有 jsonb 列);
 *  ④ 累计失败达上限 → reason='exhausted'(转人工);
 *  ⑤ 退款目标余额行不存在(组/Key 被删)→ 按失败处理,不报"退款成功";
 *  ⑥ 路由侧:任务 failed 的轮询会等退款结果,未完成时写退款 DLQ(Redis),响应不受影响。
 *
 * 零连库、零真实 Redis:db / @ihui/database / 内部转发全部 mock。
 */
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'

const KEY_ID = 'key-f34-0000-4000-8000-000000000001'
const USER_ID = 'user-f34-0000-4000-8000-0000000000aa'

/** 表对象引用必须在 mock 之间共享(代码里用 `table === llmCallLogs` 分流)。 */
const tables = vi.hoisted(() => ({
  llmCallLogs: {
    id: 'id',
    metadata: 'metadata',
    callType: 'call_type',
    status: 'status',
    refunded: 'refunded',
    apiKeyId: 'api_key_id',
    costCents: 'cost_cents',
  },
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    tokenBalance: 'token_balance',
    costBalanceCents: 'cost_balance_cents',
    tokenUsedTotal: 'token_used_total',
    costUsedTotalCents: 'cost_used_total_cents',
    updatedAt: 'updated_at',
  },
  apiKeyGroups: {
    id: 'id',
    sharedTokenBalance: 'shared_token_balance',
    sharedCostBalanceCents: 'shared_cost_balance_cents',
    updatedAt: 'updated_at',
  },
  aiPricing: {
    modelId: 'model_id',
    inputTokenPrice: 'input_token_price',
    outputTokenPrice: 'output_token_price',
    effectiveAt: 'effective_at',
    expiresAt: 'expires_at',
  },
  aiModelConfigModels: {
    id: 'id',
    modelId: 'model_id',
    configId: 'config_id',
    inputPricePer1k: 'input_price_per_1k',
    outputPricePer1k: 'output_price_per_1k',
    relayPriceMultiplier: 'relay_price_multiplier',
    isRelayPublic: 'is_relay_public',
    enabled: 'enabled',
  },
  aiModelConfig: { id: 'id' },
  tokenFlows: { userId: 'user_id' },
  userMargins: { userId: 'user_id' },
}))

/** 可控的 DB 状态:按用例决定 claim/加钱/待补偿标记的走向。 */
const dbState = vi.hoisted(() => ({
  claimRows: [] as Record<string, unknown>[],
  claimError: null as Error | null,
  creditRows: [] as Record<string, unknown>[],
  creditError: null as Error | null,
  creditFailuresRemaining: 0,
  logRows: [] as Record<string, unknown>[],
  markerPayloads: [] as Record<string, unknown>[],
  txCount: 0,
  claimInTx: 0,
  claimOutsideTx: 0,
  creditUpdates: 0,
  inTx: false,
}))

vi.mock('@ihui/database', () => ({
  llmCallLogs: tables.llmCallLogs,
  developerApiKeys: tables.developerApiKeys,
  apiKeyGroups: tables.apiKeyGroups,
  aiPricing: tables.aiPricing,
  aiModelConfigModels: tables.aiModelConfigModels,
  aiModelConfig: tables.aiModelConfig,
  tokenFlows: tables.tokenFlows,
  userMargins: tables.userMargins,
}))

vi.mock('../src/db/index.js', () => {
  const buildUpdate = (table: unknown) => ({
    set: (payload: Record<string, unknown>) => ({
      where: () => {
        // 待补偿 metadata 标记:UPDATE 载荷不含 refunded 键,单条 UPDATE 后直接 await
        if (table === tables.llmCallLogs && !('refunded' in payload)) {
          dbState.markerPayloads.push(payload)
          return Promise.resolve({ rowCount: 1 })
        }
        if (table === tables.llmCallLogs) {
          if (dbState.inTx) dbState.claimInTx++
          else dbState.claimOutsideTx++
          return {
            returning: async () => {
              if (dbState.claimError) throw dbState.claimError
              return dbState.claimRows
            },
          }
        }
        if (table === tables.developerApiKeys || table === tables.apiKeyGroups) {
          dbState.creditUpdates++
          return {
            returning: async () => {
              if (dbState.creditFailuresRemaining > 0) {
                dbState.creditFailuresRemaining--
                throw new Error('db blip')
              }
              if (dbState.creditError) throw dbState.creditError
              return dbState.creditRows
            },
          }
        }
        throw new Error('unexpected update target')
      },
    }),
  })

  const tx = { update: (table: unknown) => buildUpdate(table) }
  const readChain = (rows: () => Record<string, unknown>[]) => ({
    from: () => ({ where: () => ({ limit: async () => rows() }) }),
  })

  return {
    db: {
      select: () => readChain(() => dbState.logRows),
      update: (table: unknown) => buildUpdate(table),
      insert: () => ({ values: () => ({ returning: async () => [] }) }),
      transaction: async (cb: (t: typeof tx) => Promise<unknown>) => {
        dbState.txCount++
        dbState.inTx = true
        try {
          return await cb(tx)
        } finally {
          dbState.inTx = false
        }
      },
    },
    dbRead: { select: () => readChain(() => []) },
    dbClient: {},
  }
})

vi.mock('../src/services/api-key-group-service.js', () => ({
  getKeyGroup: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/relay-commission-service.js', () => ({
  recordRelayCommission: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/tiered-pricing-service.js', () => ({
  getCurrentTierMultiplier: vi.fn().mockResolvedValue({ multiplier: 1 }),
}))
vi.mock('../src/services/peak-pricing-service.js', () => ({
  resolvePeakMultiplier: vi.fn().mockResolvedValue({ multiplier: 1, ruleId: null, ruleName: null }),
}))
vi.mock('../src/services/subscription-window-service.js', () => ({
  checkSubscriptionWindowQuota: vi.fn().mockResolvedValue({ allowed: true }),
  consumeSubscriptionWindowUsage: vi.fn().mockResolvedValue(false),
}))
vi.mock('../src/services/key-rate-window-service.js', () => ({
  checkKeyRateWindows: vi.fn().mockResolvedValue({ allowed: true }),
  incrKeyRateWindows: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/mail-relay-notifier.js', () => ({
  checkAndNotifyLowBalance: vi.fn().mockResolvedValue(false),
  sendLowBalanceMail: vi.fn().mockResolvedValue(false),
}))
vi.mock('../src/services/user-billing-group-service.js', () => ({
  getUserMultiplier: vi.fn().mockResolvedValue(1),
  getUserModelMultiplier: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: async (request: { apiKey?: unknown }) => {
    request.apiKey = { id: KEY_ID, userId: USER_ID }
  },
  requireApiKeyQuota: () => async () => undefined,
}))
vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapability: () => async () => undefined,
}))
vi.mock('../src/services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: vi.fn(),
}))

import { refundTaskCall, REFUND_MAX_ATTEMPTS } from '../src/services/relay-billing-service.js'
import v1MultimodalRoutes from '../src/routes/v1-multimodal.js'

function resetDbState(): void {
  dbState.claimRows = []
  dbState.claimError = null
  dbState.creditRows = []
  dbState.creditError = null
  dbState.creditFailuresRemaining = 0
  dbState.logRows = []
  dbState.markerPayloads = []
  dbState.txCount = 0
  dbState.claimInTx = 0
  dbState.claimOutsideTx = 0
  dbState.creditUpdates = 0
  dbState.inTx = false
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn()
const dlqMock = {
  recordRefundFailure: vi.fn(async () => 1),
  enqueueRefundFailure: vi.fn(async () => undefined),
  clearRefundFailure: vi.fn(async () => undefined),
}

describe('F-34 / refundTaskCall 不再吞掉退款失败', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbState()
  })

  it('成功路径:打标与加钱同事务完成,返回 ok', async () => {
    dbState.claimRows = [{ id: 'log-1', apiKeyId: KEY_ID, costCents: 120 }]
    dbState.creditRows = [{ id: KEY_ID }]

    const result = await refundTaskCall('task-ok')

    expect(result).toEqual({ refunded: true, refundedCents: 120, reason: 'ok' })
    expect(dbState.txCount).toBe(1)
    // 退款资格标记必须在事务内(与加钱同生共死),不能在事务外先落库
    expect(dbState.claimInTx).toBe(1)
    expect(dbState.claimOutsideTx).toBe(0)
    expect(dbState.creditUpdates).toBe(1)
    expect(dbState.markerPayloads).toHaveLength(0)
  })

  it('瞬时写库失败 → 有界重试后成功(仍只加一次钱)', async () => {
    dbState.claimRows = [{ id: 'log-2', apiKeyId: KEY_ID, costCents: 80 }]
    dbState.creditRows = [{ id: KEY_ID }]
    dbState.creditFailuresRemaining = 1

    const result = await refundTaskCall('task-retry')

    expect(result.refunded).toBe(true)
    expect(result.refundedCents).toBe(80)
    expect(dbState.txCount).toBe(2)
    // 第一次事务内的加钱失败即整体回滚,重试命中事务 2 的那次成功
    expect(dbState.creditUpdates).toBe(2)
    expect(dbState.markerPayloads).toHaveLength(0)
  })

  it('持续失败 → reason=error,并把待补偿事实写进 metadata(不静默)', async () => {
    dbState.claimRows = [{ id: 'log-3', apiKeyId: KEY_ID, costCents: 60 }]
    dbState.creditError = new Error('db down')
    dbState.logRows = [{ id: 'log-3', metadata: {} }]

    const result = await refundTaskCall('task-fail')

    expect(result.refunded).toBe(false)
    expect(result.reason).toBe('error')
    expect(result.attempts).toBe(1)
    expect(dbState.txCount).toBe(3)
    expect(dbState.markerPayloads).toHaveLength(1)
    expect(dbState.markerPayloads[0]).toHaveProperty('metadata')
  })

  it('累计失败达上限 → reason=exhausted(转人工),标记 pending_manual', async () => {
    dbState.claimRows = [{ id: 'log-4', apiKeyId: KEY_ID, costCents: 60 }]
    dbState.creditError = new Error('db down')
    dbState.logRows = [{ id: 'log-4', metadata: { refund_attempts: REFUND_MAX_ATTEMPTS - 1 } }]

    const result = await refundTaskCall('task-exhausted')

    expect(result.refunded).toBe(false)
    expect(result.reason).toBe('exhausted')
    expect(result.attempts).toBe(REFUND_MAX_ATTEMPTS)
    expect(dbState.markerPayloads).toHaveLength(1)
  })

  it('退款目标余额行不存在(Key 被删)→ 按失败处理,不报退款成功', async () => {
    dbState.claimRows = [{ id: 'log-5', apiKeyId: KEY_ID, costCents: 60 }]
    dbState.creditRows = []
    dbState.logRows = [{ id: 'log-5', metadata: {} }]

    const result = await refundTaskCall('task-missing-target')

    expect(result.refunded).toBe(false)
    expect(result.reason).toBe('error')
    expect(dbState.markerPayloads).toHaveLength(1)
  })

  it('无对应流水(未扣费/已退过)→ no_log,不写待补偿标记、不重试', async () => {
    dbState.claimRows = []

    const result = await refundTaskCall('task-none')

    expect(result).toEqual({ refunded: false, refundedCents: 0, reason: 'no_log' })
    expect(dbState.txCount).toBe(1)
    expect(dbState.creditUpdates).toBe(0)
    expect(dbState.markerPayloads).toHaveLength(0)
  })
})

describe('F-34 路由侧:失败退款等待结果并写 DLQ', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.decorate('refundDlq', dlqMock)
    await server.register(v1MultimodalRoutes, { prefix: '/v1' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbState()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('生图任务 failed → 轮询内完成退款(而非 fire-and-forget 丢弃)', async () => {
    fetchMock.mockResolvedValue(jsonResp({ code: 0, data: { status: 'failed' } }))
    dbState.claimRows = [{ id: 'log-r1', apiKeyId: KEY_ID, costCents: 50 }]
    dbState.creditRows = [{ id: KEY_ID }]

    const res = await server.inject({ method: 'GET', url: '/v1/generation/status/job-failed-1' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'failed' })
    // 响应帧先出,退款在同一 handler 内被 await 完成(不是 void 丢弃)
    await vi.waitFor(() =>
      expect(dlqMock.clearRefundFailure).toHaveBeenCalledWith('task:job-failed-1'),
    )
    expect(dbState.creditUpdates).toBe(1)
    expect(dlqMock.recordRefundFailure).not.toHaveBeenCalled()
  })

  it('退款未完成 → 写退款 DLQ,响应仍是任务状态(不被退款拖垮)', async () => {
    fetchMock.mockResolvedValue(jsonResp({ code: 0, data: { status: 'failed' } }))
    dbState.claimRows = [{ id: 'log-r2', apiKeyId: KEY_ID, costCents: 50 }]
    dbState.creditError = new Error('db down')
    dbState.logRows = [{ id: 'log-r2', metadata: {} }]

    const res = await server.inject({ method: 'GET', url: '/v1/generation/status/job-failed-2' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'failed' })
    await vi.waitFor(() =>
      expect(dlqMock.recordRefundFailure).toHaveBeenCalledWith(
        'task:job-failed-2',
        'refund_error',
        expect.objectContaining({ taskId: 'job-failed-2', reason: 'error' }),
      ),
    )
  })

  it('视频任务 failed → 同样在响应前完成退款(不再 void 丢弃)', async () => {
    fetchMock.mockResolvedValue(jsonResp({ code: 0, data: { taskId: 'job-v1', status: 'FAILED' } }))
    dbState.claimRows = [{ id: 'log-r3', apiKeyId: KEY_ID, costCents: 30 }]
    dbState.creditRows = [{ id: KEY_ID }]

    const res = await server.inject({ method: 'GET', url: '/v1/videos/tasks/job-v1' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'failed' })
    expect(dbState.creditUpdates).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
