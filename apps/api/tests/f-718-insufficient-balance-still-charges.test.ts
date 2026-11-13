// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-718 回归锁(2026-11-11)。
 *
 * 病灶:扣费 UPDATE 的成本列 CASE 在"余额 < 本次成本"时走 ELSE **保持原余额**,
 * 而准入 checkQuota 只在 costBalanceCents === 0 时拒绝 ⇒ 余额 1 分的 Key 每次调用
 * 都进 ELSE、余额永远是 1 分,可无限免费调用,且每次照常累加 costUsedTotalCents、
 * 按全额计提返佣。
 *
 * 判据:
 * - 成本列 CASE 的 ELSE 必须是真实扣减(`cost_balance_cents - 本次成本`),不再是原值;
 * - 余额 1 分、本次 10 分 → 落库 -9(欠费),余额 -1(无限额度)仍保持 -1;
 * - 负余额能进已有的低余额通知(< 1000 分),不因 >0 判断漏掉欠费;
 * - 准入把 -9 当"余额耗尽"拒绝,下次调用被拦住;-1 哨兵仍豁免。
 *
 * 测试模式:vi.mock 掉 db / @ihui/database(对齐 f-35-settle-prededuction-failure.test.ts)。
 * 扣减语义不用真库:本仓依赖里没有 pg-mem / pglite,无法离线执行 Postgres;
 * 因此用 PgDialect 编译**真实运行路径捕获的** SQL 表达式(不是照抄源码字符串)做形状断言,
 * 再按编译结果推演余额(见 evaluateCostCase),这是票面允许的退化口径。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

function chain(limitReturn: unknown[]) {
  const limit = vi.fn().mockResolvedValue(limitReturn)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ limit, orderBy })
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

const { mockDbReadSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
  dbRead: {
    select: mockDbReadSelect,
  },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    tokenBalance: 'token_balance',
    costBalanceCents: 'cost_balance_cents',
    tokenUsedTotal: 'token_used_total',
    costUsedTotalCents: 'cost_used_total_cents',
    allowedIps: 'allowed_ips',
    blockedIps: 'blocked_ips',
    rateLimit5h: 'rate_limit_5h',
    rateLimit1d: 'rate_limit_1d',
    rateLimit7d: 'rate_limit_7d',
    updatedAt: 'updated_at',
  },
  llmCallLogs: { id: 'id', metadata: 'metadata' },
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
  apiKeyGroups: {
    id: 'id',
    sharedTokenBalance: 'shared_token_balance',
    sharedCostBalanceCents: 'shared_cost_balance_cents',
    updatedAt: 'updated_at',
  },
  tokenFlows: { userId: 'user_id' },
  userMargins: { userId: 'user_id' },
}))

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
  getUserModelMultiplier: vi.fn().mockResolvedValue(1),
}))

import { recordCall, checkQuota } from '../src/services/relay-billing-service.js'
import { getKeyGroup } from '../src/services/api-key-group-service.js'
import { notifyRelayEvent } from '../src/services/webhook-relay-notifier.js'

const dialect = new PgDialect()
const compile = (expr: unknown) => dialect.sqlToQuery(expr as Parameters<PgDialect['sqlToQuery']>[0])

/**
 * 按编译后的 CASE 推演扣费结果(离线无 Postgres 的退化口径):
 * 形状必须是 `CASE WHEN <列> = -1 THEN -1 ELSE <列> - <本次成本> END`,
 * -1 分支保持 -1,其余一律 列 - 成本(允许为负)。
 */
function evaluateCostCase(existingBalance: number, compiled: { sql: string; params: unknown[] }) {
  expect(compiled.sql).toMatch(/^case when \$\d+ = -1 then -1 else \$\d+ - \$\d+ end$/i)
  // 第 1 个参数是列替身(mock 里列是字符串),最后一个参数是本次成本
  expect(compiled.params[0]).toBe('cost_balance_cents')
  const costCents = compiled.params[compiled.params.length - 1]
  expect(typeof costCents).toBe('number')
  return existingBalance === -1 ? -1 : existingBalance - (costCents as number)
}

/** 让 recordCall 的个人余额 UPDATE 可被捕获,并固定 returning 的"扣后余额" */
function stubBalanceUpdate(returned: { tokenBalance: number; costBalanceCents: number }) {
  const payloads: Record<string, unknown>[] = []
  mockDbUpdate.mockImplementation(() => ({
    set: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      payloads.push(payload)
      return {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([returned]),
        }),
      }
    }),
  }))
  return payloads
}

const relayInput = {
  apiKeyId: 'key-f718',
  userId: 'user-f718',
  // 定价行 50 分/千 token:100 prompt + 100 completion → 5 + 5 = 10 分
  model: 'f718-relay-model',
  prompt: 'hello',
  response: 'world',
  promptTokens: 100,
  completionTokens: 100,
  totalTokens: 200,
  latencyMs: 50,
  status: 'success' as const,
  mode: 'relay' as const,
}

describe('F-718 余额不足不再"免单"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-f718' }]),
      }),
    })
    vi.mocked(getKeyGroup).mockResolvedValue(null)
  })

  it('源码:成本列 CASE 的 ELSE 是真实扣减,不再保持原值(-1 分支保留)', () => {
    const source = readFileSync(
      new URL('../src/services/relay-billing-service.ts', import.meta.url),
      'utf8',
    )

    // 个人余额:旧形状 `... ELSE ${developerApiKeys.costBalanceCents} END` 必须消失
    expect(source).not.toMatch(/ELSE \$\{developerApiKeys\.costBalanceCents\} END/)
    expect(source).toMatch(
      /costBalanceCents: sql`CASE WHEN \$\{developerApiKeys\.costBalanceCents\} = -1 THEN -1 ELSE \$\{developerApiKeys\.costBalanceCents\} - \$\{costCentsToDeduct\} END`/,
    )

    // 组池成本列是同语义 CASE(同一扣费函数),一并锁住
    expect(source).not.toMatch(/ELSE \$\{apiKeyGroups\.sharedCostBalanceCents\} END/)
    expect(source).toMatch(
      /sharedCostBalanceCents: sql`CASE WHEN \$\{apiKeyGroups\.sharedCostBalanceCents\} = -1 THEN -1 ELSE \$\{apiKeyGroups\.sharedCostBalanceCents\} - \$\{costCentsToDeduct\} END`/,
    )
  })

  it('运行路径:余额 1 分、本次 10 分 → CASE 落 -9;无限额度 -1 仍为 -1', async () => {
    mockDbReadSelect
      .mockReturnValueOnce(chain([{ inputPricePer1k: 0, outputPricePer1k: 0 }])) // model_config 空
      .mockReturnValueOnce(chain([{ inputTokenPrice: 50, outputTokenPrice: 50 }])) // 定价行
    const payloads = stubBalanceUpdate({ tokenBalance: 900, costBalanceCents: -9 })

    const result = await recordCall(relayInput)

    expect(result.costCents).toBe(10)
    expect(payloads).toHaveLength(1)
    const compiled = compile(payloads[0]!.costBalanceCents)

    // 旧实现在这里编译成 `... THEN $1 END`(ELSE 保持原值),不可能出现减法
    expect(compiled.sql).not.toMatch(/else \$\d+ end$/i)
    expect(evaluateCostCase(1, compiled)).toBe(-9)
    expect(evaluateCostCase(-1, compiled)).toBe(-1)
  })

  it('负余额(欠费)能触发已有低余额通知(< 1000 分)', async () => {
    mockDbReadSelect
      .mockReturnValueOnce(chain([{ inputPricePer1k: 0, outputPricePer1k: 0 }]))
      .mockReturnValueOnce(chain([{ inputTokenPrice: 50, outputTokenPrice: 50 }]))
    stubBalanceUpdate({ tokenBalance: 900, costBalanceCents: -9 })

    await recordCall(relayInput)
    // relay.balance.low 走 setImmediate(fire-and-forget),等一个宏任务后再断言
    await new Promise((resolve) => setImmediate(resolve))

    const lowCalls = vi
      .mocked(notifyRelayEvent)
      .mock.calls.filter(([arg]) => arg.event === 'relay.balance.low')
    expect(lowCalls).toHaveLength(1)
    expect(lowCalls[0]![0].payload).toMatchObject({ costBalanceCents: -9 })
  })

  it('准入:欠费负余额下次调用被拒(no_balance_cost),-1 哨兵仍放行', async () => {
    const keyRow = (costBalanceCents: number, tokenBalance = 1_000_000) => ({
      id: 'key-f718',
      userId: 'user-f718',
      status: 'active',
      tokenBalance,
      costBalanceCents,
      allowedIps: null,
      blockedIps: null,
      rateLimit5h: null,
      rateLimit1d: null,
      rateLimit7d: null,
    })

    mockDbReadSelect.mockReturnValueOnce(chain([keyRow(-9)]))
    const overdrawn = await checkQuota('key-f718', 100)
    expect(overdrawn.allowed).toBe(false)
    expect(overdrawn.reason).toBe('no_balance_cost')

    mockDbReadSelect.mockReturnValueOnce(chain([keyRow(-1)]))
    const unlimited = await checkQuota('key-f718', 100)
    expect(unlimited.allowed).toBe(true)

    // 组池同样:共享成本余额 -9(欠费)必须拒绝
    mockDbReadSelect.mockReturnValueOnce(chain([keyRow(100)]))
    vi.mocked(getKeyGroup).mockResolvedValueOnce({
      groupId: 'group-f718',
      groupName: 'g',
      role: 'owner',
      sharedTokenBalance: 1_000_000,
      sharedCostBalanceCents: -9,
      rateLimitQpm: 0,
      allowedModels: null,
      allowedIps: null,
      enabled: true,
      maxTokensPerReq: null,
    })
    const groupOverdrawn = await checkQuota('key-f718', 100)
    expect(groupOverdrawn.allowed).toBe(false)
    expect(groupOverdrawn.reason).toBe('no_balance_cost')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
