#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-pointer-purge.mjs —— PROJECT_PLAN.md「重复登记副本」指针行存量一次性清偿(2026-10-13 立)。
 *
 * 立因(用户原话):"我不想让它出现重复登记副本 根本不想 不要再看到 给我彻底根治!"
 * 存量实测(HEAD dba9853f1f 现读):带【归并】重复登记副本/不再单独派单 注记的登记行
 * 共 1508 行(未勾 1393 / 已勾 6 …),其中:
 *   - 682 行按复合主键或剥注记后正文,能匹配到**同面存活持有行**(外部持有行)⇒ 直接删除;
 *   - 其余(族内互为副本 / 持有行已完成 / 纯指针行 / 无主键)⇒ 分层处置,见下方四层。
 *
 * 分层处置(保守优先:少删胜过错删,每一条被删行都进归档台账可回溯):
 *   L1 外部持有行(未勾、非指针行,复合主键或剥注记正文等值)⇒ 删副本;副本带认领标记
 *      而持有行没有 ⇒ 认领标记**先转移到持有行**再删(实测 8 条,不许让认领随删除消失)。
 *   L2 族内归并:同主键/同剥注记正文的候选 ≥2 且无外部持有行 ⇒ 保留一条(优先带认领的),
 *      其余删除。
 *   L3 纯指针行:剥掉注记后正文只剩复选框/空白 ⇒ 删除(它本身不承载任务内容)。
 *   L4 剥注记保留:其余候选行只剥掉 〔【归并】…〕 注记,行本身保留 —— 它们的正文是
 *      实质内容(普查样本:TEMP 指向、Esc 层栈协议等),误删 = 丢别人的活账。
 *
 * 落地:直接改写工作树 PROJECT_PLAN.md(紧随其后由本会话提交;并发约束见 AGENTS §12,
 * 本机此刻无其他会话在飞该文件 —— 提交前以 `git diff --name-only PROJECT_PLAN.md` 复核)。
 * 台账:全部被删行原文写入 .ihui-agent/archive/plan-pointer-purge-2026-10-13.md(入库)。
 *
 * 守恒断言(任一不成立 ⇒ 整批不落,exit 1):
 *   A1 已勾选行数不减少(只许剥注记,不许动勾选状态)。
 *   A2 未勾选行的**任务语义不缩水**:每条被删行必须满足「L1 持有行仍在面 ∧ 正文等值(剥注记后)」
 *      或「L2/L3 同族保留行仍在面」—— 由 buildPlan 的分类结果直接给出,删行集必须 ⊆ 分类集。
 *   A3 清偿后全文件 DUP_POINTER_RE 与 SELF_DEDISPATCH_RE 命中归零(用户要的"不要再看到")。
 *   A4 认领标记 `（进行中…）` 总数不减少(8 条存量全部转移,不许静默丢失)。
 *
 * 用法: node scripts/plan-pointer-purge.mjs [--dry-run|--apply]
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const idx = require(path.join(ROOT, 'scripts/lib/plan-task-index.mjs'))
// 判据同源:门 203(台账同题多号差值棘轮)的标题指纹就是它。本脚本分族若另抄一份归一化,
// 剥注记后必然出现"门 203 看见同题、我这边没看见"的撞车 —— 首版正是这么红的。
const { extractTaskFingerprint } = require(path.join(ROOT, 'scripts/check-plan-task-duplicates.mjs'))
const {
  alignSharedIndex,
  attestBypassCommit,
  casUpdateRef,
  commitTreeWithIndex,
  resolveHeadRef,
} = require(path.join(ROOT, 'scripts/lib/bypass-git.mjs'))

const PLAN = 'PROJECT_PLAN.md'
const LEDGER_REL = '.ihui-agent/archive/plan-pointer-purge-2026-10-13.md'
const GIT = process.env.GIT_BIN || 'git'

const DUP_POINTER_RE = idx.DUP_POINTER_RE
const SELF_DEDISPATCH_RE = idx.SELF_DEDISPATCH_RE
const CLAIM_RE = /（进行中[^）]*）/

/** 单轮剥掉注记段(深度匹配括号对,不贪婪截断)。
 *  三种括号对都要认(存量实测形态):〔…〕 标准注记 / 【…】 与 【【…】】 变体 / （…） 圆括变体。
 *  ⚠️ 括号对只有在**内容命中归并标记**(归并|重复登记副本|不再单独派单)时才整段剥除 ——
 *  `（）` 在中文正文里到处都是,不带标记的圆括内容一律原样保留(宁漏不误)。 */
function stripBracketsOnce(text) {
  const MARKER = /归并|重复登记副本|不再单独派单|派单一律走持有行|派单以|勿照本行/
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch !== '〔' && ch !== '【' && ch !== '（') {
      out += ch
      i++
      continue
    }
    const close = ch === '〔' ? '〕' : ch === '【' ? '】' : '）'
    let depth = 0
    let j = i
    for (; j < text.length; j++) {
      if (text[j] === ch) depth++
      else if (text[j] === close) {
        depth--
        if (depth === 0) break
      }
    }
    if (depth === 0 && MARKER.test(text.slice(i, j + 1))) {
      out += ' ' // 整段注记剥掉
      i = j + 1
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** 剥到不动点(嵌套 〔〕 注记实测存在,单轮剥不净)。 */
export function stripMergeNotes(text) {
  let cur = text
  for (let round = 0; round < 6; round++) {
    const next = stripBracketsOnce(cur)
    if (next === cur) break
    cur = next
  }
  // 散文里孤立残留的注记(注记剥净后仍命中判据的行)一并摘除:
  //  ① 无括号散文型:`【归并】重复登记副本:…以…为准。`(存量 184 行里的主力形态,写在行首正文里)
  //  ② `**[归并]**` 强调前缀
  //  ③ 顽固短语"本行不再单独派单"(SELF_DEDISPATCH_RE 语义)
  return cur
    .replace(/(?:【归并】)?重复登记副本[::][^【〔。]*?以[^【〔。]*为准。/g, ' ')
    .replace(/\*\*\[归并\]\*\*\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[,，;；]?\s*本行不再单独派单[。.]?/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd()
}

const isCandidate = (line) => DUP_POINTER_RE.test(line) || SELF_DEDISPATCH_RE.test(line)
// 行形态:标准 `- [ ]`/`- [x]` 为主;另有存量残缺行(行首缺 `- `,如 `[x] ✅(2026-10-09)…`,
// 实测 2+ 处带注记)一并纳入 —— 用户要的是"不要再看到",按行清,不按格式挑。
const ROW_RE = /^\s*(?:[-*]\s*)?\[[ xX]\]/
const isRowLine = (line) => ROW_RE.test(line)
const isCheckedRow = (line) => /^\s*(?:[-*]\s*)?\[[xX]\]/.test(line)
const isOpenRow = (line) => /^\s*(?:[-*]\s*)?\[ \]/.test(line)
// 占位注释/归档引用(`<!-- … -->`)与纯散文里的注记**不碰**:① 渲染不可见;
// ② 占位文本是门 13c A2 锚点匹配的输入,改写会让已归档条目瞬间"点名落空"判红。
const isProse = (line) => /^\s*<!--/.test(line)

/** 分类规划(纯函数,可测):返回 {deleteSet, stripSet, claimTransfers, stats} */
export function buildPlan(lines) {
  const rows = []
  lines.forEach((l, i) => {
    if (isRowLine(l) && !isProse(l)) rows.push({ i, line: l })
  })
  const candidates = rows.filter((r) => isCheckedRow(r.line) === false && isCandidate(r.line))
  const holders = rows.filter((r) => isCheckedRow(r.line) === false && !isCandidate(r.line))
  const bareOf = (l) => stripMergeNotes(stripMergeNotes(l).replace(CLAIM_RE, '')).trim()
  const claimOf = (l) => (CLAIM_RE.exec(stripMergeNotes(l)) || [null])[0]
  const keyOf = (l) => idx.compositeKeyOf(stripMergeNotes(l))
  // 分族键:**指纹优先**(与门 203 的量纲完全对齐),其次复合主键,最后剥注记正文。
  // 首版用复合主键优先是错的 —— 不同票号(G-1105294 / G-1106294)抄的同一段正文,
  // 复合主键把它们分成两族、各自保留一行,剥掉注记后露出同一副指纹 ⇒ 门 203 读成
  // 「同一件事的第二次登记」(实测 139 键判红)。指纹优先 ⇒ 同题族只留一行,正是
  // 门 203 的修法①「同题多号收拢」。
  const famKeyOf = (l) => {
    const bare = stripMergeNotes(l).replace(CLAIM_RE, '')
    const fp = extractTaskFingerprint(bare)
    if (fp) return `F:${fp}`
    const k = keyOf(l)
    if (k) return `K:${k}`
    return `B:${bare}`
  }

  // 持有行索引:统一按 famKey(复合主键 ∪ 指纹 ∪ 剥注记正文)—— 与门 203 的"同题"口径同源
  const holderByFam = new Map()
  for (const h of holders) {
    const fk = famKeyOf(h.line)
    if (!holderByFam.has(fk)) holderByFam.set(fk, [])
    holderByFam.get(fk).push(h)
  }

  const deleteSet = new Set()
  const stripSet = new Set() // 只剥注记保留的行
  const claimTransfers = [] // {from, to, claim}
  const stats = { L1: 0, L2: 0, L3: 0, L4: 0, checkedStripped: 0 }
  const reasons = new Map() // 行号 → 分类原因(给台账)

  const family = new Map() // 归并键 → 候选行集
  for (const c of candidates) {
    const k = famKeyOf(c.line)
    if (!family.has(k)) family.set(k, [])
    family.get(k).push(c)
  }

  for (const c of candidates) {
    const b = bareOf(c.line)
    const ext = holderByFam.get(famKeyOf(c.line)) || null
    const fam = family.get(famKeyOf(c.line)) || []
    const claim = claimOf(c.line)
    if (ext && ext.length > 0) {
      // L1:存在同题外部持有行 ⇒ 删副本
      deleteSet.add(c.i)
      stats.L1++
      const target = ext[0]
      if (claim && !claimOf(target.line)) {
        claimTransfers.push({ from: c.line, to: target.i, claim })
      }
      reasons.set(c.i, `L1 外部持有行 L${target.i + 1}`)
    } else if (fam.length > 1) {
      // L2 族内归并:保留一条,**优先非候选持有行**(带认领的持有行),其次带认领副本,再次首行
      const keep =
        fam.find((f) => !candidates.includes(f)) ||
        fam.find((f) => claimOf(f.line)) ||
        fam[0]
      if (keep.i !== c.i) {
        deleteSet.add(c.i)
        stats.L2++
        const kclaim = claimOf(keep.line)
        if (claim && !kclaim && !candidates.includes(keep))
          claimTransfers.push({ from: c.line, to: keep.i, claim })
        reasons.set(c.i, `L2 族内归并,保留 L${keep.i + 1}`)
      } else {
        stripSet.add(c.i)
        stats.L4++
      }
    } else if (b.length <= 30 && !claim) {
      // L3:剥注记后正文空/极短**且无认领标记** ⇒ 纯指针行。
      // ⚠️ 认领标记必须排除在外:带 `（进行中…）` 的行是有人在飞的活账,哪怕正文短也不许当纯指针删
      // (镜像测试 P2 抓到的第一版缺陷:短正文+认领被 L3 误吞,认领随删除消失)。
      deleteSet.add(c.i)
      stats.L3++
      reasons.set(c.i, 'L3 纯指针行(剥注记后无实质正文)')
    } else {
      // L4:实质内容,剥注记保留
      stripSet.add(c.i)
      stats.L4++
    }
  }

  // 已勾选但带注记的行:只剥注记,不动勾选(用户"不要再看到"包括这些)
  for (const r of rows) {
    if (isCheckedRow(r.line) && isCandidate(r.line)) {
      stripSet.add(r.i)
      stats.checkedStripped++
    }
  }

  return { deleteSet, stripSet, claimTransfers, stats, reasons, holders, candidates, bareOf, keyOf, famKeyOf }
}

/** 构建清偿后的文档(纯函数)。 */
export function renderPurge(lines, plan) {
  const out = lines.slice()
  // 先做认领转移(写进保留的持有行;锚定行首勾选框,不重复缩进)
  for (const t of plan.claimTransfers) {
    const stripped = stripMergeNotes(out[t.to]).replace(/\s{2,}/g, ' ')
    out[t.to] = stripped.replace(/^(\s*(?:[-*]\s*)?\[ \])/, `$1${t.claim}`)
  }
  for (const i of plan.deleteSet) out[i] = null
  const result = []
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) continue
    if (plan.stripSet.has(i) && !plan.deleteSet.has(i)) {
      const line = stripMergeNotes(out[i])
      // 注记可能嵌在句中:剥掉后若形成"孤零零的勾选框"也一并删
      result.push(/^\s*-\s*\[[ xX]\]\s*$/.test(line) ? null : line)
    } else result.push(out[i])
  }
  return result.filter((l) => l !== null)
}

/** 守恒断言(返回 error 列表;空 = 通过)。
 *  A4 认领守恒按**族内不变式**断言:任何复合主键/剥注记正文族,清偿后至少保留一条
 *  带认领标记的行(若清偿前该族有认领)—— 副本上的认领随副本删除而"消失"是必然的
 *  (认领转移到持有行后被删除的副本不再计入),总数断言会误报;族级断言才是真守恒。 */
export function verifyPurge(oldLines, newLines, plan) {
  const errs = []
  const countChecked = (ls) => ls.filter((l) => isCheckedRow(l)).length
  const countOpen = (ls) => ls.filter((l) => isOpenRow(l)).length
  if (countChecked(newLines) !== countChecked(oldLines))
    errs.push(`A1 已勾选行数变化:${countChecked(oldLines)} → ${countChecked(newLines)}`)
  // A4 族内认领守恒:清偿前带认领的族,清偿后必须仍带认领(族键与分族同源:复合主键 ∪ 指纹)
  const famKeyOf = (l) => plan.famKeyOf(l)
  const oldClaims = new Set()
  for (const l of oldLines)
    if (isRowLine(l) && !isProse(l) && CLAIM_RE.test(stripMergeNotes(l))) oldClaims.add(famKeyOf(l))
  const newClaimFams = new Set()
  for (const l of newLines)
    if (isRowLine(l) && !isProse(l) && CLAIM_RE.test(stripMergeNotes(l))) newClaimFams.add(famKeyOf(l))
  const lostClaims = [...oldClaims].filter((k) => !newClaimFams.has(k))
  if (lostClaims.length)
    errs.push(`A4 族级认领守恒破坏:${lostClaims.length} 个族丢失认领标记;样例:${lostClaims.slice(0, 3).join(' | ')}`)
  // A3 注记残留只数**登记行**(散文/占位注释里的引用不动,渲染不可见且受门 13c 保护)
  const residueDup = newLines.filter((l) => isRowLine(l) && !isProse(l) && DUP_POINTER_RE.test(l)).length
  const residueSelf = newLines.filter((l) => isRowLine(l) && !isProse(l) && SELF_DEDISPATCH_RE.test(l)).length
  if (residueDup || residueSelf) errs.push(`A3 登记行注记残留:dup=${residueDup} selfDe=${residueSelf}`)
  const openDelta = countOpen(oldLines) - countOpen(newLines)
  if (openDelta < 0) errs.push(`A2 未勾选行数反增:${countOpen(oldLines)} → ${countOpen(newLines)}`)
  return errs
}

/** 某 ref 下路径的**内容**(不是 oid —— headBlobOf 返回的是 oid,别混用)。 */
function readBlobContent(ref, relPath) {
  return execFileSync(GIT, ['show', `${ref}:${relPath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function main() {
  const apply = process.argv.includes('--apply')
  // ── 门 203 同源差值校验(纯函数):清偿后不得比 HEAD 面多出「同题多号」成员键。
  // 首版缺陷的实测形状:剥注记让 146 个键从"指针行(指纹 null,不进组)"变成"有指纹的行",
  // 门 203 的棘轮把它们读成这次带进来的第二次登记。分族已改为复合主键 ∪ 指纹同源,
  // 这里再放一道**同源**自校验:不许脚本自己造出门会拦的形态。
  const gate203Delta = (oldText, newText) => {
    const A = require(path.join(ROOT, 'scripts/check-plan-task-duplicates.mjs'))
    const anchor = A.findDuplicateGroups(oldText)
    const candidate = A.findDuplicateGroups(newText)
    return A.ratchetAdded(anchor, candidate)
  }

  // 面一律取 HEAD blob(对象空间落地的唯一真相面);工作树副本常年滞后,按它落地就是写回旧态(§12)
  let headText = ''
  try {
    headText = readBlobContent('HEAD', PLAN)
  } catch {
    headText = ''
  }
  if (!headText) {
    console.error('❌ 取不到 HEAD:PROJECT_PLAN.md ⇒ 无法判定,不落')
    process.exit(1)
  }
  const eol = headText.includes('\r\n') ? '\r\n' : '\n'
  const lines = headText.split(/\r?\n/)
  const plan = buildPlan(lines)
  const { stats } = plan
  console.log(
    `分类: L1 外部持有行删除=${stats.L1} L2 族内归并删除=${stats.L2} L3 纯指针删除=${stats.L3} ` +
      `L4 剥注记保留=${stats.L4} 已勾剥注记=${stats.checkedStripped} 认领转移=${plan.claimTransfers.length}`,
  )
  const next = renderPurge(lines, plan)
  const errs = verifyPurge(lines, next, plan)
  if (errs.length) {
    console.error('❌ 守恒断言失败,整批不落:')
    for (const e of errs) console.error(`  - ${e}`)
    process.exit(1)
  }
  // 门 203 同源自校验:清偿不得自己造出「同题多号」
  const dups = gate203Delta(headText, next.join(eol) + eol)
  if (dups.length) {
    console.error(`❌ 门 203 同源自校验失败:清偿后比 HEAD 多出 ${dups.length} 个同题多号成员键,拒绝落地:`)
    for (const d of dups.slice(0, 12))
      console.error(`   - 指纹=${d.fingerprint} 自持号=${d.selfId} 多出=${d.extra} 份`)
    console.error('   ⇒ 分族键仍与门 203 不同源,先修 famKeyOf 的归一化,再重跑(不许为消红放宽判据)')
    process.exit(1)
  }
  const before = lines.filter((l) => l.trim() !== '').length
  const after = next.filter((l) => l.trim() !== '').length
  console.log(`守恒断言 4/4 通过;门 203 同源自校验 0 键;非空行 ${before} → ${after}(-${before - after})`)
  if (!apply) {
    console.log('--dry-run 模式,未落地。加 --apply 走对象空间落地(从不写工作树)。')
    return 0
  }

  const MSG_TAIL =
    '落地前四条守恒断言必须全绿(A1 已勾选不缩水 ∧ A2 未勾选不反增 ∧ A3 登记行注记归零 ∧ A4 族级认领守恒),\n' +
    '并过门 203 同源自校验(清偿不得自己造出「同题多号」)。\n' +
    '落地方式:对象空间 + CAS,从不写工作树(共享工作树的台账副本常年滞后 HEAD,按 pathspec 写等于\n' +
    '把别人已入库的行整批写回旧态,§12 一族);被删行原文进 .ihui-agent/archive/plan-pointer-purge-2026-10-13.md。\n' +
    '动因:用户指令「我不想让它出现重复登记副本 根本不想 不要再看到 给我彻底根治」。'

  // 每一轮都从**当下** HEAD 面重算(不复用首轮结果):别人推进过 HEAD 就必须在新面上重算,
  // 把旧面结果硬贴上去会连带写回别人的行(§12 一族)。
  for (let attempt = 1; attempt <= 10; attempt++) {
    const head = execFileSync(GIT, ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    try {
      let freshText = ''
      try {
        freshText = readBlobContent('HEAD', PLAN)
      } catch {
        freshText = ''
      }
      if (!freshText) {
        console.log(`   第 ${attempt} 次:取不到 HEAD:PROJECT_PLAN.md,重读`)
        continue
      }
      const fEol = freshText.includes('\r\n') ? '\r\n' : '\n'
      const fLines = freshText.split(/\r?\n/)
      const fPlan = buildPlan(fLines)
      const fNext = renderPurge(fLines, fPlan)
      const fErrs = verifyPurge(fLines, fNext, fPlan)
      if (fErrs.length) {
        console.log('❌ 重算后守恒断言未过 ⇒ 拒绝落地:' + fErrs.join(' / '))
        return 1
      }
      const fNextText = fNext.join(fEol) + fEol
      const fDups = gate203Delta(freshText, fNextText)
      if (fDups.length) {
        console.log(`❌ 重算后门 203 同源自校验失败(${fDups.length} 键)⇒ 拒绝落地`)
        return 1
      }
      const fStats = fPlan.stats
      const fMsg =
        `refactor(plan): 一次性清偿 PROJECT_PLAN「重复登记副本」指针注记存量\n\n` +
        `L1 外部持有行删除 ${fStats.L1} 行 / L2 族内归并 ${fStats.L2} 行 / L3 纯指针 ${fStats.L3} 行 / ` +
        `L4 剥注记保留 ${fStats.L4} 行 / 已勾剥注记 ${fStats.checkedStripped} 行 / 认领转移 ${fPlan.claimTransfers.length} 条。\n\n` +
        MSG_TAIL
      const fLedger =
        [
          '# plan-pointer-purge 存量清偿台账(2026-10-13)',
          '',
          '> 一次性清偿 PROJECT_PLAN.md「重复登记副本」指针注记,用户指令「彻底根治」。',
          `> 分类:L1 外部持有行 ${fStats.L1} / L2 族内归并 ${fStats.L2} / L3 纯指针 ${fStats.L3} / L4 剥注记保留 ${fStats.L4} / 认领转移 ${fPlan.claimTransfers.length}。`,
          '> 落地方式:对象空间(HEAD blob → 改写 → commit-tree → CAS),从不写工作树;旁路已 attestBypassCommit 留痕。',
          '> 下列每行为被删行原文(带原行号与分类原因)。',
          '',
          ...fLines.flatMap((l, i) => {
            if (!fPlan.deleteSet.has(i)) return []
            return [`- 原 L${i + 1}(${fPlan.reasons.get(i)}):`, '', '```', l, '```', '']
          }),
        ].join(fEol) + fEol
      const { commit } = commitTreeWithIndex({
        root: ROOT,
        parent: head,
        message: fMsg,
        entries: [
          { path: PLAN, text: fNextText },
          { path: LEDGER_REL, text: fLedger },
        ],
        baseRef: 'HEAD',
      })
      const ref = (resolveHeadRef({ root: ROOT }) || 'HEAD').trim()
      if (!casUpdateRef(commit, head, { root: ROOT, ref })) {
        console.log(`   第 ${attempt} 次 CAS 未中(HEAD 被别人推进)⇒ 在新面上重算`)
        continue
      }
      const al = alignSharedIndex({ root: ROOT, paths: [PLAN, LEDGER_REL], parentRef: head })
      console.log(
        `✅ 落地 ${commit.slice(0, 11)}(父 ${head.slice(0, 11)}) 删 ${fPlan.deleteSet.size} 行;主索引 moved=${(al.moved || []).length} already=${(al.already || []).length} skipped=${(al.skipped || []).length} 未判定=${(al.undetermined || []).length}`,
      )
      if ((al.skipped || []).length || (al.undetermined || []).length) {
        console.log(
          '⚠️ 共享主索引有路径未对齐(归属他人/判不出)⇒ 逐条点名,不静默:' +
            JSON.stringify([...(al.skipped || []), ...(al.undetermined || [])]),
        )
      }
      // 旁路落地不跑钩子 ⇒ 必须留痕,否则总量统计只能把这枚读成 unknown(与"有人跳门"同形)
      const at = attestBypassCommit(commit, {
        root: ROOT,
        headBefore: head,
        source: 'plan-pointer-purge',
      })
      if (!at.ok) console.log(`⚠️ 旁路留痕未写入(${at.why})⇒ 这一枚在跳门总量台账里仍是 unknown`)
      return 0
    } catch (e) {
      console.log(`   第 ${attempt} 次派生失败,重读面再来:${String(e?.message ?? e).split('\n').pop().slice(0, 140)}`)
    }
  }
  console.log('❌ 多次未抢到 CAS ⇒ 不覆盖别人的推进(这不是失败,是并发窗口太密;稍后重跑即可)')
  return 1
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
