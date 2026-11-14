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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
