/**
 * 资源上游同步中心 DB 查询层(2026-07-24 立)。
 *
 * 操作 3 张表:registry_items / registry_sync_logs / registry_webhook_triggers。
 * 所有函数用 drizzle-orm 查询,读写分离:SELECT 走 dbRead,INSERT/UPDATE 走 db。
 */
import { and, desc, eq, sql, ilike, or } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import {
  registryItems,
  registrySyncLogs,
  registryWebhookTriggers,
  type RegistryItemRecord,
  type RegistrySyncLogRecord,
  type RegistryWebhookTriggerRecord as RegistryWebhookTriggerDBRecord,
  type NewRegistrySyncLogRecord,
  type NewRegistryWebhookTriggerRecord,
} from '@ihui/database'
import type {
  RegistryItem,
  RegistryItemListQuery,
  RegistryItemListResponse,
  RegistryItemDetailResponse,
  RegistrySyncLog,
  RegistrySyncLogQuery,
  RegistrySyncLogListResponse,
  RegistryInstallStatus,
  RegistryUpstreamSource,
  RegistryWebhookTriggerRecord,
} from '@ihui/types'
import type { RawRegistryItem } from '../services/registry-sync/types.js'
import { computePayloadHash } from '../services/registry-sync/index.js'

// =============================================================================
// 类型转换:DB Record → 跨端契约类型
// =============================================================================

function toIso(d: Date | string | null): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : String(d)
}

function toRegistryItem(r: RegistryItemRecord): RegistryItem {
  return {
    id: r.id,
    sourceType: r.sourceType as RegistryItem['sourceType'],
    source: r.source as RegistryUpstreamSource,
    sourceId: r.sourceId,
    name: r.name,
    description: r.description,
    version: r.version,
    author: r.author,
    homepage: r.homepage,
    repoUrl: r.repoUrl,
    downloadUrl: r.downloadUrl,
    categories: Array.isArray(r.categories) ? (r.categories as string[]) : [],
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    installCount: r.installCount,
    heatScore: r.heatScore,
    qualityScore: r.qualityScore,
    latestSyncedAt: toIso(r.latestSyncedAt),
    payload: (r.payload as Record<string, unknown>) ?? {},
    createdAt: toIso(r.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(r.updatedAt) ?? new Date().toISOString(),
  }
}

function toSyncLog(r: RegistrySyncLogRecord): RegistrySyncLog {
  return {
    id: r.id,
    sourceType: r.sourceType as RegistrySyncLog['sourceType'],
    sourceName: r.sourceName,
    status: r.status as RegistrySyncLog['status'],
    errorMessage: r.errorMessage,
    payloadHash: r.payloadHash,
    oldVersion: r.oldVersion,
    newVersion: r.newVersion,
    durationMs: r.durationMs,
    startedAt: toIso(r.startedAt) ?? new Date().toISOString(),
    finishedAt: toIso(r.finishedAt),
  }
}

function toWebhookTrigger(
  r: RegistryWebhookTriggerDBRecord,
): RegistryWebhookTriggerRecord {
  return {
    id: r.id,
    name: r.name,
    eventType: r.eventType,
    source: r.source as RegistryUpstreamSource,
    signature: r.signature,
    payload: (r.payload as Record<string, unknown>) ?? {},
    receivedAt: r.receivedAt instanceof Date ? r.receivedAt.toISOString() : String(r.receivedAt),
    processedAt: r.processedAt instanceof Date ? r.processedAt.toISOString() : r.processedAt,
    status: r.status as RegistryWebhookTriggerRecord['status'],
    resultMessage: r.resultMessage,
  }
}

// =============================================================================
// 资源条目查询
// =============================================================================

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20

function parsePaging(q: { page?: number; pageSize?: number }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(q.page ?? DEFAULT_PAGE))
  const pageSize = Math.min(100, Math.max(1, Math.floor(q.pageSize ?? DEFAULT_PAGE_SIZE)))
  return { page, pageSize }
}

/**
 * 列表查询,支持 sort=latest/hot/best + 模糊搜索 + 分类过滤 + 分页。
 * installedIds 行为:
 *   - 不传 userId(公开列表):返回空数组,保持公开列表行为。
 *   - 传 userId(已登录用户):查 user_preferences 表 group='registry_installs',
 *     返回当前 page 中该用户已安装的条目 id 列表(key 格式 `${sourceType}:${sourceId}`)。
 *     仅查当前 page 的 items 对应记录,避免全表扫。
 */
export async function listRegistryItems(
  query: RegistryItemListQuery,
  userId?: string,
): Promise<RegistryItemListResponse> {
  const { page, pageSize } = parsePaging(query)
  const offset = (page - 1) * pageSize

  const conds = []
  if (query.sourceType) conds.push(eq(registryItems.sourceType, query.sourceType))
  if (query.source) conds.push(eq(registryItems.source, query.source))
  if (query.q) {
    const like = `%${query.q}%`
    conds.push(
      or(
        ilike(registryItems.name, like),
        ilike(registryItems.description, like),
      )!,
    )
  }
  if (query.category) {
    // categories 是 jsonb 数组,用 @> 包含判断
    conds.push(sql`${registryItems.categories} @> ${JSON.stringify([query.category])}::jsonb`)
  }

  const where = conds.length > 0 ? and(...conds) : undefined

  // 排序
  let orderExpr
  if (query.sort === 'hot') {
    orderExpr = desc(registryItems.heatScore)
  } else if (query.sort === 'best') {
    orderExpr = desc(registryItems.qualityScore)
  } else {
    // latest(默认):latest_synced_at desc,nulls last
    orderExpr = sql`${registryItems.latestSyncedAt} desc nulls last`
  }

  const rows = await dbRead
    .select()
    .from(registryItems)
    .where(where)
    .orderBy(orderExpr)
    .limit(pageSize)
    .offset(offset)

  const totalRows = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(registryItems)
    .where(where)
  const total = Number(totalRows[0]?.c ?? 0)

  // 已登录用户:查该用户在当前 page 中的安装记录,匹配 sourceType:sourceId 复合键
  let installedIds: string[] = []
  if (userId && rows.length > 0) {
    const userInstalls = await dbRead.execute(
      sql`SELECT key FROM "user_preferences" WHERE "user_id" = ${userId} AND "group" = 'registry_installs'`,
    )
    // drizzle postgres-js execute 返回 RowList 或 { rows },兼容两种形态
    const installRows = (
      Array.isArray(userInstalls)
        ? userInstalls
        : (userInstalls as { rows?: unknown[] }).rows ?? []
    ) as Array<{ key: string }>
    const installedKeys = new Set(installRows.map((r) => r.key))
    installedIds = rows
      .filter((r) => installedKeys.has(`${r.sourceType}:${r.sourceId}`))
      .map((r) => r.id)
  }

  return {
    items: rows.map(toRegistryItem),
    total,
    page,
    pageSize,
    installedIds,
  }
}

/**
 * 单条详情。install_status 先固定返回 not_installed(安装表后续接入)。
 */
export async function getRegistryItem(
  id: string,
): Promise<RegistryItemDetailResponse | null> {
  const rows = await dbRead
    .select()
    .from(registryItems)
    .where(eq(registryItems.id, id))
    .limit(1)
  const r = rows[0]
  if (!r) return null
  const installStatus: RegistryInstallStatus = 'not_installed'
  return {
    item: toRegistryItem(r),
    installStatus,
    installedVersion: null,
    upgradeAvailable: false,
  }
}

/**
 * upsert:按 (source_type, source, source_id) 复合键。
 * 返回:
 *   - inserted: true 表示新插入, false 表示更新
 *   - hash: payload 的 SHA-256
 *   - oldVersion: 更新前的版本号(新插入时为 null),供 sync_log.old_version 字段使用
 */
export async function upsertRegistryItem(
  raw: RawRegistryItem,
  heat: number,
  quality: number,
): Promise<{ inserted: boolean; hash: string; oldVersion: string | null }> {
  const hash = await computePayloadHash(raw.payload)
  const now = new Date()

  // 先查是否已存在,同时取出版本号(用于 sync_log.old_version)
  const existing = await dbRead
    .select({ id: registryItems.id, version: registryItems.version })
    .from(registryItems)
    .where(
      and(
        eq(registryItems.sourceType, raw.sourceType),
        eq(registryItems.source, raw.source),
        eq(registryItems.sourceId, raw.sourceId),
      ),
    )
    .limit(1)
  const inserted = existing.length === 0
  const oldVersion = existing[0]?.version ?? null

  await db
    .insert(registryItems)
    .values({
      sourceType: raw.sourceType,
      source: raw.source,
      sourceId: raw.sourceId,
      name: raw.name,
      description: raw.description,
      version: raw.version,
      author: raw.author,
      homepage: raw.homepage,
      repoUrl: raw.repoUrl,
      downloadUrl: raw.downloadUrl,
      categories: raw.categories,
      tags: raw.tags,
      payload: raw.payload,
      payloadHash: hash,
      heatScore: heat,
      qualityScore: quality,
      latestSyncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        registryItems.sourceType,
        registryItems.source,
        registryItems.sourceId,
      ],
      set: {
        name: raw.name,
        description: raw.description,
        version: raw.version,
        author: raw.author,
        homepage: raw.homepage,
        repoUrl: raw.repoUrl,
        downloadUrl: raw.downloadUrl,
        categories: raw.categories,
        tags: raw.tags,
        payload: raw.payload,
        payloadHash: hash,
        heatScore: heat,
        qualityScore: quality,
        latestSyncedAt: now,
        updatedAt: now,
      },
    })

  return { inserted, hash, oldVersion }
}

// =============================================================================
// 同步日志
// =============================================================================

export async function insertSyncLog(log: NewRegistrySyncLogRecord): Promise<void> {
  await db.insert(registrySyncLogs).values(log)
}

export async function listSyncLogs(
  query: RegistrySyncLogQuery,
): Promise<RegistrySyncLogListResponse> {
  const { page, pageSize } = parsePaging(query)
  const offset = (page - 1) * pageSize

  const conds = []
  if (query.sourceType) conds.push(eq(registrySyncLogs.sourceType, query.sourceType))
  if (query.status) conds.push(eq(registrySyncLogs.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const rows = await dbRead
    .select()
    .from(registrySyncLogs)
    .where(where)
    .orderBy(desc(registrySyncLogs.startedAt))
    .limit(pageSize)
    .offset(offset)

  const totalRows = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(registrySyncLogs)
    .where(where)
  const total = Number(totalRows[0]?.c ?? 0)

  return {
    logs: rows.map(toSyncLog),
    total,
    page,
    pageSize,
  }
}

// =============================================================================
// Webhook 触发记录
// =============================================================================

export async function insertWebhookTrigger(
  record: NewRegistryWebhookTriggerRecord,
): Promise<RegistryWebhookTriggerRecord> {
  const rows = await db
    .insert(registryWebhookTriggers)
    .values(record)
    .returning()
  const r = rows[0]
  if (!r) throw new Error('insertWebhookTrigger: 未返回记录')
  return toWebhookTrigger(r)
}

export async function listWebhookTriggers(query: {
  source?: RegistryUpstreamSource
  status?: string
  page?: number
  pageSize?: number
}): Promise<{ triggers: RegistryWebhookTriggerRecord[]; total: number }> {
  const { page, pageSize } = parsePaging(query)
  const offset = (page - 1) * pageSize

  const conds = []
  if (query.source) conds.push(eq(registryWebhookTriggers.source, query.source))
  if (query.status) conds.push(eq(registryWebhookTriggers.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const rows = await dbRead
    .select()
    .from(registryWebhookTriggers)
    .where(where)
    .orderBy(desc(registryWebhookTriggers.receivedAt))
    .limit(pageSize)
    .offset(offset)

  const totalRows = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(registryWebhookTriggers)
    .where(where)
  const total = Number(totalRows[0]?.c ?? 0)

  return { triggers: rows.map(toWebhookTrigger), total }
}

export async function markWebhookTriggerProcessed(
  id: string,
  status: 'processed' | 'failed' | 'ignored',
  resultMessage: string,
): Promise<void> {
  await db
    .update(registryWebhookTriggers)
    .set({ status, resultMessage, processedAt: new Date() })
    .where(eq(registryWebhookTriggers.id, id))
}

// =============================================================================
// TTL 清理 + 版本查询辅助
// =============================================================================

/**
 * 清理过期的 webhook 触发记录(保留最近 N 天)。
 * 由定时任务或管理员手动触发。
 * 注:drizzle postgres-js 的 delete 不返回 rowCount,用 returning().length 取删除行数。
 */
export async function cleanupOldWebhookTriggers(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 86400_000)
  const deleted = await db
    .delete(registryWebhookTriggers)
    .where(sql`${registryWebhookTriggers.receivedAt} < ${cutoff}`)
    .returning({ id: registryWebhookTriggers.id })
  return deleted.length
}

/**
 * 清理过期的同步日志(保留最近 N 天)。
 */
export async function cleanupOldSyncLogs(daysToKeep: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 86400_000)
  const deleted = await db
    .delete(registrySyncLogs)
    .where(sql`${registrySyncLogs.startedAt} < ${cutoff}`)
    .returning({ id: registrySyncLogs.id })
  return deleted.length
}

/**
 * 查询单个条目的当前版本(供 worker 对比 oldVersion 用)。
 * 按 (sourceType, source, sourceId) 复合键查询。
 */
export async function getRegistryItemVersion(
  sourceType: string,
  source: string,
  sourceId: string,
): Promise<string | null> {
  const rows = await dbRead
    .select({ version: registryItems.version })
    .from(registryItems)
    .where(
      and(
        eq(registryItems.sourceType, sourceType),
        eq(registryItems.source, source),
        eq(registryItems.sourceId, sourceId),
      ),
    )
    .limit(1)
  return rows[0]?.version ?? null
}
