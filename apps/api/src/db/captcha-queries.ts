// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 验证码查询（DB fallback）。
 * 主存储为内存 code-store.ts，此模块仅在 Redis/DB 持久化时使用。
 */
import { eq, inArray, lt } from 'drizzle-orm'
import { db } from './index.js'
import { captchas } from '@ihui/database'

/**
 * 单轮删除的主键批次上界。
 * expires_at 无二级索引,且清理此前从未挂上生命周期,积压可能是全表 ——
 * 一条无界 DELETE 会把 seq scan + 行锁一次性摊到事务里,故先取一批主键再删。
 */
const CLEANUP_BATCH_LIMIT = 1000

export async function saveCaptcha(captchaKey: string, code: string): Promise<void> {
  await db.insert(captchas).values({
    captchaKey,
    code,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })
}

export async function findCaptcha(captchaKey: string) {
  const rows = await db.select().from(captchas).where(eq(captchas.captchaKey, captchaKey)).limit(1)
  return rows[0]
}

export async function deleteCaptcha(captchaKey: string): Promise<void> {
  await db.delete(captchas).where(eq(captchas.captchaKey, captchaKey))
}

/**
 * 清理一批过期验证码,返回本轮删除条数(调用方要能观察到"清了多少")。
 * 批间短批即止:积压 ≥ 上界时由调用方的下一轮继续,单轮持锁面始终只有一批。
 */
export async function cleanupExpiredCaptchas(): Promise<number> {
  let deleted = 0
  while (true) {
    // 先取一批过期主键,再按主键删(见 CLEANUP_BATCH_LIMIT 的立因):
    // expires_at 无二级索引,一条无界 DELETE 会把 seq scan + 行锁一次性摊进事务。
    const expired = await db
      .select({ id: captchas.id })
      .from(captchas)
      .where(lt(captchas.expiresAt, new Date()))
      .limit(CLEANUP_BATCH_LIMIT)
    if (expired.length === 0) return deleted
    await db.delete(captchas).where(
      inArray(
        captchas.id,
        expired.map((row) => row.id),
      ),
    )
    deleted += expired.length
    if (expired.length < CLEANUP_BATCH_LIMIT) return deleted
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
