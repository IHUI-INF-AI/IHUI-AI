// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回滚后的"归属是否真错位"判据 —— 单源(2026-11-26 立)。
 *
 * 背景:relay-trae-chat-switch 回滚完会核对 project / user_configuration 的 user_id,
 * 原判据是"必须只剩切前那枚 oldUid"。但这台机器用过很久,库里本来就躺着多枚历史号的
 * 残留(2026-11-26 实测:回滚后仍是 256600094542297 / 4052179693353144 / 4135677762212986 /
 * 2257723987855312;而切前 vscdb 备份里同四枚各有 101/8/7/2 个键 —— 切前就是这副样子)。
 * 于是回滚明明干净,却报"归属仍与登录态不一致",把人往"事故"上引。
 *
 * 正确判据:回滚后出现的归属**不能超出切前基线**。基线拿不到才退回"只认 oldUid"的老判据,
 * 并在报告里标明判据来源(未判定 ≠ 已核对)。
 */

/** 归属表 → uid 集合(过滤空值/非字符串) */
export function ownerUidSet(owner) {
  const out = new Set()
  if (!owner || typeof owner !== 'object') return out
  for (const uids of Object.values(owner)) {
    if (!Array.isArray(uids)) continue
    for (const u of uids) if (typeof u === 'string' && u) out.add(u)
  }
  return out
}

/**
 * 取"真错位"的表名列表。
 * @param {Record<string, string[]>} owner        回滚后读到的归属
 * @param {Record<string, string[]>|null} baseline 切前基线(可为 null)
 * @param {string} fallbackUid                    无基线时唯一允许的 uid(切前号)
 * @returns {string[]} 错位的表名
 */
export function pickOwnerMismatches(owner, baseline, fallbackUid) {
  const entries = Object.entries(owner ?? {})
  if (baseline && typeof baseline === 'object' && Object.keys(baseline).length > 0) {
    const base = ownerUidSet(baseline)
    return entries
      .filter(([, uids]) => (Array.isArray(uids) ? uids : []).some((u) => u && !base.has(u)))
      .map(([table]) => table)
  }
  return entries
    .filter(([, uids]) => (Array.isArray(uids) ? uids : []).some((u) => u && u !== fallbackUid))
    .map(([table]) => table)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
