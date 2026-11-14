// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出口代理池服务(2026-10-22 立,反代号池子系统数据层)。
 *
 * 职责:ai_relay_proxy_pool 表(迁移 331)的轮换取用与失败计数。
 * - pickProxyForAccount:账号自带 proxyUrl(落库密文,此处解密)优先;否则从池取 active 代理
 *   (最久未用优先的简单轮换,取用即回写 lastPickedAt)。取用是**单条带行锁的 UPDATE**
 *   (2026-10-28 量测定档:不加锁的「UPDATE … WHERE id = (SELECT … LIMIT 1)」会把并发请求
 *   全摁在同一枚位上,详见 pickProxyForAccount 头注),多实例并发各取不同位。
 * - reportProxyFailure / reportProxySuccess:连续失败计数,达阈值转 exhausted,成功清零并回 active。
 * - markProxyChecked:活性检测**接口**(供未来探测/人工标记用,不强制外网探测)。
 * - listProxies / createProxy / updateProxy / deleteProxy / getProxyById:管理面 CRUD。
 * 全部永不抛:取代理失败返回 null(直连),上报失败静默 warn,CRUD 返回可判别结果。
 */
import { desc, eq, sql } from 'drizzle-orm'
import { aiRelayProxyPool, type AiRelayProxyPool } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { decryptField, encryptField } from '../utils/crypto.js'
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

/**
 * 账号级出口代理落库形态(AES-256-GCM,与 token/cookies 同一把钥匙)。
 * 空串/null → null,读路径由 decryptField 兼容存量明文,升级无需停机回填。
 * 只用于 ai_relay_account_pool.proxy_url;共享代理池自己的 proxy_url 仍为明文
 * (要被多账号按 URL 精确取用与去重)。
 */
export function encryptAccountProxyUrl(plain: string | null | undefined): string | null {
  const v = typeof plain === 'string' ? plain.trim() : ''
  return v ? encryptField(v) : null
}

/**
 * 解密账号级 proxyUrl;解不出(密钥轮换/密文损坏)→ null 按直连处理。
 * 绝不把密文当代理地址交给 ProxyAgent —— 那会让该号整条出网链路必坏。
 */
export function resolveAccountProxyUrl(stored: string | null | undefined): string | null {
  if (!stored) return null
  try {
    const plain = decryptField(stored).trim()
    return plain || null
  } catch (e) {
    logger.warn('[relay-proxy-pool] 账号级 proxyUrl 解密失败,按直连处理', {
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/**
 * 账号级代理脱敏展示:只留 scheme://***@host:port。
 * 密文解不出/地址非法 → '已隐藏'(既不回流密文,也不编造地址)。
 */
export function maskAccountProxyUrl(stored: string | null | undefined): string | null {
  if (!stored) return null
  let plain: string
  try {
    plain = decryptField(stored).trim()
  } catch {
    return '已隐藏'
  }
  if (!plain) return null
  try {
    const u = new URL(plain)
    return `${u.protocol}//${u.username || u.password ? '***@' : ''}${u.host}`
  } catch {
    return '已隐藏'
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
 * 为账号选出口代理。账号自带 proxyUrl(落库密文,先解密)→ 直接返回(账号级独立出口优先);
 * 否则池内轮换取 active 代理(共享位或绑定到该账号的位);池空/异常 → null(直连)。
 *
 * 并发纪律(2026-10-28 在真 PG 18.6 上量测定档,取代此前「行锁 + 语句级快照保证不会两家拿到
 * 同一行」这条**不成立**的断言):PG 的 UPDATE 只锁"它正要写的那一行",WHERE 子查询里的
 * SELECT 走语句快照、**不锁行**;连接池 max:40 下多条语句真并行,于是所有并发请求的
 * 「ORDER BY last_picked_at ASC NULLS FIRST LIMIT 1」在同刻算出**同一个** id,全都写同一枚位。
 * 实测(3 枚位 × 12 路并发 × 30 轮):旧写法 27/30 轮出现漏刷(其余位 last_picked_at 恒 NULL,
 * 一枚位被同刻取 5–12 次),10 枚池最坏只刷到 1 枚 ⇒ 轮换整轮冻在一位上。这不是测试不稳定,
 * 是线上缺陷:同一出口 IP 被并发重复派用,其余代理闲置。
 *
 * 现改为两档行锁(仍是**单条语句、单次 db.execute**):
 *  ① free_pick:`… ORDER BY last_picked_at ASC NULLS FIRST LIMIT 1 FOR UPDATE SKIP LOCKED`
 *     —— 只认领"此刻没有别人正在认领"的最旧一枚;同刻两路不会拿到同一枚(锁本身就是认领凭据)。
 *  ② busy_pick:`NOT EXISTS (SELECT 1 FROM free_pick)` 才走,对最旧一枚**等锁**(阻塞 FOR UPDATE)
 *     —— 池位数已被在飞请求占满时宁可排队,也不能在这种时刻返回 null:null 的语义是"直连",
 *     等于让账号拿真实出口 IP 去打上游,正是本池要防的事。
 *     实测纯 ① (只有 SKIP LOCKED、没有 ②)在 3 枚位 × 12 路并发下会让 4–9 路降级直连,故必须留 ②。
 *
 * 为什么 max:40 下不死锁:EXPLAIN 证实两个 CTE 各只物化一次,且 ② 挂在 One-Time Filter 上,
 * 所以每条语句在本事务里**最多持有一把行锁**(① 与 ② 互斥);等锁的一方手里不持任何锁
 * ⇒ 构不出等待环,而死锁至少需要一个"持锁并等锁"的参与者。池顶格实测(3 枚位 × 40 路 × 30 轮)
 * 零报错零超时,wall 16–41ms。取不到任何位(池空 / 全被他人绑定 / 非 active)才返回 null 直连。
 */
export async function pickProxyForAccount(account: {
  id: string
  proxyUrl: string | null
}): Promise<string | null> {
  const accountProxy = resolveAccountProxyUrl(account.proxyUrl)
  if (accountProxy) return accountProxy
  try {
    const raw = await db.execute(sql`
      WITH free_pick AS (
        SELECT id
          FROM ai_relay_proxy_pool
         WHERE status = 'active'
           AND (bound_account_id IS NULL OR bound_account_id = ${account.id})
         ORDER BY last_picked_at ASC NULLS FIRST
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      ), busy_pick AS (
        SELECT id
          FROM ai_relay_proxy_pool
         WHERE status = 'active'
           AND (bound_account_id IS NULL OR bound_account_id = ${account.id})
           AND NOT EXISTS (SELECT 1 FROM free_pick)
         ORDER BY last_picked_at ASC NULLS FIRST
         LIMIT 1
         FOR UPDATE
      )
      UPDATE ai_relay_proxy_pool AS p
         SET last_picked_at = now(), updated_at = now()
        FROM (SELECT id FROM free_pick UNION ALL SELECT id FROM busy_pick LIMIT 1) AS claimed
       WHERE p.id = claimed.id
      RETURNING p.proxy_url
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
