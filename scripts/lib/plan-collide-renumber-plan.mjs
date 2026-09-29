// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-collide-renumber 的**判据层**(让号方案的计算体;2026-09-29 由 CLI 逐字搬出)。
 *
 * 为什么搬出来:
 *  · 关注点分离 —— 「算出让号方案」是纯函数(吃两份面文本 + 一张占用表,吐 plan / refuse /
 *    undetermined 三态),而「向 git 要面、把结果写成 blob、打印、定退出码」是 I/O。挤在一格里,
 *    给判据加一条断言就得在编排代码里找位置,取证夹具也跟着背上 git。
 *  · 体量:CLI 那份实测 902 行,超了本仓给新增文件自设的 800 行上限(台账里登记的体量债)。
 *    ⚠️ 这条上限**不是**守门 11e 判的:11e 的扩展名表只到 .ts / .tsx / .js / .jsx,扫描面只到
 *    apps 各端的 src,scripts 目录与 .mjs 都不在它的射程(读 scripts/check-file-size.mjs 的
 *    扩展名表与扫描目录清单即可自证)。所以拆分的理由只能是体量与关注点,**不是"为了过门"** ——
 *    假前提会指挥下一个人为了过门去拆本来不该拆的东西(AGENTS §12e 同型)。
 *  · 搬法是**逐字搬迁,不是重写**:函数体一字未改。唯一改动是把 buildArchiveAppend 从私有提成
 *    导出(CLI 的 buildPlan 与自检模块都调它);tokenIndex 与 occurrencesOf 仍是本层私有。
 *
 * 三条不许漂的口径(判据侧,与 CLI 头注同源):
 *  ① 编号族 / 题面 / 复合主键 / 畸形号一律走台账那一份实现(本层引 ./plan-task-index.mjs),
 *    本层不写第二条编号正则;
 *  ② 「让号之后旧行还剩几份」的期望重数式子只在 union-converge 那一处 —— 本层把**改写后的面**
 *    喂回那个出口问它,自己绝不重抄(「两处算同一件事必漂移」是本仓记过最多次的失效型);
 *  ③ 「这一行算不算已归档」由 check-plan-line-loss 的 archivedCopy 判 —— 本层只把 list 与 read
 *    注进去,不自证(那是门 71 的判据,不是我的)。
 *
 * 本层不做 git 读写、不 print、不设退出码;那些都留在 CLI。
 */

import {
  DUP_POINTER_RE,
  findIdCollisions,
  findMalformedRows,
  keyOfRow,
  parseTaskRows,
  titleOf,
  usedIdsOfPrefix,
} from './plan-task-index.mjs'
import { archivedCopy } from '../check-plan-line-loss.mjs'
import { applyReplacements } from '../live-doc-edit.mjs'
import { liveDocExpectedCounts } from '../union-converge.mjs'

// 跳距不是常数(并发取号器就从 max+1 往上走),但缺省值要有出处;CLI 的 parseArgs 也引这一个名。
export const DEFAULT_JUMP = 20000
const today = () => new Date().toISOString().slice(0, 10)

/** 一个面上按编号聚合的「标题 → 该行原文集合」。标题与编号一律走台账那两份出口。 */
export function rowsByKeyTitle(text) {
  const out = new Map()
  for (const r of parseTaskRows(text)) {
    if (!r.key) continue
    const title = titleOf(r.raw)
    if (!title) continue
    if (!out.has(r.key)) out.set(r.key, new Map())
    const byTitle = out.get(r.key)
    if (!byTitle.has(title)) byTitle.set(title, new Set())
    byTitle.get(title).add(r.raw)
  }
  return out
}

/** 某编号在该面上的**键位行数**(按出现次数算,不是去重 —— 逐字孪生副本也要计数)。 */
export function keyedRowCount(text, key) {
  let n = 0
  for (const r of parseTaskRows(text)) if (r.key === key) n += 1
  return n
}

/** 某编号在该面上的**键位行原文**(去重)。含标题为空的那些(副本指针行正是这一族 —— 它们
 *  不进 `rowsByKeyTitle`,却占着键位,漏掉就等于让号没让净,旧号仍留在产出面上)。 */
export function keyedRowsWith(text, key) {
  const out = []
  for (const r of parseTaskRows(text)) if (r.key === key) out.push(r.raw)
  return [...new Set(out)]
}

/** 提到该编号的**副本指针行**(其键位不是这个号,只在正文里指它)。 */
export function pointerRowsMentioning(text, key) {
  const out = []
  for (const r of parseTaskRows(text)) {
    if (!DUP_POINTER_RE.test(r.raw)) continue
    if (r.key === key) continue
    if (countToken(r.raw, key) > 0) out.push(r.raw)
  }
  return [...new Set(out)]
}

/**
 * 标题稳定性判据(硬约束③的可执行形态)。
 * ⚠️ 不能直接要求 `titleOf(前) === titleOf(后)` —— 台账的 `titleOf` 在严格档给不出 ≥4 字题面时
 *    **刻意退回"把编号留在题面里"的 lenient 口径**(见 plan-task-index.titleOf 头注:没收已有的键
 *    比退让更坏)。于是短题行(如 `- [ ] G-2 短题`)的标题天然含编号,换号必然变。
 *    真正要守的是:**标题的差异只许是编号本身,注记一个字都不许进题面**。
 *    所以这里把新号换回旧号再逐字比 —— 注记若漏进题面,替换后仍不等,当场判不过。
 */
export function titleStable(before, after, oldId, newId) {
  const tb = titleOf(before)
  const ta = titleOf(after)
  if (tb === ta) return { ok: true, before: tb, after: ta }
  const normalized = String(ta ?? '')
    .split(newId)
    .join(oldId)
  if (normalized === tb) return { ok: true, before: tb, after: ta, lenientKeyInTitle: true }
  return { ok: false, before: tb, after: ta, normalized }
}

/**
 * F9 的差集规则:两侧都不撞、归并结果才撞的键才算合并造的债。
 * ⚠ 这段差集与 `union-converge` 的 F9 那一支**同形而不同源**(它把差集写在 planStateRegressions 里,
 * 没有可导入的出口),所以镜像测试带一条**形状锁**:那边的表达式一旦被改写,本器必须跟着改。
 * 判"什么算撞号"的尺子始终住在台账 `findIdCollisions`,这里只回答"是不是本次新增"。
 */
export function f9AddedGroups(mergedText, sideTexts) {
  const seen = new Set(sideTexts.flatMap((t) => findIdCollisions(t).map((g) => g.key)))
  return findIdCollisions(mergedText).filter((g) => !seen.has(g.key))
}

/**
 * 「退化面」判据:merge-base == theirs ⇒ 对侧已被本侧包含,以本侧为脊柱的 union 不引入任何对侧新行,
 * 于是 F9 差集**结构上恒 0**。这一句必须自己喊出来 —— 否则报告读起来像"跑过了、没有撞号",
 * 而它其实什么都没问(§"把没判写成判过了"是本仓最高频失效型)。
 * 纯函数:两枚 sha 的等值比较,取证不需要真仓恰好处于哪一种形态。
 */
export function degenerateFaceNote(baseRev, theirsSha) {
  const b = String(baseRev ?? '').trim()
  const t = String(theirsSha ?? '').trim()
  if (!b || !t) return null
  if (b !== t) return null
  return `merge-base == theirs(${t.slice(0, 11)}) ⇒ 对侧已被本侧包含,归并结果就是本侧 ⇒ "0 组"是退化面的必然读数,不是"无撞号"的合格证;要拿这一档下结论,必须换一枚**真分叉**的远端 sha 重跑`
}

/** 族集合由面本身推得,不硬写清单(又一张会腐烂的表就是本仓记过最多次的失效型)。 */
export function familiesOfText(text) {
  const found = []
  for (const r of parseTaskRows(text)) {
    const m = /^([A-Za-z]+)/.exec(String(r.key || ''))
    if (m && !found.includes(m[1].toUpperCase())) found.push(m[1].toUpperCase())
  }
  return found
}

/** 占用面:台账 ⊕ 归档件,两侧各算一次。max 只按规整键位求(见头注口径)。 */
export function occupancy(texts) {
  const maxBy = {}
  const usedBy = {}
  const emptyBy = {}
  for (const t of texts ?? []) {
    for (const fam of familiesOfText(t)) {
      const used = usedIdsOfPrefix(t, fam)
      if (used === null) {
        emptyBy[fam] = (emptyBy[fam] || 0) + 1
        continue
      }
      maxBy[fam] = Math.max(maxBy[fam] ?? -Infinity, used.max)
      usedBy[fam] = usedBy[fam] || new Set()
      for (const id of used.ids) usedBy[fam].add(id)
    }
  }
  return { maxBy, usedBy, emptyBy }
}

/** 该族在面上的书写形状(`G-265` 带连字符、`O4` 不带;印错形状 = 判据认不出来的号)。 */
export function templateFor(texts, family) {
  for (const t of texts ?? []) {
    const u = usedIdsOfPrefix(t, family)
    if (u) return u.template
  }
  return null
}

/**
 * 前沿之外取号:起点 = 前沿 + jump(jump 由 env 覆写,**不是常数**),逐个试到两面零命中。
 * 一条都不静默放过:该族零条登记 ⇒ 无前沿;模板解析不出 ⇒ 拒;候选被判畸形 ⇒ 拒。
 */
export function pickId(
  family,
  occ,
  { texts = [], jump = DEFAULT_JUMP, taken = new Set(), probe = '题面' } = {},
) {
  const frontier = Number.isFinite(occ?.maxBy?.[family]) ? occ.maxBy[family] : null
  if (frontier === null)
    return {
      ok: false,
      reason: `${family} 族在取号面上零条登记行 ⇒ 无前沿可据,不猜号(该档降级不算通过)`,
    }
  const template = templateFor(texts, family)
  if (!template) return { ok: false, reason: `${family} 族的书写形状解析不出 ⇒ 拒绝发号` }
  const step = Math.max(1, Number(jump) || 0)
  const used = occ?.usedBy?.[family] || new Set()
  let n = frontier + step
  let tried = 0
  for (;;) {
    tried += 1
    const id = template.replace('%d', String(n))
    if (!used.has(id) && !taken.has(id) && findMalformedRows(`- [ ] ${id} ${probe}\n`).length === 0)
      return { ok: true, id, start: frontier + step, frontier, tried, jump: step }
    n += 1
    if (tried > 5000) return { ok: false, reason: `连试 ${tried} 枚仍被占 ⇒ 判不准,交人工` }
  }
}

/** 注记一律放行尾 —— 这一条是本器自己的判据,自检 ③ 反向钉它(插在编号位 ⇒ 必须判不过)。 */
export function assertNoteAtTail(before, after, note) {
  if (!note) return { ok: false, reason: '注记为空 ⇒ 无法追溯旧号' }
  if (!after.endsWith(note))
    return { ok: false, reason: '注记不在行尾 ⇒ 会改掉复合主键(§1:编号 + 标题前缀逐字等值)' }
  if (after.length < before.length) return { ok: false, reason: '改写后反而变短 ⇒ 有内容被删,拒绝' }
  if (!after.startsWith(before.slice(0, Math.min(before.length, 6))))
    return { ok: false, reason: '改写行与原型行开头就对不上 ⇒ 不是同一条登记' }
  return { ok: true }
}

/** 词边界计数:`G-9` 不得咬穿 `G-94`(本仓 split/join 踩过的那一型)。 */
export function countToken(s, token) {
  let n = 0
  let i = 0
  for (;;) {
    const at = String(s).indexOf(token, i)
    if (at < 0) return n
    const end = at + token.length
    const before = at === 0 ? '' : s[at - 1]
    const after = end >= s.length ? '' : s[end]
    if (!/[0-9A-Za-z]/.test(before) && !/[0-9]/.test(after)) n += 1
    i = at + 1
  }
}

function tokenIndex(s, token) {
  let i = 0
  for (;;) {
    const at = String(s).indexOf(token, i)
    if (at < 0) return -1
    const end = at + token.length
    const before = at === 0 ? '' : s[at - 1]
    const after = end >= s.length ? '' : s[end]
    if (!/[0-9A-Za-z]/.test(before) && !/[0-9]/.test(after)) return at
    i = at + 1
  }
}

/**
 * 把旧号换成新号并追加行尾注记。
 * `atKey = true`(活行):旧号就在这一行的键位上 ⇒ 改后 `keyOfRow` 必须给出新号。
 * `atKey = false`(指针行):只要求旧号提及被逐字替换掉且新号恰好出现一次。
 * 命中数不为 1 一律拒(不猜改哪一处)。
 */
export function renumberLine(line, oldId, newId, note, atKey = true) {
  const occurrences = countToken(line, oldId)
  if (occurrences === 0) return { ok: false, reason: '这一行没有旧号的词边界命中 ⇒ 不改' }
  if (occurrences > 1)
    return {
      ok: false,
      reason: `旧号在本行出现 ${occurrences} 次 ⇒ 无法确定该改哪一处(副本指针行尤其危险),交人工`,
    }
  const at = tokenIndex(line, oldId)
  const after = line.slice(0, at) + newId + line.slice(at + oldId.length) + note
  const tail = assertNoteAtTail(line, after, note)
  if (!tail.ok) return { ok: false, reason: tail.reason }
  if (atKey) {
    if (keyOfRow(line) !== oldId)
      return {
        ok: false,
        reason: `这一行的键位是「${keyOfRow(line)}」而非「${oldId}」⇒ 不该按活行改`,
      }
    if (keyOfRow(after) !== newId)
      return {
        ok: false,
        reason: `换号后 keyOfRow 给出「${keyOfRow(after)}」而非「${newId}」⇒ 键位没被真替换`,
      }
  } else {
    if (countToken(after, oldId) !== 0) return { ok: false, reason: '指针行里的旧号没被替换干净' }
    if (countToken(after, newId) !== 1) return { ok: false, reason: '指针行里的新号不是恰好一次' }
    if (!DUP_POINTER_RE.test(after))
      return { ok: false, reason: '改写后就不再是副本指针行 ⇒ 语义被改了' }
  }
  const t = titleStable(line, after, oldId, newId)
  if (!t.ok)
    return {
      ok: false,
      reason:
        `换号后题面不止编号在变(「${String(t.before).slice(0, 24)}」→「${String(t.after).slice(0, 24)}」` +
        `⇒ 注记漏进了题面,复合主键会被改掉,拒绝`,
    }
  if (findMalformedRows(after + '\n').length > 0)
    return { ok: false, reason: '改写后被台账判成畸形号' }
  return { ok: true, after }
}

/**
 * 一组撞号的让号计划 ⇒ plan(可构造)/ refuse(点名原因)/ undetermined(看不见那一层,不猜)。
 * 标题比较走 `titleOf` 的逐字等值,不做相似度(§1 明令相似度只能报数,不配判红)。
 */
export function planGroup(
  group,
  { ours, theirs, base, occ, archivePath, jump = DEFAULT_JUMP, taken = new Set() },
) {
  const key = group.key
  const fam = /^([A-Za-z]+)/.exec(String(key))
  if (!fam)
    return {
      kind: 'refuse',
      key,
      reason: `编号「${key}」不落在字母族(行首裸编号属章节内序号,不占全局号段)⇒ 无法让号,交人工`,
    }
  const family = fam[1].toUpperCase()
  const oursMap = rowsByKeyTitle(ours).get(key) || new Map()
  const theirsMap = rowsByKeyTitle(theirs).get(key) || new Map()
  const theirsTitles = new Set(theirsMap.keys())
  const yieldTitles = [...oursMap.keys()].filter((t) => !theirsTitles.has(t))
  if (yieldTitles.length === 0)
    return {
      kind: 'undetermined',
      key,
      reason: '本侧该号下没有任何"对侧没有的标题" ⇒ 让号一侧判不出来,不猜(两侧标题可能逐字同形)',
    }
  const liveRows = [...new Set([...keyedRowsWith(ours, key), ...pointerRowsMentioning(ours, key)])]
  if (liveRows.length === 0)
    return {
      kind: 'undetermined',
      key,
      reason: '本侧面上该号没有键位行(标题集合却非空)⇒ 两侧关系判不出,不猜',
    }
  const picked = pickId(family, occ, { texts: [ours, theirs], jump, taken })
  if (!picked.ok) return { kind: 'refuse', key, reason: `取号失败:${picked.reason}` }
  const note = `【让号@${today()}:原编号 ${key};union-converge F9 归并新增撞号组,未推的本地面让号;改前整行原文逐字见 ${archivePath}】`
  const rows = []
  for (const row of liveRows) {
    // 键位就是这个号的行(活行,以及"键位挂着旧号的副本指针行")按活行口径改;
    // 只在正文里指它的不占键位,按指针口径改 —— 两类都必须改净,否则旧号仍留在产出面上。
    const atKey = keyOfRow(row) === key
    const r = renumberLine(row, key, picked.id, note, atKey)
    if (!r.ok)
      return {
        kind: 'refuse',
        key,
        reason: `${atKey ? '键位行' : '指针行'}改不动:${r.reason} —— 原文:${row.slice(0, 120)}`,
      }
    rows.push({ before: row, after: r.after, oldText: row, atKey, occ: occurrencesOf(ours, row) })
  }
  // 有效性判据(头注②):改写后的本侧喂回 union 那一份期望重数出口,问旧行还剩几份。
  const hypothetical = applyReplacements(
    String(ours).split(/\r?\n/),
    rows.map((r) => ({ before: r.before, after: r.after, all: true })),
  )
  if (!hypothetical.ok)
    return {
      kind: 'refuse',
      key,
      reason: `整行改写引擎拒了:${hypothetical.reason}(旧行在面上不止一份,或与其它改写成链)`,
    }
  const want = liveDocExpectedCounts(hypothetical.next.join('\n'), theirs, base)
  const back = rows.reduce((s, r) => s + (want.get(r.oldText) || 0), 0)
  if (back > 0)
    return {
      kind: 'refuse',
      key,
      reason:
        `让号后旧行仍会被归并补回 ${back} 份(式子 own + max(0, 对侧 − max(基底, own)),由 liveDocExpectedCounts 现读)` +
        ' ⇒ 会造出第三份副本;对侧确实逐字带着本侧那行,这一格**不该让号**,交人工裁决',
    }
  const rowOcc = rows.reduce((s, r) => s + r.occ, 0)
  return {
    kind: 'plan',
    key,
    family,
    newId: picked.id,
    frontier: picked.frontier,
    jump: picked.jump,
    tried: picked.tried,
    yieldTitles,
    pointerCount: rows.filter((r) => !r.atKey).length,
    keyedEmptyTitleCount: rows.filter((r) => r.atKey && !titleOf(r.before)).length,
    rowOcc,
    rows,
    note,
  }
}

function occurrencesOf(text, row) {
  let n = 0
  for (const r of parseTaskRows(text)) if (r.raw === row) n += 1
  return n
}

/** 产出面的零损失断言(位置逐字):除被改写行外每一行同位置逐字相同、行数不变;
 *  旧号在产出面零键位行;每枚新号的键位行数 = 该组让号行数(含逐字孪生副本的份数)。 */
export function verifyProduced(inputText, outputText, plans) {
  const problems = []
  const a = String(inputText).split(/\r?\n/)
  const b = String(outputText).split(/\r?\n/)
  if (a.length !== b.length) problems.push(`行数变了:${a.length} → ${b.length}(本器只改号,不搬行)`)
  const changed = new Set(plans.flatMap((p) => p.rows.map((r) => r.before)))
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue
    if (!changed.has(a[i]))
      problems.push(`第 ${i + 1} 行不在让号清单里却被改了:${a[i].slice(0, 80)}`)
    if (a[i].trim() === '') problems.push(`空行被填上内容@${i + 1}`)
  }
  for (const p of plans) {
    const stillOld = keyedRowCount(outputText, p.key)
    if (stillOld > 0) problems.push(`产出面上旧号 ${p.key} 仍有 ${stillOld} 行键位行(应当为 0)`)
    const nowNew = keyedRowCount(outputText, p.newId)
    if (nowNew !== p.rowOcc)
      problems.push(`新号 ${p.newId} 的键位行数 ${nowNew} ≠ 让号行数 ${p.rowOcc}(不得增删登记)`)
  }
  const before = findMalformedRows(inputText).length
  const after = findMalformedRows(outputText).length
  if (after > before)
    problems.push(`让号引入畸形号:${before} → ${after}(台账 findMalformedRows 那一份判据)`)
  return { problems }
}

/** 留痕档必须真能拿到门 71 的归档豁免 —— 不由本器自证,由那一份实现自证。 */
export function proveArchiveExemption(
  plans,
  { archivePath, archiveNewText, otherBlobs = new Map() },
) {
  const missing = []
  const list = () => [archivePath, ...otherBlobs.keys()]
  const read = (p) => (p === archivePath ? archiveNewText : (otherBlobs.get(p) ?? null))
  for (const p of plans)
    for (const r of p.rows)
      if (!archivedCopy(r.oldText, { list, read }))
        missing.push(`${p.key} :: ${r.oldText.slice(0, 90)}`)
  return { ok: missing.length === 0, missing }
}

// 本层唯一由私有提成导出的函数:CLI 的 buildPlan 与自检模块都要用它(其余仍私有:tokenIndex、
// occurrencesOf、today)。提导出不是放宽判据,是把"谁来写留痕"这一格交给编排层的事实。
export function buildArchiveAppend(oldText, plans, archivePath) {
  const head = String(oldText).replace(/\s+$/, '')
  const block = [
    '',
    '---',
    '',
    `## 让号留痕(补记 @${today()},由 scripts/plan-collide-renumber.mjs 追加)`,
    '',
    '> 下列**改前整行原文**逐字取自被审面的 PROJECT_PLAN.md,不做任何改写。',
    '> 它们的存在就是门 71 的那条放行出口:原文能在 .ihui-agent/archive/PROJECT_PLAN_*.md 里找到 ⇒ 不算丢。',
    `> 落点归档件:${archivePath}`,
    '',
  ]
  for (const p of plans) {
    block.push(
      `- 编号 ${p.key} → ${p.newId}(键位前沿 ${p.frontier} + 跳距 ${p.jump},试 ${p.tried} 枚)`,
    )
    for (const r of p.rows) block.push('  ' + r.oldText)
  }
  return head + '\n' + block.join('\n') + '\n'
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
