// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HEAD 面回捞判据(2026-10-30 立;纯函数、零 IO、零 git 派生)。
 *
 * 要补的机制缺口(不是又造一把尺,是**唯一那把尺够不着的那一格**):
 * `scrub-declared-removals.mjs` 的维一/维三都以「HEAD 面已无此行」为前提 —— 它们服务的是
 * 「收编器把盘上滞后副本带回」那一型。而 2026-10-30 17:12 实测枚 `7864cde002`
 * (父1=本侧 40 枚未勾 / 父2=origin/main 338 枚 / 结果=342 枚)是**普通 `git merge` 把带旧台账的
 * 一侧整份带回 HEAD**:污染本身就落在被审面上 ⇒ 那道前提对每一枚候选恒假 ⇒ 全仓没有任何器物
 * 负责这一型,也没有任何门看得见(`check-live-doc-merge-recall.mjs` 只警告、只扫最近 10 枚 merge)。
 * 于是账面在 40↔342 之间反复跳:每席手动再结清一批,下一枚合并又带回来。
 *
 * 本器把判据换成**当下这一面**:`未勾登记行 ∧ 整行逐字或题面指纹命中「声明为删除」的摘除台账`
 * ⇒ 回捞件。台账维一律 import `scrub-declared-removals` 的 `declaredRows()` 证据面与 `titleFpOf`,
 * 这里一行判据都不重算(§0.6/§22c):逐字维与题面指纹维与 scrub 的维一/维三**同源同形**,
 * 只把「HEAD 面无此行」那半条前提换成「HEAD 面有此行」。
 *
 * 让路纪律(失效方向恒为「多留一份」,绝不「多删一行」):
 *  ① 带活跃认领牌(`claimMarkOf`)的行一律 held —— 席位在飞,摘牌权归它自己;
 *  ② 同复合主键在本面另有**非候选**登记行 ⇒ held —— 别人真在同题上留了活票;
 *  ③ 台账整体取不到(`filesSeen === 0`)⇒ 未判定,一个字节都不动(§0.3)。
 */

import { parseTaskRows, compositeKeyOf, claimMarkOf } from './plan-task-index.mjs'
import { titleFpOf } from '../scrub-declared-removals.mjs'

/**
 * `declaredRows()` 返回值 ⇒ 「声明为删除」那一族的**逐字原文集**。
 * 取的是维三的证据面 `dropTitleRows`(fp → 台账原文)展平,不新读台账、不自建第二份集合。
 */
export function dropVerbatimSet(declared) {
  const out = new Set()
  const map = declared?.dropTitleRows
  if (!(map instanceof Map)) return out
  for (const raws of map.values()) {
    for (const r of Array.isArray(raws) ? raws : []) out.add(r)
  }
  return out
}

/**
 * 纯判定:被审面文本 + `declaredRows()` 返回值 ⇒ 回捞件清单。
 *
 * @param {string} content 被审面(HEAD 或索引)的活文档全文
 * @param {object} declared `declaredRows()` 的返回值
 * @returns {{undetermined:boolean, why?:string, note?:string,
 *            rows:Array<{line:number, raw:string, via:'verbatim'|'title'}>,
 *            held:Array<{line:number, raw:string, why:string}>}}
 */
export function recallRowsOf(content, declared) {
  if (typeof content !== 'string' || content === '')
    return { undetermined: true, why: '被审面文本取不到 ⇒ 不判', rows: [], held: [] }
  if (!declared || declared.filesSeen === 0)
    return {
      undetermined: true,
      why: '摘除台账取不到 ⇒ 结构上认不出「已声明摘除」的行,不判(不记绿也不冒红)',
      rows: [],
      held: [],
    }

  const dropVerbatim = dropVerbatimSet(declared)
  const dropFps = declared.dropTitleFps instanceof Set ? declared.dropTitleFps : new Set()
  if (dropVerbatim.size === 0 && dropFps.size === 0)
    return {
      undetermined: false,
      rows: [],
      held: [],
      note: '台账里没有「声明为删除」条目 ⇒ 零候选',
    }

  const openRows = parseTaskRows(content).filter((r) => r.state === 'open')

  // 先分候选/非候选,才能判「同主键他行」(让路②):非候选行才是"别人留着的活票"。
  const candidateLines = new Set()
  const marked = []
  for (const r of openRows) {
    let via = null
    if (dropVerbatim.has(r.raw)) via = 'verbatim'
    else {
      const f = titleFpOf(r.raw)
      if (f && dropFps.has(f)) via = 'title'
    }
    if (!via) continue
    candidateLines.add(r.line)
    marked.push({ line: r.line, raw: r.raw, via })
  }

  const otherKeys = new Set()
  for (const r of openRows) {
    if (candidateLines.has(r.line)) continue
    const k = compositeKeyOf(r.raw)
    if (k) otherKeys.add(k)
  }

  const rows = []
  const held = []
  for (const r of marked) {
    if (claimMarkOf(r.raw)) {
      held.push({ line: r.line, raw: r.raw, why: '带活跃认领牌 ⇒ 席位在飞,不摘' })
      continue
    }
    const k = compositeKeyOf(r.raw)
    if (k && otherKeys.has(k)) {
      held.push({ line: r.line, raw: r.raw, why: '同复合主键另有非候选登记行在册 ⇒ 不摘' })
      continue
    }
    rows.push(r)
  }
  return { undetermined: false, rows, held }
}

export const __test__ = { recallRowsOf, dropVerbatimSet }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
