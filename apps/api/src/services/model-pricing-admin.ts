// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型定价管理服务(2026-11-13 立)。
 *
 * 背景:补价只做一次等于没做 —— 新渠道一同步就冒出零价行,运营也看不到"这个模型的价
 * 从哪来、是否兜底猜的、有没有手工改过"。本服务把定价从「一次性脚本」升级为
 * 「可查询、可筛选、可调价、可审计、可巡检」的持续管理面。
 *
 * 职责:
 * 1. listModelPricing  列表 + 筛选(问题模型优先:零价/兜底档/未留痕)
 * 2. getPricingOverview 概览(总量/零价/兜底/已留痕/按档位分布)
 * 3. updateModelPrice  人工调价(写 ai_pricing + config + **审计**)
 * 4. listPriceAudits   调价历史
 * 5. sweepNow          手动触发零价巡检(复用 model-price-resolver 唯一出口)
 * 6. syncPublicCatalog 公示表 zhs_ai_model_info 与实际上架模型同步(消除两套数据脱节)
 *
 * 单源原则:定价计算一律走 model-price-resolver,本服务不重算价格。
 */
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { sweepUnpricedModels, PROFIT_FACTOR } from './model-price-resolver.js'

function rowsOf<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[]
  const maybe = (r as { rows?: unknown[] }).rows
  return Array.isArray(maybe) ? (maybe as T[]) : []
}

export interface ModelPricingListItem {
  id: number
  configId: number
  modelId: string
  displayName: string | null
  providerCode: string
  enabled: boolean
  isRelayPublic: boolean
  inputPricePer1k: number
  outputPricePer1k: number
  /** 元/百万 token(展示口径,= 分/1k × 10) */
  inputPerMillion: number
  outputPerMillion: number
  tier: string | null
  source: string | null
  refModel: string | null
  /** 是否零价(启用且进/出价都为 0 且计费表也无价)—— 这是必须立刻处理的问题行 */
  isZeroPriced: boolean
  /** 是否兜底猜价(provider-fallback / global-fallback),运营应优先复核 */
  isFallback: boolean
  /** 是否有价格来源留痕 */
  hasPriceSource: boolean
  relayPriceMultiplier: string | null
}

export interface ListModelPricingQuery {
  q?: string
  providerCode?: string
  tier?: string
  /** true = 只看问题行(零价 或 兜底 或 无留痕) */
  onlyProblems?: boolean
  enabled?: boolean
  limit?: number
  offset?: number
}

const asNum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 模型定价列表(问题行优先排序,方便运营一眼看到该处理的) */
export async function listModelPricing(query: ListModelPricingQuery): Promise<{
  items: ModelPricingListItem[]
  total: number
  limit: number
  offset: number
}> {
  const limit = Math.min(500, Math.max(1, query.limit ?? 50))
  const offset = Math.max(0, query.offset ?? 0)

  const conds: ReturnType<typeof sql>[] = []
  if (query.q) {
    const like = `%${String(query.q).toLowerCase()}%`
    conds.push(
      sql`(lower(m.model_id) like ${like} or lower(coalesce(m.display_name, '')) like ${like})`,
    )
  }
  if (query.providerCode) conds.push(sql`c.provider_code = ${query.providerCode}`)
  if (query.enabled !== undefined) conds.push(sql`m.enabled = ${query.enabled}`)
  if (query.tier) conds.push(sql`(m.metadata->'priceSource'->>'tier') = ${query.tier}`)
  if (query.onlyProblems) {
    // 注意:config 价 0 不等于白送 —— 计费优先读 ai_pricing,只有两边都没价才是真零价。
    // 这里必须用"真零价"口径,否则运营会被几百行假问题淹没(实测 511 → 真问题约 90)。
    conds.push(sql`(
      (
        coalesce(m.input_price_per_1k, 0) = 0
        and coalesce(m.output_price_per_1k, 0) = 0
        and not exists (
          select 1 from ai_pricing p
          where p.model_id = lower(m.model_id)
            and (p.input_token_price > 0 or p.output_token_price > 0)
        )
      )
      or (m.metadata->'priceSource'->>'tier') in ('provider-fallback', 'global-fallback')
    )`)
  }
  const where = conds.length > 0 ? sql`where ${sql.join(conds, sql` and `)}` : sql``

  const countRes = await db.execute(sql`
    select count(*)::int as n
    from ai_model_config_models m
    join ai_model_config c on c.id = m.config_id
    ${where}
  `)
  const total = asNum(rowsOf<{ n: number }>(countRes)[0]?.n)

  const listRes = await db.execute(sql`
    select
      m.id, m.config_id, m.model_id, m.display_name, c.provider_code,
      m.enabled, m.is_relay_public, m.relay_price_multiplier,
      coalesce(m.input_price_per_1k, 0) as input_price_per_1k,
      coalesce(m.output_price_per_1k, 0) as output_price_per_1k,
      m.metadata->'priceSource'->>'tier' as tier,
      m.metadata->'priceSource'->>'source' as src,
      m.metadata->'priceSource'->>'refModel' as ref_model,
      (coalesce(m.metadata, '{}'::jsonb) ? 'priceSource') as has_source,
      not exists (
        select 1 from ai_pricing p
        where p.model_id = lower(m.model_id)
          and (p.input_token_price > 0 or p.output_token_price > 0)
      ) as pricing_missing
    from ai_model_config_models m
    join ai_model_config c on c.id = m.config_id
    ${where}
    order by
      (coalesce(m.input_price_per_1k, 0) = 0 or coalesce(m.output_price_per_1k, 0) = 0) desc,
      (m.metadata->'priceSource'->>'tier' = 'global-fallback') desc,
      (m.metadata->'priceSource'->>'tier' = 'provider-fallback') desc,
      c.provider_code, m.model_id
    limit ${limit} offset ${offset}
  `)

  const items = rowsOf<Record<string, unknown>>(listRes).map((r) => {
    const inP = asNum(r['input_price_per_1k'])
    const outP = asNum(r['output_price_per_1k'])
    const tier = (r['tier'] as string | null) ?? null
    const isZeroPriced =
      inP === 0 && outP === 0 && (r['pricing_missing'] === true || r['pricing_missing'] === 't')
    return {
      id: asNum(r['id']),
      configId: asNum(r['config_id']),
      modelId: String(r['model_id'] ?? ''),
      displayName: (r['display_name'] as string | null) ?? null,
      providerCode: String(r['provider_code'] ?? ''),
      enabled: r['enabled'] === true || r['enabled'] === 't',
      isRelayPublic: r['is_relay_public'] === true || r['is_relay_public'] === 't',
      inputPricePer1k: inP,
      outputPricePer1k: outP,
      inputPerMillion: Math.round(inP * 10 * 1e4) / 1e4,
      outputPerMillion: Math.round(outP * 10 * 1e4) / 1e4,
      tier,
      source: (r['src'] as string | null) ?? null,
      refModel: (r['ref_model'] as string | null) ?? null,
      isZeroPriced,
      isFallback: tier === 'provider-fallback' || tier === 'global-fallback',
      hasPriceSource: r['has_source'] === true || r['has_source'] === 't',
      relayPriceMultiplier: (r['relay_price_multiplier'] as string | null) ?? null,
    }
  })

  return { items, total, limit, offset }
}

export interface PricingOverview {
  totalModels: number
  enabledModels: number
  zeroPriced: number
  fallbackPriced: number
  untraced: number
  byTier: Record<string, number>
  byProvider: Array<{ providerCode: string; total: number; zero: number; fallback: number }>
}

/** 定价概览(运营首页用:一眼看出还有多少问题行) */
export async function getPricingOverview(): Promise<PricingOverview> {
  const aggRes = await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where m.enabled)::int as enabled,
      count(*) filter (
        where m.enabled
          and coalesce(m.input_price_per_1k, 0) = 0
          and coalesce(m.output_price_per_1k, 0) = 0
          and not exists (
            select 1 from ai_pricing p
            where p.model_id = lower(m.model_id)
              and (p.input_token_price > 0 or p.output_token_price > 0)
          )
      )::int as zero_priced,
      count(*) filter (
        where m.enabled
          and (m.metadata->'priceSource'->>'tier') in ('provider-fallback', 'global-fallback')
      )::int as fallback_priced,
      count(*) filter (where m.enabled and not (coalesce(m.metadata, '{}'::jsonb) ? 'priceSource'))::int as untraced
    from ai_model_config_models m
  `)
  const agg = rowsOf<Record<string, unknown>>(aggRes)[0] ?? {}

  const tierRes = await db.execute(sql`
    select coalesce(m.metadata->'priceSource'->>'tier', 'untraced') as tier, count(*)::int as n
    from ai_model_config_models m
    where m.enabled
    group by 1
    order by 2 desc
  `)
  const byTier: Record<string, number> = {}
  for (const r of rowsOf<Record<string, unknown>>(tierRes)) {
    byTier[String(r['tier'] ?? 'untraced')] = asNum(r['n'])
  }

  const provRes = await db.execute(sql`
    select
      c.provider_code,
      count(*)::int as total,
      count(*) filter (
        where coalesce(m.input_price_per_1k, 0) = 0 and coalesce(m.output_price_per_1k, 0) = 0
      )::int as zero,
      count(*) filter (
        where (m.metadata->'priceSource'->>'tier') in ('provider-fallback', 'global-fallback')
      )::int as fallback
    from ai_model_config_models m
    join ai_model_config c on c.id = m.config_id
    where m.enabled
    group by 1
    order by 2 desc
    limit 50
  `)

  return {
    totalModels: asNum(agg['total']),
    enabledModels: asNum(agg['enabled']),
    zeroPriced: asNum(agg['zero_priced']),
    fallbackPriced: asNum(agg['fallback_priced']),
    untraced: asNum(agg['untraced']),
    byTier,
    byProvider: rowsOf<Record<string, unknown>>(provRes).map((r) => ({
      providerCode: String(r['provider_code'] ?? ''),
      total: asNum(r['total']),
      zero: asNum(r['zero']),
      fallback: asNum(r['fallback']),
    })),
  }
}

/** 写审计(只追加;失败不阻断主流程,但要留日志) */
async function writeAudit(args: {
  modelId: string
  configId: number | null
  oldIn: number | null
  oldOut: number | null
  newIn: number
  newOut: number
  changeSource: string
  tier: string | null
  refModel: string | null
  operatorId: string | null
  note: string | null
}): Promise<void> {
  try {
    await db.execute(sql`
      insert into ai_model_price_audit
        (model_id, config_id, old_input_per_1k, old_output_per_1k, new_input_per_1k, new_output_per_1k,
         change_source, change_tier, ref_model, operator_id, note)
      values
        (${args.modelId}, ${args.configId}, ${args.oldIn}, ${args.oldOut}, ${args.newIn}, ${args.newOut},
         ${args.changeSource}, ${args.tier}, ${args.refModel}, ${args.operatorId}, ${args.note})
    `)
  } catch (e) {
    logger.warn(`[model-pricing-admin] 审计写入失败(不影响调价): ${String(e).slice(0, 160)}`)
  }
}

/**
 * 人工调价。价格单位 **分/千 token**,与 ai_pricing/config 同口径。
 * 同时写 ai_pricing(计费真源)+ config(展示/下发)+ 审计三处,保证不会出现"后台看着改了、实际扣费没变"。
 */
export async function updateModelPrice(args: {
  modelRowId: number
  configId: number
  modelId: string
  inputPer1k: number
  outputPer1k: number
  operatorId: string | null
  note: string | null
  applyPricing: (a: {
    modelId: string
    inputTokenPrice: number
    outputTokenPrice: number
    billingMode: 'token'
  }) => Promise<unknown>
}): Promise<{ ok: true; before: { input: number; output: number } }> {
  const beforeRes = await db.execute(sql`
    select coalesce(input_price_per_1k, 0) as i, coalesce(output_price_per_1k, 0) as o
    from ai_model_config_models
    where id = ${args.modelRowId} and config_id = ${args.configId}
    limit 1
  `)
  const beforeRow = rowsOf<Record<string, unknown>>(beforeRes)[0]
  const oldIn = beforeRow ? asNum(beforeRow['i']) : null
  const oldOut = beforeRow ? asNum(beforeRow['o']) : null

  const inP = Math.round(args.inputPer1k * 1e6) / 1e6
  const outP = Math.round(args.outputPer1k * 1e6) / 1e6

  await args.applyPricing({
    modelId: args.modelId.toLowerCase(),
    inputTokenPrice: inP,
    outputTokenPrice: outP,
    billingMode: 'token',
  })
  await db.execute(sql`
    update ai_model_config_models
    set input_price_per_1k = ${String(inP)}, output_price_per_1k = ${String(outP)},
        cost_input_price_per_1k = ${String(Math.round((inP / PROFIT_FACTOR) * 1e6) / 1e6)},
        cost_output_price_per_1k = ${String(Math.round((outP / PROFIT_FACTOR) * 1e6) / 1e6)},
        metadata = coalesce(metadata, '{}'::jsonb) || ${JSON.stringify({
          priceSource: {
            tier: 'manual',
            source: 'manual',
            refModel: null,
            profitFactor: PROFIT_FACTOR,
            resolvedAt: new Date().toISOString(),
          },
        })}::jsonb,
        updated_at = now()
    where id = ${args.modelRowId} and config_id = ${args.configId}
  `)
  await writeAudit({
    modelId: args.modelId,
    configId: args.configId,
    oldIn,
    oldOut,
    newIn: inP,
    newOut: outP,
    changeSource: 'manual',
    tier: 'manual',
    refModel: null,
    operatorId: args.operatorId,
    note: args.note,
  })
  logger.info(`[model-pricing-admin] 人工调价 ${args.modelId} ${oldIn}/${oldOut} → ${inP}/${outP}`)
  return { ok: true, before: { input: oldIn ?? 0, output: oldOut ?? 0 } }
}

/** 调价历史(按模型或全量) */
export async function listPriceAudits(query: {
  modelId?: string
  limit?: number
  offset?: number
}): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const limit = Math.min(500, Math.max(1, query.limit ?? 50))
  const offset = Math.max(0, query.offset ?? 0)
  const where = query.modelId ? sql`where model_id = ${query.modelId}` : sql``
  const countRes = await db.execute(
    sql`select count(*)::int as n from ai_model_price_audit ${where}`,
  )
  const total = asNum(rowsOf<{ n: number }>(countRes)[0]?.n)
  const listRes = await db.execute(sql`
    select *
    from ai_model_price_audit
    ${where}
    order by created_at desc
    limit ${limit} offset ${offset}
  `)
  return { items: rowsOf<Record<string, unknown>>(listRes), total }
}

/** 手动触发零价巡检(与定时任务同一个出口) */
export async function sweepNow(args: {
  dryRun: boolean
  applyPricing: (a: {
    modelId: string
    inputTokenPrice: number
    outputTokenPrice: number
    billingMode: 'token'
  }) => Promise<unknown>
}): Promise<Awaited<ReturnType<typeof sweepUnpricedModels>>> {
  return sweepUnpricedModels(
    db as unknown as { execute: (q: unknown) => Promise<unknown> },
    args.applyPricing,
    {
      dryRun: args.dryRun,
    },
  )
}

/**
 * 公示表同步(2026-11-13 立):把「实际启用且对外公示」的模型写进 zhs_ai_model_info。
 *
 * 背景:前端 /llm/models 读的是 zhs_ai_model_info,而计费/路由读 ai_model_config_models,
 * 两套数据长期脱节(公示 102 行 vs 实际 1400+)。本函数只做**增量补齐**:
 * - 已有同名行 → 不动(保留运营手工编辑的图标/描述/排序)
 * - 缺失 → 插入最小行(name + type=0 + status=1)
 * 不做删除:运营手工下线某模型只改 status,不能被同步逻辑复活。
 */
export async function syncPublicCatalog(): Promise<{
  scanned: number
  inserted: number
  existing: number
}> {
  const srcRes = await db.execute(sql`
    select distinct m.model_id, m.display_name
    from ai_model_config_models m
    where m.enabled = true and m.is_relay_public = true
  `)
  const src = rowsOf<Record<string, unknown>>(srcRes)
  const exRes = await db.execute(sql`select lower(name) as n from zhs_ai_model_info`)
  const existing = new Set(rowsOf<Record<string, unknown>>(exRes).map((r) => String(r['n'] ?? '')))

  let inserted = 0
  let skipped = 0
  for (const r of src) {
    const name = String(r['display_name'] || r['model_id'] || '').trim()
    if (!name) continue
    if (existing.has(name.toLowerCase())) {
      skipped++
      continue
    }
    await db.execute(sql`
      insert into zhs_ai_model_info (name, status, type, sort)
      values (${name}, 1, 0, 0)
    `)
    existing.add(name.toLowerCase())
    inserted++
  }
  logger.info(
    `[model-pricing-admin] 公示表同步 scanned=${src.length} inserted=${inserted} existing=${skipped}`,
  )
  return { scanned: src.length, inserted, existing: skipped }
}

// =============================================================================
// 7. getProfitReport 利润看板(2026-11-14 立)
// =============================================================================
// 口径(唯一数据源 = llm_call_logs,不在本服务重算单价):
// - 收入 revenueCents = cost_cents,即对用户实收;
// - 成本 costCents = metadata->>'providerCostCents',仅成本已知的调用计入;
// - 毛利 profitCents = 成本已知行的收入 − 成本;成本未知行只计入收入、不计利润,
//   绝不把"成本未知"当"零成本"虚增毛利;
// - costCoverage = 成本已知调用数 / 总调用数,低于 100% 说明部分模型缺定价留痕。

export type ProfitGroupBy = 'day' | 'model' | 'provider'

export interface ProfitBucket {
  bucket: string
  calls: number
  /** 成本已知的调用数 */
  costedCalls: number
  /** 对用户实收总额(分,含全部调用) */
  revenueCents: number
  /** 成本已知行对应的收入(分) */
  costedRevenueCents: number
  /** 采购成本(分,仅成本已知行) */
  costCents: number
  /** 毛利(分)= 成本已知行收入 − 成本 */
  profitCents: number
  /** 毛利率(0~1,分母为成本已知行收入) */
  margin: number
}

export interface ProfitReport {
  from: string
  to: string
  groupBy: ProfitGroupBy
  totals: Omit<ProfitBucket, 'bucket'> & { costCoverage: number }
  rows: ProfitBucket[]
}

function toProfitBucket(r: Record<string, unknown>): ProfitBucket {
  const costedRevenueCents = asNum(r['costed_revenue_cents'])
  const costCents = asNum(r['cost_cents'])
  const profitCents = costedRevenueCents - costCents
  return {
    bucket: String(r['bucket'] ?? ''),
    calls: asNum(r['calls']),
    costedCalls: asNum(r['costed_calls']),
    revenueCents: asNum(r['revenue_cents']),
    costedRevenueCents,
    costCents,
    profitCents,
    margin: costedRevenueCents > 0 ? profitCents / costedRevenueCents : 0,
  }
}

export async function getProfitReport(args: {
  from: string
  to: string
  groupBy?: ProfitGroupBy
  limit?: number
}): Promise<ProfitReport> {
  const groupBy: ProfitGroupBy = args.groupBy ?? 'day'
  const rawLimit = Number(args.limit ?? 30)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 30, 1), 200)
  const bucketExpr =
    groupBy === 'model'
      ? sql`coalesce(model, 'unknown')`
      : groupBy === 'provider'
        ? sql`coalesce(provider_code, 'unknown')`
        : sql`to_char(created_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`

  const whereExpr = sql`
    created_at >= ${args.from}::date
    and created_at < (${args.to}::date + interval '1 day')
    and status in ('success', 'partial')
  `

  const totalRes = await db.execute(sql`
    select
      count(*)::int as calls,
      count(*) filter (where metadata ? 'providerCostCents')::int as costed_calls,
      coalesce(sum(cost_cents), 0)::numeric as revenue_cents,
      coalesce(sum(case when metadata ? 'providerCostCents' then cost_cents else 0 end), 0)::numeric as costed_revenue_cents,
      coalesce(sum(case when metadata ? 'providerCostCents' then (metadata->>'providerCostCents')::numeric else 0 end), 0)::numeric as cost_cents
    from llm_call_logs
    where ${whereExpr}
  `)

  const rowsRes = await db.execute(sql`
    select
      ${bucketExpr} as bucket,
      count(*)::int as calls,
      count(*) filter (where metadata ? 'providerCostCents')::int as costed_calls,
      coalesce(sum(cost_cents), 0)::numeric as revenue_cents,
      coalesce(sum(case when metadata ? 'providerCostCents' then cost_cents else 0 end), 0)::numeric as costed_revenue_cents,
      coalesce(sum(case when metadata ? 'providerCostCents' then (metadata->>'providerCostCents')::numeric else 0 end), 0)::numeric as cost_cents
    from llm_call_logs
    where ${whereExpr}
    group by 1
    order by revenue_cents desc
    limit ${limit}
  `)

  const totals = toProfitBucket(rowsOf<Record<string, unknown>>(totalRes)[0] ?? {})
  return {
    from: args.from,
    to: args.to,
    groupBy,
    totals: {
      calls: totals.calls,
      costedCalls: totals.costedCalls,
      revenueCents: totals.revenueCents,
      costedRevenueCents: totals.costedRevenueCents,
      costCents: totals.costCents,
      profitCents: totals.profitCents,
      margin: totals.margin,
      costCoverage: totals.calls > 0 ? totals.costedCalls / totals.calls : 0,
    },
    rows: rowsOf<Record<string, unknown>>(rowsRes).map(toProfitBucket),
  }
}

// =============================================================================
// 8. backfillCostPrices 成本列回填(2026-11-14 立)
// =============================================================================
// 迁移 400 之后,历史模型行的 cost_* 仍为 null(售价有值但成本未知)。
// 这里按 metadata.priceSource.profitFactor 一次性反推回填,幂等:
// 只处理 cost_* 为空且 profitFactor>=1 的行,重复调用不会覆盖已有值。
// 人工调价/sweep 之后的成本列由写入路径直接维护,不依赖本函数。

export interface CostBackfillResult {
  /** 待处理候选(成本为空的模型行) */
  scanned: number
  /** 本次回填行数 */
  updated: number
  /** 候选里缺 profitFactor、无法反推的行数 */
  skipped: number
}

export async function backfillCostPrices(): Promise<CostBackfillResult> {
  const scanRes = await db.execute(sql`
    select count(*)::int as n
    from ai_model_config_models
    where cost_input_price_per_1k is null or cost_output_price_per_1k is null
  `)
  const scanned = asNum(rowsOf<{ n: number }>(scanRes)[0]?.n)

  const updatedRes = await db.execute(sql`
    with src as (
      select id,
             input_price_per_1k,
             output_price_per_1k,
             nullif(metadata->'priceSource'->>'profitFactor', '')::numeric as pf
      from ai_model_config_models
      where (cost_input_price_per_1k is null or cost_output_price_per_1k is null)
        and metadata ? 'priceSource'
    )
    update ai_model_config_models m
    set cost_input_price_per_1k = round(s.input_price_per_1k / s.pf, 6),
        cost_output_price_per_1k = round(s.output_price_per_1k / s.pf, 6),
        updated_at = now()
    from src s
    where m.id = s.id
      and s.pf is not null
      and s.pf >= 1
    returning m.id
  `)
  const updated = rowsOf<Record<string, unknown>>(updatedRes).length
  return { scanned, updated, skipped: Math.max(0, scanned - updated) }
}

// =============================================================================
// 9. backfillCallCosts 历史调用成本补数(2026-11-14 立)
// =============================================================================
// 背景:成本/毛利从 2026-11-14 起才在 recordCall 里落账(metadata.providerCostCents),
// 存量 llm_call_logs 全部缺这两个键 ⇒ 利润看板的历史区间成本覆盖率恒为 0。
//
// 口径(与在线计费同源,不另造一套):
// - token 模式:成本 = prompt_tokens/1000 × 模型采购入价 + completion_tokens/1000 × 采购出价;
// - per_call/per_image/per_video/per_credit:按「采购成本 / 售价」的模型级比率 × 实收,
//   比率取 cost_* / price_*,缺失时退回 1/profitFactor;
// - 毛利 = 实收(cost_cents) − 采购成本,允许为负(亏损调用必须如实暴露);
// - BYOK:上游成本由用户自付 ⇒ 成本 0、毛利 = 平台抽成(platformFeeCents);
// - 缓存命中:未调用上游 ⇒ 成本 0、毛利 0。
//
// 幂等:只处理 metadata 尚无 providerCostCents 的行,重复调用不会覆盖已有值。

export interface CallCostBackfillResult {
  /** 待补候选数(成功/部分成功且尚无成本留痕) */
  scanned: number
  /** 本次实际写入行数 */
  updated: number
  /** 按成本口径拆分 */
  byBasis: { actual: number; derived: number; byok: number; cacheHit: number }
  /** 模型无采购成本、无法反推的行数 */
  skipped: number
  dryRun: boolean
}

/** 模型 → 采购成本 的单一来源 CTE(同一 model 多 config 时优先有真实成本、再按 config_id 倒序) */
function modelCostCte() {
  return sql`
    model_cost as (
      select distinct on (lower(m.model_id))
        lower(m.model_id) as mid,
        coalesce(
          m.cost_input_price_per_1k,
          m.input_price_per_1k / nullif(nullif(m.metadata->'priceSource'->>'profitFactor', '')::numeric, 0)
        ) as cost_in,
        coalesce(
          m.cost_output_price_per_1k,
          m.output_price_per_1k / nullif(nullif(m.metadata->'priceSource'->>'profitFactor', '')::numeric, 0)
        ) as cost_out,
        case
          when coalesce(m.input_price_per_1k, 0) > 0 and m.cost_input_price_per_1k is not null
            then m.cost_input_price_per_1k / m.input_price_per_1k
          when nullif(m.metadata->'priceSource'->>'profitFactor', '')::numeric >= 1
            then 1.0 / nullif(m.metadata->'priceSource'->>'profitFactor', '')::numeric
          else null
        end as cost_ratio,
        case
          when m.cost_input_price_per_1k is not null or m.cost_output_price_per_1k is not null
            then 'actual'
          else 'derived'
        end as basis
      from ai_model_config_models m
      where m.cost_input_price_per_1k is not null
         or m.cost_output_price_per_1k is not null
         or (
           nullif(m.metadata->'priceSource'->>'profitFactor', '')::numeric >= 1
           and (coalesce(m.input_price_per_1k, 0) > 0 or coalesce(m.output_price_per_1k, 0) > 0)
         )
      order by lower(m.model_id),
               (m.cost_input_price_per_1k is null) asc,
               m.config_id desc
    )
  `
}

export async function backfillCallCosts(args?: {
  from?: string
  to?: string
  dryRun?: boolean
}): Promise<CallCostBackfillResult> {
  const dryRun = args?.dryRun === true
  const rangeConds: ReturnType<typeof sql>[] = []
  if (args?.from) rangeConds.push(sql`l.created_at >= ${args.from}::date`)
  if (args?.to) rangeConds.push(sql`l.created_at < (${args.to}::date + interval '1 day')`)
  const range = rangeConds.length > 0 ? sql`and ${sql.join(rangeConds, sql` and `)}` : sql``

  const scanRes = await db.execute(sql`
    with ${modelCostCte()}
    select
      count(*)::int as scanned,
      count(*) filter (
        where (l.metadata->>'byokMode') = 'true'
      )::int as byok,
      count(*) filter (
        where (l.metadata->>'cacheHit') = 'true' and (l.metadata->>'byokMode') is distinct from 'true'
      )::int as cache_hit,
      count(*) filter (
        where (l.metadata->>'byokMode') is distinct from 'true'
          and (l.metadata->>'cacheHit') is distinct from 'true'
          and mc.mid is not null
      )::int as costed,
      count(*) filter (
        where (l.metadata->>'byokMode') is distinct from 'true'
          and (l.metadata->>'cacheHit') is distinct from 'true'
          and mc.mid is null
      )::int as uncosted
    from llm_call_logs l
    left join model_cost mc on lower(l.model) = mc.mid
    where l.status in ('success', 'partial')
      and l.cost_cents is not null
      and not (coalesce(l.metadata, '{}'::jsonb) ? 'providerCostCents')
      ${range}
  `)
  const scan = rowsOf<Record<string, unknown>>(scanRes)[0] ?? {}
  const scanned = asNum(scan['scanned'])
  const skipped = asNum(scan['uncosted'])

  if (dryRun) {
    return {
      scanned,
      updated: 0,
      byBasis: { actual: 0, derived: 0, byok: 0, cacheHit: 0 },
      skipped,
      dryRun: true,
    }
  }

  // ① token/按次/按图/按视频/按积分:按模型采购成本反推
  const costedRes = await db.execute(sql`
    with ${modelCostCte()},
    pending as (
      select
        l.id,
        l.cost_cents,
        mc.basis,
        round(
          case
            when coalesce(l.metadata->>'billingMode', 'token') = 'token'
              and (mc.cost_in is not null or mc.cost_out is not null)
              then coalesce(l.prompt_tokens, 0) / 1000.0 * coalesce(mc.cost_in, 0)
                 + coalesce(l.completion_tokens, 0) / 1000.0 * coalesce(mc.cost_out, 0)
            else coalesce(l.cost_cents, 0) * coalesce(mc.cost_ratio, 0)
          end,
          6
        ) as provider_cost
      from llm_call_logs l
      join model_cost mc on lower(l.model) = mc.mid
      where l.status in ('success', 'partial')
        and l.cost_cents is not null
        and not (coalesce(l.metadata, '{}'::jsonb) ? 'providerCostCents')
        and (l.metadata->>'byokMode') is distinct from 'true'
        and (l.metadata->>'cacheHit') is distinct from 'true'
        ${range}
    )
    update llm_call_logs l
    set metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
      'providerCostCents', p.provider_cost,
      'profitCents', round(coalesce(l.cost_cents, 0) - p.provider_cost, 6),
      'costBasis', p.basis,
      'costedRevenueCents', coalesce(l.cost_cents, 0),
      'costBackfilledAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
    from pending p
    where l.id = p.id
    returning p.basis
  `)
  const updatedRows = rowsOf<{ basis: string }>(costedRes)
  const actual = updatedRows.filter((r) => r.basis === 'actual').length
  const derived = updatedRows.length - actual

  // ② BYOK:上游成本由用户自付,平台毛利 = 抽成
  const byokRes = await db.execute(sql`
    update llm_call_logs l
    set metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
      'providerCostCents', 0,
      'profitCents', coalesce((l.metadata->>'platformFeeCents')::numeric, coalesce(l.cost_cents, 0)),
      'costBasis', 'byok',
      'costedRevenueCents', coalesce(l.cost_cents, 0),
      'costBackfilledAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
    where l.status in ('success', 'partial')
      and l.cost_cents is not null
      and not (coalesce(l.metadata, '{}'::jsonb) ? 'providerCostCents')
      and (l.metadata->>'byokMode') = 'true'
      ${range}
    returning l.id
  `)
  const byokUpdated = rowsOf<Record<string, unknown>>(byokRes).length

  // ③ 缓存命中:未调用上游,成本与毛利同为 0
  const cacheRes = await db.execute(sql`
    update llm_call_logs l
    set metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
      'providerCostCents', 0,
      'profitCents', 0,
      'costBasis', 'derived',
      'costedRevenueCents', 0,
      'costBackfilledAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
    where l.status in ('success', 'partial')
      and l.cost_cents is not null
      and not (coalesce(l.metadata, '{}'::jsonb) ? 'providerCostCents')
      and (l.metadata->>'cacheHit') = 'true'
      and (l.metadata->>'byokMode') is distinct from 'true'
      ${range}
    returning l.id
  `)
  const cacheUpdated = rowsOf<Record<string, unknown>>(cacheRes).length

  const updated = updatedRows.length + byokUpdated + cacheUpdated
  logger.info(
    `[model-pricing-admin] 历史调用成本补数 scanned=${scanned} updated=${updated} actual=${actual} derived=${derived} byok=${byokUpdated} cache=${cacheUpdated} skipped=${skipped}`,
  )
  return {
    scanned,
    updated,
    byBasis: { actual, derived, byok: byokUpdated, cacheHit: cacheUpdated },
    skipped: Math.max(0, skipped),
    dryRun: false,
  }
}

// =============================================================================
// 10. getChannelCostReport 渠道成本报表 + 扣费对账(2026-11-14 立)
// =============================================================================
// 目的:把「上游渠道/上游账号花了多少、卖了多少、赚了多少」和「API Key 扣费台账」
// 放到同一张表里,避免只看到收入却不知道钱从哪条渠道出去。
//
// 口径与利润看板一致(成本只算已留痕行),额外给出:
// - errorCalls:该渠道的失败调用数(失败不计费,但能暴露上游稳定性);
// - reconciliation:llm_call_logs 累计实收 vs developer_api_keys 累计已用金额(生命周期),
//   差值非零说明存在未落流水/补数/人工调整,需人工核对。

export type ChannelGroupBy = 'provider' | 'keypool'

export interface ChannelCostRow {
  bucket: string
  calls: number
  errorCalls: number
  costedCalls: number
  /** 实收为 0 的成功调用数(套餐内/免费额度/内部调用),负毛利的主要来源 */
  zeroRevenueCalls: number
  /** 这些零实收调用对应的采购成本(分) */
  zeroRevenueCostCents: number
  revenueCents: number
  costedRevenueCents: number
  costCents: number
  profitCents: number
  margin: number
  costCoverage: number
}

export interface ChannelCostReport {
  from: string
  to: string
  groupBy: ChannelGroupBy
  totals: Omit<ChannelCostRow, 'bucket'>
  rows: ChannelCostRow[]
  reconciliation: {
    scope: 'lifetime'
    logsRevenueCents: number
    keysUsedTotalCents: number
    diffCents: number
  }
}

function toChannelRow(r: Record<string, unknown>): ChannelCostRow {
  const costedRevenueCents = asNum(r['costed_revenue_cents'])
  const costCents = asNum(r['cost_cents'])
  const profitCents = costedRevenueCents - costCents
  const calls = asNum(r['calls'])
  const costedCalls = asNum(r['costed_calls'])
  return {
    bucket: String(r['bucket'] ?? ''),
    calls,
    errorCalls: asNum(r['error_calls']),
    costedCalls,
    zeroRevenueCalls: asNum(r['zero_revenue_calls']),
    zeroRevenueCostCents: asNum(r['zero_revenue_cost_cents']),
    revenueCents: asNum(r['revenue_cents']),
    costedRevenueCents,
    costCents,
    profitCents,
    margin: costedRevenueCents > 0 ? profitCents / costedRevenueCents : 0,
    costCoverage: calls > 0 ? costedCalls / calls : 0,
  }
}

export async function getChannelCostReport(args: {
  from: string
  to: string
  groupBy?: ChannelGroupBy
  limit?: number
}): Promise<ChannelCostReport> {
  const groupBy: ChannelGroupBy = args.groupBy ?? 'provider'
  const rawLimit = Number(args.limit ?? 50)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50, 1), 200)
  const bucketExpr =
    groupBy === 'keypool'
      ? sql`coalesce(key_pool_id::text, 'unassigned')`
      : sql`coalesce(provider_code, 'unknown')`
  const whereExpr = sql`
    created_at >= ${args.from}::date
    and created_at < (${args.to}::date + interval '1 day')
  `
  const aggSelect = sql`
    count(*) filter (where status in ('success', 'partial'))::int as calls,
    count(*) filter (where status = 'error')::int as error_calls,
    count(*) filter (
      where status in ('success', 'partial') and metadata ? 'providerCostCents'
    )::int as costed_calls,
    count(*) filter (
      where status in ('success', 'partial') and coalesce(cost_cents, 0) = 0
    )::int as zero_revenue_calls,
    coalesce(sum(case when status in ('success', 'partial') and coalesce(cost_cents, 0) = 0
      and metadata ? 'providerCostCents' then (metadata->>'providerCostCents')::numeric else 0 end), 0)::numeric as zero_revenue_cost_cents,
    coalesce(sum(case when status in ('success', 'partial') then cost_cents else 0 end), 0)::numeric as revenue_cents,
    coalesce(sum(case when status in ('success', 'partial') and metadata ? 'providerCostCents' then cost_cents else 0 end), 0)::numeric as costed_revenue_cents,
    coalesce(sum(case when status in ('success', 'partial') and metadata ? 'providerCostCents' then (metadata->>'providerCostCents')::numeric else 0 end), 0)::numeric as cost_cents
  `

  const totalRes = await db.execute(sql`
    select ${aggSelect}
    from llm_call_logs
    where ${whereExpr}
  `)
  const rowsRes = await db.execute(sql`
    select ${bucketExpr} as bucket, ${aggSelect}
    from llm_call_logs
    where ${whereExpr}
    group by 1
    order by revenue_cents desc
    limit ${limit}
  `)
  const reconRes = await db.execute(sql`
    select
      (select coalesce(sum(cost_cents), 0)::numeric
         from llm_call_logs where status in ('success', 'partial')) as logs_revenue_cents,
      (select coalesce(sum(cost_used_total_cents), 0)::numeric
         from developer_api_keys) as keys_used_total_cents
  `)
  const recon = rowsOf<Record<string, unknown>>(reconRes)[0] ?? {}
  const logsRevenueCents = asNum(recon['logs_revenue_cents'])
  const keysUsedTotalCents = asNum(recon['keys_used_total_cents'])

  const totals = toChannelRow(rowsOf<Record<string, unknown>>(totalRes)[0] ?? {})
  return {
    from: args.from,
    to: args.to,
    groupBy,
    totals: {
      calls: totals.calls,
      errorCalls: totals.errorCalls,
      costedCalls: totals.costedCalls,
      zeroRevenueCalls: totals.zeroRevenueCalls,
      zeroRevenueCostCents: totals.zeroRevenueCostCents,
      revenueCents: totals.revenueCents,
      costedRevenueCents: totals.costedRevenueCents,
      costCents: totals.costCents,
      profitCents: totals.profitCents,
      margin: totals.margin,
      costCoverage: totals.costCoverage,
    },
    rows: rowsOf<Record<string, unknown>>(rowsRes).map(toChannelRow),
    reconciliation: {
      scope: 'lifetime',
      logsRevenueCents,
      keysUsedTotalCents,
      diffCents: logsRevenueCents - keysUsedTotalCents,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
