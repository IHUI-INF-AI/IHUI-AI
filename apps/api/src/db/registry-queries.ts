// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

function toWebhookTrigger(r: RegistryWebhookTriggerDBRecord): RegistryWebhookTriggerRecord {
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
    conds.push(or(ilike(registryItems.name, like), ilike(registryItems.description, like))!)
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
  // 缺口 3 优化:仅查当前 page 的 keys(WHERE key IN (...)),避免全表扫用户安装记录
  let installedIds: string[] = []
  if (userId && rows.length > 0) {
    const currentPageKeys = rows.map((r) => `${r.sourceType}:${r.sourceId}`)
    const userInstalls = await dbRead.execute(
      sql`SELECT key FROM "user_preferences" WHERE "user_id" = ${userId} AND "group" = 'registry_installs' AND key IN (${sql.join(
        currentPageKeys.map((k) => sql`${k}`),
        sql`, `,
      )})`,
    )
    // drizzle postgres-js execute 返回 RowList 或 { rows },兼容两种形态
    const installRows = (
      Array.isArray(userInstalls)
        ? userInstalls
        : ((userInstalls as { rows?: unknown[] }).rows ?? [])
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
export async function getRegistryItem(id: string): Promise<RegistryItemDetailResponse | null> {
  const rows = await dbRead.select().from(registryItems).where(eq(registryItems.id, id)).limit(1)
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

// =============================================================================
// 外部字段落库净化(SDB-09)
// =============================================================================

/**
 * varchar 列的字符上限,与 packages/database/src/schema/registry.ts:41-58 同源。
 * 截断统一由这一张表驱动:新增 varchar 列时先改 schema,再补这里,避免各调用点散落魔法数字。
 * description 是 text、categories/tags/payload 是 jsonb,没有列宽上限,不参与截断。
 */
const REGISTRY_VARCHAR_LIMITS = {
  sourceType: 20,
  source: 20,
  sourceId: 255,
  name: 200,
  version: 100,
  author: 200,
  homepage: 500,
  repoUrl: 500,
  downloadUrl: 500,
} as const

type RegistryVarcharField = keyof typeof REGISTRY_VARCHAR_LIMITS

const REGISTRY_URL_FIELDS: readonly RegistryVarcharField[] = ['homepage', 'repoUrl', 'downloadUrl']

/** 必填列:缺失/空白时整条拒绝(DB 的 NOT NULL 是写库时才炸,整批会一起回滚)。 */
const REGISTRY_REQUIRED_FIELDS = ['sourceType', 'source', 'sourceId', 'name'] as const

export interface RegistryFieldSanitizeStats {
  /** 被列宽截断的字段数(同一行的多个字段分别计数) */
  truncated: number
  /** 因协议非 http(s) 或无法解析而被置空的 URL 字段数 */
  droppedUrls: number
  /** 因必填字段非法被整条拒绝的记录数 */
  rejected: number
}

function emptySanitizeStats(): RegistryFieldSanitizeStats {
  return { truncated: 0, droppedUrls: 0, rejected: 0 }
}

/**
 * 按字符(码点)截断,与 PG varchar(n) 的计数口径一致;
 * 直接 slice 会切开 emoji 的代理对,留下半个字符写库。
 */
function truncateToColumn(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return Array.from(value).slice(0, maxLength).join('')
}

/** 只放行 http/https;解析失败或其它协议返回 null(丢字段,不丢记录)。 */
function sanitizeUrlField(value: string): string | null {
  const trimmed = value.trim()
  try {
    const protocol = new URL(trimmed).protocol
    return protocol === 'http:' || protocol === 'https:' ? trimmed : null
  } catch {
    return null
  }
}

interface SanitizedRegistryItem {
  raw: RawRegistryItem
  stats: RegistryFieldSanitizeStats
  invalidField: string | null
}

/**
 * 外部条目的唯一净化出口(适配器不重复实现)。
 * 逐列截断 + URL 协议白名单;必填字段非法时返回 invalidField,由调用方拒绝该条。
 * 其余情况一律保留记录,只把越界值降级(截断/置空)并计数。
 */
function sanitizeRegistryItem(raw: RawRegistryItem): SanitizedRegistryItem {
  const stats = emptySanitizeStats()
  const sanitized = { ...raw }
  const mutable = sanitized as unknown as Record<string, unknown>

  for (const field of REGISTRY_REQUIRED_FIELDS) {
    const value = raw[field]
    if (typeof value !== 'string' || value.trim() === '') {
      return { raw: sanitized, stats, invalidField: field }
    }
  }

  for (const [field, maxLength] of Object.entries(REGISTRY_VARCHAR_LIMITS) as Array<
    [RegistryVarcharField, number]
  >) {
    const value = raw[field]
    if (typeof value !== 'string') continue
    const next = truncateToColumn(value, maxLength)
    if (next !== value) stats.truncated++
    mutable[field] = next
  }

  for (const field of REGISTRY_URL_FIELDS) {
    const value = mutable[field]
    if (typeof value !== 'string') continue
    const next = sanitizeUrlField(value)
    if (next === null) stats.droppedUrls++
    mutable[field] = next
  }

  return { raw: sanitized, stats, invalidField: null }
}

/** 沿用 registry-sync 既有日志形态:有降级才 warn,一次写入一行聚合计数。 */
function logSanitizeStats(stats: RegistryFieldSanitizeStats, scope: string): void {
  if (stats.truncated === 0 && stats.droppedUrls === 0 && stats.rejected === 0) return
  console.warn(
    `[registry-sync] registry field sanitize (${scope}): truncated=${stats.truncated} droppedUrls=${stats.droppedUrls} rejected=${stats.rejected}`,
  )
}

/**
 * upsert:按 (source_type, source, source_id) 复合键。
 * 返回:
 *   - inserted: true 表示新插入, false 表示更新
 *   - hash: payload 的 SHA-256
 *   - oldVersion: 更新前的版本号(新插入时为 null),供 sync_log.old_version 字段使用
 *   - sanitized: 本次落库前的字段净化计数(SDB-09)
 */
export async function upsertRegistryItem(
  rawInput: RawRegistryItem,
  heat: number,
  quality: number,
): Promise<{
  inserted: boolean
  hash: string
  oldVersion: string | null
  sanitized: RegistryFieldSanitizeStats
}> {
  const { raw, stats, invalidField } = sanitizeRegistryItem(rawInput)
  if (invalidField) {
    stats.rejected++
    logSanitizeStats(stats, 'upsertRegistryItem')
    throw new Error(`registry: 必填字段非法(${invalidField})`)
  }
  // 先记录再写库:即使 DB 抛错,截断/丢弃的计数也不会丢
  logSanitizeStats(stats, 'upsertRegistryItem')

  const hash = await computePayloadHash(raw.payload)
  const now = new Date()

  // F-643:存在性/版本判定必须与写入同源同事务。原先判定读 dbRead(只读副本)、
  // 写入走主库 db,副本延迟窗口内 inserted 虚高 / oldVersion 失真(审计链断档)。
  // 现在判定与写入同在主库事务内;inserted 再由主库原子返回的 xmax 判定。
  return await db.transaction(async (tx) => {
    // 同时取出版本号(用于 sync_log.old_version)
    const existing = await tx
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
    const oldVersion = existing[0]?.version ?? null

    const written = await tx
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
        target: [registryItems.sourceType, registryItems.source, registryItems.sourceId],
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
      .returning({ inserted: sql<boolean>`(xmax = 0)` })

    return { inserted: written[0]?.inserted === true, hash, oldVersion, sanitized: stats }
  })
}

/**
 * 批量 upsert 结果。
 * - inserted/updated/skipped:本次批量的三态计数
 * - oldVersions:每条条目的 oldVersion(更新前)+ newVersion,供 sync_log 聚合
 * - hashList:每条条目的 payload SHA-256,供 sync_log payloadHash 聚合计算
 * - sanitized:本次落库前的字段净化计数(SDB-09),被截断/丢弃 URL 的条数可从返回值观测
 */
export interface BatchUpsertResult {
  inserted: number
  updated: number
  skipped: number
  failed: number
  /** 批内复合键去重丢掉的重复行数(见 batchUpsertRegistryItems 头注) */
  deduped: number
  /** 本次批量的字段净化计数(SDB-09) */
  sanitized: RegistryFieldSanitizeStats
  oldVersions: Array<{
    sourceType: string
    source: string
    sourceId: string
    oldVersion: string | null
    newVersion: string | null
  }>
  hashList: string[]
}

/**
 * 批量 upsert 资源条目(2 次 DB 往返替代 2N 次)。
 * 1. 批量 SELECT existing(含 version)——用 OR 拼接 (source_type, source, source_id) 复合键
 * 2. 批量 INSERT ... ON CONFLICT DO UPDATE —— 一次写入所有需要 upsert 的条目
 *
 * 幂等检查:非 force 且 existing.version === raw.version → skipped,不加入 upsert 批次
 * (跳过时不更新 latestSyncedAt,避免无变更条目产生虚假同步时间)
 *
 * **批内复合键去重(2026-10-25 立,实测宕因)**:mcp.so/smithery 的 offset 分页在上游重排时
 * 会把同一 (source_type, source, source_id) 送进两页(实测一轮 760 条里 122 个键重复)⇒
 * 单条 `INSERT .. ON CONFLICT DO UPDATE` 对同一行影响两次会被 PG 以 21000 拒绝并**整批回滚**
 * —— 症状正是 12:00 那轮 `synced=0 failed=760`:上游数据一条没落库,日志只留一行 WARN。
 * 去重住在这条唯一写出口的入口(后位覆盖前位:后一页是上游重排后的新态),任何调用方都自动受保;
 * 计数如实进返回值 `deduped`(§134 同族:请求侧数字不得冒充落库侧,这里量的是"丢掉的重复请求行")。
 *
 * 返回每条的 oldVersion 供 sync_log 聚合。
 */
export async function batchUpsertRegistryItems(
  items: Array<{ raw: RawRegistryItem; heat: number; quality: number; hash: string }>,
  options?: { force?: boolean },
): Promise<BatchUpsertResult> {
  if (items.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      oldVersions: [],
      hashList: [],
      deduped: 0,
      sanitized: emptySanitizeStats(),
    }
  }

  // 0. 先净化再批内去重(SDB-09):sourceId 截断后可能产生新的同键,
  //    若在截断前判重,同一批里会出现两条相同复合键 → PG 21000 整批回滚。
  const stats = emptySanitizeStats()
  let rejected = 0
  const acceptedItems: typeof items = []
  for (const item of items) {
    const result = sanitizeRegistryItem(item.raw)
    stats.truncated += result.stats.truncated
    stats.droppedUrls += result.stats.droppedUrls
    if (result.invalidField) {
      // 必填字段非法的记录只能拒绝;其余条目继续落库,不因一条坏数据回滚整批
      rejected++
      continue
    }
    acceptedItems.push({ ...item, raw: result.raw })
  }
  stats.rejected = rejected
  // 先记录再写库:即使 DB 抛错,截断/丢弃的计数也不会丢
  logSanitizeStats(stats, 'batchUpsertRegistryItems')

  // 批内去重(见头注宕因);Map 保留每个复合键的**最后一次**出现
  const byKey = new Map<string, (typeof items)[number]>()
  for (const item of acceptedItems) {
    byKey.set(`${item.raw.sourceType}:${item.raw.source}:${item.raw.sourceId}`, item)
  }
  const uniqueItems = [...byKey.values()]
  const deduped = acceptedItems.length - uniqueItems.length

  // 全部被拒时不能走到下面的 or(...conditions):空条件会退化成全表 SELECT
  if (uniqueItems.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: rejected,
      oldVersions: [],
      hashList: [],
      deduped,
      sanitized: stats,
    }
  }

  // F-643:判定(批量查 existing)与写入必须同源同事务 —— 原先判定读 dbRead(只读副本)、
  // 写入走主库 db,副本延迟窗口内同版本条目会被误判成新增/漏跳过,
  // inserted/skipped/oldVersion 全部失真。现在判定与写入同在主库事务内。
  return await db.transaction(async (tx) => {
    // 1. 批量查 existing(inArray 不支持多列,用 OR 拼接复合键条件)
    const conditions = uniqueItems.map((item) =>
      and(
        eq(registryItems.sourceType, item.raw.sourceType),
        eq(registryItems.source, item.raw.source),
        eq(registryItems.sourceId, item.raw.sourceId),
      ),
    )
    const existingRows = await tx
      .select({
        id: registryItems.id,
        version: registryItems.version,
        sourceType: registryItems.sourceType,
        source: registryItems.source,
        sourceId: registryItems.sourceId,
      })
      .from(registryItems)
      .where(or(...conditions))

    const existingMap = new Map<string, { id: string; version: string | null }>()
    for (const row of existingRows) {
      existingMap.set(`${row.sourceType}:${row.source}:${row.sourceId}`, {
        id: row.id,
        version: row.version,
      })
    }

    // 2. 计算每条的状态 + 准备批量 upsert
    const oldVersions: BatchUpsertResult['oldVersions'] = []
    const hashList: string[] = []
    const valuesToUpsert: Array<typeof registryItems.$inferInsert> = []
    let inserted = 0
    let updated = 0
    let skipped = 0
    const now = new Date()

    for (const item of uniqueItems) {
      const key = `${item.raw.sourceType}:${item.raw.source}:${item.raw.sourceId}`
      const existing = existingMap.get(key)
      const oldVersion = existing?.version ?? null

      oldVersions.push({
        sourceType: item.raw.sourceType,
        source: item.raw.source,
        sourceId: item.raw.sourceId,
        oldVersion,
        newVersion: item.raw.version ?? null,
      })
      hashList.push(item.hash)

      // 幂等检查:非 force 且版本未变 → skipped,不加入 upsert 批次
      if (!options?.force && existing && oldVersion === item.raw.version) {
        skipped++
        continue
      }

      valuesToUpsert.push({
        sourceType: item.raw.sourceType,
        source: item.raw.source,
        sourceId: item.raw.sourceId,
        name: item.raw.name,
        description: item.raw.description,
        version: item.raw.version,
        author: item.raw.author,
        homepage: item.raw.homepage,
        repoUrl: item.raw.repoUrl,
        downloadUrl: item.raw.downloadUrl,
        categories: item.raw.categories,
        tags: item.raw.tags,
        payload: item.raw.payload,
        payloadHash: item.hash,
        heatScore: item.heat,
        qualityScore: item.quality,
        latestSyncedAt: now,
        updatedAt: now,
      })
      if (existing) updated++
      else inserted++
    }

    // 3. 批量 upsert(一次 DB 往返)
    if (valuesToUpsert.length > 0) {
      await tx
        .insert(registryItems)
        .values(valuesToUpsert)
        .onConflictDoUpdate({
          target: [registryItems.sourceType, registryItems.source, registryItems.sourceId],
          set: {
            name: sql`EXCLUDED.name`,
            description: sql`EXCLUDED.description`,
            version: sql`EXCLUDED.version`,
            author: sql`EXCLUDED.author`,
            homepage: sql`EXCLUDED.homepage`,
            repoUrl: sql`EXCLUDED.repo_url`,
            downloadUrl: sql`EXCLUDED.download_url`,
            categories: sql`EXCLUDED.categories`,
            tags: sql`EXCLUDED.tags`,
            payload: sql`EXCLUDED.payload`,
            payloadHash: sql`EXCLUDED.payload_hash`,
            heatScore: sql`EXCLUDED.heat_score`,
            qualityScore: sql`EXCLUDED.quality_score`,
            latestSyncedAt: sql`EXCLUDED.latest_synced_at`,
            updatedAt: sql`EXCLUDED.updated_at`,
          },
        })
    }

    return {
      inserted,
      updated,
      skipped,
      failed: rejected,
      oldVersions,
      hashList,
      deduped,
      sanitized: stats,
    }
  })
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
  const rows = await db.insert(registryWebhookTriggers).values(record).returning()
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
    // status-guard-exempt: webhook 触发一次性结果回写(processed/failed/ignored),非出向
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
  // postgres.js 原生参数不接受 Date 对象,必须转 ISO 字符串(否则 ERR_INVALID_ARG_TYPE)
  const cutoff = new Date(Date.now() - daysToKeep * 86400_000).toISOString()
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
  // postgres.js 原生参数不接受 Date 对象,必须转 ISO 字符串(否则 ERR_INVALID_ARG_TYPE)
  const cutoff = new Date(Date.now() - daysToKeep * 86400_000).toISOString()
  const deleted = await db
    .delete(registrySyncLogs)
    .where(sql`${registrySyncLogs.startedAt} < ${cutoff}`)
    .returning({ id: registrySyncLogs.id })
  return deleted.length
}

/**
 * 查询单个条目的当前版本(供 worker 对比 oldVersion 用)。
 * 按 (sourceType, source, sourceId) 复合键查询。
 * F-643:版本判定读主库 —— 该值用于和待写入版本比较,读副本延迟会产生错误决策。
 */
export async function getRegistryItemVersion(
  sourceType: string,
  source: string,
  sourceId: string,
): Promise<string | null> {
  const rows = await db
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
