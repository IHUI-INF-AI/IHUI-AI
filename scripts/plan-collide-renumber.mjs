// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/plan-collide-renumber.mjs —— union-converge F9 撞号的**可执行修复出口**(2026-09-29 立)

/**
 * 为什么要有它(不是"再写一个改号脚本):
 * `scripts/union-converge.mjs` 的落地闸有一条判据 **F9 =「归并新增撞号组」**——同一编号在合并结果里
 * 挂了 ≥2 个不同标题前缀,而两侧各自都不撞。判据本身是对的(§1「一个编号只能有一行当前状态」),
 * 但它**只判不修**:实测 2026-09-29 一整晚 `G-816101 → G-816102 → G-816103` 逐轮换号,每轮都由人肉
 * 重做同一套动作。AGENTS §12e/§12f 写死了后果:一台只会喊红的闸,最终结局是所有人绕过钩子,连带链上
 * 全部对账作废。本器就是那条出路。
 *
 * 三条不可漂的设计前提(每一条都是被实测逼出来的,不是审美):
 *  ① **让号只该由未推的一侧做**(§1「后来者改号」)。调用形态决定了谁是未推侧:ours = 本地 HEAD,
 *     theirs = 显式点名的远端 sha。反过来让已入库的一侧改号,等于替别人重写历史。
 *  ② **有效性判据是一条式子,不是"对侧带没带"的直觉**。活文档 union 的期望重数是
 *     `own + max(0, 对侧 − max(基底, own))`(唯一实现 = `union-converge.liveDocExpectedCounts`);让号后
 *     本侧那份旧行的 `own` 归零,于是旧行被补回 ⟺ 式子给出的份数 > 0。本器**不重抄这条式子**,而是把
 *     "改写后的本侧"喂回那个出口问它旧行还剩几份:还剩 >0 ⇒ 让号会造出第三份副本 ⇒ 拒绝并点名。
 *     我第一版把拒的条件写成"旧号在不在 merge-base",把 `G-816103` 那一格(基底有本侧那行而对侧没有)
 *     误判成不可让 —— 那是把判据写歪成"多拒",代价是每次撞号都要人重新推一遍机理。自检 ①② 成对钉住。
 *  ③ **注记必须落在行尾**。台账的复合主键 = 编号 + 标题前缀逐字等值(`plan-task-index` 的
 *     `keyOfRow`/`titleOf`),而 `titleOf` 从键位之后取题面 —— 把注记插在编号位之后就是给这一行换了个
 *     标题,于是它被 F9 当成"另一次登记",**制造出新的撞号组**。本器一律放行尾,并用 `assertNoteAtTail`
 *     + `titleStable` 当场自证,不成立就拒(自检 ③)。注记以全角方头括号起头:它是 `cleanTitle` 截断集里
 *     的字符,所以短题行(题面不足 4 字时台账刻意退回"编号留在题面"的 lenient 口径)也不会被注记污染。
 *
 * 其余口径:
 *  · 编号族/标题/主键/畸形号**只引台账那一份**(`lib/plan-task-index.mjs`),本器不写第二条编号正则;
 *    整行改写引擎同引 `live-doc-edit.applyReplacements`(它要求 before 恰好命中 1 次,除非显式 all)。
 *  · 取号面必须**含远端且含归档件**:台账 ⊕ `.ihui-agent/archive/PROJECT_PLAN_*.md`,两侧各算一次;
 *    号段 max 只按规整键位求(`usedIdsOfPrefix` 口径)——行文引用与脏号不得顶出假前沿。
 *  · 跳距**不得写成常数**:并发取号器就从 max+1 往上走,实测跳 40 位、跳 300 位都是每轮换一枚,一次挪到
 *    前沿之外才止住。默认跳距经 `IHUI_RENUMBER_JUMP` 覆写(自检 ⑥ 钉它真能被覆写)。
 *  · 被改写的每一行(活行 + 指向旧号的副本指针行)的**改前整行原文**逐字追加进**已入库**的归档件 ——
 *    门 71(`check-plan-line-loss.archivedCopy`)的归档豁免因此永久成立,而不是等 60 枚提交窗口过去;
 *    这一格不由本器自证,由门 71 那一份实现自证(注入 list/read 问它"这行现在算不算已归档")。
 *  · 交付形态 = **blob 产出器,默认零副作用**:缺省档只出报告;`--apply` 才写临时件、过水印、
 *    `hash-object -w` 并**从对象库回读比对**(内存变量不算证据)。本器从不写工作树、从不 commit/push/fetch。
 *  · **"退化面"必须自己喊出来**:theirs 已被本侧包含时(merge-base == theirs),以本侧为脊柱的归并
 *    不引入任何对侧行 ⇒ F9 差集**结构上恒 0**。此时报告印的是"这一档量不到东西",不是"没有撞号"。
 *    纯函数 `degenerateFaceNote` 把这一判断从 I/O 里摘出来,自检成对钉它(退化 ⇒ 点名 / 真分叉 ⇒ 不点名);
 *    写这张脸的理由是实测:同一枚 `--theirs` 在两次运行之间被并发会话合进了 HEAD,第二次那份报告
 *    的"0 组"与第一次的"0 组"字面相同、内容完全不同 —— 不留痕就会把前者读成后者。
 *
 * 退出码:0 = 无需让号,或给出可执行方案(缺省档)/已产出 blob(--apply);
 *        1 = 有撞号组但**构造不出**安全方案(逐条点名原因);
 *        2 = 无法判定(面取不到 / 依赖给不出结论 / 参数不合法)——"没判"绝不写成"判过了"。
 * ⚠️ 本头注刻意不写"已接 pre-commit/CI"字样(守门 89 的 R1/R2 判"声称已接线而零命中")。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DUP_POINTER_RE,
  findIdCollisions,
  findMalformedRows,
  keyOfRow,
  parseTaskRows,
  titleOf,
  usedIdsOfPrefix,
} from './lib/plan-task-index.mjs'
import { archivedCopy } from './check-plan-line-loss.mjs'
import { applyReplacements } from './live-doc-edit.mjs'
import { liveDocExpectedCounts, moveAwareForDoc, unionLines } from './union-converge.mjs'
import { catBatch, gitRaw } from './lib/face-reader.mjs'
import { hashBlob } from './lib/plan-collide-renumber-blob.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
export const PLAN_DOC = 'PROJECT_PLAN.md'
export const ARCHIVE_DIR = '.ihui-agent/archive'
/** 归档件的**选择**启发(不是判据):留痕件优先,其次按名字取最新。
 *  「什么算一条归档凭据」的判据住在 `check-plan-line-loss.archivedCopy` 那一份实现里,本器不抄。 */
const ARCHIVE_PICK_RE = /^PROJECT_PLAN_.*\.md$/
const ARCHIVE_PREFER_RE = /yielded-ids/
const GIT_TIMEOUT = 120000
const DEFAULT_JUMP = 20000
export const JUMP_ENV = 'IHUI_RENUMBER_JUMP'
const BLOB_OUT = '.ihui-agent/tmp/o81-resume/agentB'

const eolOf = (s) => (String(s ?? '').includes('\r\n') ? '\r\n' : '\n')
const today = () => new Date().toISOString().slice(0, 10)
const firstLine = (e) =>
  String(e?.message ?? e ?? '')
    .split(/\r?\n/)[0]
    .slice(0, 180)

/** ── 一、面取材(唯一的 I/O 层;判据一律住在纯函数里)──────────────── */

function lsArchives(rev, root) {
  try {
    const out = gitRaw(['ls-tree', '-r', '--name-only', '-z', rev, '--', ARCHIVE_DIR], root, {
      timeout: GIT_TIMEOUT,
    })
    return String(out || '')
      .split('\0')
      .filter(Boolean)
  } catch (e) {
    return { error: firstLine(e) }
  }
}

/** 一次性把两侧的面读满(三份台账 + 两侧归档件清单与其内容)。
 *  清单与内容**同面同轮**:分两趟取,并发会话推进的那一刻就会产出自洽却错位的尺子(守门 118 那一型)。 */
function readFaces(root, oursRev, theirsRev) {
  const listOurs = lsArchives(oursRev, root)
  if (!Array.isArray(listOurs))
    return { undetermined: `归档清单(${oursRev})取不到:${listOurs.error}` }
  const listTheirs = lsArchives(theirsRev, root)
  if (!Array.isArray(listTheirs))
    return { undetermined: `归档清单(${String(theirsRev).slice(0, 9)})取不到:${listTheirs.error}` }
  let mergeBase = ''
  try {
    mergeBase = String(
      gitRaw(['merge-base', oursRev, theirsRev], root, { timeout: GIT_TIMEOUT }) || '',
    ).trim()
  } catch (e) {
    return { undetermined: `merge-base 问不到:${firstLine(e)}` }
  }
  if (!mergeBase) return { undetermined: 'merge-base 给不出结论(两枚 rev 无共同祖先?)⇒ 无法判定' }
  // 退化面(对侧已被本侧包含)必须被点名:它让"0 组"这个读数**没有内容**,而不点名就等于拿它当合格证。
  let theirsSha = ''
  try {
    theirsSha = String(
      gitRaw(['rev-parse', '--verify', `${theirsRev}^{commit}`], root, { timeout: GIT_TIMEOUT }) ||
        '',
    ).trim()
  } catch (e) {
    return { undetermined: `theirs 解析不成提交 ⇒ 无法判定:${firstLine(e)}` }
  }
  if (!theirsSha)
    return { undetermined: `theirs(${String(theirsRev).slice(0, 11)}) 解析不出 sha ⇒ 无法判定` }
  const degenerateNote = degenerateFaceNote(mergeBase, theirsSha)
  const docs = [`${oursRev}:${PLAN_DOC}`, `${theirsRev}:${PLAN_DOC}`, `${mergeBase}:${PLAN_DOC}`]
  const arch = [
    ...listOurs.map((p) => `${oursRev}:${p}`),
    ...listTheirs.map((p) => `${theirsRev}:${p}`),
  ]
  let got
  try {
    got = catBatch(root, [...docs, ...arch], { timeout: GIT_TIMEOUT })
  } catch (e) {
    return { undetermined: `批量取面失败:${firstLine(e)}` }
  }
  const pick = (spec) => (typeof got?.get === 'function' ? got.get(spec) : undefined)
  const ours = pick(docs[0])
  const theirs = pick(docs[1])
  const base = pick(docs[2])
  const missing = []
  if (typeof ours !== 'string') missing.push(`${oursRev}:${PLAN_DOC}`)
  if (typeof theirs !== 'string') missing.push(`${theirsRev}:${PLAN_DOC}`)
  if (typeof base !== 'string') missing.push(`${mergeBase}:${PLAN_DOC}`)
  if (missing.length)
    return { undetermined: `被审面取不到内容:${missing.join(' / ')}(不回落另一个面,也不记绿)` }
  const archives = []
  for (const p of listOurs) {
    const t = pick(`${oursRev}:${p}`)
    if (typeof t === 'string') archives.push({ face: oursRev, path: p, text: t })
  }
  for (const p of listTheirs) {
    const t = pick(`${theirsRev}:${p}`)
    if (typeof t === 'string') archives.push({ face: theirsRev, path: p, text: t })
  }
  const nO = listOurs.filter((p) => ARCHIVE_PICK_RE.test(p.split('/').pop())).length
  const nT = listTheirs.filter((p) => ARCHIVE_PICK_RE.test(p.split('/').pop())).length
  const notes = [`归档件参与取号口径:本侧 ${nO} 份 / 对侧 ${nT} 份(台账 ⊕ 归档件,两侧各算一次)`]
  if (degenerateNote) notes.unshift(degenerateNote)
  return {
    ours,
    theirs,
    base,
    baseRev: mergeBase,
    theirsSha,
    degenerate: Boolean(degenerateNote),
    archives,
    archivePaths: { [oursRev]: listOurs, [theirsRev]: listTheirs },
    notes,
  }
}

/** ── 二、纯函数判据层 ─────────────────────────────────────────────── */

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

function buildArchiveAppend(oldText, plans, archivePath) {
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

/** ── 三、编排(报告档与 --apply 档共用同一套判据)───────────────────── */

export function buildPlan({
  root,
  oursRev = 'HEAD',
  theirsRev,
  jump = DEFAULT_JUMP,
  archiveOverride = null,
}) {
  const faces = readFaces(root, oursRev, theirsRev)
  if (faces.undetermined) return { rc: 2, undetermined: faces.undetermined }
  const suppress = moveAwareForDoc(PLAN_DOC, faces.ours, faces.theirs, oursRev, root)
  let merged
  try {
    merged = unionLines(faces.ours, faces.theirs, faces.base, suppress.suppress)
  } catch (e) {
    return { rc: 2, undetermined: `归并结果重建不出(不猜、不降级成启发式):${firstLine(e)}` }
  }
  const groups = f9AddedGroups(merged, [faces.ours, faces.theirs])
  const occ = occupancy([faces.ours, faces.theirs, ...faces.archives.map((a) => a.text)])
  const eol = eolOf(faces.ours)
  const archList = (faces.archivePaths[oursRev] || []).filter((p) =>
    ARCHIVE_PICK_RE.test(p.split('/').pop()),
  )
  const chosen =
    archiveOverride ||
    archList.find((p) => ARCHIVE_PREFER_RE.test(p.split('/').pop())) ||
    archList.slice().sort().reverse()[0] ||
    null
  if (!chosen)
    return {
      rc: 2,
      undetermined: '本侧面上没有任何 PROJECT_PLAN_*.md 归档件 ⇒ 留痕无落点,拒绝构造',
    }
  const taken = new Set()
  const plans = []
  const refused = []
  const undetermined = []
  for (const g of groups) {
    const r = planGroup(g, {
      ours: faces.ours,
      theirs: faces.theirs,
      base: faces.base,
      occ,
      archivePath: chosen,
      jump,
      taken,
    })
    if (r.kind === 'plan') {
      taken.add(r.newId)
      plans.push(r)
    } else if (r.kind === 'refuse') refused.push(r)
    else undetermined.push(r)
  }
  const pairs = plans.flatMap((p) =>
    p.rows.map((r) => ({ before: r.before, after: r.after, all: true })),
  )
  let newText = faces.ours
  if (pairs.length) {
    const applied = applyReplacements(String(faces.ours).split(/\r?\n/), pairs)
    if (applied.ok) newText = applied.next.join(eol)
    else {
      refused.push({
        key: '(整批)',
        reason: `整行改写引擎拒了:${applied.reason} ⇒ 不落任何一行,逐组交人工`,
      })
      plans.length = 0
    }
  }
  const verify = plans.length ? verifyProduced(faces.ours, newText, plans) : { problems: [] }
  const oldArch = faces.archives.find((a) => a.path === chosen && a.face === oursRev)?.text ?? ''
  const archiveNewText = buildArchiveAppend(oldArch, plans, chosen)
  const exemption = proveArchiveExemption(plans, {
    archivePath: chosen,
    archiveNewText,
    otherBlobs: new Map(
      faces.archives.filter((a) => a.path !== chosen).map((a) => [a.path, a.text]),
    ),
  })
  return {
    rc: 0,
    theirsRev,
    baseRev: faces.baseRev,
    degenerate: faces.degenerate,
    notes: faces.notes,
    archive: chosen,
    groups,
    plans,
    refused,
    undetermined,
    suppressUndetermined: suppress.undetermined || [],
    mergedGroups: groups.length,
    newText,
    archiveNewText,
    verify,
    exemption,
    landingBlocked:
      refused.length > 0 ||
      undetermined.length > 0 ||
      (plans.length > 0 && (verify.problems.length > 0 || !exemption.ok)),
  }
}

/** ── 四、落地面在 `lib/plan-collide-renumber-blob.mjs`(blob 产出,从不写工作树)──── */

/** ── 五、自检 ─────────────────────────────────────────────────── */

/**
 * 断言体与夹具搬到了 `lib/plan-collide-renumber-selftest.mjs`。
 * 搬的理由是**关注点分离**(判据层 / 落地面 / 取证夹具),不是"守门 11e 的 800 行上限":
 * 11e 的扩展名表只有 `.ts/.tsx/.js/.jsx`(`scripts/check-file-size.mjs:85`,staged 档在 :149 用它筛),
 * `.mjs` 结构上不进它的射程 —— 本器格式化后 800+ 行也不受它约束。把假前提留在注释里,
 * 下一个人就会为了"过门"去拆本来不该拆的东西(AGENTS §12e:为消红改判据同型)。
 * 搬法是**依赖注入**:自检模块不 import 本器,由这里把函数表交给它 —— 否则就是
 * `本器 ⇄ 自检模块` 的循环,而循环只在"两边都只有函数声明"时看起来能跑(§22c 第二真相同族)。
 */
export async function selfTest() {
  const { runSelfTest } = await import('./lib/plan-collide-renumber-selftest.mjs')
  return runSelfTest(__test__)
}

/** ── 六、CLI ───────────────────────────────────────────────────── */

export function parseArgs(argv) {
  const out = {
    theirs: '',
    apply: false,
    json: false,
    selfTest: false,
    root: REPO_ROOT,
    archive: null,
    jump: Number(process.env[JUMP_ENV] || DEFAULT_JUMP),
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') out.apply = true
    else if (a === '--json') out.json = true
    else if (a === '--self-test') out.selfTest = true
    else if (a === '--theirs') out.theirs = String(argv[++i] || '')
    else if (a === '--root') out.root = resolve(String(argv[++i] || ''))
    else if (a === '--archive') out.archive = String(argv[++i] || '')
    else if (a === '--jump') out.jump = Number(argv[++i])
    else if (!String(a).startsWith('-') && !out.theirs) out.theirs = String(a)
  }
  return out
}

function report(r, a) {
  if (a.json) {
    // 只把"体积可控的结论"印成 JSON:两份产出正文(台账 + 归档件)是十几 MB 量级,印进 JSON 会把读数
    // 淹掉。这里**剥字段**而不是另列一份"该印哪些键"的清单 —— 清单与 `buildPlan` 的返回是同一件事的
    // 两处写法,必漂移(本仓记过最多次的失效型)。
    const jsonOut = { ...r }
    delete jsonOut.newText
    delete jsonOut.archiveNewText
    console.log(JSON.stringify({ ...jsonOut, jump: a.jump }, null, 2))
    return
  }
  console.log(
    `[plan-collide-renumber] theirs=${String(r.theirsRev).slice(0, 11)} base=${String(r.baseRev).slice(0, 11)} 跳距=${a.jump}(env ${JUMP_ENV},未写死)`,
  )
  for (const n of r.notes) console.log(`  · ${n}`)
  if (r.suppressUndetermined.length) {
    console.log(
      `  ⚠️ 搬运感知抑制表有 ${r.suppressUndetermined.length} 条未判定 ⇒ "旧行是否被补回"按期望重数式子现读,已含在最保守一侧`,
    )
    for (const u of r.suppressUndetermined.slice(0, 5))
      console.log(`     - ${String(u?.reason ?? u).slice(0, 140)}`)
  }
  console.log(
    `  预测 F9 新增撞号组:${r.mergedGroups} 组 ⇒ 可构造 ${r.plans.length} / 拒 ${r.refused.length} / 判不出 ${r.undetermined.length}`,
  )
  for (const p of r.plans)
    console.log(
      `  ✅ ${p.key} → ${p.newId}(改 ${p.rows.length} 种原文 / ${p.rowOcc} 行,含指针行 ${p.pointerCount};前沿 ${p.frontier} + 跳距 ${p.jump},试 ${p.tried} 枚;让的标题:${p.yieldTitles.join(' / ')})`,
    )
  for (const x of r.refused) console.log(`  ❌ 拒:${x.key} —— ${x.reason}`)
  for (const x of r.undetermined) console.log(`  ❔ 判不出:${x.key} —— ${x.reason}`)
  if (r.plans.length) {
    for (const p of r.verify.problems) console.log(`  ❌ 零损失断言:${p}`)
    if (!r.exemption.ok)
      console.log(`  ❌ 门 71 归档豁免自证不过:${r.exemption.missing.length} 行未逐字进入归档件`)
    console.log(`  留痕落点(已入库归档件):${r.archive}`)
  }
}

async function main(argv) {
  const a = parseArgs(argv)
  if (a.selfTest) process.exit(await selfTest())
  const USAGE =
    '用法:node scripts/plan-collide-renumber.mjs [--theirs] <远端sha> [--apply] [--json] [--root <dir>] [--archive <路径>] [--jump N]'
  const USAGE2 =
    '<远端sha> 就是 union-converge 报 F9 红时点名的那枚 theirs;本器不 fetch、不 commit、不写工作树。'
  if (!a.theirs) {
    if (a.json) console.log(JSON.stringify({ rc: 2, error: USAGE, hint: USAGE2 }, null, 2))
    else {
      console.log(`❌ ${USAGE}`)
      console.log(`   ${USAGE2}`)
    }
    process.exit(2)
  }
  if (!Number.isFinite(a.jump) || a.jump < 1) {
    const m = `跳距必须是正整数(env ${JUMP_ENV} 或 --jump),实得不为:${a.jump}`
    if (a.json) console.log(JSON.stringify({ rc: 2, error: m }, null, 2))
    else console.log(`❌ ${m}`)
    process.exit(2)
  }
  const r = buildPlan({
    root: a.root,
    theirsRev: a.theirs,
    jump: a.jump,
    archiveOverride: a.archive,
  })
  if (r.rc === 2) {
    // `--json` 档的 stdout 只许是**一个 JSON 文档**:人读尾行会把 JSON.parse 打掉
    // (本器第一版就是这么坏的 —— 阳性对照把它喂给 JSON.parse 才现形,见 DELIVERY)。
    if (a.json) console.log(JSON.stringify({ rc: 2, undetermined: r.undetermined }, null, 2))
    else console.log(`UNDETERMINED 未判定:${r.undetermined}`)
    process.exit(2)
  }
  report(r, a)
  if (!r.plans.length) {
    // 三种"没有可落地的让号"必须分档说出:退化面的 0 不是合格证(头注 §退出码与 degenerateFaceNote)。
    if (!a.json)
      console.log(
        r.mergedGroups === 0
          ? r.degenerate
            ? '  ⚠️ 0 组来自**退化面**(theirs 已被本侧包含)⇒ 本档不构成"无撞号"结论;换一枚真分叉的远端 sha 重跑才量得到东西。'
            : '  本次无 F9 新增撞号组(两侧真分叉,归并结果以本侧为脊柱)⇒ 无需让号。'
          : '  无可构造的让号 ⇒ 交人工,不落任何 blob。',
      )
    process.exit(r.mergedGroups === 0 ? 0 : 1)
  }
  if (!a.apply) {
    if (!a.json)
      console.log('  未落地(缺省档零副作用;核对报告后加 --apply 产出 blob,它仍不写工作树)')
    process.exit(r.landingBlocked ? 1 : 0)
  }
  if (r.landingBlocked) {
    if (a.json)
      console.log(
        JSON.stringify(
          { rc: 1, error: '存在被拒/判不出/断言不过的条目 ⇒ 整批不落(不做"能落几行算几行")' },
          null,
          2,
        ),
      )
    else console.log('❌ 存在被拒/判不出/断言不过的条目 ⇒ 整批不落(不做"能落几行算几行")')
    process.exit(1)
  }
  let planBlob
  let archBlob
  try {
    planBlob = hashBlob(r.newText, { root: a.root, rel: PLAN_DOC })
    archBlob = hashBlob(r.archiveNewText, { root: a.root, rel: r.archive, watermark: true })
  } catch (e) {
    console.log(`❌ ${firstLine(e)}`)
    process.exit(2)
  }
  const dir = resolve(a.root, BLOB_OUT)
  mkdirSync(dir, { recursive: true })
  const files = [
    { path: PLAN_DOC, blob: planBlob },
    { path: r.archive, blob: archBlob },
  ]
  writeFileSync(join(dir, 'blobs-renumber.json'), JSON.stringify({ files }, null, 2), 'utf8')
  if (a.json)
    console.log(
      JSON.stringify({ rc: 0, landed: 'blobs-only(未写工作树)', outDir: BLOB_OUT, files }, null, 2),
    )
  else
    console.log(
      `✅ blob:${planBlob.slice(0, 10)}(${PLAN_DOC}) / ${archBlob.slice(0, 10)}(${r.archive})`,
    )
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // main 是 async(自检档要动态 import),所以入口必须走 .catch 而不是 try/catch ——
  // 后者抓不到 rejected promise,异常会变成 unhandled rejection 而以退出码 0 收场。
  main(process.argv.slice(2)).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  rowsByKeyTitle,
  keyedRowCount,
  keyedRowsWith,
  titleStable,
  pointerRowsMentioning,
  f9AddedGroups,
  degenerateFaceNote,
  familiesOfText,
  occupancy,
  templateFor,
  pickId,
  assertNoteAtTail,
  countToken,
  renumberLine,
  planGroup,
  verifyProduced,
  proveArchiveExemption,
  buildArchiveAppend,
  parseArgs,
  selfTest,
  JUMP_ENV,
  DEFAULT_JUMP,
  PLAN_DOC,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
