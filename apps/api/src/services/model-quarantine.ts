// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 缺成本模型按类型隔离(2026-11-26 立)。
 *
 * 规则(用户 2026-11-26 确认):
 * - 非聊天模型(embedding/rerank/图像/视频/音频/翻译/审核)从 LLM 售卖面移出:
 *   is_relay_public=false 且 enabled=false,不再进入 LLM 调用面。
 * - free 变体直接下架:不提供免费模型。
 * - 合作方别名/数字 ID/测试别名仅内部路由:is_relay_public=false,但保留 enabled。
 * - 真实聊天模型缺成本:先 is_relay_public=false,避免用户点到 503;补价后再上架。
 *
 * 不硬编成本价。补价仍走 backfillCostPrices / 人工合同价。
 */
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { aiModelConfigModels } from '@ihui/database'
import { db } from '../db/index.js'
import {
  classifyModelKind,
  shouldDisableOnMissingCost,
  type ModelKind,
} from './model-kind-classifier.js'

export interface MissingCostQuarantineItem {
  id: number
  modelId: string
  kind: ModelKind
  enabled: boolean
  isRelayPublic: boolean
}

export interface MissingCostQuarantineResult {
  dryRun: boolean
  scannedRows: number
  distinctModels: number
  publicBefore: number
  publicAfter: number
  unpublished: number
  disabled: number
  byKind: Record<string, number>
  pendingPricingChat: number
  items: MissingCostQuarantineItem[]
}

function countByKind(rows: MissingCostQuarantineItem[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.kind] = (counts[row.kind] ?? 0) + 1
  return counts
}

async function loadMissingCostRows(): Promise<MissingCostQuarantineItem[]> {
  const rows = await db
    .select({
      id: aiModelConfigModels.id,
      modelId: aiModelConfigModels.modelId,
      enabled: aiModelConfigModels.enabled,
      isRelayPublic: aiModelConfigModels.isRelayPublic,
    })
    .from(aiModelConfigModels)
    .where(
      and(
        eq(aiModelConfigModels.enabled, true),
        or(
          isNull(aiModelConfigModels.costInputPricePer1k),
          isNull(aiModelConfigModels.costOutputPricePer1k),
        ),
      ),
    )

  return rows.map((row) => ({
    id: row.id,
    modelId: row.modelId,
    enabled: row.enabled === true,
    isRelayPublic: row.isRelayPublic,
    kind: classifyModelKind(row.modelId),
  }))
}

async function countPublicMissingCost(): Promise<number> {
  const rows = await db
    .select({ id: aiModelConfigModels.id })
    .from(aiModelConfigModels)
    .where(
      and(
        eq(aiModelConfigModels.enabled, true),
        eq(aiModelConfigModels.isRelayPublic, true),
        or(
          isNull(aiModelConfigModels.costInputPricePer1k),
          isNull(aiModelConfigModels.costOutputPricePer1k),
        ),
      ),
    )
  return rows.length
}

export async function quarantineMissingCostModels(opts?: {
  dryRun?: boolean
}): Promise<MissingCostQuarantineResult> {
  const dryRun = opts?.dryRun !== false
  const rows = await loadMissingCostRows()
  const publicRows = rows.filter((row) => row.isRelayPublic)
  const disableRows = rows.filter((row) => shouldDisableOnMissingCost(row.kind))
  const unpublishIdSet = new Set([
    ...publicRows.map((row) => row.id),
    ...disableRows.map((row) => row.id),
  ])
  const pendingPricingChat = rows.filter((row) => row.kind === 'chat').length

  if (!dryRun) {
    const unpublishIds = [...unpublishIdSet]
    if (unpublishIds.length > 0) {
      await db
        .update(aiModelConfigModels)
        .set({ isRelayPublic: false, updatedAt: new Date() })
        .where(inArray(aiModelConfigModels.id, unpublishIds))
    }
    if (disableRows.length > 0) {
      await db
        .update(aiModelConfigModels)
        .set({ enabled: false, isRelayPublic: false, updatedAt: new Date() })
        .where(
          inArray(
            aiModelConfigModels.id,
            disableRows.map((row) => row.id),
          ),
        )
    }
  }

  const publicAfter = dryRun ? publicRows.length : await countPublicMissingCost()

  return {
    dryRun,
    scannedRows: rows.length,
    distinctModels: new Set(rows.map((row) => row.modelId)).size,
    publicBefore: publicRows.length,
    publicAfter,
    unpublished: unpublishIdSet.size,
    disabled: disableRows.length,
    byKind: countByKind(rows),
    pendingPricingChat,
    items: rows.slice(0, 200),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
