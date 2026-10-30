// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G6 企业治理面回归测试(2026-10-30 立)。
 *
 * 覆盖面:
 * 1. resolvePolicy 命中/缺省(含停用行、未到生效点);
 * 2. model_allowlist allow/block 两模式 + guardModelAdmission 拒绝形态(403/ORG_MODEL_BLOCKED);
 * 3. 无组织放行(默认开放纪律);
 * 4. ORG_POLICIES_ENABLED 开关关 ⇒ 所有检查点直通;
 * 5. feature_flags 缺省开 / 显式关;
 * 6. 预算 min 语义:checkOrgSpendBudget 触顶拒 + ai-cost checkBudget 叠加(个人预算缺失时
 *    组织上限仍生效、组织未触顶时逐字节旧行为);
 * 7. org-billing 路由守卫(401/403)与聚合返回形态;
 * 8. PUT /api/org/policies/:key version+1 / 新建 version=1 / 未知键 400 / 值形态非法 400。
 *
 * Mock 策略(照 pricing-g4.test.ts / devices-g1.test.ts 基建):
 * - ../src/db/index.js 为最小内存假库:select 按 where 条件 params 分派(org_policies 过滤
 *   或 aiBudgets/用量桩数据),execute 按 SQL 文本分派(成员归属/管理员/组织日花费/聚合);
 * - ../src/config/index.js 为可变 mock(ORG_POLICIES_ENABLED 逐用例翻转);
 * - auth 用 x-test-user 头注入;ai-cost 的重依赖(pricing/business-metrics/require-permission)
 *   全部 mock 掉,只测 checkBudget 的预算判定。测试文件豁免 any。
 */
 
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// =============================================================================
// 内存假库 + config / auth mock(必须先于被测模块 import)
// =============================================================================

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    /** ORG_POLICIES_ENABLED 开关(逐用例翻转) */
    orgEnabled: false,
    /** organization_members 行:{org_id, user_id, role, status, joined_at} */
    members: [] as any[],
    /** org_policies 行:{id, orgId, policyKey, policyValue, enabled, version, effectiveFrom} */
    policies: [] as any[],
    /** 组织今日花费聚合桩(checkOrgSpendBudget 的 SUM(cost)) */
    orgUsedCredits: '0',
    /** aiBudgets 单行桩(checkBudget 个人预算;null = 无预算记录) */
    budget: null as any,
    /** 个人今日 token 用量桩 */
    budgetUsedTokens: 0,
    /** 聚合路由各节返回桩 */
    summaryByMember: [] as any[],
    summaryByModel: [] as any[],
    summaryByDay: [] as any[],
    agentByModel: [] as any[],
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    get ORG_POLICIES_ENABLED() {
      return mockStore.orgEnabled
    },
    PRICING_RULES_ENABLED: false,
  },
}))

/** 给 Promise 挂 .limit,兼容 select().where().limit() 与直接 await where() 两种收口 */
function makeRows(rows: any[]) {
  const p: any = Promise.resolve(rows)
  p.limit = (n: number) => Promise.resolve(rows.slice(0, n))
  return p
}

/**
 * 把 drizzle SQL 对象渲染成 {sql, params}。
 *
 * ⚠️ 0.45 的 `SQL.toQuery()` 必须传方言配置对象(内部直接访问 config.inlineParams,
 * 裸调会抛 "Cannot read properties of undefined (reading 'inlineParams')" 并被
 * 被测代码的 fail-open catch 吞成"无数据");形态对齐 codebase-index-tenant-isolation.test.ts
 * 的 renderSql 官方渲染路径。
 */
function buildQuery(q: any): { sql: string; params: any[] } {
  if (q && typeof q.toQuery === 'function') {
    try {
      return q.toQuery({
        escapeName: (n: string) => `"${n}"`,
        escapeParam: (i: number) => `$${i + 1}`,
        casing: {
          getColumnCasing: (c: any) => c?.name ?? '',
          cache: () => undefined,
          convert: (c: string) => c,
        },
      })
    } catch {
      /* 渲染失败落到 String 兜底 */
    }
  }
  return { sql: String(q), params: [] }
}

/** org_policies 过滤:按 and(...) 的 params 前缀 [orgId, policyKey?, enabled?, effectiveFrom?] */
function filterPolicies(params: any[]) {
  let rows = mockStore.policies.slice()
  if (params.length > 0) rows = rows.filter((p) => p.orgId === params[0])
  if (params.length > 1) rows = rows.filter((p) => p.policyKey === params[1])
  if (params.length > 2 && params[2] === true) rows = rows.filter((p) => p.enabled === true)
  if (params.length > 3 && (params[3] instanceof Date || typeof params[3] === 'string')) {
    const cutoff = new Date(params[3])
    rows = rows.filter((p) => new Date(p.effectiveFrom) <= cutoff)
  }
  return rows
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: any) => {
          const { sql: text, params } = buildQuery(cond)
          // 按渲染文本分派:列片段会带出 "表名"."列名",比 params 位次假设稳
          if (text.includes('ai_cost_records'))
            return makeRows([{ total: mockStore.budgetUsedTokens }])
          if (text.includes('ai_budgets'))
            return makeRows(mockStore.budget ? [mockStore.budget] : [])
          return makeRows(filterPolicies(params))
        },
      }),
    }),
    insert: () => ({
      values: (v: any) => ({
        returning: async () => {
          const row = {
            id: `pol-${Math.random().toString(36).slice(2, 10)}`,
            enabled: true,
            version: 1,
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date(),
            ...v,
          }
          mockStore.policies.push(row)
          return [row]
        },
      }),
    }),
    update: () => ({
      set: (s: any) => ({
        where: (cond: any) => ({
          returning: async () => {
            const { params } = buildQuery(cond)
            const row = mockStore.policies.find((p) => p.id === params[0])
            if (!row) return []
            Object.assign(row, s)
            return [row]
          },
        }),
      }),
    }),
    execute: async (q: any) => {
      const { sql: text, params } = buildQuery(q)
      // getOrgIdForUser:最早加入的生效成员行
      if (text.includes('ORDER BY "joined_at"')) {
        const uid = params[0]
        return mockStore.members
          .filter((m) => m.user_id === uid && m.status === 1)
          .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
          .slice(0, 1)
          .map((m) => ({ org_id: m.org_id }))
      }
      // isOrgAdmin:成员行角色
      if (text.includes('SELECT "role"')) {
        const [orgId, uid] = params
        return mockStore.members
          .filter((m) => m.org_id === orgId && m.user_id === uid && m.status === 1)
          .map((m) => ({ role: m.role }))
      }
      // checkOrgSpendBudget:组织今日花费 SUM
      if (text.includes('AS used')) return [{ used: mockStore.orgUsedCredits }]
      // org-billing 聚合四节
      if (text.includes('agent_billings')) return mockStore.agentByModel
      if (text.includes('to_char')) return mockStore.summaryByDay
      if (text.includes('AS "userId"')) return mockStore.summaryByMember
      if (text.includes('AS "model"')) return mockStore.summaryByModel
      return []
    },
  },
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => Promise.resolve([]), limit: () => Promise.resolve([]) }),
      }),
    }),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: any) => {
    const uid = request.headers?.['x-test-user']
    if (!uid) {
      const e: any = new Error('Authentication required')
      e.statusCode = 401
      throw e
    }
    request.userId = uid
    return { userId: uid }
  }),
  requireActiveUser: vi.fn(async () => {}),
  checkAuth: vi.fn(async () => true),
}))

// ai-cost 的重依赖全部 mock 掉,只测 checkBudget 的预算判定
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  requireAdminRouteGuard: vi.fn(async () => {}),
}))
vi.mock('../src/services/pricing-service.js', () => ({
  calculateCost: vi.fn(async () => ({ totalCost: 0, currency: 'CNY' })),
}))
vi.mock('../src/services/pricing-engine.js', () => ({
  resolvePrice: vi.fn(async () => null),
}))
vi.mock('../src/plugins/business-metrics.js', () => ({
  recordAiCallSample: vi.fn(),
  recordAiCostWriteFailure: vi.fn(),
}))

// =============================================================================
// 被测模块
// =============================================================================

import {
  checkFeatureEnabled,
  checkModelAllowed,
  checkOrgSpendBudget,
  clearOrgPolicyCache,
  getOrgIdForUser,
  guardModelAdmission,
  resolvePolicy,
} from '../src/services/org-policy-service.js'
import { checkBudget } from '../src/plugins/ai-cost.js'
import { orgBillingRoutes } from '../src/routes/org-billing.js'

// =============================================================================
// 夹具
// =============================================================================

const PAST = new Date('2026-01-01T00:00:00Z')
const FUTURE = new Date('2099-01-01T00:00:00Z')

function makePolicy(over: Record<string, unknown> = {}): any {
  return {
    id: 'pol-1',
    orgId: 'org-1',
    policyKey: 'model_allowlist',
    policyValue: { modelIds: ['gpt-4o'], mode: 'allow' },
    enabled: true,
    version: 1,
    effectiveFrom: PAST,
    updatedAt: PAST,
    ...over,
  }
}

const MEMBER_U1 = { org_id: 'org-1', user_id: 'u1', role: 'member', status: 1, joined_at: PAST }
const ADMIN_U1 = { org_id: 'org-1', user_id: 'u1', role: 'admin', status: 1, joined_at: PAST }

beforeEach(() => {
  mockStore.orgEnabled = false
  mockStore.members = []
  mockStore.policies = []
  mockStore.orgUsedCredits = '0'
  mockStore.budget = null
  mockStore.budgetUsedTokens = 0
  mockStore.summaryByMember = []
  mockStore.summaryByModel = []
  mockStore.summaryByDay = []
  mockStore.agentByModel = []
  clearOrgPolicyCache()
})

// =============================================================================
// 1. resolvePolicy 命中/缺省
// =============================================================================

describe('resolvePolicy 命中与缺省', () => {
  it('命中生效策略 → 返回 policyValue;未知键 → null', async () => {
    mockStore.policies = [makePolicy()]
    const hit = await resolvePolicy<any>('org-1', 'model_allowlist')
    expect(hit).toEqual({ modelIds: ['gpt-4o'], mode: 'allow' })
    const miss = await resolvePolicy<any>('org-1', 'feature_flags')
    expect(miss).toBeNull()
  })

  it('停用行(enabled=false)与未到生效点 ⇒ 视为无策略', async () => {
    mockStore.policies = [
      makePolicy({ id: 'pol-off', enabled: false }),
      makePolicy({
        id: 'pol-future',
        policyKey: 'spend_budget_daily',
        policyValue: { credits: 10 },
        effectiveFrom: FUTURE,
      }),
    ]
    expect(await resolvePolicy('org-1', 'model_allowlist')).toBeNull()
    expect(await resolvePolicy('org-1', 'spend_budget_daily')).toBeNull()
  })

  it('getOrgIdForUser:多组织取最早加入的生效成员行;无成员 → null', async () => {
    mockStore.members = [
      { org_id: 'org-late', user_id: 'u1', role: 'member', status: 1, joined_at: FUTURE },
      { org_id: 'org-1', user_id: 'u1', role: 'member', status: 1, joined_at: PAST },
      { org_id: 'org-x', user_id: 'u1', role: 'member', status: 0, joined_at: PAST },
    ]
    expect(await getOrgIdForUser('u1')).toBe('org-1')
    clearOrgPolicyCache()
    mockStore.members = []
    expect(await getOrgIdForUser('u1')).toBeNull()
  })
})

// =============================================================================
// 2/3/4. model_allowlist 两模式 + 无组织放行 + 开关关直通
// =============================================================================

describe('模型准入检查点', () => {
  it('allow 模式:仅白名单内可用,名单外拒绝', async () => {
    mockStore.orgEnabled = true
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [makePolicy({ policyValue: { modelIds: ['gpt-4o'], mode: 'allow' } })]
    expect((await checkModelAllowed('u1', 'gpt-4o')).allowed).toBe(true)
    const blocked = await checkModelAllowed('u1', 'gpt-image-1')
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toContain('gpt-image-1')
  })

  it('block 模式:名单内禁用,其余可用', async () => {
    mockStore.orgEnabled = true
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [makePolicy({ policyValue: { modelIds: ['gpt-4o'], mode: 'block' } })]
    expect((await checkModelAllowed('u1', 'gpt-4o')).allowed).toBe(false)
    expect((await checkModelAllowed('u1', 'deepseek-chat')).allowed).toBe(true)
  })

  it('无组织成员关系 ⇒ 全放行(默认开放,不破坏存量行为)', async () => {
    mockStore.orgEnabled = true
    mockStore.members = []
    mockStore.policies = [makePolicy({ policyValue: { modelIds: [], mode: 'allow' } })]
    expect((await checkModelAllowed('u-ghost', 'gpt-4o')).allowed).toBe(true)
  })

  it('开关关 ⇒ 所有检查点直通,逐字节旧行为', async () => {
    mockStore.orgEnabled = false
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [makePolicy({ policyValue: { modelIds: ['gpt-4o'], mode: 'block' } })]
    expect((await checkModelAllowed('u1', 'gpt-4o')).allowed).toBe(true)
    expect(await checkFeatureEnabled('u1', 'delegation')).toBe(true)
    expect((await checkOrgSpendBudget('u1')).allowed).toBe(true)
  })

  it('guardModelAdmission:放行返回 null;拒绝给出 403/ORG_MODEL_BLOCKED 形态', async () => {
    mockStore.orgEnabled = true
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [makePolicy({ policyValue: { modelIds: ['gpt-4o'], mode: 'block' } })]
    expect(await guardModelAdmission('u1', 'deepseek-chat')).toBeNull()
    const rej = await guardModelAdmission('u1', 'gpt-4o')
    expect(rej).not.toBeNull()
    expect(rej!.statusCode).toBe(403)
    expect(rej!.errorCode).toBe('ORG_MODEL_BLOCKED')
    expect(rej!.model).toBe('gpt-4o')
  })

  it('策略值形态非法 ⇒ 视为无策略放行(治理面脏数据绝不拦截)', async () => {
    mockStore.orgEnabled = true
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [makePolicy({ policyValue: { mode: 'allow' } })]
    expect((await checkModelAllowed('u1', 'gpt-4o')).allowed).toBe(true)
  })
})

// =============================================================================
// 5. feature_flags
// =============================================================================

describe('特性开关检查点', () => {
  it('缺省开;策略显式置 false 才关;未知键默认开', async () => {
    mockStore.orgEnabled = true
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [
      makePolicy({ policyKey: 'feature_flags', policyValue: { delegation: false } }),
    ]
    expect(await checkFeatureEnabled('u1', 'delegation')).toBe(false)
    expect(await checkFeatureEnabled('u1', 'automations')).toBe(true)
  })
})

// =============================================================================
// 6. 预算 min 语义
// =============================================================================

describe('组织日预算(spend_budget_daily)', () => {
  it('触顶拒 / 未触顶放行 / 无策略直通', async () => {
    mockStore.orgEnabled = true
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [
      makePolicy({ policyKey: 'spend_budget_daily', policyValue: { credits: 100 } }),
    ]
    mockStore.orgUsedCredits = '150'
    const over = await checkOrgSpendBudget('u1')
    expect(over.allowed).toBe(false)
    expect(over.reason).toBe('组织日预算已用尽')
    expect(over.limitCredits).toBe(100)
    mockStore.orgUsedCredits = '50'
    expect((await checkOrgSpendBudget('u1')).allowed).toBe(true)
    mockStore.policies = []
    clearOrgPolicyCache()
    expect((await checkOrgSpendBudget('u1')).allowed).toBe(true)
  })

  it('checkBudget 叠加:min(个人,组织)语义 —— 个人预算缺失时组织上限仍生效,任一触顶即拒', async () => {
    mockStore.orgEnabled = true
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [
      makePolicy({ policyKey: 'spend_budget_daily', policyValue: { credits: 100 } }),
    ]
    // 无个人预算记录(旧行为 = 放行),但组织触顶 ⇒ 拒
    mockStore.budget = null
    mockStore.orgUsedCredits = '150'
    const blocked = await checkBudget('user', 'u1')
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toBe('组织日预算已用尽')
    // 组织未触顶 + 个人预算未触顶 ⇒ 放行(旧行为)
    mockStore.orgUsedCredits = '50'
    mockStore.budget = { dailyTokenLimit: 1000 }
    mockStore.budgetUsedTokens = 500
    expect((await checkBudget('user', 'u1')).allowed).toBe(true)
    // 个人维度触顶 ⇒ 拒(既有语义不变)
    mockStore.budgetUsedTokens = 1000
    expect((await checkBudget('user', 'u1')).allowed).toBe(false)
  })

  it('开关关 ⇒ checkBudget 不触组织面,逐字节旧行为', async () => {
    mockStore.orgEnabled = false
    mockStore.members = [MEMBER_U1]
    mockStore.policies = [
      makePolicy({ policyKey: 'spend_budget_daily', policyValue: { credits: 100 } }),
    ]
    mockStore.orgUsedCredits = '999999'
    mockStore.budget = null
    expect((await checkBudget('user', 'u1')).allowed).toBe(true)
  })
})

// =============================================================================
// 7/8. org-billing 路由(守卫 + 聚合 + 策略读写)
// =============================================================================

describe('org-billing 路由', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(orgBillingRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server?.close()
  })

  const inject = (method: string, url: string, opts: { user?: string; payload?: unknown } = {}) =>
    server.inject({
      method: method as any,
      url,
      headers: opts.user ? { 'x-test-user': opts.user } : {},
      payload: opts.payload as any,
    })

  it('GET /api/org/billing/summary 未登录 → 401', async () => {
    const res = await inject('GET', '/api/org/billing/summary')
    expect(res.statusCode).toBe(401)
  })

  it('无组织归属 → 403;普通成员 → 403(组织管理员守卫)', async () => {
    mockStore.orgEnabled = true
    mockStore.members = []
    let res = await inject('GET', '/api/org/billing/summary', { user: 'u1' })
    expect(res.statusCode).toBe(403)
    mockStore.members = [MEMBER_U1]
    clearOrgPolicyCache()
    res = await inject('GET', '/api/org/billing/summary', { user: 'u1' })
    expect(res.statusCode).toBe(403)
  })

  it('组织管理员 → 200,聚合四节(按成员/按模型/按日/agent 参考)', async () => {
    mockStore.members = [ADMIN_U1]
    mockStore.summaryByMember = [{ userId: 'u2', cost: '3.5', tokens: 100, calls: 2 }]
    mockStore.summaryByModel = [{ model: 'gpt-4o', cost: '3.5', tokens: 100, calls: 2 }]
    mockStore.summaryByDay = [{ date: '2026-10-30', cost: '3.5', tokens: 100, calls: 2 }]
    mockStore.agentByModel = [{ modelId: 'coze-x', balance: '1', tokens: 10, calls: 1 }]
    const res = await inject('GET', '/api/org/billing/summary?from=2026-10-01&to=2026-10-30', {
      user: 'u1',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.orgId).toBe('org-1')
    expect(body.data.byMember).toHaveLength(1)
    expect(body.data.byModel[0].model).toBe('gpt-4o')
    expect(body.data.byDay[0].date).toBe('2026-10-30')
    expect(body.data.agentBillings.byModel[0].modelId).toBe('coze-x')
  })

  it('GET /api/org/policies 管理员 → 200 本组织策略行', async () => {
    mockStore.members = [ADMIN_U1]
    mockStore.policies = [makePolicy(), makePolicy({ id: 'pol-2', policyKey: 'feature_flags' })]
    const res = await inject('GET', '/api/org/policies', { user: 'u1' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(2)
  })

  it('PUT 已存在策略 → version+1,值落库', async () => {
    mockStore.members = [ADMIN_U1]
    mockStore.policies = [makePolicy({ version: 3 })]
    const res = await inject('PUT', '/api/org/policies/model_allowlist', {
      user: 'u1',
      payload: { policyValue: { modelIds: ['gpt-4o', 'deepseek-chat'], mode: 'block' } },
    })
    expect(res.statusCode).toBe(200)
    const row = res.json().data
    expect(row.version).toBe(4)
    expect(row.policyValue).toEqual({ modelIds: ['gpt-4o', 'deepseek-chat'], mode: 'block' })
  })

  it('PUT 不存在策略 → 新建 version=1', async () => {
    mockStore.members = [ADMIN_U1]
    mockStore.policies = []
    const res = await inject('PUT', '/api/org/policies/spend_budget_daily', {
      user: 'u1',
      payload: { policyValue: { credits: 500 } },
    })
    expect(res.statusCode).toBe(200)
    const row = res.json().data
    expect(row.version).toBe(1)
    expect(row.policyKey).toBe('spend_budget_daily')
    expect(mockStore.policies).toHaveLength(1)
  })

  it('PUT 未知策略键 → 400;值形态非法 → 400', async () => {
    mockStore.members = [ADMIN_U1]
    let res = await inject('PUT', '/api/org/policies/mystery_key', {
      user: 'u1',
      payload: { policyValue: {} },
    })
    expect(res.statusCode).toBe(400)
    res = await inject('PUT', '/api/org/policies/model_allowlist', {
      user: 'u1',
      payload: { policyValue: { modelIds: ['gpt-4o'] } },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT 非管理员 → 403(写面同守卫)', async () => {
    mockStore.members = [MEMBER_U1]
    const res = await inject('PUT', '/api/org/policies/model_allowlist', {
      user: 'u1',
      payload: { policyValue: { modelIds: [], mode: 'allow' } },
    })
    expect(res.statusCode).toBe(403)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
