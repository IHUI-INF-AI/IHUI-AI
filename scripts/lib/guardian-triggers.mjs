// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `stagedTriggers` 的取值归一层(2026-09-25 立)。
 *
 * 为什么单独成文件:guardian-runner 顶层就是 CLI 主流程(无 §22d `isDirectRun` 守卫),
 * 测试若直接 import 它会把 159 道门全跑一遍。判据抽出来才能被钉住。
 *
 * 立因(实测,非假设):runner 的 `stagedPathsTouch()` 只认数组(`prefixes.some(...)`),
 * 而 HEAD 里有三道门把 `stagedTriggers` 写成了裸字符串 ——
 * `'scripts/'` / `'apps/cli/src/'` / `'apps/,packages/'`(第三条作者显然想用逗号表列表)。
 * 于是**任何一次带 --staged 的 pre-commit 都在第 118 道门处 TypeError 崩掉**,
 * 整条守门链在崩溃点之后全部没跑,而提交被 `--no-verify` 兜住 —— 现象是"钩子红了",
 * 实际后果等同把其余 140+ 道门一起关掉(§12e 那一型)。
 *
 * 两个失效面都要堵,而且**失效方向必须是"多问一次",不能是"多放一次"**:
 *  - 裸字符串 → 归一成数组(作者的意图显然可辨);
 *  - 空清单(`[]` / `''` / `','`)→ **抛错**,不得静默变成"该门永不运行"
 *    (旧写法 `stagedTriggers: []` 是 truthy,会让那道门在提交链上隐形失踪)。
 */

/** @param {unknown} raw @returns {string[]} */
export function normalizeTriggers(raw) {
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((entry) =>
    typeof entry === 'string' ? entry.split(',') : [entry],
  )
  const list = parts.map((s) => (typeof s === 'string' ? s.trim() : s)).filter((s) => s !== '')
  if (list.length === 0) {
    throw new TypeError(
      `stagedTriggers 归一后为空(收到 ${JSON.stringify(raw)}):空清单会让那道门在提交链上永不运行 —— ` +
        '要么给出前缀,要么干脆不声明这个字段。',
    )
  }
  if (list.some((s) => typeof s !== 'string')) {
    throw new TypeError(`stagedTriggers 含非字符串条目:${JSON.stringify(raw)}`)
  }
  return list
}

/**
 * 本次暂存的路径是否触及任一触发前缀。取不到暂存清单时**保守判"触及"**(照旧跑门)。
 * @param {string[]|null} files @param {unknown} raw
 */
export function triggersTouch(files, raw) {
  const prefixes = normalizeTriggers(raw)
  if (files === null) return true
  return files.some((f) => {
    const norm = String(f).replace(/\\/g, '/')
    return prefixes.some((p) => norm.startsWith(p))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
