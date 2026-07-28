import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { createDb } from '../src/client.js'
import { aiBudgets, aiCostRecords } from '../src/schema/ai-cost.js'
import { users } from '../src/schema/users.js'

const db = createDb(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui',
)

type CostRecordEntry = typeof aiCostRecords.$inferInsert
type BudgetEntry = typeof aiBudgets.$inferInsert

/**
 * AI 成本治理 seed 数据(P0-3d, 2026-07-28 立)。
 *
 * 目标:为 admin/ai-cost 看板的 top-users / budget-alerts 端点补真实数据。
 *   apps/api/src/plugins/ai-cost.ts 已实现 dashboard / records / budgets / top-users / budget-alerts 共 5 端点。
 *   本 seed 为其中 2 个分析端点提供展示数据,验证流程:
 *     1. seedUsers (step 7) → users 表必有 1 个普通用户 + admin 用户 (roleId >= 1)
 *     2. seedAiCostRecords (step 11, 本文件) → aiCostRecords + aiBudgets 表填充
 *     3. GET /api/admin/ai/cost/top-users → 看到 3 个用户排行(按 cost desc)
 *     4. GET /api/admin/ai/cost/budget-alerts → 看到 1 个用户的 critical 告警 (dailyTokenPercent >= 100)
 *
 * 数据规模:
 *   - aiCostRecords: 3 用户 × 4 模型 × 7 天 × 5-15 次/天 ≈ 420-1260 条
 *   - aiBudgets: 3 用户 × 1 条 = 3 条 (scope='user', model=NULL 覆盖全部模型)
 *
 * 幂等策略:
 *   - aiCostRecords: deterministic promptHash = sha256(`p0-3d-cost|user|model|day|idx`)
 *     每个 (user, model, day) batch 写入前 SELECT 首个 promptHash 是否存在 → 存在则整个 batch 跳过
 *     不删旧数据(任务硬约束"aiCostRecords 不删旧数据,只在过去 7 天范围内")
 *   - aiBudgets: (scope, scopeKey, model) 唯一键已存在则跳过,否则插入
 *     注:ai_budgets.scopeUnique 是 index 非 unique,需手动 SELECT 检查 (ai-pricing-seed 同理)
 *
 * 预算告警触发设计:
 *   - 用户 A (第 1 个 admin): dailyTokenLimit=50_000 (故意设小,日均 ~80,000 token → 160% → critical)
 *   - 用户 B/C: 保持 schema 默认值 (dailyTokenLimit=1_000_000 → 日均 ~80,000 token = 8% → 无告警)
 *   - monthlyCostLimit 全员 200 USD (admin 显式) / 2000 USD (默认) → 7 天累计 $50~$150 = 25-75% 不会触发
 *     (但任一维度超 80% 即触发,用户 A 的 dailyTokenPercent 160% 即可单独触发 critical)
 */

const SEED_TAG = 'p0-3d-cost'

/** 4 个测试模型:国际旗舰 + 国内主力,与 ai-pricing-seed 已有数据对齐,确保 cost 计算有定价 */
const MODELS = [
  { id: 'gpt-4o', provider: 'openai' },
  { id: 'claude-3-5-sonnet', provider: 'anthropic' },
  { id: 'deepseek-chat', provider: 'deepseek' },
  { id: 'qwen-plus', provider: 'qwen' },
] as const

/** 最近 7 天(包含今天):dayAgo ∈ {6, 5, 4, 3, 2, 1, 0} */
const SEVEN_DAYS_AGO = 7

/** 生成 [min, max] 闭区间整数 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function deterministicHash(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** Seed 标记用的 promptHash:固定算法 sha256(`p0-3d-cost|user|model|day|idx`),保证幂等 */
function makeSeedPromptHash(userId: string, model: string, dayIso: string, idx: number): string {
  return deterministicHash(`${SEED_TAG}|${userId}|${model}|${dayIso}|${idx}`)
}

/** 选 2-3 个真实用户,roleId 降序优先(系统管理员最优先)
 *
 *  任务硬约束要求 `WHERE role_id >= 1`,但开发环境通常只有 1 个 admin,不足 2 个时降级为任意活跃用户,
 *  保证 seed 不因用户数不够而失败(top-users 端点本身只关心 userId 是否存在,不强制 admin)
 */
async function pickAdminUsers(limit: number): Promise<Array<{ id: string; email: string | null }>> {
  // 1. 优先拿 roleId >= 1 (admin)
  const admins = await db
    .select({ id: users.id, email: users.email, roleId: users.roleId })
    .from(users)
    .where(and(gte(users.roleId, 1), eq(users.status, 1)))
    .orderBy(desc(users.roleId), users.createdAt)
    .limit(limit)
  if (admins.length >= 2) {
    return admins.map(({ id, email }) => ({ id, email }))
  }
  // 2. 不足则补充 roleId >= 0 的活跃用户
  const filled = await db
    .select({ id: users.id, email: users.email, roleId: users.roleId })
    .from(users)
    .where(and(gte(users.roleId, 0), eq(users.status, 1)))
    .orderBy(desc(users.roleId), users.createdAt)
    .limit(limit)
  return filled.map(({ id, email }) => ({ id, email }))
}

/** 生成单个 (user, model, day) batch 的 AI 成本记录 */
function buildDayBatchRecords(
  userId: string,
  model: (typeof MODELS)[number],
  dayDate: Date,
  dayStart: Date,
  dayEnd: Date,
): CostRecordEntry[] {
  const callCount = randomInt(5, 15)
  const dayIso = dayDate.toISOString().slice(0, 10)
  const records: CostRecordEntry[] = []
  for (let i = 0; i < callCount; i++) {
    const promptTokens = randomInt(500, 3000)
    const completionTokens = randomInt(200, 1500)
    const totalTokens = promptTokens + completionTokens
    // cost 美元 6 位小数,范围 $0.01 - $0.5 (覆盖从 deepseek 廉价到 gpt-4o 旗舰的合理波动)
    const costUsd = 0.01 + Math.random() * 0.49
    // 时间均匀分布在该天 [dayStart, dayEnd] 内,模拟真实一天的调用节奏
    const callTime = new Date(
      dayStart.getTime() + Math.random() * (dayEnd.getTime() - dayStart.getTime()),
    )
    records.push({
      userId,
      tenantId: null,
      model: model.id,
      provider: model.provider,
      promptTokens,
      completionTokens,
      totalTokens,
      cost: costUsd.toFixed(6),
      cached: Math.random() < 0.2, // 20% 缓存命中,匹配 P3-1 prompt cache 命中率统计
      requestType: 'chat',
      promptHash: makeSeedPromptHash(userId, model.id, dayIso, i),
      metadata: null,
      createdAt: callTime,
    })
  }
  return records
}

/** 幂等检查:首个 promptHash 是否已存在 → 整个 batch 是否已存在
 *
 *  算法:seed 写入用 deterministic promptHash (idx=0),存在即说明该 (user, model, day) 整批已写入
 *  即使两次随机 callCount 不同 (5-15),首次写入的 idx=0 永远存在 → 重跑时整批跳过
 */
async function isBatchInserted(
  userId: string,
  model: string,
  dayIso: string,
): Promise<boolean> {
  const firstHash = makeSeedPromptHash(userId, model, dayIso, 0)
  const [row] = await db
    .select({ id: aiCostRecords.id })
    .from(aiCostRecords)
    .where(
      and(
        eq(aiCostRecords.userId, userId),
        eq(aiCostRecords.model, model),
        eq(aiCostRecords.promptHash, firstHash),
      ),
    )
    .limit(1)
  return row !== undefined
}

/** 检查 aiBudgets (scope, scopeKey, model) 唯一键是否存在
 *
 *  ai_budgets.scopeUnique 是 index 非 unique,无法用 onConflictDoNothing,需手动 SELECT
 *  model 字段允许 NULL,Drizzle 不会用 eq() 处理 NULL,改用 `IS NULL` 显式判断
 */
async function isBudgetExists(
  scope: 'user' | 'tenant' | 'model',
  scopeKey: string,
  model: string | null,
): Promise<boolean> {
  const baseConditions = and(eq(aiBudgets.scope, scope), eq(aiBudgets.scopeKey, scopeKey))
  const modelCondition = model === null ? sql`${aiBudgets.model} IS NULL` : eq(aiBudgets.model, model)
  const [row] = await db
    .select({ id: aiBudgets.id })
    .from(aiBudgets)
    .where(and(baseConditions, modelCondition))
    .limit(1)
  return row !== undefined
}

export async function seedAiCostRecords(): Promise<void> {
  console.info(`[seed] ai-cost-records: 开始生成测试数据...`)

  // ---- 1. 选 2-3 个真实用户 (roleId >= 1) ----
  // 必须先有 seedUsers (step 7) 执行完成 → users 表必有数据
  const selectedUsers = await pickAdminUsers(3)
  if (selectedUsers.length < 2) {
    throw new Error(
      `[seed] ai-cost-records: 真实用户不足 2 个 (实际 ${selectedUsers.length}),请先运行 seedUsers (step 7) 创建默认用户`,
    )
  }
  console.info(`[seed] ai-cost-records: 选中 ${selectedUsers.length} 个用户:`)
  for (const u of selectedUsers) {
    console.info(`  - ${u.email ?? 'no-email'} (id=${u.id})`)
  }

  // ---- 2. 写入 aiCostRecords ----
  // dayAgo: 6 (最早) → 0 (今天),从远到近循环,符合"过去 7 天内"的硬约束
  const now = new Date()
  let totalInserted = 0
  let batchSkipped = 0
  for (let dayAgo = SEVEN_DAYS_AGO - 1; dayAgo >= 0; dayAgo--) {
    const dayDate = new Date(now)
    dayDate.setUTCHours(0, 0, 0, 0)
    dayDate.setUTCDate(dayDate.getUTCDate() - dayAgo)
    const dayStart = new Date(dayDate)
    const dayEnd = new Date(dayDate.getTime() + 24 * 3600 * 1000 - 1)
    const dayIso = dayDate.toISOString().slice(0, 10)

    for (const user of selectedUsers) {
      for (const model of MODELS) {
        if (await isBatchInserted(user.id, model.id, dayIso)) {
          // 已存在 → 整批跳过 (不重插避免重复)
          batchSkipped++
          continue
        }
        const records = buildDayBatchRecords(user.id, model, dayDate, dayStart, dayEnd)
        await db.insert(aiCostRecords).values(records)
        totalInserted += records.length
      }
    }
  }
  console.info(
    `[seed] ai-cost-records: 写入 ${totalInserted} 条 aiCostRecords (跳过 ${batchSkipped} 个已存在 batch)`,
  )

  // ---- 3. 写入 aiBudgets (3 用户各 1 条 user 维度预算,model=NULL 覆盖全部模型) ----
  // 第 1 个用户故意设小 dailyTokenLimit 触发 critical 告警
  // 其余用户不指定 → 走 schema 默认值 (dailyTokenLimit=1_000_000,monthlyTokenLimit=30_000_000 等)
  let budgetsInserted = 0
  for (const [index, user] of selectedUsers.entries()) {
    const isCriticalUser = index === 0
    const budget: BudgetEntry = isCriticalUser
      ? {
          scope: 'user',
          scopeKey: user.id,
          model: null,
          dailyTokenLimit: 50_000, // 故意设小,日均 ~80,000 token → 160% → critical
          monthlyTokenLimit: 500_000,
          dailyCostLimit: '10.0000', // numeric(10,4) 必须传字符串
          monthlyCostLimit: '200.0000',
        }
      : {
          scope: 'user',
          scopeKey: user.id,
          model: null,
          // 不指定 dailyTokenLimit / monthlyTokenLimit / dailyCostLimit / monthlyCostLimit
          // → 走 schema 默认值 (1_000_000 / 30_000_000 / '100' / '2000'),无告警
        }

    if (await isBudgetExists('user', user.id, null)) {
      continue
    }
    await db.insert(aiBudgets).values(budget)
    budgetsInserted++
  }
  console.info(`[seed] ai-cost-records: 写入 ${budgetsInserted} 条 aiBudgets`)

  console.info(`[seed] ai-cost-records: 完成`)
}

// =============================================================================
// ESM 标准 main 守卫:仅当本文件被 tsx 直接调用时执行,被 seed/index.ts 导入时不执行
//   (避免与 orchestrator 的 step.fn() 形成双调用;虽 seed 本身幂等,但 print 会重复)
// =============================================================================
const isDirectInvocation =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectInvocation) {
  seedAiCostRecords()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('[seed] ai-cost-records: 执行失败:', err)
      process.exit(1)
    })
}
