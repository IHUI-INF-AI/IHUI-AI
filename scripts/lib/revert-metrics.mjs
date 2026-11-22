// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// scripts/lib/revert-metrics.mjs
// 部分回退判据的共用度量。原住在已退役的 auto-commit-quiet,收编器删除后迁到这里,判据口径不变。

export function minusCount(aText, bText) {
  const pool = new Map()
  for (const l of String(bText).split('\n')) pool.set(l, (pool.get(l) ?? 0) + 1)
  let n = 0
  for (const l of String(aText).split('\n')) {
    const c = pool.get(l) ?? 0
    if (c > 0) pool.set(l, c - 1)
    else n += 1
  }
  return n
}

/** 删占比 ≥2% ∧ 删 ≥15 行 ∧ 增 ≤ 删的 1/8,三条缺一不算。 */
export function isPartialRevert(delta) {
  if (!delta || typeof delta.removed !== 'number') return false
  const removed = delta.removed
  const added = delta.added
  const total = delta.headLines
  if (!(removed >= 15) || !(total > 0)) return false
  if (removed * 100 < total * 2) return false
  return added * 8 <= removed
}
