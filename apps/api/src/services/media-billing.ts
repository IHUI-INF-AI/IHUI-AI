// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成计费(2026-11-21 立,机主授权"按深度分析后的最优建议执行")。
 *
 * 为什么要有这一层:
 *   LLM 走 ``chargePointsForCall`` 的"按 token 数扣分",而图像/视频上游**从不返回 token 用量**
 *   —— ``extractTokenUsage`` 恒得 0,于是 ``totalTokens <= 0`` 直接跳过扣分。结果就是:一次
 *   40-50s 的真出图、一次要轮询 160s 的视频任务,平台付了上游成本、用户一分不扣。
 * 定价公式与单位价在 ``media-billing-pricing.ts``(纯模块,可单测);本文件只负责 IO:
 * 余额预检 + 成功后扣分 + 幂等查重。
 *
 * 三条硬约束(与 2026-11-21 的既定口径一致):
 *   ① **不预扣**:先调上游,只有拿到可用产物(可渲染图片地址 / 已创建的任务)才扣分。
 *      预扣失败要走退还,而退还只能走 earn —— earn 会同时累加 totalEarned 与 experience,
 *      等于"退款送经验",账目会脏。所以"成功后扣"是唯一干净路径,失败天然零成本。
 *   ② **不阻塞**:扣分异常(并发竞态/DB 抖动)只记日志,不把已经生成成功的产物吞掉 ——
 *      与 ``chargePointsForCall`` 同一失效方向。
 *   ③ **幂等**:同一条 ``referenceId``(图像=落库记录 id 或任务 id,视频=任务 id)只扣一次,
 *      重试/重复推送不会二次扣费。查重按 (userId, referenceId, source) 精确命中。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { pointTransactions } from '@ihui/database'
import { db } from '../db/index.js'
import { findUserPoints } from '../db/gamification-queries.js'
import { spendPoints } from './points-service.js'
import {
  MEDIA_UNIT_POINTS,
  estimateMediaPoints,
  type MediaCategory,
} from './media-billing-pricing.js'

export type { MediaCategory }
export { MEDIA_UNIT_POINTS, estimateMediaPoints }

/** 积分流水 source 标识;幂等查重与对账都按它定位。 */
export const MEDIA_BILLING_SOURCE = 'ai_media'

/** 同一 referenceId 是否已经扣过媒体分(幂等判据)。 */
async function hasChargedMedia(userId: string, referenceId: string): Promise<boolean> {
  const rows = await db
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, userId),
        eq(pointTransactions.referenceId, referenceId),
        eq(pointTransactions.source, MEDIA_BILLING_SOURCE),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/**
 * 调用前余额预检。与 ``ensurePointsBalance`` 的差别是**按本次预估金额**判,而不是只判 >0:
 * 视频 12 积分起,余额 1 也放行的话用户会跑到上游才发现扣不动。
 * 返回 false 表示已响应 402,调用方直接 return。
 */
export async function ensureMediaPointsBalance(
  request: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
  category: MediaCategory,
  units = 1,
): Promise<boolean> {
  const required = estimateMediaPoints(modelId, category, units)
  if (required <= 0) return true
  const userId = request.userId
  if (!userId) return true
  const points = await findUserPoints(userId)
  const balance = points?.points ?? 0
  if (balance >= required) return true
  reply.status(402).send({
    code: 402,
    message: `积分不足:本次${category === 'image' ? '出图' : '出片'}约需 ${required} 积分,当前余额 ${balance}`,
    data: { balance, required, category, unit_points: MEDIA_UNIT_POINTS[category] },
  })
  return false
}

/**
 * 生成成功后扣分。返回实际扣掉的积分(0 = 未扣:免费档 / 已扣过 / 扣分失败)。
 * 调用点必须在**产物已确认可用之后**,且传一条稳定唯一的 referenceId。
 */
export async function chargeMediaPoints(
  request: FastifyRequest,
  modelId: string,
  category: MediaCategory,
  units: number,
  referenceId: string,
): Promise<number> {
  const amount = estimateMediaPoints(modelId, category, units)
  if (amount <= 0) return 0
  const userId = request.userId
  if (!userId || !referenceId) return 0
  try {
    if (await hasChargedMedia(userId, referenceId)) return 0
    await spendPoints(
      userId,
      amount,
      MEDIA_BILLING_SOURCE,
      `媒体生成扣分(${category}, model=${modelId}, units=${units}, unit=${MEDIA_UNIT_POINTS[category]})`.slice(
        0,
        255,
      ),
      referenceId,
    )
    return amount
  } catch (err) {
    // 余额在预检与扣分之间被并发消耗等情形:产物已给用户,不能因扣分失败吞掉结果。
    request.log.warn(
      { err, model: modelId, category, units, referenceId },
      '[media-billing] 扣分失败(产物已交付,不阻塞响应)',
    )
    return 0
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
