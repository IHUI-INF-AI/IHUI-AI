// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `- [ ]` → `- [x] ✅` 结清动作的**留痕自动腿**(2026-10-26 立,主席两次实测的缺口)。
 *
 * 立因是量出来的,不是推断:`.ihui-agent/state/plan-row-drop.jsonl` 是"这行本侧已处置过"的
 * **唯一**凭据,两条回潮防线都读它 —— `scripts/scrub-declared-removals.mjs` 的 `declaredRows`
 * (整行逐字)与 `scripts/union-converge.mjs` 的 `declaredDropCaps`。主席当日实测两格:
 *  ① 兜底清扫器摘两枚已勾行时留痕腿一行没写(台账 `at>=12:30Z` 条数 = 0);
 *  ② **结清入口 14+1 个里有 12 个不写留痕**(一天 `noTrace=182/434` = 42%)。
 * 于是"摘得掉、存量永远归不了零":摘一次、union 回捞一次。唯一合法的活文档写盘入口是
 * `scripts/live-doc-edit.mjs` 的整行改写档(`LIVE_REPLACE_FILE`),它的结清动作天然知道
 * "before 是什么、after 是什么" —— 所以本腿挂在那里,而不是给 15 个入口各装一遍口头纪律。
 *
 * 四条不可漂的硬约束(AGENTS §1 逐字要求,顺序本身是判据):
 *  ① **留痕排在落地成功之后**。本模块不自己判断"落地成没成",它吃调用方给的**凭据**:
 *     `landed`(落地 sha)/`parent`(父提交)/`head`(当下 HEAD)/`ancestor`(landed 是否被 HEAD 包含)。
 *     **凭据是"HEAD 有没有被推进",不是落地器退出码** —— 实测过 CAS 成功推进 HEAD 而落地器因
 *     回读未判定返 exit 2 的形态,按退出码跳过留痕就成了"无凭据摘除"。
 *  ② **取不到输入 ⇒ 显式未判定 + 非零退出**,不得静默跳过:台账读不到/写不进、HEAD 取不到、
 *     祖先关系问不到(三态里的 `null`),一律 `unjudged=true`,由调用方落非 0 退出码并大声点名。
 *  ③ **只在这条形状上写**:`before` 未勾 ∧ `after` 已勾 ∧ 两行都是登记行形。纯注记改写
 *     (未勾→未勾)、翻回未勾(已勾→未勾)、非登记行(散文/表格/注释)一律零入账。
 *     未勾判据取 `lib/plan-row-conservation.mjs` 的 `isOpenRow`、登记行形取
 *     `lib/plan-task-index.mjs` 的 `ENTRY_LINE_RE` —— 本模块不抄第二份正则(§0.6)。
 *  ④ **幂等**:同一形态已在账中(逐字命中 `rowBefore`/`before`)⇒ 不重复追加。台账按集合语义
 *     被下游消费,重复写入只会让"补了多少条"不可读(清扫器的欠账对账按 commit 计数)。
 *
 * 两形态都入账(而不是只入已勾那份):回捞风险来自**对侧滞后工作树里的未勾整行**,已勾形态
 * 与未勾形态是两条不同的整行,任一形态没进账,那一侧就仍然"不认识这行已被处置"。
 * 族名沿用既有 `closed-row-reclose-open-form`(主席当日补记用的就是这一族),本模块不自立新族。
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { ENTRY_LINE_RE } from './plan-task-index.mjs'
import { isOpenRow } from './plan-row-conservation.mjs'

/** 摘除声明台账(与 `scrub-declared-removals` / `union-converge` / 清扫器同一个落点)。 */
export const DROP_LEDGER_REL = '.ihui-agent/state/plan-row-drop.jsonl'

/** 族名:沿用既有的"结清把未勾行改写成已勾行"那一族,不自立新族。 */
export const DROP_KIND = 'closed-row-reclose-open-form'

/** `seat` 缺省值(具名身份,不是正文;下游只认 `rowBefore`)。 */
export const DROP_SEAT_DEFAULT = 'live-doc-edit'

/** 缺省 note(逐条与行一起入账;只在调用方没给时用)。 */
export const DROP_NOTE =
  'live-doc-edit 整行改写档自动留痕:未勾→已勾两形态逐字入账,供 scrub-declared-removals 与 union declaredDropCaps 认账'

const SHA40_RE = /^[0-9a-f]{40}$/

/**
 * 一行属于哪种形态:`open`(未勾登记行)/ `closed`(已勾登记行)/ `other`(非登记行)。
 * 判据全部来自单源:`ENTRY_LINE_RE`(登记行形)+ `isOpenRow`(未勾) ⇒ 已勾 = 登记行 ∧ 非未勾。
 */
export function rowFormOf(line) {
  const s = String(line ?? '')
  if (!ENTRY_LINE_RE.test(s)) return 'other'
  return isOpenRow(s) ? 'open' : 'closed'
}

/**
 * 从改写声明里挑出**结清形态**的项(纯函数,零 IO)。`all:true` 的孪生副本项只是命中面不同,
 * 形态判定与普通项同一把尺子。返回保持声明顺序,并按 `before|after` 去重 —— 同一对出现两次
 * (调用方拼了两条一样的声明)只入账一次,否则账面上会出现两条逐字相同的行。
 *
 * @param {Array<{before?:string, after?:string}>} pairs
 * @returns {{flips:Array<{before:string, after:string}>, other:Array<{before:string, after:string, from:string, to:string}>}}
 */
export function flipPairsOf(pairs) {
  const flips = []
  const drops = []
  const other = []
  const seen = new Set()
  const seenDrop = new Set()
  for (const p of Array.isArray(pairs) ? pairs : []) {
    const before = typeof p?.before === 'string' ? p.before : ''
    const after = typeof p?.after === 'string' ? p.after : ''
    // 删除档(2026-10-28 立,治"滞留反复出现"):显式 `drop: true` ∧ after 为 null ⇒ 该行
    // **结清即删**,面上不会再出现已勾形态,所以只把未勾形态入账。三项缺一(尤其缺 drop 标记)
    // 一律不认 —— 否则"after 字段拼错成 null"就会被读成删行。
    // 门 71 的 declaredExempt 按整行逐字认账 ⇒ 有这条 before 就够它判"不是丢失"。
    if (before !== '' && p?.drop === true && (p?.after === null || p?.after === undefined)) {
      if (rowFormOf(before) !== 'open') {
        other.push({ before, after: '', from: rowFormOf(before), to: 'drop' })
        continue
      }
      if (seenDrop.has(before)) continue
      seenDrop.add(before)
      drops.push({ before })
      continue
    }
    if (before === '' || after === '') continue
    const from = rowFormOf(before)
    const to = rowFormOf(after)
    if (from === 'open' && to === 'closed') {
      const key = `${before}\u0000${after}`
      if (seen.has(key)) continue
      seen.add(key)
      flips.push({ before, after })
    } else other.push({ before, after, from, to })
  }
  return { flips, drops, other }
}

/** 一对结清形态要入账的两条:未勾整行 + 已勾整行(顺序固定,便于逐条对账);删除档只有未勾一条。 */
export function rowsToRecordOf(flips, drops = []) {
  const rows = []
  for (const f of Array.isArray(flips) ? flips : []) {
    rows.push({ rowBefore: f.before, form: 'open' })
    rows.push({ rowBefore: f.after, form: 'closed' })
  }
  for (const d of Array.isArray(drops) ? drops : [])
    // 终态是"整行消失",不是"翻勾前的旧形态"。〔2026-10-29 改判〕过去这里也写 `open`,于是账面上
    // "被删掉的行"与"即将变成已勾的行的前像"同值 —— 而消费方 `scrub-declared-removals.declaredRows`
    // 的题面指纹通道(维三)要按"声明为删除"取条目,拿不到这个区别,只能按生产者名字枚举。
    // 实测代价就是当天 Z-1 那枚票:两轮正当摘除都被守门 71 按"历史登记行丢失"建前向恢复提交补回
    // (`d5be75da91`→`9c1bd9a5df`、`a23a42a3fb`→`0853d13df9`),因为回捞器插回的是它自己从历史面
    // 采集的那份字节形态(实测 600 → 599),与被摘那一刻的整行**不同字** ⇒ 只认逐字的维一结构上
    // 永远命中不了。缺的就是这一格具名终态。
    rows.push({ rowBefore: d.before, form: 'dropped' })
  return rows
}

/**
 * 台账已登记行的逐字集合(消费方只认 `rowBefore`/`before` 两个键,与 scrub 同口径)。
 * 读不到(非 ENOENT)⇒ `ok:false`(未判定);文件不存在 ⇒ 空集(新建仓,不是"读不到")。
 * 单行 JSON 坏 ⇒ 跳过该行并计入 `malformed`(台账存量畸形不得把整本账判成"取不到",
 * 那会让唯一合法写盘入口在一条坏行上永久停摆)。
 */
export function ledgerRowSet(text) {
  if (typeof text !== 'string')
    return { ok: false, set: new Set(), malformed: 0, why: '台账内容不成文本' }
  const set = new Set()
  let malformed = 0
  for (const raw of text.split('\n')) {
    const l = raw.trim()
    if (l === '') continue
    let e
    try {
      e = JSON.parse(l)
    } catch {
      malformed += 1
      continue
    }
    for (const k of ['rowBefore', 'before']) {
      if (typeof e?.[k] === 'string' && e[k] !== '') set.add(e[k])
    }
  }
  return { ok: true, set, malformed, why: '' }
}

/**
 * 计划要追加的条目(纯函数,零 IO):幂等过滤 + 逐条构造 JSON-ready 对象。
 * @returns {{entries:Array<object>, skipped:Array<{rowBefore:string, form:string, why:string}>}}
 */
export function planDropEntries({
  flips,
  drops = [],
  ledgerText = '',
  at,
  seat = DROP_SEAT_DEFAULT,
  file,
  commit = '',
  note = DROP_NOTE,
} = {}) {
  const rows = rowsToRecordOf(flips, drops)
  const have = ledgerRowSet(ledgerText)
  const entries = []
  const skipped = []
  const seen = new Set()
  for (const r of rows) {
    if (!have.ok) {
      skipped.push({ ...r, why: '台账取不到 ⇒ 无从判幂等(整批未判定)' })
      continue
    }
    if (have.set.has(r.rowBefore) || seen.has(r.rowBefore)) {
      skipped.push({ ...r, why: '已在账中(逐字命中)⇒ 不重复追加' })
      continue
    }
    seen.add(r.rowBefore)
    const entry = {
      at,
      seat,
      file,
      kind: DROP_KIND,
      rowBefore: r.rowBefore,
      form: r.form,
    }
    if (commit) entry.commit = commit
    if (note) entry.note = note
    entries.push(entry)
  }
  return { entries, skipped }
}

/**
 * 落地证据三态(纯函数):凭据是"HEAD 有没有被推进",不是落地器退出码。
 *
 * `ancestor` 由调用方用 `lib/bypass-git.mjs` 的 `isAncestor(landed, head)` 量出 —— 那里的三态
 * (true/false/null)刻意不折叠:false = git 明确说"不是祖先"(未推进),null = 问不到(未判定)。
 * @returns {{state:'advanced'|'not-advanced'|'undetermined', why:string}}
 */
export function judgeLandingAdvanced({ landed, parent, head, ancestor } = {}) {
  const l = String(landed ?? '')
  const p = String(parent ?? '')
  const h = String(head ?? '')
  if (!SHA40_RE.test(l))
    return { state: 'undetermined', why: `落地 sha 不成 40 位形态(${l || '(空)'})` }
  if (!SHA40_RE.test(h)) return { state: 'undetermined', why: '当前 HEAD 取不到(不成 40 位形态)' }
  if (l === p) return { state: 'not-advanced', why: '落地 sha 与父提交相同 ⇒ HEAD 未被本器推进' }
  if (ancestor === false)
    return {
      state: 'not-advanced',
      why: `落地 sha ${l.slice(0, 11)} 不在 HEAD(${h.slice(0, 11)}) 的祖先链上`,
    }
  if (ancestor === null || ancestor === undefined)
    return { state: 'undetermined', why: '祖先关系问不到(git 侧未判定)' }
  return { state: 'advanced', why: `HEAD 已推进:${h.slice(0, 11)} 含落地 ${l.slice(0, 11)}` }
}

/**
 * 结清留痕的**唯一落账出口**(薄 IO 包装)。调用方(`live-doc-edit.mjs` 整行改写档)只在
 * 回读已证明"after 在位、before 归零"之后调用它 —— 本模块不重新判断落成没落成,只判**凭据**。
 *
 * @param {object} o
 * @param {string} o.root 仓库根(台账按它解析,测试用 LIVE_ROOT 换仓时天然隔离)
 * @param {string} o.doc 活文档相对路径
 * @param {Array<{before:string, after:string}>} o.pairs 本次实际生效的改写项
 * @param {string} o.landed 落地 sha
 * @param {string} o.parent 落地时的父提交
 * @param {string|null} o.head 当下 HEAD
 * @param {boolean|null} o.ancestor landed 是否被 head 包含
 * @param {string} [o.seat]
 * @param {string} [o.at]
 * @param {string} [o.note]
 * @param {string} [o.ledgerRel]
 * @param {{read?:Function, append?:Function, mkdir?:Function}} [o.io] 测试注入点
 * @returns {{ok:boolean, unjudged:boolean, written:number, skipped:Array, flips:Array, entries:Array, file:string, lines:Array<{level:string, text:string}>}}
 */
export function recordFlipDrops({
  root,
  doc,
  pairs,
  landed,
  parent,
  head,
  ancestor,
  seat = DROP_SEAT_DEFAULT,
  at = new Date().toISOString(),
  note = DROP_NOTE,
  ledgerRel = DROP_LEDGER_REL,
  io = {},
} = {}) {
  const read = io.read ?? ((p) => readFileSync(p, 'utf8'))
  const append = io.append ?? ((p, s) => appendFileSync(p, s, 'utf8'))
  const mkdir = io.mkdir ?? ((p) => mkdirSync(p, { recursive: true }))
  const lines = []
  const { flips, drops, other } = flipPairsOf(pairs)
  const base = {
    ok: true,
    unjudged: false,
    written: 0,
    skipped: [],
    flips,
    entries: [],
    file: ledgerRel,
    lines,
  }

  // ③ 只在这条形状上写:没有结清形态 ⇒ 零入账(不读台账、不看 HEAD,一个字节都不写)。
  if (flips.length === 0 && drops.length === 0) {
    lines.push({
      level: 'info',
      text:
        `ℹ 结清留痕:本次改写 ${other.length} 项无「未勾→已勾」形态(纯注记/翻回未勾/非登记行)` +
        '⇒ 零入账(该形状不在留痕射程)',
    })
    return base
  }

  // ① 凭据:HEAD 有没有被推进(不是落地器退出码)。
  const land = judgeLandingAdvanced({ landed, parent, head, ancestor })
  if (land.state !== 'advanced') {
    lines.push({
      level: 'error',
      text:
        `❌ 结清留痕未判定(${land.state}):${land.why} ⇒ 本次 ${flips.length} 项结清形态**零入账**。` +
        '凭据是"HEAD 有没有被推进",不是落地器退出码 —— 没有推进就不写,否则账面上会出现"面上还在"的行(§1)。',
    })
    return { ...base, ok: false, unjudged: true }
  }

  // ② 台账可取性:读不到 ⇒ 未判定(不猜"它大概是空的")。
  const abs = resolve(root, ledgerRel)
  let text = ''
  try {
    text = read(abs)
  } catch (e) {
    if (String(e?.code ?? '') !== 'ENOENT') {
      lines.push({
        level: 'error',
        text: `❌ 结清留痕未判定:台账读不到(${abs}):${String(e?.message ?? e).slice(0, 160)} ⇒ 零入账,不猜"它大概是空的"`,
      })
      return { ...base, ok: false, unjudged: true }
    }
    text = '' // 新建仓:文件不存在 = 空集,不是"读不到"
  }
  const have = ledgerRowSet(text)
  if (!have.ok) {
    lines.push({ level: 'error', text: `❌ 结清留痕未判定:${have.why} ⇒ 零入账` })
    return { ...base, ok: false, unjudged: true }
  }

  // ④ 幂等:逐字已在账 ⇒ 不重复追加。
  const planned = planDropEntries({
    flips,
    drops,
    ledgerText: text,
    at,
    seat,
    file: doc,
    commit: landed,
    note,
  })
  const out = { ...base, skipped: planned.skipped, entries: planned.entries }
  if (planned.entries.length === 0) {
    lines.push({
      level: 'info',
      text: `ℹ 结清留痕:${planned.skipped.length} 条形态逐字已在账中 ⇒ 不重复追加(幂等),本次零写入`,
    })
    return out
  }

  // ② 写不进 ⇒ 未判定 + 非零退出(由调用方落码),绝不静默跳过。
  try {
    mkdir(dirname(abs))
    append(abs, planned.entries.map((e) => JSON.stringify(e)).join('\n') + '\n')
  } catch (e) {
    lines.push({
      level: 'error',
      text:
        `❌ 结清留痕未判定:台账写不进(${abs}):${String(e?.message ?? e).slice(0, 160)}` +
        ` ⇒ ${planned.entries.length} 条结清形态未入账(内容已落地 ${String(landed).slice(0, 11)},本留痕腿未完成)`,
    })
    return {
      ...base,
      ok: false,
      unjudged: true,
      entries: planned.entries,
      skipped: planned.skipped,
    }
  }

  lines.push({
    level: 'ok',
    text:
      `✅ 结清留痕 ${planned.entries.length} 条已入账 ${ledgerRel}(kind=${DROP_KIND},` +
      `落地 ${String(landed).slice(0, 11)},${flips.length} 项结清形态 × 两形态)` +
      (planned.skipped.length ? ` / 已在册跳过 ${planned.skipped.length} 条` : ''),
  })
  return { ...out, written: planned.entries.length }
}

/**
 * 自检用例(纯函数、零 git、零写盘):`live-doc-edit.mjs --self-test` 收编这一族,
 * 镜像测试也从 `__test__` 复读(§22c:禁止在测试里复制第二份判据)。
 */
export function selfTestCases() {
  const mk = (name, pass) => ({ name, pass: pass === true })
  const openRow = '- [ ] G-1 **标题**:说明。'
  const closedRow = '- [x] ✅(2026-10-26) G-1 **标题**:说明。'
  const noteRow = '- [ ] G-1 **标题**:说明。〔追加注记〕'
  const failIo = {
    append: () => {
      throw new Error('EACCES: 夹具模拟台账不可写')
    },
  }
  const cases = []
  cases.push(
    mk(
      'P1 形态判定:未勾=open/已勾=closed/非登记行=other',
      (() => {
        return (
          rowFormOf(openRow) === 'open' &&
          rowFormOf(closedRow) === 'closed' &&
          rowFormOf('| 表格 | 行 |') === 'other' &&
          rowFormOf('散文 - [ ] 行内') === 'other'
        )
      })(),
    ),
  )
  cases.push(
    mk(
      'P2 结清形态挑取:未勾→已勾命中,纯注记/翻回未勾不入账',
      (() => {
        const r = flipPairsOf([
          { before: openRow, after: closedRow },
          { before: openRow, after: noteRow },
          { before: closedRow, after: openRow },
        ])
        return r.flips.length === 1 && r.other.length === 2
      })(),
    ),
  )
  cases.push(
    mk(
      'P3 两形态各入账一次:未勾整行 + 已勾整行逐字等值',
      (() => {
        const rows = rowsToRecordOf([{ before: openRow, after: closedRow }])
        return (
          rows.length === 2 &&
          rows[0].rowBefore === openRow &&
          rows[0].form === 'open' &&
          rows[1].rowBefore === closedRow &&
          rows[1].form === 'closed'
        )
      })(),
    ),
  )
  cases.push(
    mk(
      'P3b 删除档的终态具名为 dropped,不得与翻勾前像的 open 同值(2026-10-29:同值 ⇒ 维三拿不到"这是删除",回捞器插回的另一份字节形态又对不上逐字维 ⇒ 摘一次回一次)',
      (() => {
        const rows = rowsToRecordOf([], [{ before: openRow }])
        return rows.length === 1 && rows[0].rowBefore === openRow && rows[0].form === 'dropped'
      })(),
    ),
  )
  cases.push(
    mk(
      'P4 幂等:同形态已在账 ⇒ 零新增(逐字命中,不重复追加)',
      (() => {
        const text =
          JSON.stringify({ at: 'x', seat: 's', file: 'f', kind: DROP_KIND, rowBefore: openRow }) +
          '\n' +
          JSON.stringify({ at: 'x', seat: 's', file: 'f', kind: DROP_KIND, rowBefore: closedRow }) +
          '\n'
        const r = planDropEntries({
          flips: [{ before: openRow, after: closedRow }],
          ledgerText: text,
          at: 't',
          file: 'f',
        })
        return r.entries.length === 0 && r.skipped.length === 2
      })(),
    ),
  )
  cases.push(
    mk(
      'P5 凭据三态:HEAD 未推进/取不到 ⇒ not-advanced 与 undetermined',
      (() => {
        const a = judgeLandingAdvanced({
          landed: 'a'.repeat(40),
          parent: 'b'.repeat(40),
          head: 'a'.repeat(40),
          ancestor: true,
        })
        const b = judgeLandingAdvanced({
          landed: 'a'.repeat(40),
          parent: 'b'.repeat(40),
          head: 'b'.repeat(40),
          ancestor: false,
        })
        const c = judgeLandingAdvanced({
          landed: 'a'.repeat(40),
          parent: 'b'.repeat(40),
          head: '',
          ancestor: true,
        })
        const d = judgeLandingAdvanced({
          landed: 'a'.repeat(40),
          parent: 'b'.repeat(40),
          head: 'c'.repeat(40),
          ancestor: null,
        })
        return (
          a.state === 'advanced' &&
          b.state === 'not-advanced' &&
          c.state === 'undetermined' &&
          d.state === 'undetermined'
        )
      })(),
    ),
  )
  cases.push(
    mk(
      'P6 台账写不进 ⇒ 未判定(不静默跳过)',
      (() => {
        const r = recordFlipDrops({
          root: '.',
          doc: 'PROJECT_PLAN.md',
          pairs: [{ before: openRow, after: closedRow }],
          landed: 'a'.repeat(40),
          parent: 'b'.repeat(40),
          head: 'c'.repeat(40),
          ancestor: true,
          io: {
            read: () => {
              const e = new Error('ENOENT')
              e.code = 'ENOENT'
              throw e
            },
            append: failIo.append,
            mkdir: () => {},
          },
        })
        return (
          r.ok === false &&
          r.unjudged === true &&
          r.written === 0 &&
          r.lines.some((l) => l.level === 'error')
        )
      })(),
    ),
  )
  cases.push(
    mk(
      'P7 台账读不到(非 ENOENT)⇒ 未判定,零入账',
      (() => {
        const r = recordFlipDrops({
          root: '.',
          doc: 'PROJECT_PLAN.md',
          pairs: [{ before: openRow, after: closedRow }],
          landed: 'a'.repeat(40),
          parent: 'b'.repeat(40),
          head: 'c'.repeat(40),
          ancestor: true,
          io: {
            read: () => {
              throw new Error('EISDIR')
            },
            append: () => {},
            mkdir: () => {},
          },
        })
        return r.ok === false && r.unjudged === true && r.written === 0
      })(),
    ),
  )
  return cases
}

export const __test__ = {
  rowFormOf,
  flipPairsOf,
  rowsToRecordOf,
  ledgerRowSet,
  planDropEntries,
  judgeLandingAdvanced,
  recordFlipDrops,
  selfTestCases,
  DROP_LEDGER_REL,
  DROP_KIND,
  DROP_SEAT_DEFAULT,
  DROP_NOTE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
