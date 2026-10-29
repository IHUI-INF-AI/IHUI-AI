// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「已吊销的 refresh token 又被拿来刷新」这件事的唯一裁决出口(2026-10-20 立)。
 *
 * 立因:同一个判定此前散在两处(`routes/auth.ts` 的 /refresh 与
 * `routes/auth-extended.ts` 的 rotateRefreshTokenFlow),而两处口径不同 —— 前者有 30s
 * 宽限期,后者一律吊销整族。用户侧症状是"关掉再打开就要重新登录":实测 refresh_tokens
 * 里约每小时一次族吊销爆发(同 family 同秒签发 2-3 个子 token),三端同时被踢。
 *
 * 三档裁决(语义互斥,不许合并):
 * - `race`          —— 吊销发生在宽限期内:多标签页/多端同批 15min access 过期后几乎同时
 *                      刷新,后到者重放先到者刚轮转掉的 v1。属并发竞态,放行正常轮转。
 * - `stale-sibling` —— 超出宽限期,但**这一族里还有活 token**:迟到的是陈旧副本(桌面
 *                      vault 里的旧值 / 停在旧页签的上下文 / 另一台设备 / 刷新响应被
 *                      API 重启打断后浏览器仍留着旧 cookie)。**同样放行正常轮转**,仅记
 *                      warn 留痕。2026-10-27 前这里只拒绝本次,结果把「凭据明明在、族也
 *                      活着」的用户永久锁在门外:生产日志连续出现
 *                      `stale refresh token replay ... rejected without revoking`,
 *                      每次只能手动重登并新建一个 family,日积月累堆出上千条会话记录。
 * - `reuse`         —— 超出宽限期,且这一族一个活的都没有:整族已死,保留 RFC 6749 §10.4
 *                      的吊销动作与审计留痕(该次吊销本身是空操作,价值在日志与指标)。
 *
 * 为什么 stale-sibling 也放行:能走到这一档的前提是「同族还有活 token」—— 说明会话本身
 * 没有死,死的只是调用方手里那一份旧副本。真正的重放攻击面由 `reuse` 覆盖(整族无活 token
 * 才判攻击);把「持有旧副本」一律当攻击,只会误伤唯一合法用户。
 *
 * 为什么宽限期是 30s:业界先例 AWS Cognito 默认 115s、Auth0 可配 refresh rotation leeway;
 * 30s 覆盖"两个上下文同批过期"的窗口。窗口固定不滑动 —— revokedAt 保持首次吊销时间,
 * 放行分支跳过重复 revoke,不给"多次重放不断续窗"留缝。
 */

import { findLiveFamilyToken } from '../db/queries.js'

/** 重放宽容期(毫秒)。窗口固定:不以重放次数续窗,revokedAt 保持首次吊销时间。 */
const REFRESH_REUSE_LEEWAY_MS = 30_000

/** 重放裁决档位。 */
type RefreshReplayVerdict = 'race' | 'stale-sibling' | 'reuse'

/** 裁决结果(带观测用的吊销时长,便于日志定位是哪种重放)。 */
export interface RefreshReplayAssessment {
  verdict: RefreshReplayVerdict
  revokedAgeMs: number
}

/**
 * 裁决一次重放。
 *
 * @param revokedAt 该 token 记录上的吊销时刻(调用方已确认非空)
 * @param familyId  token 载荷里的 familyId(缺失 ⇒ 无从判断同族活 token,按 reuse 处理)
 * @param now       当前时刻(测试注入用)
 */
export async function assessRefreshReplay(
  revokedAt: Date,
  familyId: string | undefined,
  now: number = Date.now(),
): Promise<RefreshReplayAssessment> {
  const revokedAgeMs = now - revokedAt.getTime()
  if (revokedAgeMs < REFRESH_REUSE_LEEWAY_MS) {
    return { verdict: 'race', revokedAgeMs }
  }
  if (familyId) {
    const liveSibling = await findLiveFamilyToken(familyId)
    if (liveSibling) return { verdict: 'stale-sibling', revokedAgeMs }
  }
  return { verdict: 'reuse', revokedAgeMs }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
