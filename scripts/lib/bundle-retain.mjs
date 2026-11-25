// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * bundle-retain.mjs — 仓外冷归档 bundle 的老化策略（单一实现，§22c）。
 *
 * 立因（2026-11-25）：prune-repo-bloat / prune-lost-commit-tags 的「清理前 bundle」已改落
 * `<仓库根>/../ihui-git-bundles/<族>/`，但那只是把膨胀从仓内挪到仓外 —— 若不清，
 * 每轮 over-budget 就写一份 GB 级 bundle，仓外目录会无界增长（同型通道换了个位置，
 * 用户的「不允许再出现膨胀」一条都不允许）。
 *
 * 策略：按 mtime 保留最近 `retain` 份（默认 3，env `IHUI_BUNDLE_RETAIN`），更老的删。
 *
 * 纪律：
 *  - 只在新 bundle **已写成功并 verify 之后**调用（失效方向恒为多留一份，§0.10）；
 *  - 只删 `*.bundle`，可选 `prefix` 过滤（不碰目录里别人放的东西）；
 *  - 取不到目录 / 取不到某枚 mtime ⇒ 该枚一律不动，返回 skipped 让调用方点名（§0.3）。
 */
import { readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function pruneBundles(dir, { retain = 3, prefix = '' } = {}) {
  const removed = []
  let names
  try {
    names = readdirSync(dir)
  } catch (e) {
    return { removed, skipped: `目录读不到（${e?.code ?? e?.message ?? e}）⇒ 未判定，一份都不删` }
  }
  const items = []
  for (const name of names) {
    if (!name.endsWith('.bundle')) continue
    if (prefix && !name.startsWith(prefix)) continue
    try {
      items.push({ name, mtimeMs: statSync(join(dir, name)).mtimeMs })
    } catch {
      /* mtime 取不到 ⇒ 该枚不动（多留一份方向） */
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs)
  // 至少留 1 份：retain 传 0/负数也不能把归档删空（删空 = 无可回滚点）
  const keepCount = Math.max(1, Number(retain) || 1)
  for (const x of items.slice(keepCount)) {
    try {
      rmSync(join(dir, x.name), { force: true })
      removed.push(x.name)
    } catch {
      /* 下次再来 */
    }
  }
  return { removed, skipped: '' }
}

export const __test__ = { pruneBundles }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
