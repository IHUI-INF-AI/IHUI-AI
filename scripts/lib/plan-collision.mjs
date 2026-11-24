// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F9「撞号」的**定级层**唯一实现(门 130 / 2026-10-29 b25-gate130)。
 *
 * ## 这一层为什么存在(票面:G-455 / G-45)
 * 撞号这一维在台账层(`plan-task-index.mjs` 的 `f9Faces`)已经分了三档:
 *  - `collisions`:编号落在**声明位**的登记行,按题面分组后 ≥2 组(判据输入);
 *  - `references`:编号只出现在正文里 ⇒ 行文引用,不是第二次登记(只报数);
 *  - `malformed`:畸形号(`G-G-334` 那族)肚子里的子串(只报数)。
 * 三档之外还有一格**这一层**才管得住:`- [x]` 的**已完成历史行**。
 *
 * 病:历史行是**历史快照** —— 当年这件事确实占过这个号。它**改不掉**:
 *  - 改号 = 改历史,与"已完成"这件事本身矛盾(G-312 明令不得批量改号);
 *  - 删行 = 抹掉已经发生的事(§1:把做过的记成没做过,比原病更响)。
 * 于是"同号下挂着一个已完成标题"这一形态一旦进判据,红就**结构上不可清偿** ——
 * 这正是 §12e 点名的"与任何提交无关的恒红门":唯一结局是全队跳钩子、连带全部守门作废。
 *
 * ## 判据(与票面逐字同一句)
 * **真撞号 = 同一编号下 ≥2 个「仍有未勾活行」的不同题面。**
 *  - 题面整组都是 `- [x]` ⇒ 历史行,只报数、永不判红(`all-done`);
 *  - 只剩一个题面还有活行 ⇒ 已完成的那些是历史、活的那一个没有竞争者,只报数(`one-live-title`);
 *  - ≥2 个题面各有活行 ⇒ **真撞号**,照旧判红。
 *
 * ## 这是"定级"不是"放过"—— 两条硬纪律
 *  ① **降档必须报名**:调用方必须把 `history` 逐组印出来(计数 + 名单),否则"从红路挪走"与
 *     "没人看过"同形(本仓"报数不报名"记过多次,守门 70/76/81/128 同族)。
 *  ② **不得少判一格**:扫描面(哪些行进候选)由台账层的 `f9Faces` 决定,这一层**只做去向分类、
 *     不重算分组、不重写"什么算声明行"**。任何"看起来像已完成"的推断都不在这里发生 ——
 *     只认 `parseTaskRows` 递出来的 `state`,与 F1/F4 同一个状态源。
 *
 * ## fail-closed(取不到状态 ⇒ 仍判红)
 * 组明细里的行号在本面取不到(面被换过/裁剪过)时**不得**当成"没有活行":
 * 只有 `lines.length > 0 ∧ 每一行都明确 === 'done'` 才认成历史题面,其余一律算活。
 * 失效方向按票面:宁可多判(与 `splitF9SettledGroups` 2026-10-06 立的那条同形)。
 *
 * ## 为什么不改 `plan-task-index.mjs`
 * 那边的 `f9Faces` 是**取材/分组**的单一实现,被取号工具、收敛落地闸、镜像测试共用;
 * 在它里面加"按状态定级"会把"撞号存在"与"撞号要不要判红"两件事焊死在一个出口上,而
 * 两者消费者不同(取号工具要的是"这个号还被谁占着",含历史行)。所以本层只 import 它的
 * 既有导出(`parseTaskRows` / `f9Faces`),既不新增它的导出、也不抄它任何一条正则。
 */

import { parseTaskRows } from './plan-task-index.mjs'

/** 历史档的两种成因(报名文案与计数都按这两档分开 —— 合成一个数就说不清"为什么这组不判红")。 */
export const HISTORY_REASON = {
  /** 组内每一个题面的每一行都已勾选 ⇒ 纯历史快照。 */
  ALL_DONE: 'all-done',
  /** 只剩一个题面还有未勾行 ⇒ 另一半是历史,活的那一行没有竞争者。 */
  ONE_LIVE_TITLE: 'one-live-title',
}

/**
 * 一个题面是否"仍有未勾活行"。
 * fail-closed:行号取不到 / 题目下没有行号 ⇒ **算活**(宁可多判)。
 * @param title `{title, lines}`
 * @param stateByLine `Map<line, 'open'|'done'>`
 */
function titleHasLiveRow(title, stateByLine) {
  const lines = title?.lines ?? []
  if (!lines.length) return true
  return !lines.every((ln) => stateByLine.get(ln) === 'done')
}

/**
 * 把一把**声明位撞号组**按"还有没有两个活题面"分成 判红档 / 历史档。
 *
 * 输入与 `content` 必须是**同一面同一轮**(两处各取一次面就是自洽却错位的尺子)。
 * @param content 被审面全文
 * @param groups 台账层已分好的声明位撞号组(`f9Faces().collisions` / `auditPlan().f9Declared`)
 * @returns {{live:Array, history:Array<{group:Object, reason:string}>}}
 *   `live` = 真撞号(≥2 个仍有未勾活行的不同题面);`history` = 只报数档(带成因)。
 *   两个数组的元素都是**入参原组对象**(不复制、不改写),调用方可以按对象同一性对账。
 */
export function splitLiveCollisions(content, groups) {
  const list = groups ?? []
  if (!list.length) return { live: [], history: [] }
  const stateByLine = new Map()
  for (const r of parseTaskRows(content)) stateByLine.set(r.line, r.state)
  const live = []
  const history = []
  for (const g of list) {
    const titles = g.titles ?? []
    // fail-closed:组明细里一个题面都没有 = "没量到",不是"量到没有活行" ⇒ 仍进判红路。
    if (!titles.length) {
      live.push(g)
      continue
    }
    const liveTitles = titles.filter((t) => titleHasLiveRow(t, stateByLine))
    if (liveTitles.length >= 2) {
      live.push(g)
      continue
    }
    const allDone = titles.length > 0 && liveTitles.length === 0
    history.push({ group: g, reason: allDone ? HISTORY_REASON.ALL_DONE : HISTORY_REASON.ONE_LIVE_TITLE })
  }
  return { live, history }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
