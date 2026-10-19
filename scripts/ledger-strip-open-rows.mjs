#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账"活账移出已完成块"的常驻出口(2026-09-28 立,由一次真实排空台账的四轮搬运收编而来)。
 *
 * 它解的是这一型死锁:`archive-completed-tasks.mjs` 拒绝搬运"条目标题写着已完成、体内还裹着
 * `- [ ]`"的块 —— 搬走会把没做完的账埋进归档件、派单口径静默少行(那条判据是**对的**)。
 * 于是这些块永久留在台账里,"完成即归档"读起来像没生效。唯一无损出路:把未勾选登记行从
 * 已完成块移到台账末尾的待办区 —— 一行不删、一个勾选不改、其余行相对顺序不动。
 *
 * 为什么不是改判据:块内那些行里大量带着 `【归并】重复登记副本` 指针,而 §1 对这一族的口径是
 * "两条都是没做完的事、绝不动勾选"。把"被逐出派单口径"读成"它做完了"是本票立项前真走过的
 * 错路,已登记在台账对应票里,勿在此重新发明。
 *
 * CLI 契约:
 *   node scripts/ledger-strip-open-rows.mjs              # 只出报告(零副作用,默认档)
 *   node scripts/ledger-strip-open-rows.mjs --apply      # 落地:对象空间 + CAS,**从不写工作树**
 *   node scripts/ledger-strip-open-rows.mjs --json       # 机器读面(纯 JSON,可 JSON.parse)
 *   node scripts/ledger-strip-open-rows.mjs --plan-face worktree       # 人工取证逃生舱(缺省判 HEAD blob)
 *   node scripts/ledger-strip-open-rows.mjs --self-test  # 构造面自检,零副作用
 *
 * 取号/落盘纪律:面一律经 face-reader / resolvePlanBase(不 `readFileSync` 台账当被审内容),
 * 写盘走 lib/bypass-git 的临时索引 + commit-tree + CAS。共享工作树里的台账副本常年滞后 HEAD,
 * 按 pathspec 交工作树等于把别人已入库的行整批写回旧态(§12 那一族),所以本脚本把
 * "不得 writeFileSync(PLAN_REL)" 钉成源码级自检(见 S6)。
 *
 * 头注刻意不写"已接 pre-commit / CI / 第 N 项":它是手动常驻出口,那种话会被守门 89 判
 * "声称已接线而权威点零命中"(本仓记过多次的假出路形态)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings } from './lib/code-mask.mjs'

import { partitionPlanBlocks, resolvePlanBase, resolveRequestedFace } from './archive-completed-tasks.mjs'
import { OPEN_ROW_RE, isCompletedTaskHeading, headingLevel } from './lib/plan-task-headings.mjs'
import { parseTaskRows } from './lib/plan-task-index.mjs'
import { alignSharedIndex, attestBypassCommit, casUpdateRef, commitTreeWithIndex, resolveHeadRef } from './lib/bypass-git.mjs'

const ROOT = process.cwd()
const PLAN_REL = 'PROJECT_PLAN.md'
const GIT = process.env.GIT_BIN || 'git'
const MAX_ROUNDS = 12

const ZONE_TITLE = '## 待办剥离区（从带完成标记的条目体内移出）'
const ZONE_NOTES = [
  '>',
  '> 这些 `- [ ]` 登记原本坐在**带完成标记的条目块体内**,使整块无法归档(搬走会把没做完的账埋进归档件)。',
  '> 移出只换位置:一行都没删、一个勾选状态都没改、其余行的相对顺序不动。',
  '> 出口与守恒断言:`scripts/ledger-strip-open-rows.mjs`;为什么搬不走:`node scripts/archive-completed-tasks.mjs --list-blocked`。',
]

const gitArgs = (a) => ['-c', 'safe.directory=*', ...a]

/** 未勾选登记行数(与派单口径同样只看行首形态,不在此重造"什么算一行登记")。 */
const openCount = (text) => parseTaskRows(text).filter((r) => r.state === 'open').length
const doneCount = (text) => parseTaskRows(text).filter((r) => r.state === 'done').length
const multiset = (arr) => {
  const m = new Map()
  for (const s of arr) m.set(s, (m.get(s) || 0) + 1)
  return m
}

/** 把 moved 落到剥离区末尾;区不存在则连标题带说明一起建在文档末尾。 */
function placeZone(lines, moved) {
  if (!moved.length) return lines
  const hi = lines.indexOf(ZONE_TITLE)
  if (hi === -1) return [...lines, '', ZONE_TITLE, ...ZONE_NOTES, '', ...moved]
  const zoneLevel = headingLevel(ZONE_TITLE)
  let end = lines.length
  for (let i = hi + 1; i < lines.length; i++) {
    const lv = headingLevel(lines[i])
    if (lv > 0 && lv <= zoneLevel) {
      end = i
      break
    }
  }
  let insert = end
  while (insert > hi + 1 && lines[insert - 1].trim() === '') insert--
  return [...lines.slice(0, insert), ...moved, ...lines.slice(insert)]
}

/** 一轮:摘掉被拒块内的未勾选行并落进剥离区。返回 {text, moved, blockedBefore}。 */
function stripOnce(text) {
  const lines = String(text).split('\n')
  const { blocked } = partitionPlanBlocks(text)
  if (!blocked.length) return { text, moved: [], blockedBefore: 0 }
  const cut = new Set()
  for (const t of blocked) {
    for (let i = t.startLine; i <= t.endLine && i < lines.length; i++) if (OPEN_ROW_RE.test(lines[i])) cut.add(i)
  }
  const moved = [...cut].sort((a, b) => a - b).map((i) => lines[i])
  return { text: placeZone(lines.filter((_, i) => !cut.has(i)), moved).join('\n'), moved, blockedBefore: blocked.length }
}

/** 迭代到不动点(摘行会改块边界,可能暴露新块;一次过会把"还剩几个"报成假 0)。 */
export function stripToFixpoint(text) {
  let cur = text
  const moved = []
  let rounds = 0
  for (;;) {
    const r = stripOnce(cur)
    rounds++
    moved.push(...r.moved)
    cur = r.text
    if (!r.moved.length) return { text: cur, moved, rounds, converged: true }
    if (rounds >= MAX_ROUNDS) return { text: cur, moved, rounds, converged: false }
  }
}

/**
 * 落地前的守恒断言。**任一条不成立即拒绝写盘** —— 本工具动的是多人共写的活文档,
 * "看起来搬干净了"而实际吞了行,比不搬严重得多。
 * @returns {{ok:boolean, fails:string[], readout:object}}
 */
export function verifyStrip({ parentText, newText, moved }) {
  const fails = []
  const pl = String(parentText).split('\n')
  const nl = String(newText).split('\n')
  if (isCompletedTaskHeading(ZONE_TITLE) || headingLevel(ZONE_TITLE) !== 2) {
    fails.push('区标题被判成"已完成条目"或不是 ## 级 ⇒ 剥离区自己会变成一条已完成登记')
  }
  const nz = (a) => a.filter((l) => l.trim() !== '')
  const mo = multiset(nz(pl))
  const mn = multiset(nz(nl))
  let lost = 0
  for (const [k, v] of mo) lost += Math.max(0, v - (mn.get(k) || 0))
  let gain = 0
  for (const [k, v] of mn) gain += Math.max(0, v - (mo.get(k) || 0))
  // **移动不改多重集**:被摘走的那 N 行原本就在文档里,只是换了位置 ⇒ 区已在位时净新增必须是 0,
  // 区不在位时只应多出"区头"那几行。收编自一次性脚本时这里被我写成"新增应等于移出行数",
  // 于是工具在真仓上把自己每一次正常动作都判成违规 —— 失效方向是安全的(它拒落地而不是错落地),
  // 但一道永远红、永远拒绝的出口等于没有出口,所以这条必须修判据而不是绕它。
  const zoneHeadLines = 1 + ZONE_NOTES.filter((n) => n.trim() !== '').length
  const zoneExists = pl.indexOf(ZONE_TITLE) >= 0
  const expectGain = zoneExists ? 0 : zoneHeadLines
  if (lost !== 0) fails.push(`有 ${lost} 行非空内容消失(本工具只许移动,绝不许删)`)
  if (gain !== expectGain) {
    fails.push(
      `非空行净新增=${gain},应为 ${expectGain} —— ${zoneExists ? '区已在位 ⇒ 移动不改多重集,净新增必须是 0' : '新建区 ⇒ 只应多出区头行(移出行原本就在文档里,不计新增)'}`,
    )
  }
  const after = partitionPlanBlocks(newText)
  if (after.blocked.length !== 0) fails.push(`产出面仍有 ${after.blocked.length} 个被拒块 ⇒ 未收敛`)
  const ob = openCount(parentText)
  const oa = openCount(newText)
  if (ob !== oa) fails.push(`派单口径未勾选数从 ${ob} 变成 ${oa} ⇒ 有活账被改成死账或反之,拒落`)
  const db = doneCount(parentText)
  const da = doneCount(newText)
  if (db !== da) fails.push(`已勾选数从 ${db} 变成 ${da} ⇒ 本工具不得翻勾任何一行`)
  return { ok: fails.length === 0, fails, readout: { moved: moved.length, openBefore: ob, openAfter: oa, doneBefore: db, doneAfter: da, linesBefore: pl.length, linesAfter: nl.length } }
}

function buildReport(parentText, headSha) {
  const r = stripToFixpoint(parentText)
  const v = verifyStrip({ parentText, newText: r.text, moved: r.moved })
  return { ...r, face: headSha, verdict: v }
}

function runSelfTest() {
  let pass = 0
  let fail = 0
  const ok = (name, cond, detail = '') => {
    if (cond) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${detail ? ' —— ' + detail : ''}`)
    }
  }
  // 判据面必须先遮掉注释与字符串 —— 下面 S6 断言的**名字本身**就带着被禁的写法,裸扫源码会让
  // 这道锁命中自己的解释文字(本仓记过多次:判据把散文当代码,表现是"永远红"或"永远绿")。
  const srcMasked = maskCommentsAndStrings(readFileSync(fileURLToPath(import.meta.url), 'utf8'))
  const dirty = [
    '# 计划',
    '',
    '## 甲(已完成 ✅ 2026-09-28)',
    '- [x] 甲做完的一条',
    '- [ ] 甲块里混着的活账',
    '',
    '## 乙(已完成 ✅ 2026-09-28)',
    '- [x] 乙做完的一条',
    '',
    '## 丙 仍在进行的小节(不带完成标记)',
    '- [ ] 丙的活',
  ].join('\n')
  const r = stripToFixpoint(dirty)
  ok('S1 被拒块内的未勾选行被移出,且产出面被拒块归零', r.moved.length === 1 && String(r.moved[0]).includes('甲块里混着的活账') && partitionPlanBlocks(r.text).blocked.length === 0, `moved=${r.moved.length}`)
  ok('S2 守恒断言在合法产出上全过', verifyStrip({ parentText: dirty, newText: r.text, moved: r.moved }).ok, JSON.stringify(verifyStrip({ parentText: dirty, newText: r.text, moved: r.moved }).fails))
  ok('S3 干净块(体内无未勾选)不得被摘走任何一行', stripToFixpoint(['## 丁(已完成 ✅ 2026-09-28)', '- [x] 丁的一条'].join('\n')).moved.length === 0)
  ok('S4 未勾选行不得被翻勾、已勾选行不得被改动', doneCount(dirty) === doneCount(r.text) && openCount(dirty) === openCount(r.text))
  const tampered = r.text.replace('- [ ] 甲块里混着的活账', '- [x] 甲块里混着的活账')
  ok('S5 反向对照:偷偷翻勾必须被守恒断言拦下', verifyStrip({ parentText: dirty, newText: tampered, moved: r.moved }).ok === false)
  const deleted = r.text.split('\n').filter((l) => l !== '- [ ] 丙的活').join('\n')
  ok('S5b 反向对照:删行必须被守恒断言拦下', verifyStrip({ parentText: dirty, newText: deleted, moved: [] }).ok === false)
  ok(
    'S6 源码锁:本工具不得把台账写回工作树(只允许对象空间落地)',
    !/writeFileSync\(\s*PLAN_REL/.test(srcMasked) && !/writeFileSync\(\s*join\(/.test(srcMasked),
  )
  ok('S7 空面/无被拒块时零改动零新增', stripToFixpoint('').moved.length === 0 && stripToFixpoint('').text === '')
  /**
   * S8/S8b —— 收编时我亲手写坏过的那一条,必须钉成回归:
   *  区**已在位**时,移动 N 行不改多重集 ⇒ 净新增必须 0(旧写法要求 = N,于是工具拒绝自己每次正常动作);
   *  同时在文档里凭空多出一行(既非移入亦非区头)仍必须被拦 —— 修判据不许顺手把牙磨掉。
   */
  const twoDirty = [
    '## 甲(已完成 ✅ 2026-09-28)',
    '- [ ] 甲的活账一',
    '- [ ] 甲的活账二',
    '',
    '## 乙(已完成 ✅ 2026-09-28)',
    '- [ ] 乙的活账',
    '',
    ZONE_TITLE,
    ...ZONE_NOTES,
    '',
    '- [ ] 先前搬来的一条',
  ].join('\n')
  const r8 = stripToFixpoint(twoDirty)
  ok('S8 区已在位:移动 3 行 ⇒ 净新增 0 且守恒断言必须放过', r8.moved.length === 3 && verifyStrip({ parentText: twoDirty, newText: r8.text, moved: r8.moved }).ok === true, JSON.stringify(verifyStrip({ parentText: twoDirty, newText: r8.text, moved: r8.moved }).fails))
  const injected = r8.text + '\n- [ ] 凭空多出来的一行\n'
  ok('S8b 反向锁:凭空多出一行必须仍被拦(修判据不得把牙磨掉)', verifyStrip({ parentText: twoDirty, newText: injected, moved: r8.moved }).ok === false)
  console.log(`\n自检共 ${pass + fail} 条断言,通过 ${pass},失败 ${fail}`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return runSelfTest()
  const apply = has('--apply')
  // 面语义**复用归档器那一份解析**(只认 head|worktree,未知值报错退出)—— 在这里另发明一套
  // "--staged 判索引"会造出第二个"什么算一个被审面",两边一旦漂开,报告与落地就在不同面上。
  const want = resolveRequestedFace(argv)
  if (want.error) {
    console.log(`❌ ${want.error}`)
    return 2
  }
  const base = resolvePlanBase({ root: ROOT, requested: want.face })
  if (!base.text) {
    console.log(`❌ 取不到被审面 ⇒ 既不落地也不判定:${base.why}`)
    return 2
  }
  const rep = buildReport(base.text, base.headSha)
  if (has('--json')) {
    console.log(JSON.stringify({ face: base.face, headSha: base.headSha, rounds: rep.rounds, moved: rep.moved, ok: rep.verdict.ok, fails: rep.verdict.fails, readout: rep.verdict.readout }, null, 2))
    return rep.verdict.ok ? 0 : 1
  }
  const rd = rep.verdict.readout
  console.log(`判定面:${base.face}${base.headSha ? `(${String(base.headSha).slice(0, 9)})` : ''}  轮次=${rep.rounds} 拟移出=${rd.moved} 未勾选 ${rd.openBefore}→${rd.openAfter} 已勾选 ${rd.doneBefore}→${rd.doneAfter} 行数 ${rd.linesBefore}→${rd.linesAfter}`)
  if (!rep.moved.length) {
    console.log('✅ 无被拒块(面上没有"已完成块体内混着活账"的情形),不需动手')
    return 0
  }
  if (!rep.verdict.ok) {
    console.log(`❌ ${rep.verdict.fails.length} 条守恒断言未过 ⇒ 拒绝落地:`)
    for (const f of rep.verdict.fails) console.log('   ' + f)
    return 1
  }
  console.log(`✅ 五条守恒断言全过(区标题不自认已完成 ∧ 零消失 ∧ 新增只可能是区头/移出行 ∧ 被拒块归零 ∧ 勾选两态不缩水)`)
  if (!apply) {
    console.log(`ℹ️ 未落地(缺 --apply)。要落:node scripts/ledger-strip-open-rows.mjs --apply`)
    return 0
  }
  const MSG = `refactor(plan): 把带完成标记条目体内的 ${rep.moved.length} 条未勾选登记移到剥离区\n\n只换位置:不删行、不改勾选、不动其余行相对顺序。\n落地前五条守恒断言必须全绿(区标题不得自认已完成 ∧ 非空行零消失 ∧ 新增只能是区头与移出行 ∧\n产出面被拒块归零 ∧ 派单口径未勾选与已勾选两态都不缩水)。\n动因:归档器拒绝整块搬运是对的(块内有活账),但那些行因此永久挡住"完成即归档" ——\n本出口把"移出块"变成可复用动作,不再依赖某次会话手写的临时脚本。`
  for (let attempt = 1; attempt <= 10; attempt++) {
    const head = gitRead(['rev-parse', 'HEAD']).trim()
    try {
      // 别人推进了 HEAD ⇒ 必须在**新面**上重算,不能把旧面结果硬贴上去
      const nb = resolvePlanBase({ root: ROOT, requested: 'head' })
      if (!nb.text || nb.headSha !== head) continue
      const fresh = buildReport(nb.text, nb.headSha)
      if (!fresh.moved.length) {
        console.log(`✅ 第 ${attempt} 次:当前面已无需剥离,不落空提交`)
        return 0
      }
      if (!fresh.verdict.ok) {
        console.log('❌ 重算后守恒断言未过 ⇒ 拒绝落地:' + fresh.verdict.fails.join(' / '))
        return 1
      }
      const { commit } = commitTreeWithIndex({ root: ROOT, parent: head, message: MSG, treePath: PLAN_REL, text: fresh.text, baseRef: 'HEAD' })
      const ref = (resolveHeadRef({ root: ROOT }) || 'HEAD').trim()
      if (!casUpdateRef(commit, head, { root: ROOT, ref })) {
        console.log(`   第 ${attempt} 次 CAS 未中(HEAD 被别人推进)⇒ 在新面上重算`)
        continue
      }
      const shown = gitRead(['show', '--name-only', '--format=', commit]).split('\n')
      if (!shown.includes(PLAN_REL)) {
        console.log('❌ 提交面回读不含台账路径 ⇒ 消息与内容不符,停手')
        return 1
      }
      const al = alignSharedIndex({ root: ROOT, paths: [PLAN_REL], parentRef: head })
      console.log(`✅ 落地 ${commit.slice(0, 11)}(父 ${head.slice(0, 11)}) 移出 ${fresh.moved.length} 行;主索引 moved=${(al.moved || []).length} already=${(al.already || []).length} skipped=${(al.skipped || []).length} 未判定=${(al.undetermined || []).length}`)
      if ((al.skipped || []).length || (al.undetermined || []).length) {
        console.log('⚠️ 共享主索引有路径未对齐(归属他人/判不出)⇒ 逐条点名,不静默:' + JSON.stringify([...(al.skipped || []), ...(al.undetermined || [])]))
      }
      // 旁路落地不跑钩子 ⇒ 必须留痕,否则总量统计只能把这枚读成 unknown(与"有人跳门"同形)。
      const at = attestBypassCommit(commit, { root: ROOT, headBefore: head, source: 'ledger-strip-open-rows' })
      if (!at.ok) console.log(`⚠️ 旁路留痕未写入(${at.why})⇒ 这一枚在跳门总量台账里仍是 unknown`)
      return 0
    } catch (e) {
      console.log(`   第 ${attempt} 次派生失败,重读面再来:${String(e?.message ?? e).split('\n').pop().slice(0, 140)}`)
    }
  }
  console.log('❌ 多次未抢到 CAS ⇒ 不覆盖别人的推进(这不是失败,是并发窗口太密;稍后重跑即可)')
  return 1
}

function gitRead(a) {
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  return execFileSync(GIT, gitArgs(a), { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}

export const __test__ = { stripOnce, stripToFixpoint, verifyStrip, placeZone, openCount, doneCount, ZONE_TITLE, ZONE_NOTES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
