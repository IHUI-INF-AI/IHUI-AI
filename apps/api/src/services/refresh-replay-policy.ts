// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「已吊销的 refresh token 又被拿来刷新」这件事的唯一裁决出口(2026-10-20 立)。
 *
 * 立因:同一个判定此前散在两处(`routes/auth.ts` 的 /refresh 与
 * `routes/auth-extended.ts` 的 rotateRefreshTokenFlow),而两处口径不同 —— 前者有 30s
 * 宽限期,后者一律吊销整族。
 *
 * 两档裁决(语义互斥,不许合并):
 * - `race`  —— 吊销发生在宽限期内:多标签页/多端同批 15min access 过期后几乎同时
 *              刷新,后到者重放先到者刚轮转掉的 v1。属并发竞态,放行正常轮转。
 * - `reuse` —— 超出宽限期即视为攻击重放:吊销整族并审计。
 *
 * F-268:2026-11-08 删除原 `stale-sibling` 档。它按「同族还有活 token」放行迟到重放,
 * 但攻击者首次重放 v1 被放行后会拿到新的活 sibling,此后 reuse 永远不可达 —— 等于把
 * 一次凭据泄露洗成合法轮转(可无限续命)。多端各自持有独立 family,真正需要兼容的只是
 * 同一 context 的并发窗口,已由 30s `race` 覆盖。
 *
 * 为什么宽限期是 30s:业界先例 AWS Cognito 默认 115s、Auth0 可配 refresh rotation leeway;
 * 30s 覆盖"两个上下文同批过期"的窗口。窗口固定不滑动 —— revokedAt 保持首次吊销时间,
 * 放行分支跳过重复 revoke,不给"多次重放不断续窗"留缝。
 */

/** 重放宽容期(毫秒)。窗口固定:不以重放次数续窗,revokedAt 保持首次吊销时间。 */
const REFRESH_REUSE_LEEWAY_MS = 30_000

/** 重放裁决档位。 */
type RefreshReplayVerdict = 'race' | 'reuse'

/** 裁决结果(带观测用的吊销时长,便于日志定位是哪种重放)。 */
export interface RefreshReplayAssessment {
  verdict: RefreshReplayVerdict
  revokedAgeMs: number
}

/**
 * 裁决一次重放。
 *
 * @param revokedAt 该 token 记录上的吊销时刻(调用方已确认非空)
 * @param _familyId token 载荷里的 familyId(保留签名兼容;F-268 起不再据此放行)
 * @param now       当前时刻(测试注入用)
 */
export async function assessRefreshReplay(
  revokedAt: Date,
  _familyId: string | undefined,
  now: number = Date.now(),
): Promise<RefreshReplayAssessment> {
  const revokedAgeMs = now - revokedAt.getTime()
  if (revokedAgeMs < REFRESH_REUSE_LEEWAY_MS) {
    return { verdict: 'race', revokedAgeMs }
  }
  return { verdict: 'reuse', revokedAgeMs }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
