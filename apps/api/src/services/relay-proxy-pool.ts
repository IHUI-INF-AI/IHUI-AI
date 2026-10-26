// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出口代理池服务(2026-10-22 立,反代号池子系统数据层)。
 *
 * 职责:ai_relay_proxy_pool 表(迁移 331)的轮换取用与失败计数。
 * - pickProxyForAccount:账号自带 proxyUrl 直接返回;否则从池取 active 代理
 *   (最久未用优先的简单轮换,取用即回写 lastPickedAt)。取用是**单条 UPDATE**,
 *   多实例并发取不同位(读-改-写会两家取到同一位)。
 * - reportProxyFailure / reportProxySuccess:连续失败计数,达阈值转 exhausted,成功清零并回 active。
 * - markProxyChecked:活性检测**接口**(供未来探测/人工标记用,不强制外网探测)。
 * - listProxies / createProxy / updateProxy / deleteProxy / getProxyById:管理面 CRUD。
 * 全部永不抛:取代理失败返回 null(直连),上报失败静默 warn,CRUD 返回可判别结果。
 */
import { desc, eq, sql } from 'drizzle-orm'
import { aiRelayProxyPool, type AiRelayProxyPool } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { logger } from '../utils/logger.js'

/** 连续失败阈值:达到即转 exhausted(暂冷,成功上报可回升 active) */
const PROXY_FAIL_LIMIT = 5

/** 日志脱敏:代理地址只留协议+主机,账密/路径/查询串一律不落日志 */
function maskProxyUrlForLog(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.host}`
  } catch {
    return '***'
  }
}

/** 安全提取 db.execute 结果为数组(兼容 postgres.js RowList / {rows} 两种形态)。 */
function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/**
 * 为账号选出口代理。账号自带 proxyUrl → 直接返回(账号级独立出口优先);
 * 否则池内轮换取 active 代理(共享位或绑定到该账号的位);池空/异常 → null(直连)。
 *
 * 2026-10-22:原「SELECT 最久未用 → UPDATE 该 id」是读-改-写,多实例会同时取到同一位。
 * 现改为**单条 UPDATE ... WHERE id = (SELECT ... LIMIT 1) RETURNING proxy_url**,
 * 行锁 + 语句级快照保证同一连接池视图内不会两家拿到同一行。
 */
export async function pickProxyForAccount(account: {
  id: string
  proxyUrl: string | null
}): Promise<string | null> {
  if (account.proxyUrl) return account.proxyUrl
  try {
    const raw = await db.execute(sql`
      UPDATE ai_relay_proxy_pool
         SET last_picked_at = now(), updated_at = now()
       WHERE id = (
         SELECT id
           FROM ai_relay_proxy_pool
          WHERE status = 'active'
            AND (bound_account_id IS NULL OR bound_account_id = ${account.id})
          ORDER BY last_picked_at ASC NULLS FIRST
          LIMIT 1
       )
      RETURNING proxy_url
    `)
    const row = toRows(raw)[0]
    return row && typeof row.proxy_url === 'string' ? row.proxy_url : null
  } catch (e) {
    logger.warn('[relay-proxy-pool] 代理轮换取用失败(降级为直连)', {
      accountId: account.id,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/** 上报一次代理失败:failCount+1,达阈值转 exhausted。永不抛。 */
export async function reportProxyFailure(proxyUrl: string): Promise<void> {
  try {
    const rows = await dbRead
      .select({
        id: aiRelayProxyPool.id,
        failCount: aiRelayProxyPool.failCount,
        status: aiRelayProxyPool.status,
      })
      .from(aiRelayProxyPool)
      .where(eq(aiRelayProxyPool.proxyUrl, proxyUrl))
      .limit(1)
    const row = rows[0]
    if (!row) return
    const failures = row.failCount + 1
    await db
      .update(aiRelayProxyPool)
      .set({
        failCount: failures,
        status: failures >= PROXY_FAIL_LIMIT ? 'exhausted' : row.status,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiRelayProxyPool.id, row.id))
  } catch (e) {
    logger.warn('[relay-proxy-pool] 代理失败计数上报失败(已吞)', {
      proxyUrl: maskProxyUrlForLog(proxyUrl),
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/** 上报一次代理成功:failCount 清零,exhausted 位回升 active。永不抛。 */
export async function reportProxySuccess(proxyUrl: string): Promise<void> {
  try {
    const rows = await dbRead
      .select({ id: aiRelayProxyPool.id, status: aiRelayProxyPool.status })
      .from(aiRelayProxyPool)
      .where(eq(aiRelayProxyPool.proxyUrl, proxyUrl))
      .limit(1)
    const row = rows[0]
    if (!row) return
    await db
      .update(aiRelayProxyPool)
      .set({
        failCount: 0,
        status: row.status === 'exhausted' ? 'active' : row.status,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiRelayProxyPool.id, row.id))
  } catch (e) {
    logger.warn('[relay-proxy-pool] 代理成功计数上报失败(已吞)', {
      proxyUrl: maskProxyUrlForLog(proxyUrl),
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * 活性检测接口(留桩,不强制外网探测):人工/探测器标记代理存活状态。
 * alive=true → active + 清零;alive=false → dead。永不抛。
 */
export async function markProxyChecked(proxyUrl: string, alive: boolean): Promise<void> {
  try {
    await db
      .update(aiRelayProxyPool)
      .set({
        status: alive ? 'active' : 'dead',
        ...(alive ? { failCount: 0 } : {}),
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiRelayProxyPool.proxyUrl, proxyUrl))
  } catch (e) {
    logger.warn('[relay-proxy-pool] 代理活性标记失败(已吞)', {
      proxyUrl: maskProxyUrlForLog(proxyUrl),
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

// =============================================================================
// 管理面 CRUD(2026-10-22 补:此前池表无任何写入入口,只能手工 SQL)
// 与文件既有风格一致:永不抛,返回可判别结果由路由层映射 HTTP 状态码。
// =============================================================================

function logProxyError(action: string, e: unknown, extra?: Record<string, unknown>): void {
  logger.warn(`[relay-proxy-pool] ${action}失败(已吞)`, {
    ...extra,
    error: e instanceof Error ? e.message : String(e),
  })
}

export interface ProxyPoolListQuery {
  page: number
  pageSize: number
  status?: string
}

export type ProxyPoolListResult =
  { ok: true; list: AiRelayProxyPool[]; total: number } | { ok: false }

/** 代理池分页列表(管理员可见 proxyUrl 原样,含可能存在的账号密码)。永不抛。 */
export async function listProxies(input: ProxyPoolListQuery): Promise<ProxyPoolListResult> {
  try {
    const where = input.status ? eq(aiRelayProxyPool.status, input.status) : undefined
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiRelayProxyPool)
        .where(where)
        .orderBy(desc(aiRelayProxyPool.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      dbRead
        .select({ c: sql<number>`count(*)::int` })
        .from(aiRelayProxyPool)
        .where(where),
    ])
    return { ok: true, list, total: totalRows[0]?.c ?? 0 }
  } catch (e) {
    logProxyError('代理池列表查询', e)
    return { ok: false }
  }
}

export interface CreateProxyInput {
  proxyUrl: string
  providerCode?: string | null
  boundAccountId?: string | null
}

/** 唯一约束冲突(proxy_url 全池唯一)由路由映射为 409。 */
export type CreateProxyResult =
  { ok: true; row: AiRelayProxyPool } | { ok: false; reason: 'duplicate' | 'error' }

export async function createProxy(input: CreateProxyInput): Promise<CreateProxyResult> {
  try {
    const rows = await db
      .insert(aiRelayProxyPool)
      .values({
        proxyUrl: input.proxyUrl,
        providerCode: input.providerCode ?? null,
        boundAccountId: input.boundAccountId ?? null,
      })
      .returning()
    const row = rows[0]
    if (!row) return { ok: false, reason: 'error' }
    return { ok: true, row }
  } catch (e) {
    if ((e as { code?: string } | null)?.code === '23505') {
      return { ok: false, reason: 'duplicate' }
    }
    logProxyError('代理新增', e, { proxyUrl: maskProxyUrlForLog(input.proxyUrl) })
    return { ok: false, reason: 'error' }
  }
}

export interface UpdateProxyPatch {
  status?: string
  boundAccountId?: string | null
  proxyUrl?: string
}

export type UpdateProxyResult =
  { ok: true; row: AiRelayProxyPool } | { ok: false; reason: 'not_found' | 'duplicate' | 'error' }

export async function updateProxy(id: string, patch: UpdateProxyPatch): Promise<UpdateProxyResult> {
  try {
    const [existing] = await dbRead
      .select()
      .from(aiRelayProxyPool)
      .where(eq(aiRelayProxyPool.id, id))
      .limit(1)
    if (!existing) return { ok: false, reason: 'not_found' }
    const changed = Object.fromEntries(
      Object.entries(patch).filter(
        ([k, v]) => v !== undefined && (existing as Record<string, unknown>)[k] !== v,
      ),
    )
    if (Object.keys(changed).length === 0) return { ok: true, row: existing }
    const rows = await db
      .update(aiRelayProxyPool)
      .set({ ...changed, updatedAt: new Date() })
      .where(eq(aiRelayProxyPool.id, id))
      .returning()
    const row = rows[0]
    if (!row) return { ok: false, reason: 'not_found' }
    return { ok: true, row }
  } catch (e) {
    if ((e as { code?: string } | null)?.code === '23505') {
      return { ok: false, reason: 'duplicate' }
    }
    logProxyError('代理更新', e, { id })
    return { ok: false, reason: 'error' }
  }
}

export type DeleteProxyResult = { ok: true; deleted: boolean } | { ok: false }

export async function deleteProxy(id: string): Promise<DeleteProxyResult> {
  try {
    const rows = await db
      .delete(aiRelayProxyPool)
      .where(eq(aiRelayProxyPool.id, id))
      .returning({ id: aiRelayProxyPool.id })
    return { ok: true, deleted: rows.length > 0 }
  } catch (e) {
    logProxyError('代理删除', e, { id })
    return { ok: false }
  }
}

export type GetProxyResult =
  { ok: true; row: AiRelayProxyPool } | { ok: false; reason: 'not_found' | 'error' }

export async function getProxyById(id: string): Promise<GetProxyResult> {
  try {
    const [row] = await dbRead
      .select()
      .from(aiRelayProxyPool)
      .where(eq(aiRelayProxyPool.id, id))
      .limit(1)
    if (!row) return { ok: false, reason: 'not_found' }
    return { ok: true, row }
  } catch (e) {
    logProxyError('代理查询', e, { id })
    return { ok: false, reason: 'error' }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
