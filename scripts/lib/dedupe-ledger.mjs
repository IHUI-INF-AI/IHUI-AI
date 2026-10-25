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
import { stripHeader } from './plan-field-line.mjs'

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
 * @param {string|Set<string>} [baseLines] 共同基底的全文或行集(用于「改写者优先」,见 dedupeGroups)
 * @returns {string} 折叠后的全文
 */
export function dedupeByFingerprint(text, baseLines = null, oursLines = null) {
  return dedupeGroups(text, baseLines, oursLines).text
}

/**
 * 折叠的**唯一判据实现**(`dedupeByFingerprint` 只是取 `.text` 的薄壳,§0.6 不许有第二份)。
 *
 * 2026-10-20 加「改写者优先」这一维(票 G-310 同族,立项凭据全是现读):旧择优选只有
 * ①已翻勾 ②行内注记最新日期 ③字节最长 —— 而"本侧把该行就地改写给短了"是 §1 的正当操作
 * (同一件事只有一个当前状态、验证流水移出活文档、完成即删都不留日期)。落到 ③ 就会把
 * **较新的精简版当副本折掉、把旧长版留下**:实测 G-69(base 1023 / 本侧 830)、
 * G-158(1539 / 1524)、G-222(629 / 613)三条,合并稿里三条本侧版**一条都不在**。
 * 所以判据换成先问"谁是改写者":组里"不等于基底原文"的那一条 = 改写版,由它当选 keeper。
 * 两侧各写了一版时(两条都不等于基底且彼此不同)机器**无从裁定** ⇒ 本组一条不折,
 * 把整组交 `ambiguous` 点名人工 —— 失效方向必须是"多要一次定向说明",绝不能是"多放一次静默"。
 *
 * @param {string} text 台账全文
 * @param {string|Set<string>} [baseLines] 共同基底全文/行集;不给 ⇒ 没有改写信号,逐字走旧判据
 * @param {string|Set<string>} [oursLines] 本侧现行版行集(选择 keeper 时优先)
 * @param {Map<string,string>|null} [picks] 声明式保留行:指纹 → 该组保留行逐字字面(票 G-310 同族)。
 *   只给"机器判不出的那几组"(两侧各改写一版 / 同号两份改写),声明必须由人给原因(CLI 侧校验)。
 *   声明的指纹本轮没有分组、或声明的那一行不在组里 ⇒ 记 `stalePicks`(陈旧声明不记通过)。
 * @returns {{text:string, ambiguous:Array<{fp:string,lines:string[]}>,
 *   keptOf:Map<string,string>, stalePicks:Array<{fp:string,keep:string,reason:string}>}}
 *   `keptOf` 是**折叠自己写的去向账**(被折行 → 产物面里真接住它的那一行,含注记并入后的
 *   最终字面)。旧实现由 `foldLedgerOf` 按指纹事后回查去向,一旦并入注记改变了保留行的指纹,
 *   回查就落空 ⇒ 记「未判定」(实测 `68. 流式中切换模型` 两格);由折叠自己记则不会不同轮。
 */
export function dedupeGroups(text, baseLines = null, oursLines = null, picks = null) {
  const lines = String(text ?? '').split('\n')
  const baseSet =
    baseLines === null || baseLines === undefined
      ? null
      : baseLines instanceof Set
        ? baseLines
        : new Set(String(baseLines).split('\n'))
  // 本侧(ours)现行版行集:选择 keeper 时优先从这里挑 —— 对侧原样带回的 base 旧版不得当选。
  const oursSet =
    oursLines === null || oursLines === undefined
      ? null
      : oursLines instanceof Set
        ? oursLines
        : new Set(String(oursLines).split('\n'))
  const ambiguous = []
  const stalePicks = []
  const keptOf = new Map() // 被折行 -> 产物面里接住它的那一行(折叠自己记的去向账)
  const usedPicks = new Set()
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
  for (const [fp, idxs] of groups.entries()) {
    const declared = picks?.get?.(fp) ?? null
    if (idxs.length < 2) {
      // 声明指向一个"没得折"的组 ⇒ 陈旧声明,不记通过(§0.3:配了清单不等于这一轮真放过东西)
      if (declared !== null)
        stalePicks.push({ fp, keep: String(declared), reason: '该指纹本轮没有成组的同题行(声明无处置)' })
      continue // 指纹唯一出现 ⇒ 不是重复,跳过(含同一行被摘指针后单存的形态)
    }
    const members = idxs.map((i) => ({ line: lines[i], i }))
    // 声明式保留行(人裁定):只接管"机器判不出"的那几组。声明的那一行必须真在本组里,
    // 否则整组不折并记 `stalePicks` —— 陈旧/串档的声明绝不能静默变成"折过了"。
    let picked = null
    if (declared !== null) {
      picked = members.find((m) => m.line === declared) ?? null
      if (!picked) {
        stalePicks.push({ fp, keep: String(declared), reason: '声明保留的那一行不在本组(串档或已漂开)' })
        continue
      }
      usedPicks.add(fp)
    }
    // 仅投影标头不同(正文逐字相同)⇒ 这台机器判得出,不算"两侧各改写一版"。
    // 立因(2026-10-25 实测,主干合并卡死):两侧同期各动同一行 —— 本侧补侧车标头、对侧富化正文;
    // 正文合并成同一份后产物仍留两行(带标头 / 不带标头)。它们指纹相同、都 ≠ 基底、同票号 ⇒ 旧写法
    // 判 `clash` ⇒ 整组 ambiguous ⇒ 折叠层一条不折 ⇒ 落地闸 F4 判"同一件事多条待办"放大(各侧 0 /
    // 归并 2),而 merge-tree 本身没有内容冲突 ⇒ 分叉只能人工删行才收得掉。
    // 标头是侧车的**投影**(可重生成,不承载正文差异),正文逐字相同时不存在"哪一版是当下状态"的
    // 分歧 —— 保留带标头那份即可;恰好一个带标头才自动裁(多个不同标头 ⇒ 仍交人工,见下)。
    if (!picked) {
      // 只在"两版正文是前缀关系"时自动裁:内容差异只在尾部 ⇒ 保留最长那份零信息损失,
      // 不涉及"哪一版是当下状态"。判据要能同时吃掉三型实测形态:
      //   ① marker 与正文间空白差异(`- [ ]**H05` vs `- [ ] 〔标头〕 **H05`);
      //   ② 仅投影标头差异(正文逐字相同);
      //   ③ 尾部注记/补充的差异(实测 G-50:本侧版 = 对侧正文 + 一段畸形嵌套注记,剥注记后
      //      仍是其后缀延伸 —— 括号不配平时 stripNoteGroups 故意不剥,所以"去注记后逐字相等"
      //      这条路对它不成立,只能用前缀关系)。
      // 标头是侧车的投影(可重生成);带标头那一份必须同时是最长那份才裁 —— 标头只在短份说明
      // 两份各有对方没有的东西(交人工),而不是"一版是另一版的旧形态"。
      const norm = (l) =>
        stripHeader(l)
          .replace(/^(\s*-\s*\[[ xX]\])\s*/, '$1 ')
          .trimEnd()
      const rows = members.map((m) => ({ m, s: norm(m.line) }))
      const longest = rows.reduce((a, b) => (b.s.length > a.s.length ? b : a))
      const headed = rows.filter((r) => stripHeader(r.m.line) !== r.m.line)
      if (rows.every((r) => r.m === longest.m || longest.s.startsWith(r.s)) && headed.length === 1 && headed[0].m === longest.m)
        picked = longest.m
    }    // 「改写者优先」:组里"不等于基底原文"的那一条 = 某侧后来就地改写过的那一版,由它当 keeper。
    const rewritten = baseSet ? members.filter((m) => !baseSet.has(m.line)) : []
    // 只在**同一自持票号**下才问"是不是两侧各改写了一遍":同指纹而票号不同的两条是
    // "同一件事登记到了两个号下",那是 F4/F10 既有的折并语义(号由〔同题原号〕接住),不是分叉。
    const bySelfId = new Map()
    for (const m of rewritten) {
      const id = selfIdOf(m.line) ?? '(无号)'
      if (!bySelfId.has(id)) bySelfId.set(id, [])
      bySelfId.get(id).push(m)
    }
    const clash = [...bySelfId.values()].find((v) => v.length >= 2)
    if (clash && !picked) {
      // 同一票号下有两个改写版 ⇒ 机器无从裁定哪一版是当下状态,而折掉任何一版都是有损
      // ⇒ 本组一条不折,整组点名交人工(§0.10:多要一次定向说明,绝不静默放)。
      ambiguous.push({ fp, lines: members.map((m) => m.line) })
      continue
    }
    // 回落 pickBest 时收窄候选池:① 有改写者(≠base)就只在改写者里挑,base 旧版不进池;
    // ② 无改写信号时,优先从本侧(ours)现行版里挑。base 旧版(对侧原样带回)永不当选 keeper。
    let pool = members
    if (rewritten.length) pool = rewritten
    else if (oursSet) {
      const oursMembers = members.filter((m) => oursSet.has(m.line))
      if (oursMembers.length) pool = oursMembers
    }
    const best = picked ?? (rewritten.length === 1 ? rewritten[0] : pickBest(pool))
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
    // 去向账必须在**这一组**里当场记:产物行 = 保留行 + 本轮并入的注记(再折同注)。
    // 事后按指纹回查会落空 —— 并入注记会改变保留行的指纹,于是"合法的折"被读成"去向未判定"。
    const appended = appendTo.get(best.i) || ''
    const keptProduct = appended ? collapseDuplicateNotes(lines[best.i] + appended) : lines[best.i]
    for (const m of members) keptOf.set(m.line, keptProduct)
  }
  // 声明了却连分组都没命中 ⇒ 同样是陈旧声明(§0.3)
  for (const fp of picks?.keys?.() || []) {
    if (usedPicks.has(fp)) continue
    if (stalePicks.some((s) => s.fp === fp)) continue
    stalePicks.push({ fp, keep: String(picks.get(fp)), reason: '本轮产物面没有这一指纹的分组(声明陈旧)' })
  }
  if (remove.size === 0) return { text, ambiguous, keptOf, stalePicks } // 无折叠:原样返回,避免任何不必要的重写
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (remove.has(i)) continue
    const add = appendTo.get(i)
    // 只折"本轮真动过的那一行"里的同注 ⇒ 射程收在折叠集内,不顺手改与本次无关的行
    out.push(add ? collapseDuplicateNotes(lines[i] + add) : lines[i])
  }
  return { text: out.join('\n'), ambiguous, keptOf, stalePicks }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
