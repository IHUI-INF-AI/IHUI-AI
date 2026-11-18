// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池模型目录自动同步(2026-11-18 立)。
 *
 * 立因:选择器「模型清单」此前只有两条刷新路 —— ① 用户开面板现拉(带 10 分钟缓存);
 * ② 管理员手动 POST /admin/relay/discovery/scan。两者都不覆盖「上游悄悄上新/下架模型」:
 * 新模型要等人发现并手扫,预置登记行下架了也永远躺在 ai_model_config_models 里。
 *
 * 本腿补第三条:低频自动巡检。遍历每个「有可调度号」的中继平台,现拉上游清单,与
 * ai_relay_discovery 现有行对账:
 *  - 上游有、发现表无 ⇒ 新插入 status='discovered'(等人工审批定价/展示名);
 *  - 上游无、发现表还是 discovered ⇒ 上游已下架 ⇒ 自动标 'approved'(退役,不再占审批队列)。
 *
 * 边界(刻意不做,见 §0.3 反向应用):
 *  - 不自动写 ai_model_config_models(定价/展示名机器不该瞎填,仍走人工审批);
 *  - 不动 approved/rejected 的历史行(它们是人的决定,不是「本轮抖动」);
 *  - 取不到上游清单(ok=false)的平台整块跳过 —— 「取不到 ≠ 没模型」,绝不据此判下架。
 *
 * 由 relay-account-pool-worker 的 repeat job `model-discovery-cron`(每 6 小时)驱动。
 */
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { aiRelayDiscovery, aiRelayAccountPool } from '@ihui/database'
import { isRelayProviderCode, type RelayProviderCode } from './relay-account-format.js'
import { fetchUpstreamModelIdsForProvider } from './relay-account-pool-service.js'
import { logger } from '../utils/logger.js'

/** 单轮最多处理的平台数(防上游抖动时打爆发现表) */
const MAX_PROVIDERS_PER_ROUND = 20

/** 同步结果(轮级读数,与 sweep 的产出面同风格) */
export interface ModelDiscoverySyncResult {
  /** 本轮扫到的平台数 */
  providersScanned: number
  /** 拿到上游清单的平台数(ok=true) */
  providersOk: number
  /** 取不到清单而跳过的平台数(ok=false,绝不据此判下架) */
  providersSkipped: number
  /** 新发现的模型数(插入 ai_relay_discovery) */
  modelsDiscovered: number
  /** 上游已下架而自动退役的发现行数(discovered → approved) */
  modelsRetired: number
  /** 各平台明细(便于日志归因) */
  perProvider: Array<{
    providerCode: string
    ok: boolean
    upstreamCount: number
    discovered: number
    retired: number
  }>
}

/**
 * 发现表「仍在等审批」的状态集:只有这些行会因「上游不再报」而退役。
 * approved/rejected 是人的决定,本腿永不回头改(§0.3:失效方向 = 多留一份,不冒改人决定)。
 */
const PENDING_DISCOVERY_STATUSES = ['discovered', 'pending'] as const

/**
 * 归一后的下架判据(纯函数,可单测)。
 *
 * 输入 = 上一轮发现的 model_id 集合 + 本轮上游报的原始 id 集合(都未归一)。
 * 归一口径与 listUserPoolModels 的交集过滤同源(normalizePoolUpstreamModelId):
 * 裸名 / `<平台>/` 前缀名 / 大小写差异都算同一模型。
 *
 * 返回 = 上一轮有、这一轮上游明确不再报的 id(即「已下架」)。
 * upstreamIds 为 null(取不到清单)⇒ 返回空集(绝不据此判下架)。
 */
export function retiredModelIdsOf(
  previousIds: readonly string[],
  upstreamIds: readonly string[] | null,
): string[] {
  if (upstreamIds === null) return []
  // 归一:去 `<平台>/` 前缀 + 小写,两边同口径
  const norm = (s: string) => s.trim().toLowerCase().split('/').pop() ?? ''
  const upstreamNorm = new Set(upstreamIds.map(norm).filter((s) => s !== ''))
  return previousIds.filter((id) => {
    const n = norm(id)
    return n !== '' && !upstreamNorm.has(n)
  })
}

/**
 * 单轮同步。永不抛(任何一段失败都折进 perProvider,绝不拖死整个 worker)。
 *
 * 平台遍历面 = 「至少有一枚可调度号」的中继平台(与 listUserPoolModels 的归属面同源:
 * accountSchedulableCondition)。每平台只拉一次清单(清单语义是「这平台有哪些模型」,
 * 与具体哪枚号无关)。
 */
export async function syncRelayPoolModelDiscovery(): Promise<ModelDiscoverySyncResult> {
  // 动态导入打破循环依赖(relay-account-pool-scheduler 反向依赖 account-pool-service 一族)
  const { accountSchedulableCondition } = await import('./relay-account-pool-scheduler.js')
  const result: ModelDiscoverySyncResult = {
    providersScanned: 0,
    providersOk: 0,
    providersSkipped: 0,
    modelsDiscovered: 0,
    modelsRetired: 0,
    perProvider: [],
  }

  // 1. 找出「有可调度号」的中继平台(每平台取一枚代表号即可,清单与具体号无关)
  const accounts = await dbRead
    .select({ providerCode: aiRelayAccountPool.providerCode })
    .from(aiRelayAccountPool)
    .where(and(accountSchedulableCondition(), isNotNull(aiRelayAccountPool.providerCode)))
  const providerSet = new Set<string>()
  for (const row of accounts) {
    if (isRelayProviderCode(row.providerCode)) providerSet.add(row.providerCode)
  }
  const providers = [...providerSet].sort().slice(0, MAX_PROVIDERS_PER_ROUND)

  for (const providerCode of providers) {
    result.providersScanned += 1
    try {
      // 2. 现拉上游清单(内部自带 8s 超时 + 适配器注册兜底)
      const info = await fetchUpstreamModelIdsForProvider(providerCode as RelayProviderCode)
      if (!info.ok) {
        // 取不到 ⇒ 整块跳过,不判下架(§0.3:「取不到 ≠ 没模型」)
        result.providersSkipped += 1
        result.perProvider.push({
          providerCode,
          ok: false,
          upstreamCount: 0,
          discovered: 0,
          retired: 0,
        })
        continue
      }
      result.providersOk += 1
      const upstreamIds = info.ids

      // 3. 读发现表现有行(该平台全部状态,供对账)
      const existingRows = await dbRead
        .select({
          id: aiRelayDiscovery.id,
          modelId: aiRelayDiscovery.modelId,
          status: aiRelayDiscovery.status,
        })
        .from(aiRelayDiscovery)
        .where(eq(aiRelayDiscovery.providerCode, providerCode))
      const existingByNorm = new Map<string, { id: string; status: string }>()
      for (const row of existingRows) {
        const norm = row.modelId.trim().toLowerCase().split('/').pop() ?? ''
        if (norm !== '') existingByNorm.set(norm, { id: row.id, status: row.status })
      }

      // 4. 新发现:上游有、发现表无 ⇒ 插入 status='discovered'
      let discovered = 0
      const newRows: Array<{ providerCode: string; modelId: string; status: string }> = []
      for (const upstreamId of upstreamIds) {
        const norm = upstreamId.trim().toLowerCase().split('/').pop() ?? ''
        if (norm === '' || existingByNorm.has(norm)) continue
        newRows.push({ providerCode, modelId: upstreamId, status: 'discovered' })
        // 内存里也补上,避免同一轮内重复(多个上游 id 归一后同名的边界)
        existingByNorm.set(norm, { id: '', status: 'discovered' })
      }
      if (newRows.length > 0) {
        try {
          await db
            .insert(aiRelayDiscovery)
            .values(newRows)
            .onConflictDoNothing({
              target: [aiRelayDiscovery.providerCode, aiRelayDiscovery.modelId],
            })
          discovered = newRows.length
          result.modelsDiscovered += discovered
        } catch (e) {
          logger.warn('[relay-pool-model-discovery] 插入新发现行失败(可能并发冲突)', {
            err: e,
            providerCode,
            count: newRows.length,
          })
        }
      }

      // 5. 下架退役:发现表还在等审批、但上游这轮不再报 ⇒ 标 approved(退役)
      const pendingRows = existingRows.filter((r) =>
        (PENDING_DISCOVERY_STATUSES as readonly string[]).includes(r.status),
      )
      const retiredIds = retiredModelIdsOf(
        pendingRows.map((r) => r.modelId),
        upstreamIds,
      )
      let retired = 0
      if (retiredIds.length > 0) {
        const retiredNorms = new Set(
          retiredIds.map((s) => s.trim().toLowerCase().split('/').pop() ?? ''),
        )
        const rowIdsToRetire = pendingRows
          .filter((r) => retiredNorms.has(r.modelId.trim().toLowerCase().split('/').pop() ?? ''))
          .map((r) => r.id)
        if (rowIdsToRetire.length > 0) {
          try {
            await db
              .update(aiRelayDiscovery)
              .set({ status: 'approved', updatedAt: new Date() })
              .where(
                and(
                  inArray(aiRelayDiscovery.id, rowIdsToRetire),
                  // 再守一道:只改还在等审批的(并发审批可能刚改过)
                  inArray(aiRelayDiscovery.status, [...PENDING_DISCOVERY_STATUSES]),
                ),
              )
            retired = rowIdsToRetire.length
            result.modelsRetired += retired
          } catch (e) {
            logger.warn('[relay-pool-model-discovery] 标记下架失败', {
              err: e,
              providerCode,
              count: rowIdsToRetire.length,
            })
          }
        }
      }

      result.perProvider.push({
        providerCode,
        ok: true,
        upstreamCount: upstreamIds.length,
        discovered,
        retired,
      })
    } catch (e) {
      // 单平台异常不拖死整轮(§0.3:绝不因一段失败把整个同步腿打死)
      logger.warn('[relay-pool-model-discovery] 平台同步异常,跳过', {
        err: e,
        providerCode,
      })
      result.providersSkipped += 1
      result.perProvider.push({
        providerCode,
        ok: false,
        upstreamCount: 0,
        discovered: 0,
        retired: 0,
      })
    }
  }

  logger.info('[relay-pool-model-discovery] 模型目录自动同步 done', {
    providersScanned: result.providersScanned,
    providersOk: result.providersOk,
    providersSkipped: result.providersSkipped,
    modelsDiscovered: result.modelsDiscovered,
    modelsRetired: result.modelsRetired,
  })
  return result
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
