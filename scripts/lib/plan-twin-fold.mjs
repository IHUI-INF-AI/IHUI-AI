// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F10「同题不同编号」折叠档的形态与判据(门 103 C1 收口,2026-11-19 从 plan-tasks-merge.mjs 下沉)。
 *
 * 为什么独立成模块:这族判据与 `--fold-twins` 档的散文一起被镜像测试直接 import,是同一份真相源;
 * 原文件越 6000 行上限,把「注记长什么样 / 折得对不对」整族搬到 lib,生产侧只留调用与转出口,
 * 公开面(`twinFoldNote` / `buildTwinFold` / `stripTwinFold` / `isTwinFolded` / `twinFoldRejectReason` /
 * `pickTwinKeeper` / `foldTwins` / `TWIN_NOTE_RE` / `TWIN_TAIL_RE` / `CHECKBOX_LEAD_RE` / `TWIN_GROUP_MAX`)
 * 逐名等值。
 */

import { DUP_POINTER_RE, keyOfRow, parseTaskRows, titleOf } from './plan-task-index.mjs'
import { stripLastTail } from './plan-merge-annotation.mjs'
import { completeLeaseOf } from './plan-row-conservation.mjs'
import { headIdOf, TASK_ID_PATTERN } from '../check-plan-line-loss.mjs'

/** 组内行数上限:超过它就不猜持有行(噪声或真事故都得人来判),与"机器折半即有损"同一条纪律。 */
export const TWIN_GROUP_MAX = 8
/** 复选框前缀(含其后原有空白)—— 折叠必须把它连同空白一起原样留住,否则"逐字保留"不成立。 */
export const CHECKBOX_LEAD_RE = /^(\s*[-*]\s\[[ xX]\]\s*)/
/** 本档写进去的注记体(行首、全角括号包裹、内部无闭括号)。 */
export const TWIN_NOTE_RE = /^（【归并】重复登记副本·同题不同编号·\d{4}-\d{2}-\d{2}·[^）)]*）/
/** 注记体 + 复选框前缀一起匹配,替换成捕获组即"只剥本档注记"。 */
export const TWIN_FOLDED_RE =
  /^(\s*[-*]\s\[[ xX]\]\s*)（【归并】重复登记副本·同题不同编号·\d{4}-\d{2}-\d{2}·[^）)]*）/
/**
 * 行尾沿革(原编号 + 持有行题面),刻意留在 KEY_MAX_OFFSET 窗口之外。
 * 题面那一段**必须**用贪婪 `.*` 收在行尾的 `」)` 上,不能用 `[^」]*`:台账里的标题本身常带
 * 「…」(HEAD 面实测 19 条里有 4 条如此,例:题面「桌面端「启动后先进托盘」…」),非贪婪会把
 * 剥取停在标题内部那个 `」` 上 ⇒ 剥完不等于底稿 ⇒ 可逆判据把合法折叠误拒、那一族永久留在待办。
 * 而 `;持有行题面「` 这一段就是天然哨兵:旧的一次性折叠形态 ` (原编号 G-316)` 后面没有它,
 * 不会被误当成哨兵起点(真撞上"正文里本来就有这句"的那一行,过剥 ⇒ 判不可逆 ⇒ 拒落,方向是安全的)。
 */
export const TWIN_TAIL_RE = / \(原编号 [^();]+;持有行题面「.*」\)$/
export const TWIN_ID_RE = new RegExp(TASK_ID_PATTERN)

/** 注记正文:固定散文(不含任何编号、行号、闭括号),日期由调用方给。 */
export function twinFoldNote(today) {
  return `（【归并】重复登记副本·同题不同编号·${today}·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）`
}

/**
 * 把一条同题副本折成"摘号 + 指针"形态。给不出编号或给不出持有行题面 ⇒ 返回 null(调用方记未判定)。
 * 幂等由 `DUP_POINTER_RE` 在调用点挡住(本函数不自己判重复)。
 */
export function buildTwinFold(line, keeperLine, today) {
  const m = CHECKBOX_LEAD_RE.exec(line)
  if (!m) return null
  const key = keyOfRow(line)
  const anchor = titleOf(keeperLine)
  if (!key || !anchor) return null
  return `${m[1]}${twinFoldNote(today)}${line.slice(m[1].length)} (原编号 ${key};持有行题面「${anchor}」)`
}

/** 剥掉**本档**写的注记与沿革,还原底稿 —— 折叠必须可逆,不可逆就等于在改别人的登记。
 *  G-952 缺陷 A(2026-10-23 接线):沿革剥离走 stripLastTail 只剥最右一层 —— 旧 `.*` 贪婪会从
 *  正文中间那条沿革起点吃到行尾,把两条之间的正文整段剥掉 ⇒ 可逆性判据被自己的手术制造失败。 */
export function stripTwinFold(line) {
  const noNote = String(line).replace(TWIN_FOLDED_RE, '$1')
  return stripLastTail(noNote, {
    anchors: [' (原编号 '],
    pattern: new RegExp(`^${TWIN_TAIL_RE.source}`),
  })
}

/** 这行是不是本档折出来的形态(注记 + 沿革都在位才算)。 */
export function isTwinFolded(line) {
  return TWIN_FOLDED_RE.test(line) && TWIN_TAIL_RE.test(line)
}

export const STATE_TOKEN_RE = /^\s*[-*]\s\[[ xX]\]/

/**
 * 行首注记区(复选框之后、正文之前的那一段全角括注)里是否混进了任务编号形态。
 * 一条实现,两处调用(`twinFoldRejectReason` 拒折 / `verifyTwinFold` 落地前复核)—— 注记里写持有行
 * 编号这一型当年真犯过:"折掉一条副本反而给账面新增一次撞号"。
 * 判的是**形状卫生**而不是尺子会不会取到它:索引层 2026-09-29 补认装饰档之后,括注里的引用不再顶位,
 * 但指针里的编号会随持有行改名而腐烂成查不到的死指针(§1 规矩 3 同一条理由),所以照旧拒。
 */
export function strayIdInLeadDecoration(line) {
  const m = /^\s*[-*]\s\[[ xX]\]\s*(（[^）]*）)/.exec(String(line ?? ''))
  if (!m) return []
  const re = new RegExp(TWIN_ID_RE.source, 'g')
  return [...m[1].matchAll(re)].map((x) => x[0])
}

/**
 * 一条折叠产物的**准入判据**(全用真尺子,不抄编号正则)。返回拒绝理由或 null。
 * 顺序有意:先查最便宜也最要命的"摘号有没有成",再查可逆性、勾选、行首名额、注记洁净。
 */
export function twinFoldRejectReason(beforeLine, afterLine) {
  if (afterLine === null || afterLine === undefined) return '构造失败(拿不到本行编号或持有行题面)'
  const k = keyOfRow(afterLine)
  const kBefore = keyOfRow(beforeLine)
  /**
   * 旧判据是 `keyOfRow(afterLine) === null` —— 那身"隐形"靠的是索引层把编号推出 48 字窗口的**缺陷**
   * (`lib/plan-task-index.mjs` 于 2026-09-29 修掉:同一机制当天让 39 个已用号看起来空闲,并因此重发过号)。
   * 把机制建在尺子的盲区上,尺子修好那天这一维就静默停摆,而账面只看见"折不动"。
   * 现改为可证的那一条:折叠**不得改变本行身份** —— 折后主键要么取不到,必须仍等于折前那一个。
   * (刻意不拿门 71 的 `headIdOf` 当右半边:它对 `**G-12. 题面**` 这种粗体形态返回 null,
   * 拿它比会把自己的夹具判成"改了身份";`headIdOf` 等值那一判仍在下面,管的是防丢层互咬。)
   * "不再算一条活待办"另由 `DUP_POINTER_RE`(索引层派单口径逐出指针族的同一份判据)在 verifyTwinFold 把关。
   */
  if (k !== null && k !== kBefore)
    return `折叠后主键为 ${k},而本行折前主键是 ${String(kBefore)} ⇒ 这一折给这行改了身份,不折`
  const stray = strayIdInLeadDecoration(afterLine)
  if (stray.length)
    return `注记区在本行主键之前出现了别的任务编号 ${stray.slice(0, 2).join(',')} ⇒ 会被尺子读成本行主键(撞号),不折`
  // 〈原 3 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#plan-merge-l2854(门 103 C1 收口)〉首意: 注记内容的三条判据排在可逆性**之前**:poison 构造(把持有行编号写进注记)必须被点名成
  const note = TWIN_NOTE_RE.exec(afterLine.replace(CHECKBOX_LEAD_RE, ''))?.[0] ?? ''
  if (!note) return '注记形状不合本档构造(内部出现了闭括号?)'
  if (TWIN_ID_RE.test(note)) return `注记里出现了任务编号形态 ⇒ 会被尺子读成本行主键(实得 ${k})`
  if (/\bL\d{1,6}\b/.test(note)) return '注记里出现了行号(§1 规矩 3 禁止证据指针写行号)'
  if (stripTwinFold(afterLine) !== beforeLine) return '剥掉本档注记后不等于底稿(折叠不可逆)'
  const bs = STATE_TOKEN_RE.exec(beforeLine)?.[0]
  const as = STATE_TOKEN_RE.exec(afterLine)?.[0]
  if (bs !== as)
    return `勾选状态被改了(${JSON.stringify(bs)}→${JSON.stringify(as)})—— 翻勾是 --heal 那一维的职责`
  // 门 71 的"行首名额"必须原样保住,否则防丢层会把这行读成消失并回捞未折叠原行(互咬)。
  if (headIdOf(beforeLine) !== headIdOf(afterLine))
    return `行首编号被门 71 读成变了(${String(headIdOf(beforeLine))}→${String(headIdOf(afterLine))})⇒ 会与回捞层互咬`
  return null
}

// 〈原 16 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#plan-merge-l2872(门 103 C1 收口)〉首意: 折叠族的**持有行选择**(2026-10-25 改,承「A4 族级认领守恒把整批折叠按住」票)。
export function pickTwinKeeper(candidates) {
  const list = Array.isArray(candidates) ? candidates : []
  if (!list.length) return { keeper: null, conflict: null, leasedMarks: [] }
  const leased = []
  for (const c of list) {
    const m = completeLeaseOf(c.raw)
    if (m) leased.push({ c, m })
  }
  const marks = [...new Set(leased.map((x) => x.m.mark))]
  if (marks.length > 1) return { keeper: null, conflict: marks, leasedMarks: marks }
  // 同文本多枚 ⇒ 取位置最靠前那枚(确定性;折叠后副本无主键,幂等不受影响)
  return { keeper: leased.length ? leased[0].c : list[0], conflict: null, leasedMarks: marks }
}

// 〈原 17 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#plan-merge-l2902(门 103 C1 收口)〉首意: 纯函数:输入计划文档的行数组,输出"该折哪些行、留哪一行当持有行、哪些判不出"。
export function foldTwins(lines, today = new Date().toISOString().slice(0, 10)) {
  const content = Array.isArray(lines) ? lines.join('\n') : String(lines ?? '')
  const edits = []
  const groups = []
  const undetermined = []
  const refused = []
  const byTitle = new Map()
  for (const r of parseTaskRows(content)) {
    if (!r.key) continue // 已经没有主键的行不参与(无号可摘,也不是"同题不同编号")
    const t = titleOf(r.raw)
    if (!t || t.length < 4) continue // 与 compositeKeyOf 同一条题面闸:给不出实质题面就不配判"同题"
    if (!byTitle.has(t)) byTitle.set(t, [])
    byTitle.get(t).push(r)
  }
  for (const [t, rows] of byTitle) {
    const keys = new Set(rows.map((r) => r.key))
    if (keys.size < 2) continue // 编号互异这一条不成立 ⇒ 不是本档的地盘(F1/F4 各管自己那一型)
    const open = rows.filter((r) => r.state === 'open')
    const doneMembers = rows.length - open.length
    if (rows.length > TWIN_GROUP_MAX) {
      undetermined.push(
        `题面「${t}」组内 ${rows.length} 行 > 上限 ${TWIN_GROUP_MAX} ⇒ 不猜持有行,交人工`,
      )
      continue
    }
    if (!open.length) {
      // 全组都是已完成:那是归档器与 F1 的面,本档一行都不碰(只点名,不判通过也不判红)
      undetermined.push(
        `题面「${t}」的 ${doneMembers} 行全部已完成 ⇒ 本档不动勾选,交归档器/F1 那一维`,
      )
      continue
    }
    const candidates = open.filter((r) => !DUP_POINTER_RE.test(r.raw))
    if (!candidates.length) {
      undetermined.push(
        `题面「${t}」的 ${open.length} 条未勾选行都带归并指针 ⇒ 没有可认定的持有行,交人工`,
      )
      continue
    }
    if (candidates.length < 2) {
      groups.push({
        title: t,
        keeper: { line: candidates[0].line, key: candidates[0].key },
        folded: [],
        openMembers: open.length,
        doneMembers,
      })
      continue
    }
    const pick = pickTwinKeeper(candidates)
    if (pick.conflict) {
      // 多人在飞:整族不折,点名交人工(不代摘任何一张牌,也不猜谁作数)
      const reason = `族内 ${pick.conflict.length} 张互不相同的完整租约 ⇒ 多人在飞,不猜持有行,交人工:${pick.conflict.join(' / ')}`
      undetermined.push(`题面「${t}」${reason}`)
      refused.push({ line: candidates[0].line, title: t, reason })
      continue
    }
    const keeper = pick.keeper
    const folded = []
    for (const r of candidates) {
      if (r === keeper) continue
      const after = buildTwinFold(r.raw, keeper.raw, today)
      const why = twinFoldRejectReason(r.raw, after)
      if (why) {
        undetermined.push(`题面「${t}」的 L${r.line} 不折:${why}`)
        refused.push({ line: r.line, title: t, reason: why })
        continue
      }
      edits.push({ line: r.line, before: r.raw, after, title: t, keeperLine: keeper.line })
      folded.push({ line: r.line, key: r.key })
    }
    groups.push({
      title: t,
      keeper: { line: keeper.line, key: keeper.key },
      folded,
      openMembers: open.length,
      doneMembers,
    })
  }
  edits.sort((a, b) => a.line - b.line)
  groups.sort((a, b) => a.keeper.line - b.keeper.line)
  return { edits, groups, undetermined, refused }
}

/**
 * 把 foldTwins 的产物落到内容上(行内改写,一行不增不删)。
 * 入参不是字符串 ⇒ 抛错而不是 `String(undefined)='undefined'`:后者会"成功地"折出一份
 * 单行假文档,而调用链只看得到"没报错"(本仓最高频失效型:把取不到当成判过)。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
