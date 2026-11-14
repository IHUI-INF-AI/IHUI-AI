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
 * F-626:别名解析进程内 TTL 缓存。
 * 解析必须读主库(删除/禁用别名只写主库),再叠加短 TTL 缓存压住每请求一次 DB 往返;
 * 写路径(创建/删除别名)主动失效对应 key,使下线动作即时可见。
 * 只缓存成功结果(含"无映射"),查询异常不入缓存,不掩盖故障。
 */
const ALIAS_CACHE_TTL_MS = 30_000
const ALIAS_CACHE_MAX = 2_000
const aliasCache = new Map<string, { value: ResolvedModel | null; expiresAt: number }>()

function aliasCacheKey(providerCode: string, alias: string): string {
  return `${providerCode}\u0000${alias}`
}

/** 写路径后失效单个 (providerCode, alias) 缓存。 */
function invalidateAliasCache(providerCode: string, alias: string): void {
  aliasCache.delete(aliasCacheKey(providerCode, alias))
}

/** 防请求侧任意模型名把缓存撑成无界:达上限先清过期项,仍满则淘汰最早插入的一条。 */
function pruneAliasCache(): void {
  if (aliasCache.size < ALIAS_CACHE_MAX) return
  const now = Date.now()
  for (const [key, entry] of aliasCache) {
    if (entry.expiresAt <= now) aliasCache.delete(key)
  }
  if (aliasCache.size < ALIAS_CACHE_MAX) return
  const oldest = aliasCache.keys().next()
  if (typeof oldest.value === 'string') aliasCache.delete(oldest.value)
}

/**
 * 解析对外别名 → 上游真实模型名。命中返回映射;无映射(或查询异常)返回 null,调用方原样透传。
 * F-626:走主库 `db`,避免读副本复制延迟窗口内已删除/禁用的别名继续生效。
 */
export async function resolveModelAlias(
  providerCode: string,
  requestedModel: string,
): Promise<ResolvedModel | null> {
  const cacheKey = aliasCacheKey(providerCode, requestedModel)
  const cached = aliasCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  try {
    const rows = await db
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
    const value = row
      ? { upstreamModel: row.upstreamModel, displayName: row.displayName ?? row.upstreamModel }
      : null
    pruneAliasCache()
    aliasCache.set(cacheKey, { value, expiresAt: Date.now() + ALIAS_CACHE_TTL_MS })
    return value
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
  // F-626:新建(或覆盖)别名后立即失效,避免刚建的映射被旧缓存/负缓存挡住。
  invalidateAliasCache(input.providerCode, input.alias)
  return rows[0] as AiRelayModelCatalog
}

/** 删除别名映射;返回是否真实删掉了行 */
export async function deleteModelCatalog(id: string): Promise<boolean> {
  const deleted = await db
    .delete(aiRelayModelCatalog)
    .where(eq(aiRelayModelCatalog.id, id))
    .returning({
      id: aiRelayModelCatalog.id,
      providerCode: aiRelayModelCatalog.providerCode,
      alias: aiRelayModelCatalog.alias,
    })
  // F-626:删除写主库,缓存必须同步失效,否则下线动作最多被缓存延长 30s。
  for (const row of deleted) invalidateAliasCache(row.providerCode, row.alias)
  return deleted.length > 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
