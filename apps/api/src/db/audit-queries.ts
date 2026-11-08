// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 国安级审计日志链 DB 操作层(raw SQL)。
 *
 * 设计要点:
 * - 表名 `audit_logs_chain`(独立于现有 `audit_logs` 表,避免破坏既有审计链路)。
 *   主 agent 后续通过 migration 建表,字段对齐 AuditLogChainRow。
 * - 全部用 `db.execute(sql\`...\`)` 原生 SQL,不依赖 drizzle schema 声明,
 *   这样表未建时不会编译报错;**写路径**捕获异常降级(表未就绪时不影响主业务),
 *   但**读路径**失败一律抛错(F-246):审计查询不能把"失败"写成"没有记录"。
 * - 写走 db(主库),读走 dbRead(读副本,无副本时回退主库)。
 *
 * 期望表结构(主 agent 建表参考):
 *   CREATE TABLE audit_logs_chain (
 *     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     timestamp     TIMESTAMPTZ NOT NULL,
 *     user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
 *     action        VARCHAR(64) NOT NULL,
 *     resource_type VARCHAR(64),
 *     resource_id   VARCHAR(64),
 *     ip            VARCHAR(64),
 *     user_agent    VARCHAR(512),
 *     result        VARCHAR(32),
 *     metadata      JSONB DEFAULT '{}'::jsonb,
 *     prev_hash     CHAR(64) NOT NULL,
 *     current_hash  CHAR(64) NOT NULL
 *   );
 *   CREATE INDEX idx_audit_chain_ts    ON audit_logs_chain(timestamp DESC);
 *   CREATE INDEX idx_audit_chain_user  ON audit_logs_chain(user_id);
 *   CREATE INDEX idx_audit_chain_act   ON audit_logs_chain(action);
 */
import { sql, type SQL } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'

/** 审计日志链行(对齐 DB 列,camelCase 映射)。 */
export interface AuditLogChainRow {
  id: string
  timestamp: string
  userId: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  ip: string | null
  userAgent: string | null
  result: string | null
  metadata: Record<string, unknown> | null
  prevHash: string
  currentHash: string
}

/** 查询过滤项(6 维)。 */
export interface AuditLogFilters {
  userId?: string
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
}

/** 插入入参(由 service 层算好 hash 后传入)。 */
export interface InsertAuditLogInput {
  timestamp: string
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  ip?: string
  userAgent?: string
  result?: string
  metadata?: Record<string, unknown>
  prevHash: string
  currentHash: string
}

const TABLE = 'audit_logs_chain'

/**
 * F-246(P2,2026-11-08):读查询失败必须显式失败,**不得** catch 成空结果。
 *
 * 旧形态把 DB 故障/表未迁移吞成 `{ list: [], total: 0 }` / `[]` / `0`,于是:
 * 审计员把"查询失败"读成"没有记录",`/audit-logs/verify` 甚至对空输入判
 * `valid:true`(等于向管理员出具"链完好"的假结论),导出侧再把空页当成末页静默截断。
 * 表未就绪也属于失败 —— 审计面没有"降级成空"这一档。
 */
function auditQueryFailed(operation: string, error: unknown): never {
  logger.error(`[audit-queries] ${operation} failed`, {
    error: (error as Error).message,
  })
  throw new AppError(
    '审计链查询失败:数据库不可用,本次结果不完整',
    503,
    'AUDIT_CHAIN_UNAVAILABLE',
  )
}

const SELECT_COLS = sql.raw(
  'id, timestamp, user_id, action, resource_type, resource_id, ip, user_agent, result, metadata, prev_hash, current_hash',
)

/** 将 postgres snake_case 行映射为 camelCase(unknown → 强类型)。 */
function mapRow(r: Record<string, unknown>): AuditLogChainRow {
  const ts = r['timestamp']
  return {
    id: String(r['id']),
    timestamp: ts instanceof Date ? ts.toISOString() : String(ts ?? ''),
    userId: r['user_id'] === null || r['user_id'] === undefined ? null : String(r['user_id']),
    action: String(r['action']),
    resourceType:
      r['resource_type'] === null || r['resource_type'] === undefined
        ? null
        : String(r['resource_type']),
    resourceId:
      r['resource_id'] === null || r['resource_id'] === undefined ? null : String(r['resource_id']),
    ip: r['ip'] === null || r['ip'] === undefined ? null : String(r['ip']),
    userAgent:
      r['user_agent'] === null || r['user_agent'] === undefined ? null : String(r['user_agent']),
    result: r['result'] === null || r['result'] === undefined ? null : String(r['result']),
    metadata:
      r['metadata'] === null || r['metadata'] === undefined
        ? null
        : (r['metadata'] as Record<string, unknown>),
    prevHash: String(r['prev_hash']),
    currentHash: String(r['current_hash']),
  }
}

/** 安全提取 db.execute 结果为数组。 */
function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/** 动态构建 WHERE 子句(无过滤项时返回 TRUE,保持语法完整)。 */
function buildWhere(f: AuditLogFilters): SQL {
  const conds: SQL[] = []
  if (f.userId) conds.push(sql`user_id = ${f.userId}::uuid`)
  if (f.action) conds.push(sql`action = ${f.action}`)
  if (f.resourceType) conds.push(sql`resource_type = ${f.resourceType}`)
  if (f.startDate) conds.push(sql`timestamp >= ${new Date(f.startDate)}`)
  if (f.endDate) conds.push(sql`timestamp <= ${new Date(f.endDate)}`)
  if (conds.length === 0) return sql`TRUE`
  return sql.join(conds, sql` AND `)
}

/**
 * 插入一条链式审计日志,返回新行 id。
 * 表不存在/列缺失时 catch → 返回 undefined(由调用方降级)。
 */
export async function insertAuditLog(input: InsertAuditLogInput): Promise<string | undefined> {
  try {
    const metadataJson = JSON.stringify(input.metadata ?? {})
    const raw = await db.execute(sql`
      INSERT INTO ${sql.raw(TABLE)}
        (timestamp, user_id, action, resource_type, resource_id, ip, user_agent, result, metadata, prev_hash, current_hash)
      VALUES
        (${input.timestamp}::timestamptz, ${input.userId ?? null}::uuid, ${input.action},
         ${input.resourceType ?? null}, ${input.resourceId ?? null}, ${input.ip ?? null},
         ${input.userAgent ?? null}, ${input.result ?? null}, ${metadataJson}::jsonb,
         ${input.prevHash}, ${input.currentHash})
      RETURNING id
    `)
    const rows = toRows(raw)
    const id = rows[0]?.['id']
    return id === null || id === undefined ? undefined : String(id)
  } catch (e) {
    logger.warn('[audit-queries] insertAuditLog failed (table not ready?)', {
      error: (e as Error).message,
    })
    return undefined
  }
}

/** 分页查询审计日志链(支持 6 维过滤)。 */
export async function selectAuditLogs(
  filters: AuditLogFilters,
  page: number,
  pageSize: number,
): Promise<{ list: AuditLogChainRow[]; total: number }> {
  const where = buildWhere(filters)
  const offset = Math.max(0, (page - 1) * pageSize)
  try {
    const [listRaw, countRaw] = await Promise.all([
      dbRead.execute(sql`
        SELECT ${SELECT_COLS} FROM ${sql.raw(TABLE)}
        WHERE ${where}
        ORDER BY timestamp DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `),
      dbRead.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM ${sql.raw(TABLE)} WHERE ${where}
      `),
    ])
    const list = toRows(listRaw).map(mapRow)
    const cntRow = toRows(countRaw)[0]
    const total = Number(cntRow?.['cnt'] ?? 0)
    return { list, total }
  } catch (e) {
    auditQueryFailed('selectAuditLogs', e)
  }
}

/** 导出专用键集游标:上一页最后一行的 (timestamp, id)。 */
export interface AuditLogExportCursor {
  timestamp: string
  id: string
}

/**
 * 导出专用查询:按 (timestamp, id) 升序 + 键集游标翻页。
 *
 * 为什么不复用 `selectAuditLogs`:展示面按 timestamp DESC + OFFSET 分页,导出面若沿用,
 * ① 行序是降序,hash 链锚 `prevHash → currentHash` 无法生成;② 导出期间新写入会改变
 * 偏移窗口,导致中间行被静默跳过。导出只需要"游标之后的下一批",不查总数。
 *
 * 游标比较用 `(timestamp, id) > (cursorTs, cursorId)` 双列元组,同一时间戳的兄弟行
 * 也能稳定切分(与 `audit-evidence-retention.ts` 的 `ORDER BY timestamp ASC, id ASC` 同序)。
 */
export async function selectAuditLogsForExport(
  filters: AuditLogFilters,
  cursor: AuditLogExportCursor | null,
  limit: number,
): Promise<AuditLogChainRow[]> {
  const filterWhere = buildWhere(filters)
  const where = cursor
    ? sql`${filterWhere} AND (timestamp, id) > (${new Date(cursor.timestamp)}::timestamptz, ${cursor.id}::uuid)`
    : filterWhere
  try {
    const raw = await dbRead.execute(sql`
      SELECT ${SELECT_COLS} FROM ${sql.raw(TABLE)}
      WHERE ${where}
      ORDER BY timestamp ASC, id ASC
      LIMIT ${limit}
    `)
    return toRows(raw).map(mapRow)
  } catch (e) {
    auditQueryFailed('selectAuditLogsForExport', e)
  }
}

/** 查询某用户最近 N 条日志(按时间升序,用于链完整性验证)。 */
export async function selectAuditLogChain(
  userId: string,
  limit = 1000,
): Promise<AuditLogChainRow[]> {
  try {
    const raw = await dbRead.execute(sql`
      SELECT ${SELECT_COLS} FROM ${sql.raw(TABLE)}
      WHERE user_id = ${userId}::uuid
      ORDER BY timestamp ASC
      LIMIT ${limit}
    `)
    return toRows(raw).map(mapRow)
  } catch (e) {
    auditQueryFailed('selectAuditLogChain', e)
  }
}

/** 查询时间范围内的日志(按时间升序,用于范围验证)。 */
export async function selectAuditLogsRange(
  startDate?: string,
  endDate?: string,
  limit = 10000,
): Promise<AuditLogChainRow[]> {
  const conds: SQL[] = []
  if (startDate) conds.push(sql`timestamp >= ${new Date(startDate)}`)
  if (endDate) conds.push(sql`timestamp <= ${new Date(endDate)}`)
  const where = conds.length > 0 ? sql.join(conds, sql` AND `) : sql`TRUE`
  try {
    const raw = await dbRead.execute(sql`
      SELECT ${SELECT_COLS} FROM ${sql.raw(TABLE)}
      WHERE ${where}
      ORDER BY timestamp ASC
      LIMIT ${limit}
    `)
    return toRows(raw).map(mapRow)
  } catch (e) {
    auditQueryFailed('selectAuditLogsRange', e)
  }
}

/** 统计总数(支持过滤)。 */
export async function countAuditLogs(filters: AuditLogFilters): Promise<number> {
  const where = buildWhere(filters)
  try {
    const raw = await dbRead.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM ${sql.raw(TABLE)} WHERE ${where}
    `)
    const row = toRows(raw)[0]
    return Number(row?.['cnt'] ?? 0)
  } catch (e) {
    auditQueryFailed('countAuditLogs', e)
  }
}

/** 取最近一条日志的 current_hash(链尾);表空或不存在返回 "0"*64 创世哈希。 */
export async function getLastAuditLogHash(): Promise<string> {
  const GENESIS = '0'.repeat(64)
  try {
    const raw = await dbRead.execute(sql`
      SELECT current_hash FROM ${sql.raw(TABLE)} ORDER BY timestamp DESC LIMIT 1
    `)
    const row = toRows(raw)[0]
    const h = row?.['current_hash']
    return h === null || h === undefined ? GENESIS : String(h)
  } catch (e) {
    auditQueryFailed('getLastAuditLogHash', e)
  }
}

/** 按 action 分组统计。 */
export async function groupByAction(
  filters: AuditLogFilters,
): Promise<{ action: string; count: number }[]> {
  const where = buildWhere(filters)
  try {
    const raw = await dbRead.execute(sql`
      SELECT action, COUNT(*)::int AS cnt
      FROM ${sql.raw(TABLE)}
      WHERE ${where}
      GROUP BY action
      ORDER BY cnt DESC
    `)
    return toRows(raw).map((r) => ({ action: String(r['action']), count: Number(r['cnt']) }))
  } catch (e) {
    auditQueryFailed('groupByAction', e)
  }
}

/** 按 user_id 分组统计(仅返回 top N)。 */
export async function groupByUser(
  filters: AuditLogFilters,
  topN = 20,
): Promise<{ userId: string; count: number }[]> {
  const where = buildWhere(filters)
  try {
    const raw = await dbRead.execute(sql`
      SELECT user_id, COUNT(*)::int AS cnt
      FROM ${sql.raw(TABLE)}
      WHERE ${where} AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY cnt DESC
      LIMIT ${topN}
    `)
    return toRows(raw)
      .map((r) => ({ userId: String(r['user_id']), count: Number(r['cnt']) }))
      .filter((r) => r.userId !== 'null' && r.userId !== '')
  } catch (e) {
    auditQueryFailed('groupByUser', e)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
