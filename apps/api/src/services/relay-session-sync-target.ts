// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端会话回灌的目标行选择(2026-11-01 立,单一真相源)。
 *
 * 立因:回灌腿此前只查 `owner_user_id IS NULL` 的运营池行。本机客户端号若已被某个用户
 * 个人池持有(admin 个人池已有同 uid 行),回灌看不见它 ⇒ 走自动入池再建一条运营池行,
 * 同一上游号两行并存:新票与心跳只落新建的运营池行,个人池行(签到侧绑定的那条)静默失联。
 *
 * 判据(纯函数,零 IO):
 * - 运营池行唯一 ⇒ 选它(全局归属优先,存量行为不变);
 * - 运营池无行、个人池恰好一行 ⇒ 选该行(本机号已归属用户,不再另建运营池行);
 * - 多行候选 ⇒ ambiguous,调用方必须拒写并点名(同 uid 多行时挑一行写就是写穿他人副本);
 * - 零行 ⇒ none,调用方走既有自动入池。
 *
 * 安全边界:调用方拿到 row 后**必须按主键 id 写**,不得再按 (provider, uid) 通配
 * (`apps/api/tests/relay-session-sync-owner-scope.test.ts` 钉住)。
 */

export interface SyncTargetRowLike {
  id: string
  ownerUserId: string | null
}

export type SyncTargetDecision<T extends SyncTargetRowLike> =
  { kind: 'row'; row: T } | { kind: 'none' } | { kind: 'ambiguous'; count: number }

export function chooseSyncTargetRow<T extends SyncTargetRowLike>(
  rows: readonly T[],
): SyncTargetDecision<T> {
  const opsRows = rows.filter((r) => r.ownerUserId === null)
  // 长度恰为 1 时才取 [0];noUncheckedIndexedAccess 下需要非空断言(不是猜值,是收窄)
  if (opsRows.length === 1) return { kind: 'row', row: opsRows[0]! }
  if (opsRows.length > 1) return { kind: 'ambiguous', count: opsRows.length }
  if (rows.length === 0) return { kind: 'none' }
  if (rows.length === 1) return { kind: 'row', row: rows[0]! }
  return { kind: 'ambiguous', count: rows.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
