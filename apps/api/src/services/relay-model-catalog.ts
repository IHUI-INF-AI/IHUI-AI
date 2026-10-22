// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转模型目录/别名服务(2026-10-22 立,反代号池子系统数据层)。
 *
 * 职责:ai_relay_model_catalog 表(迁移 330)的对外别名 → 上游真实模型名解析与管理面 CRUD。
 * - resolveModelAlias:转发器在选路前调用;无映射/查询异常一律返回 null,调用方原样透传。
 * - listModelCatalog / createModelCatalog / deleteModelCatalog:admin 管理面三件套。
 */
import { and, eq } from 'drizzle-orm'
import { aiRelayModelCatalog, type AiRelayModelCatalog } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { logger } from '../utils/logger.js'

export interface ResolvedModel {
  upstreamModel: string
  displayName: string
}

/**
 * 解析对外别名 → 上游真实模型名。命中返回映射;无映射(或查询异常)返回 null,调用方原样透传。
 */
export async function resolveModelAlias(
  providerCode: string,
  requestedModel: string,
): Promise<ResolvedModel | null> {
  try {
    const rows = await dbRead
      .select({
        upstreamModel: aiRelayModelCatalog.upstreamModel,
        displayName: aiRelayModelCatalog.displayName,
      })
      .from(aiRelayModelCatalog)
      .where(
        and(
          eq(aiRelayModelCatalog.providerCode, providerCode),
          eq(aiRelayModelCatalog.alias, requestedModel),
          eq(aiRelayModelCatalog.enabled, true),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return { upstreamModel: row.upstreamModel, displayName: row.displayName ?? row.upstreamModel }
  } catch (e) {
    logger.warn('[relay-model-catalog] 别名解析失败(降级为原样透传)', {
      providerCode,
      requestedModel,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/** 目录列表(providerCode 可空 = 全量),按 provider + alias 排序 */
export async function listModelCatalog(providerCode?: string): Promise<AiRelayModelCatalog[]> {
  const base = dbRead.select().from(aiRelayModelCatalog)
  const rows = providerCode
    ? await base.where(eq(aiRelayModelCatalog.providerCode, providerCode))
    : await base
  return rows
    .slice()
    .sort((a, b) => a.providerCode.localeCompare(b.providerCode) || a.alias.localeCompare(b.alias))
}

export interface CreateModelCatalogInput {
  providerCode: string
  upstreamModel: string
  alias: string
  displayName?: string | null
  enabled?: boolean
}

/**
 * 新建别名映射。同 (providerCode, alias) 冲突时抛出 PG 23505 唯一约束错误,由调用方(路由)兜。
 */
export async function createModelCatalog(
  input: CreateModelCatalogInput,
): Promise<AiRelayModelCatalog> {
  const rows = await db
    .insert(aiRelayModelCatalog)
    .values({
      providerCode: input.providerCode,
      upstreamModel: input.upstreamModel,
      alias: input.alias,
      displayName: input.displayName ?? null,
      enabled: input.enabled ?? true,
    })
    .returning()
  return rows[0] as AiRelayModelCatalog
}

/** 删除别名映射;返回是否真实删掉了行 */
export async function deleteModelCatalog(id: string): Promise<boolean> {
  const deleted = await db
    .delete(aiRelayModelCatalog)
    .where(eq(aiRelayModelCatalog.id, id))
    .returning({ id: aiRelayModelCatalog.id })
  return deleted.length > 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
