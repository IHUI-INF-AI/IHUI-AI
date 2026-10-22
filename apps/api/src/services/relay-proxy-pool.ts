// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出口代理池服务(2026-10-22 立,反代号池子系统数据层)。
 *
 * 职责:ai_relay_proxy_pool 表(迁移 331)的轮换取用与失败计数。
 * - pickProxyForAccount:账号自带 proxyUrl 直接返回;否则从池取 active 代理
 *   (最久未用优先的简单轮换,取用即回写 lastPickedAt)。
 * - reportProxyFailure / reportProxySuccess:连续失败计数,达阈值转 exhausted,成功清零并回 active。
 * - markProxyChecked:活性检测**接口**(供未来探测/人工标记用,不强制外网探测)。
 * 全部永不抛:取代理失败返回 null(直连),上报失败静默 warn。
 */
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { aiRelayProxyPool } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { logger } from '../utils/logger.js'

/** 连续失败阈值:达到即转 exhausted(暂冷,成功上报可回升 active) */
const PROXY_FAIL_LIMIT = 5

/**
 * 为账号选出口代理。账号自带 proxyUrl → 直接返回(账号级独立出口优先);
 * 否则池内轮换取 active 代理(共享位或绑定到该账号的位);池空/异常 → null(直连)。
 */
export async function pickProxyForAccount(account: {
  id: string
  proxyUrl: string | null
}): Promise<string | null> {
  if (account.proxyUrl) return account.proxyUrl
  try {
    const rows = await dbRead
      .select({ id: aiRelayProxyPool.id, proxyUrl: aiRelayProxyPool.proxyUrl })
      .from(aiRelayProxyPool)
      .where(
        and(
          eq(aiRelayProxyPool.status, 'active'),
          or(
            isNull(aiRelayProxyPool.boundAccountId),
            eq(aiRelayProxyPool.boundAccountId, account.id),
          ),
        ),
      )
      .orderBy(sql`${aiRelayProxyPool.lastPickedAt} asc nulls first`)
      .limit(1)
    const row = rows[0]
    if (!row) return null
    await db
      .update(aiRelayProxyPool)
      .set({ lastPickedAt: new Date(), updatedAt: new Date() })
      .where(eq(aiRelayProxyPool.id, row.id))
    return row.proxyUrl
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
      proxyUrl,
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
      proxyUrl,
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
      proxyUrl,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
