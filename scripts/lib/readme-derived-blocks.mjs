// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * readme-derived-blocks.mjs — README 两个「派生块」的边界与块外判据**唯一来源**。
 *
 * 立它(2026-11-06,实测两轮死锁):README 有两个由脚本独占写入的派生区 ——
 *   ① GENERATED NUMBERS(scripts/sync-readme-numbers.mjs / gen-doc-numbers.mjs 写);
 *   ② RECENT UPDATES(scripts/auto-update-readme-recent.mjs 写)。
 * 两个写入器都有一条"块外必须与索引一致才 git add"的安全闸。旧实现各自只挖掉**自己**
 * 那一块,于是数字腿把对方的 RECENT 块算进"块外"、RECENT 腿把对方的数字块算进"块外":
 * 双方产出的差异永远落在对方判据的块外 ⇒ 互为自己暂存的前提 ⇒ 结构性死锁
 * (实测日志:post-commit-readme-numbers / -recent 两轮都 `SKIP_PROSE:README.md`)。
 *
 * 所以边界常量与"块外"定义必须**单源**(AGENTS §0.6/§22c):四条消费方
 * (两个写入器、safe-commit 的活文档对账、auto-commit-quiet 的滞后副本判据)只准从这里取,
 * 任何一处再抄一份字面量 = 判据漂移入口。
 *
 * 判据口径:
 *   · `stripDerivedBlocks` 把两个派生块(含标记)一并挖掉,得到"真正的人工 prose 面";
 *   · 某块**结构不成立**(只有 BEGIN 没有 END / 第二个 BEGIN 落在第一个 END 之前 ⇒ 首对区间会
 *     跨过另一块的头)一律进 `problems`,调用方必须 fail-closed(不暂存/不豁免),绝不猜;
 *   · 只有 END 多出来(首个 BEGIN+首个 END 已构成唯一闭合区间)记为 `notes`:多余的 END 落在
 *     块外,挖掉首对不会吞任何内容。真实现读:README.en.md 的 GENERATED NUMBERS 就有一枚多余
 *     END(1 BEGIN / 2 END),它必须被**点名**而不是被当成"块外正常内容"。
 *
 * 纯函数、零 IO、零顶层副作用 ⇒ 可直接被镜像测试 import(§22d)。
 */

export const NUMBERS_BEGIN = '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->'
export const NUMBERS_END = '<!-- END GENERATED NUMBERS -->'
export const RECENT_BEGIN = '<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->'
export const RECENT_END = '<!-- END RECENT UPDATES -->'

/** 派生块清单:顺序即剥离顺序(id 也是日志里的点名键) */
export const DERIVED_BLOCKS = Object.freeze([
  Object.freeze({ id: 'numbers', begin: NUMBERS_BEGIN, end: NUMBERS_END, owner: 'scripts/sync-readme-numbers.mjs' }),
  Object.freeze({ id: 'recent', begin: RECENT_BEGIN, end: RECENT_END, owner: 'scripts/auto-update-readme-recent.mjs' }),
])

/**
 * 锚点存续判据(严格四态,零 IO ⇒ 可被测试直接构造正反面)。
 *
 * 立它的理由(2026-10-23 实测的失效型):旧实现在 `indexOf(BEGIN)`/`indexOf(END)` 任一发 -1
 * 时 `continue` —— 既不写盘也**不出声**,`touched` 仍为 0,函数末尾于是打印
 * `✅ 最近更新无新增提交,跳过`。于是"本器在这份文档上结构上已经干不了活"这件事,
 * 在钩子日志、post-commit 留痕和退出码三处**全都记成绿**(AGENTS §0.3「没判绝不写成判过」)。
 * 而本仓当下正在发生的形态更糟:活文档归并器(`union-converge` 的行级 union、
 * `merge-live-doc` 的"无锚点⇒追加到文件末尾")把 HEAD 侧内容整段甩到 `END` **之后**,
 * 块内块外同时存在同族条目 ⇒ 锚点一旦成双或错位,`indexOf` 取到的那一对会把中间内容
 * 当成"块内"整段覆盖掉(静默吞别人的行)。
 *
 * 所以判据分四态,且**非 ok 一律不落盘、逐条点名、整体记未判定**:
 *   ok        恰一枚 BEGIN、恰一枚 END、BEGIN 在前
 *   missing   任一标记缺失
 *   ambiguous 任一标记出现 ≥2 枚(`indexOf` 的静默覆盖面)
 *   inverted  END 在 BEGIN 之前(区间不成立)
 * 失效方向恒为「多要一次定向说明」(AGENTS §0.10):宁可这轮不刷新最近更新,
 * 也绝不把"追加到文件尾"当成出路 —— 那正是尾部腐坏的来源。
 *
 * 注意:`stripDerivedBlocks` 对**只多 END** 的形态用更精确的 `notes` 口径(见头注);
 * 本函数保持写入器原有的严格四态,两者不互相松绑。
 *
 * @param {string} text 文档全文
 * @param {string} begin BEGIN 标记
 * @param {string} end   END 标记
 * @returns {{state:'ok'|'missing'|'ambiguous'|'inverted', beginCount:number, endCount:number, reason:string}}
 */
export function assessAnchors(text, begin, end) {
  const body = String(text ?? '')
  const beginCount = body.split(begin).length - 1
  const endCount = body.split(end).length - 1
  const base = { beginCount, endCount }
  if (beginCount === 0 || endCount === 0)
    return { ...base, state: 'missing', reason: `标记缺失(BEGIN ${beginCount} 枚 / END ${endCount} 枚)` }
  if (beginCount > 1 || endCount > 1)
    return {
      ...base,
      state: 'ambiguous',
      reason: `锚点成双(BEGIN ${beginCount} 枚 / END ${endCount} 枚)⇒ indexOf 只会取第一对,` +
        '其余会被当成块内整段覆盖,拒绝落盘',
    }
  if (body.indexOf(end) < body.indexOf(begin))
    return { ...base, state: 'inverted', reason: 'END 在 BEGIN 之前,标记区间不成立' }
  return { ...base, state: 'ok', reason: '' }
}

/**
 * 挖掉派生块,得到「块外」文本。
 *
 * @param {string} text 文档全文
 * @param {{blocks?: ReadonlyArray<{id:string,begin:string,end:string}>}} [opts]
 * @returns {{
 *   ok:boolean,
 *   text:string,
 *   stripped:string[],
 *   problems:Array<{id:string,state:string,reason:string}>,
 *   notes:Array<{id:string,kind:string,endCount:number}>,
 * }}
 */
export function stripDerivedBlocks(text, opts = {}) {
  const blocks = opts.blocks ?? DERIVED_BLOCKS
  let out = String(text ?? '')
  const stripped = []
  const problems = []
  const notes = []
  for (const block of blocks) {
    const beginCount = out.split(block.begin).length - 1
    const endCount = out.split(block.end).length - 1
    if (beginCount === 0 && endCount === 0) continue // 该块不存在(如 ko/ja 未嵌数字块)
    if (beginCount === 0) {
      problems.push({ id: block.id, state: 'end-without-begin', reason: `有 ${endCount} 枚 END 却无 BEGIN` })
      continue
    }
    const bi = out.indexOf(block.begin)
    const ei = out.indexOf(block.end, bi + block.begin.length)
    if (ei === -1) {
      problems.push({ id: block.id, state: 'missing-end', reason: `BEGIN 之后找不到 END` })
      continue
    }
    const nextBegin = out.indexOf(block.begin, bi + block.begin.length)
    if (nextBegin !== -1 && nextBegin < ei) {
      problems.push({
        id: block.id,
        state: 'ambiguous-overlap',
        reason: '第二个 BEGIN 落在首个 END 之前 ⇒ 首对区间会跨过另一块的头',
      })
      continue
    }
    if (endCount > 1) notes.push({ id: block.id, kind: 'duplicate-end', endCount })
    out = out.slice(0, bi) + '\n' + out.slice(ei + block.end.length)
    stripped.push(block.id)
  }
  return { ok: problems.length === 0, text: out, stripped, problems, notes }
}

/**
 * safe-commit 活文档对账的旧契约:一块都没挖到 ⇒ `null`(回落到更严格的 merge-live-doc);
 * 结构不成立 ⇒ 同样 `null`(fail-closed),绝不把拿不准的面当成"逐字一致"。
 *
 * @param {string} text
 * @returns {string|null}
 */
export function outsideDerivedBlocks(text) {
  const r = stripDerivedBlocks(text)
  if (!r.ok || r.stripped.length === 0) return null
  return r.text
}

export const __test__ = {
  NUMBERS_BEGIN,
  NUMBERS_END,
  RECENT_BEGIN,
  RECENT_END,
  DERIVED_BLOCKS,
  assessAnchors,
  stripDerivedBlocks,
  outsideDerivedBlocks,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
