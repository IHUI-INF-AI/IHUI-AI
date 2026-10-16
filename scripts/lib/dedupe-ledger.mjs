#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账"同题"去重纯函数(2026-10-15 立,根治 union-converge 重复再生那一咬)
 *
 * 根因:并发会话各自给"同一件事"取了不同票号(G-100 / G-999 同标题),而 union-converge 的行级
 * 并集不认任务身份,只认"行文本重数",于是把两侧的旧态副本整批补回账面,台账条目**越合并越多**。
 * 守门 194(check-plan-task-duplicates.mjs)只事后报数/拦新增,治标不治本 —— 下一枚收敛又把副本重放。
 *
 * 本模块是**机制根治**:在 union-converge 的 unionLines 产出后、落地前,对 PROJECT_PLAN.md
 * 按"标题指纹"折叠同题行 —— 同一件事在台账上**物理上只留一行**。
 *
 * 零损失保证(与全仓"信息守恒"纪律同形):被折叠(丢弃)的那一行,其独有信息必须全部并入保留行:
 *   ① 独有 〔…〕 注记段(进度/取证留痕);
 *   ② 与该行不同的票号(〔同题原号 G-999 G-888〕),保证跨引用不断链。
 * 保留行择优选:已翻勾 [x] > 带最新注记日期 > 字节最长。
 *
 * 判据直接复用守门 194 的 extractTaskFingerprint(归一化:去编号引用/日期/注记段/标点,权重<16 不可靠),
 * 故"什么算同一件事"与门 194 同源、不得另写一份 —— 两处各写一遍必漂移。
 *
 * 范围:折叠指纹命中(同题)的任务行(- [ ] / - [x] 皆纳入);指针行(〔【归并】…〕)指纹返回 null,
 * 不进组,原样透传(存量指针行清偿由 plan-tasks-merge --dedupe-open-rows 负责,本模块只堵"再生")。
 */

import { extractTaskFingerprint } from '../check-plan-task-duplicates.mjs'

const NOTE_RE = /〔[^〕]*〕/g
const DATE_RE = /(\d{4}-\d{2}-\d{2})/g
const ID_RE = /\b([A-Z])-(\d{2,})\b/g

/** 取一行里所有 〔…〕 注记段(含指针行形态),原样返回。 */
export function noteSegments(line) {
  return [...String(line).matchAll(NOTE_RE)].map((m) => m[0])
}

/** 取一行的自持票号(首个 G-123 形态),无则 null。 */
export function selfIdOf(line) {
  const m = [...String(line).matchAll(ID_RE)][0]
  return m ? `${m[1]}-${m[2]}` : null
}

/** 一行里最新的 ISO 日期(YYYY-MM-DD),无则 ''。 */
export function latestNoteDate(line) {
  let max = ''
  for (const m of String(line).matchAll(DATE_RE)) {
    if (m[1] > max) max = m[1]
  }
  return max
}

/** 已翻勾([x])判据。 */
export function isChecked(line) {
  return /^-\s*\[x\]/.test(String(line).trim())
}

/** 从被丢弃行提取"保留行没有"的独有注记段(保证进度留痕不丢)。 */
export function uniqueNotes(droppedLine, keptLine) {
  const kept = new Set(noteSegments(keptLine))
  const uniq = []
  for (const seg of noteSegments(droppedLine)) {
    if (!kept.has(seg)) uniq.push(seg)
  }
  return uniq.join('')
}

/**
 * 把一行内**逐字相同**的 〔…〕 注记折到一条(信息零损失:同文重复不承载新事实)。
 * 立因:旧折叠写法按成员各拼一次「同题原号」,HEAD 面实测单行最多 63 条同注(全档 40 行 / 347 条多余副本),
 * 而 AGENTS §1 明令这类注记"今后一条也不许再产生"。本函数既修历史损害,也让重跑幂等。
 */
export function collapseDuplicateNotes(line) {
  const seen = new Set()
  return String(line).replace(/〔[^〕]*〕/g, (seg) => {
    if (seen.has(seg)) return ''
    seen.add(seg)
    return seg
  })
}

/**
 * 组内择优选保留行:① 已翻勾 [x] 优先(完成态盖过待办态);
 * ② 否则取注记里最新日期(进度最新);③ 否则取字节最长(信息最全)。
 * @returns {{line:string, i:number}}
 */
export function pickBest(members) {
  const checked = members.filter((m) => isChecked(m.line))
  const pool = checked.length ? checked : members
  let best = pool[0]
  for (const m of pool) {
    const dM = latestNoteDate(m.line)
    const dB = latestNoteDate(best.line)
    if (dM > dB) best = m
    else if (dM === dB) {
      const lenM = Buffer.byteLength(m.line, 'utf8')
      const lenB = Buffer.byteLength(best.line, 'utf8')
      if (lenM > lenB) best = m
    }
  }
  return best
}

/**
 * 主函数:把同一标题指纹(同题)的多行折叠成一行,被丢弃行的独有信息并入保留行。
 * 非任务行、指纹为 null 的行(过短/指针行)、指纹唯一出现的行一律原样透传。
 * 幂等:无同题组时返回与输入逐字等价的文本(仅 split/join 归一,不含 CRLF 时等价)。
 *
 * @param {string} text 台账全文
 * @returns {string} 折叠后的全文
 */
export function dedupeByFingerprint(text) {
  const lines = String(text ?? '').split('\n')
  const groups = new Map() // fingerprint -> [line indices]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 折叠**同题任务行**(- [ ] 与 - [x] 皆纳入组):同一件事在台账上物理只留一行。
    // 保留行择优选见 pickBest —— 已翻勾 [x] 优先(完成态盖过待办态,避免"已做完的事还挂着一条待办")。
    // 非任务行(段落/指针行/子项)不进组、原样透传。
    if (!/^-\s*\[[ x]\]/.test(line.trim())) continue
    const fp = extractTaskFingerprint(line)
    if (!fp) continue
    if (!groups.has(fp)) groups.set(fp, [])
    groups.get(fp).push(i)
  }
  const remove = new Set()
  const appendTo = new Map() // keptIndex -> 追加文本
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue // 指纹唯一出现 ⇒ 不是重复,跳过(含同一行被摘指针后单存的形态)
    const members = idxs.map((i) => ({ line: lines[i], i }))
    const best = pickBest(members)
    const keptId = selfIdOf(best.line)
    const extraIds = []
    const notes = [] // 本轮已并过的注记段,同段只并一次(旧写法逐成员各拼一次 ⇒ 一组 N 人产 N 条累计注记)
    const keptSegs = noteSegments(best.line)
    for (const m of members) {
      if (m.i === best.i) continue
      remove.add(m.i)
      for (const seg of noteSegments(m.line)) {
        if (keptSegs.includes(seg) || notes.includes(seg)) continue
        notes.push(seg)
      }
      const id = selfIdOf(m.line)
      if (id && id !== keptId && !extraIds.includes(id)) extraIds.push(id)
    }
    // 「同题原号」按**组**出一条,而不是按成员各出一条:旧写法在成员循环里拼,
    // 于是 N 个被折成员会留下 N 条逐字递增的同题原号注记(实测单行最多 63 条同注)。
    let add = notes.join('')
    if (extraIds.length) add += `〔同题原号 ${extraIds.join(' ')}〕`
    if (add) appendTo.set(best.i, (appendTo.get(best.i) || '') + add)
  }
  if (remove.size === 0) return text // 无折叠:原样返回,避免任何不必要的重写
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (remove.has(i)) continue
    const add = appendTo.get(i)
    // 只折"本轮真动过的那一行"里的同注 ⇒ 射程收在折叠集内,不顺手改与本次无关的行
    out.push(add ? collapseDuplicateNotes(lines[i] + add) : lines[i])
  }
  return out.join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
