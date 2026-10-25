#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * strip-stale-closed-rows.mjs —— 「完成即删」的无人值守兜底(2026-10-20 立,机主令:
 * "要彻底根治 固定完成立即删掉记录")。
 *
 * 为什么提交口那道闸(守门 check-plan-closed-stock S1)还不够:
 *   S1 只在**有人提交且碰到 PROJECT_PLAN.md** 时拦。已完成行回到 HEAD 的另一条通道是
 *   并发合并/旧基线回写(2026-10-20 实测:一次清扫推上去后,合并又把 3 条带回),
 *   而带回它的那枚提交可以不碰台账 ⇒ 提交口看不见。故需一枚按同一判据清扫的兜底层。
 *
 * 判据**不在此重写**:import 守门的 staleClosedVerdict(§0.6/§22c 单一实现)。
 * 清扫集 = HEAD 面里的"跨枚滞留"已勾行(与 HEAD^ 同主键都已勾)。
 * **刚翻勾的那一枚永不清扫** —— 给守门 71 的 (c) 配平凭据留活路,否则结清只能变成
 * "无凭据减少"被无限回捞(本机 2026-10-20 实测)。
 *
 * 三条硬守恒(不成立 ⇒ 整批不落,不部分落):
 *   H1 未勾登记行逐字节同序不变(一行不许动、不许重排);
 *   H2 行数差 == 清扫条数(只删行,不改写行);
 *   H3 摘除后仍滞留的行必须**恰好等于**本轮跳过的「仍保护」集(不得多出没人负责的一条)。
 *
 * H4 摘除前先问守门 71 同一把尺子(2026-10-20 加固,治"清扫白做一轮 + 台账每 30 分钟抖一次"):
 *   门 229 的滞留集只比 HEAD ↔ HEAD^ 两面,而把已勾行**还原成未勾行**的是守门 71 的历史回捞层
 *   (旁路落地后由 object-space-land → lib/post-merge-ledger-sync.mjs → `check-plan-line-loss --heal --commit`
 *   就地补跑)。本机 2026-10-20 实测 G-815944:清扫器摘除成功落地 ⇒ 门 71 把同一条票按
 *   `- [ ]` 形态还原,未勾数 252→253。故本器在动手摘任何一行之前,必须先用门 71 自己的出口
 *   (`historyMarkers` 的配平状态机 + `missingFrom` 的名额判活)问一次:
 *   **「把这一行摘掉之后,门 71 会不会点名一条它仍保护的登记行?」**
 *     · 点名且能归因到本行 ⇒ 该行的历史裁定是「仍保护」⇒ **跳过不摘**,逐条点名"摘了会被按未勾还原、交人工";
 *     · 点名为 0 ⇒ 裁定是「已勾销」⇒ 可以摘(翻勾后整行删除 = 机主 2026-10-16 的正当移除);
 *     · 尺子取不到 / 保护集枚举为 0 / 点名归不到本次摘除行 ⇒ **整批不落 + exit 2/1**,
 *       绝不把"没量到"读成"不会被回捞"(§0.3),也绝不在本器里复算第二份"什么算勾销"(§0.6/§22c)。
 *
 * 落地唯一通道:`scripts/object-space-land.mjs`(blob 档 + 行级复活守卫 + CAS,从不写工作树)。
 * 旁路落地不跑 post-commit ⇒ 自动推送腿不触发(AGENTS §5b 回潮通道①),故本器落地后
 * 自己调 `git-push-guard.mjs` 把 origin 追平,并把跳过的守恒读数打进留痕。
 *
 * 机读结论行(供 git-guardian 日志分档,不靠中文文案猜):每轮恒打一行
 *   `SWEEP-RESULT state=<clean|preflight|stripped|all-held|refused|undetermined> stale=<n> held=<n> stripped=<n> …`
 *
 * 用法:
 *   node scripts/strip-stale-closed-rows.mjs           # 只读预演(零副作用)
 *   node scripts/strip-stale-closed-rows.mjs --apply    # 落地 + 推送
 *   node scripts/strip-stale-closed-rows.mjs --self-test
 * 退出码(0/1/2 语义与 2026-10-20 初版一致,3 是本轮加固新增的第三态):
 *   0 无跨枚滞留 / 已成功摘除 N 条(可能同时跳过 M 条并逐条点名)
 *   1 预演发现滞留(未落地) / 超单批上限 / 守恒不过 / 点名归不到本次摘除行
 *   2 未判定(HEAD 或 HEAD^ 面取不到、登记行解析异常、门 71 的尺子取不到)
 *   3 有滞留但**全部**被判「门 71 仍保护」⇒ 本轮一条未摘(这不是"无需清扫",交人工)
 */

import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseTaskRows } from './lib/plan-task-index.mjs'
import { gitRaw } from './lib/face-reader.mjs'
import { staleClosedVerdict } from './check-plan-closed-stock.mjs'
// H4 的尺子**一律借守门 71 自己的出口**(§0.6/§22c 单一真相源):
//   historyMarkers = 历史配平状态机(它决定一个 marker 到底算「勾销」还是「仍保护」),
//   missingFrom   = 该保护集在给定面上的"仍被保护的登记行不在"点名(名额判活,与 --heal 同一实现),
//   closedRegistrationOf / lastHistoryWindow / historyDepth = 行身份与射程报名。
// 本器不复算"什么算同一件事/什么算勾销"—— 抄一份就是第二份真相,而它下一次必然漂开。
import {
  closedRegistrationOf,
  historyDepth,
  historyMarkers,
  lastHistoryWindow,
  missingFrom,
} from './check-plan-line-loss.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
/** 单批上限:超出即拒绝自动回写(与水印门"单次缺口 >200 拒绝自动回写"同一取向,§0.10 失效方向是多要一次说明) */
const BATCH_CAP = 400
/**
 * 摘除留痕的仓外落点(与 `strip-stale-claim-marks` 的 `stale-claim-strip.jsonl` 同一处、同一种语义:
 * 逐条存「摘除前的整行原文」,供 `scrub-declared-removals` 与 `union-converge` 的回潮防线读)。
 * 必须在 `.ihui-agent/state/`(活文档归并射程外):台账行内任何注记都会被别席的清偿提交洗掉,
 * 所以可追责性的真相源只能是这里 + 提交信息。
 */
const DROP_LEDGER = '.ihui-agent/state/plan-row-drop.jsonl'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

// 派生 git 一律走脚本层(lib/face-reader 的 gitRaw):裸起 git 进程的那种写法会被
// scripts/tests/face-reader.test.mjs 的"裸派生生产文件只减不增"棘轮记为新增者(2026-10-21 实测
// 本文件就是新增者之一),而走层同时也拿到它的超时/stdio 纪律。
function git(args) {
  return gitRaw(args, ROOT)
}

/** 取一面 blob;取不到返回 null(调用方落「未判定」,不回落另一个面 —— §0.4) */
function blobOf(spec) {
  try {
    return git(['cat-file', '-p', spec])
  } catch {
    return null
  }
}

/**
 * 纯函数:从底稿里摘掉指定行号的行,并跑三条守恒。
 * @returns {{ok:boolean, text?:string, removed?:number, why?:string, keptClosed:number}}
 */
export function buildStripPlan(baseText, staleLines) {
  const lines = String(baseText).split('\n')
  const drop = new Set(staleLines)
  const removed = lines.filter((_, i) => drop.has(i + 1)).length
  if (removed !== drop.size)
    return {
      ok: false,
      keptClosed: 0,
      why: `H0 行号集有 ${drop.size - removed} 枚指不到行(面已变)`,
    }
  const out = lines.filter((_, i) => !drop.has(i + 1))
  const openBefore = lines.filter((l) => /^\s*- \[ \]/.test(l))
  const openAfter = out.filter((l) => /^\s*- \[ \]/.test(l))
  if (openBefore.length !== openAfter.length || !openBefore.every((l, i) => l === openAfter[i]))
    return { ok: false, keptClosed: 0, why: 'H1 未勾登记行没做到逐字节同序不变' }
  if (out.length !== lines.length - removed)
    return { ok: false, keptClosed: 0, why: 'H2 行数差不等于清扫条数' }
  const closedAfter = parseTaskRows(out.join('\n')).filter((r) => r.state === 'done').length
  return { ok: true, text: out.join('\n'), removed, keptClosed: closedAfter }
}

/**
 * 摘除留痕(2026-10-23 补 —— 这是「摘了又回来」的元凶,不是又一道保险)。
 *
 * 立因(实测,非推断):本器此前摘除成功落地,却**一行留痕都不写**。后果是两条回潮防线同时瞎掉:
 *   ① `scrub-declared-removals.mjs` 的 `declaredRows` 只认 `plan-row-drop.jsonl` / `stale-claim-strip.jsonl`
 *      里的整行原文 ⇒ 这批行它根本看不见,收编器把它们当新增内容照收;
 *   ② `union-converge.mjs` 的活文档行 union 只认「对侧相对基底新增」,对侧旧基线里还留着的同一行
 *      ⇒ 判成别人的独有行补回。
 *   于是摘一次、回一次,存量永远归不了零(2026-10-23 实测:03:04 清扫一轮,03:27 已勾行仍 40 条)。
 * 反面对照:`strip-stale-claim-marks.mjs` 每摘一枚都往 `stale-claim-strip.jsonl` 落整行原文,
 * 所以那一族没有这个洞 —— 本函数就是补上它对等的那一半。
 *
 * 纪律:
 *   · **只在落地成功后调用**(落地被拒而先写台账 = 台账声称删了、面上还在 ⇒ 复洁器会据此误剔,
 *     方向变成"丢别人的行",正是 §0.10 明令禁止的那一型);
 *   · 追加写、同一行重复无害(下游按集合语义消费);
 *   · 写不进去 ⇒ 抛错由调用方按「留痕失败」大声点名,绝不静默 —— 少一条留痕 = 那一行下次必回潮。
 *
 * @param {string[]} rows  被摘行的**整行原文**(逐字,下游靠它逐字比对)
 * @param {{file?:string, seat?:string, commit?:string, baseline?:string, at?:string}} meta
 * @param {string} [root]
 * @returns {{ok:boolean, file:string, written:number, why?:string}}
 */
export function appendDropLedger(
  rows,
  { file = FILE, seat = 'stale-closed-sweep', commit = '', baseline = '', at = new Date().toISOString() } = {},
  root = ROOT,
) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => typeof r === 'string' && r !== '')
  if (list.length === 0) return { ok: true, file: DROP_LEDGER, written: 0 }
  const abs = path.join(root, DROP_LEDGER)
  try {
    mkdirSync(path.dirname(abs), { recursive: true })
    const payload =
      list
        .map((rowBefore) =>
          JSON.stringify({
            at,
            seat,
            file,
            rowBefore,
            kind: 'stale-closed-sweep',
            baseline,
            commit,
          }),
        )
        .join('\n') + '\n'
    appendFileSync(abs, payload, 'utf8')
    return { ok: true, file: DROP_LEDGER, written: list.length }
  } catch (e) {
    return { ok: false, file: DROP_LEDGER, written: 0, why: String(e?.message ?? e).slice(0, 160) }
  }
}

/**
 * 机读结论行 —— 守护日志按它分档,不靠中文文案猜。
 * 三个读数值(stale / held / stripped)必须同时在场:否则"摘了 0 条"与"根本没判"在日志里同形。
 */
export function emitResult(state, kv = {}) {
  const parts = [`state=${state}`]
  for (const [k, v] of Object.entries(kv)) parts.push(`${k}=${v}`)
  const line = `SWEEP-RESULT ${parts.join(' ')}`
  console.log(line)
  return line
}

/**
 * 借守门 71 的尺子(取材档,零判定复算)。
 * 尺子不可用的三种形态都返回 `{ok:false, why}` 并由调用方整批不落:
 *   ① `historyMarkers` 抛错 / 没返回保护集 —— git 问不到;
 *   ② 历史窗口枚数为 0 —— 尺子没有取材面;
 *   ③ 保护集枚举为 0 —— 按 §0.3「枚举到 0 个候选判死不记绿」,空保护集**不能**被读成
 *      "没有一行会被回捞"而放行删除(那正是把"没判"写成"判过")。
 * @returns {{ok:true, seen:Map, window:object, lossesOf:(text:string)=>Array|null}|{ok:false, why:string}}
 */
export function buildLineLossRuler({
  depth = historyDepth(),
  root = ROOT,
  archived = undefined,
} = {}) {
  let seen = null
  try {
    seen = historyMarkers(depth, root)
  } catch (e) {
    return {
      ok: false,
      why: `守门 71 的 historyMarkers 抛错:${String(e?.message ?? e).slice(0, 140)}`,
    }
  }
  if (!seen || typeof seen.size !== 'number')
    return { ok: false, why: '守门 71 未返回保护集(历史面取不到)' }
  const win = lastHistoryWindow()
  if (!win || !win.commits)
    return {
      ok: false,
      why: `历史窗口枚数为 0(depth ${depth})⇒ 尺子没有取材面,不得读成"没有保护行"`,
    }
  if (seen.size === 0)
    return {
      ok: false,
      why: `保护集枚举为 0(窗口 ${win.commits} 枚提交)⇒ 判死不记绿(§0.3),不得据"空保护集"放行删除`,
    }
  const lossesOf = (text) => {
    try {
      return missingFrom(seen, text, archived).map((e) => ({
        marker: e.marker,
        id: e.id ?? null,
        shape: e.shape ?? null,
      }))
    } catch {
      return null // 尺子在这一面取不到点名 ⇒ 由调用方落「未判定」,不折成 0 条
    }
  }
  return { ok: true, seen, window: win, lossesOf }
}

/** 被摘的已勾行与门 71 点名条目是否同一件事 —— 只用门 71 自己的行身份出口,不另立判据。 */
function rowMatchesLoss(row, entry, idOfLine) {
  let reg = null
  try {
    reg = idOfLine(row.raw)
  } catch {
    reg = null
  }
  if (entry.id && reg && reg.id === entry.id) return true
  if (entry.marker && reg && reg.marker === entry.marker) return true
  if (entry.marker && String(row.raw ?? '').includes(entry.marker)) return true
  return false
}

/**
 * H4 分档(纯函数,取证靠注入 `lossesOf`):把门 229 的滞留集分成「可摘」与「仍保护故跳过」。
 * 判序:①在被审面 base 上先取一次点名(减去与本次摘除无关的既有缺失);②摘掉全部滞留行的假想面上
 * 再取一次,新增点名逐条归因到被摘行 ⇒ 那些行按门 71 的历史裁定是「仍保护」⇒ 摘了必被还原 ⇒ 跳过;
 * ③用剩下的可摘集**复验**一次,仍有新增点名 ⇒ 整批不落(绝不部分落、绝不"少摘几条凑合")。
 * 归不到本次摘除行的新增点名同样整批不落:解释不了的红色读数必须多要一次定向说明,
 * 不能由本器替它编一个"与摘除无关"的结论(§0.10)。
 * @returns {{ok:boolean, undetermined?:boolean, why?:string, strippable:Array, held:Array,
 *            unattributed:Array, text?:string, removed?:number, baseLostCount:number,
 *            freshFirst:number, freshVerify:number}}
 */
export function partitionStaleByProtection(
  headText,
  staleRows,
  lossesOf,
  idOfLine = closedRegistrationOf,
) {
  const empty = {
    ok: false,
    strippable: [],
    held: [],
    unattributed: [],
    baseLostCount: 0,
    freshFirst: 0,
    freshVerify: 0,
  }
  const base = lossesOf(headText)
  if (base === null || base === undefined)
    return { ...empty, undetermined: true, why: '守门 71 在被审面(HEAD)上取不到点名 ⇒ 未判定' }
  const baseSet = new Set(base.map((e) => e.marker))
  const fresh = (list) =>
    list === null || list === undefined ? null : list.filter((e) => !baseSet.has(e.marker))

  const first = buildStripPlan(
    headText,
    staleRows.map((r) => r.line),
  )
  if (!first.ok) return { ...empty, undetermined: true, why: `摘除集预演本身不过守恒:${first.why}` }
  const freshFirst = fresh(lossesOf(first.text))
  if (freshFirst === null)
    return { ...empty, undetermined: true, why: '守门 71 在摘除后的假想面上取不到点名 ⇒ 未判定' }

  const heldByLine = new Map()
  const unattributed = []
  for (const e of freshFirst) {
    const hits = staleRows.filter((r) => rowMatchesLoss(r, e, idOfLine))
    if (hits.length === 0) {
      unattributed.push(e)
      continue
    }
    for (const r of hits) {
      if (!heldByLine.has(r.line)) heldByLine.set(r.line, { row: r, reasons: [] })
      heldByLine.get(r.line).reasons.push(e.marker || e.id || '(无名)')
    }
  }
  const held = [...heldByLine.values()]
  if (unattributed.length)
    return {
      ...empty,
      held,
      unattributed,
      baseLostCount: base.length,
      freshFirst: freshFirst.length,
      why:
        `摘除后新增 ${unattributed.length} 条点名归不到本次任何一枚被摘行` +
        `(${unattributed
          .slice(0, 3)
          .map((e) => e.marker || e.id || '(无名)')
          .join(' / ')})` +
        ' ⇒ 解释不了的红必须多要一次定向说明,整批不落',
    }

  const strippable = staleRows.filter((r) => !heldByLine.has(r.line))
  const plan = buildStripPlan(
    headText,
    strippable.map((r) => r.line),
  )
  if (!plan.ok)
    return {
      ...empty,
      held,
      baseLostCount: base.length,
      freshFirst: freshFirst.length,
      undetermined: true,
      why: `可摘集复演不过守恒:${plan.why}`,
    }
  if (strippable.length === 0)
    return {
      ok: true,
      strippable,
      held,
      unattributed: [],
      text: plan.text,
      removed: 0,
      baseLostCount: base.length,
      freshFirst: freshFirst.length,
      freshVerify: 0,
    }
  const freshVerify = fresh(lossesOf(plan.text))
  if (freshVerify === null)
    return {
      ...empty,
      held,
      baseLostCount: base.length,
      freshFirst: freshFirst.length,
      undetermined: true,
      why: '守门 71 复验时取不到点名 ⇒ 未判定',
    }
  if (freshVerify.length)
    return {
      ...empty,
      held,
      baseLostCount: base.length,
      freshFirst: freshFirst.length,
      freshVerify: freshVerify.length,
      why:
        `H4 复验:跳过 ${held.length} 条之后再摘余下的 ${strippable.length} 条,` +
        `门 71 仍点名 ${freshVerify.length} 条(${freshVerify
          .slice(0, 3)
          .map((e) => e.marker || e.id || '(无名)')
          .join(' / ')})⇒ 整批不落`,
    }
  return {
    ok: true,
    strippable,
    held,
    unattributed: [],
    text: plan.text,
    removed: plan.removed,
    baseLostCount: base.length,
    freshFirst: freshFirst.length,
    freshVerify: 0,
  }
}

/**
 * 分档退出码(纯函数,自检直接钉住这张表 —— 主流程与取证必须读同一份契约,§22c)。
 * `undetermined` 那一档的失效方向是**多要一次定向说明**(exit 2 未判定),
 * 绝不能折成 0(= 把"没判"写成"判过"),也不能折成 3(= 把"没判"写成"全部仍保护")。
 */
export function sweepOutcome(part, { apply = false } = {}) {
  if (part.undetermined) return { exit: 2, state: 'undetermined' }
  if (!part.ok) return { exit: 1, state: 'refused' }
  if (part.strippable.length === 0) return { exit: 3, state: 'all-held' }
  if (!apply) return { exit: 1, state: 'preflight' }
  return { exit: 0, state: 'stripped' }
}

/** 自检:纯函数夹具,不落盘、不碰仓库。 */
function selfTest() {
  const openRow = '- [ ] G-1 待办夹具:一件事'
  const staleClosed = '- [x] ✅(2026-10-20/甲) G-2 待办夹具:二件事'
  const freshClosed = '- [x] ✅(2026-10-20/乙) G-3 待办夹具:三件事'
  const cases = [
    {
      n: 'H1/H2 成立:摘掉滞留行,未勾行原样,行数精确减少',
      base: [openRow, staleClosed, freshClosed].join('\n'),
      drop: [2],
      ok: true,
      removed: 1,
      keptClosed: 1,
    },
    {
      n: 'H0 行号指不到(面已变)⇒ 整批不落',
      base: [openRow].join('\n'),
      drop: [7],
      ok: false,
    },
    {
      n: '零行清扫 ⇒ 成立且不动任何字节',
      base: [openRow, staleClosed].join('\n'),
      drop: [],
      ok: true,
      removed: 0,
      keptClosed: 1,
    },
  ]
  let fails = 0
  let total = 0
  const t = (n, cond, got = '') => {
    total++
    if (cond) console.log(`${C.green}✓${C.reset} ${n}`)
    else {
      fails++
      console.log(`${C.red}✗${C.reset} ${n} —— 实得${got}`)
    }
  }
  for (const c of cases) {
    const r = buildStripPlan(c.base, c.drop)
    const ok =
      r.ok === c.ok &&
      (c.ok
        ? r.removed === c.removed &&
          r.text ===
            c.base
              .split('\n')
              .filter((_, i) => !c.drop.includes(i + 1))
              .join('\n') &&
          r.keptClosed === c.keptClosed
        : true)
    t(c.n, ok, ` ok=${r.ok} removed=${r.removed}${r.why ? ' why=' + r.why : ''}`)
  }
  // 反证:摘掉一枚未勾行必须被 H1 咬住(守恒不是装饰)
  const hurt = buildStripPlan([openRow, staleClosed].join('\n'), [1])
  t('反证:摘未勾行被 H1 拦下(守恒不是装饰)', !hurt.ok, ` ok=${hurt.ok} why=${hurt.why}`)

  // ── H4(摘除前先问守门 71 同一把尺子)的正反例 ──────────────────────────
  // 夹具刻意写长(> MIN_LEN 40),使门 71 的 `closedRegistrationOf` 真能给出 marker/id:
  // 否则归因会悄悄退化成"仅靠正文含该串"这一条弱臂,而用例仍全绿(= 零射程的自检)。
  const P_HEAD = [
    '# 计划',
    '- [ ] G-7001 探针:这一行始终未勾,用来让守门七十一的保护集在夹具面上不为空',
    '- [x] ✅(2026-10-20/甲) G-7002 探针:这一条已勾销,历史裁定为可删(翻勾与摘行在同枚配平)',
    '- [x] ✅(2026-10-20/乙) G-7003 探针:这一条已勾销,历史裁定为仍保护(open 减量无凭据)',
  ].join('\n')
  const P_OPEN = P_HEAD.split('\n')[1]
  const P_R2 = P_HEAD.split('\n')[2]
  const P_R3 = P_HEAD.split('\n')[3]
  const STALE = [
    { line: 3, raw: P_R2 },
    { line: 4, raw: P_R3 },
  ]
  t(
    'H4 夹具身份:门 71 的 closedRegistrationOf 认得这两条已勾行(marker/id 都取到)',
    (() => {
      const a = closedRegistrationOf(P_R2)
      const b = closedRegistrationOf(P_R3)
      return !!a && !!b && a.marker === 'G-7002 探针' && a.id === 'G-7002' && b.id === 'G-7003'
    })(),
    JSON.stringify([closedRegistrationOf(P_R2), closedRegistrationOf(P_R3)]),
  )
  // ① 滞留且尺子判「可删」⇒ 摘
  const p1 = partitionStaleByProtection(P_HEAD, STALE, () => [])
  t(
    '①尺子零点名 ⇒ 两条全判可摘(removed=2、held=0)',
    p1.ok && p1.strippable.length === 2 && p1.held.length === 0 && p1.removed === 2,
    ` ok=${p1.ok} strippable=${p1.strippable.length} held=${p1.held.length} removed=${p1.removed}`,
  )
  // ② 滞留但判「仍保护」⇒ 不摘且逐条点名
  const p2 = partitionStaleByProtection(P_HEAD, STALE, (text) =>
    text.includes(P_R3) ? [] : [{ marker: 'G-7003 探针', id: 'G-7003', shape: 'checkbox' }],
  )
  t(
    '②摘它会引出点名 ⇒ 跳过不摘、并点名"为什么没摘"',
    p2.ok &&
      p2.strippable.length === 1 &&
      p2.strippable[0].line === 3 &&
      p2.held.length === 1 &&
      p2.held[0].row.line === 4 &&
      p2.held[0].reasons.length > 0 &&
      p2.removed === 1,
    ` ok=${p2.ok} strippable=${p2.strippable.map((r) => r.line).join(',')} held=${p2.held.length} reasons=${JSON.stringify(p2.held.map((h) => h.reasons))} why=${p2.why || ''}`,
  )
  // ③ 判据取不到 ⇒ 未判定(整批不落,不得静默当成"不可删"了事,更不得当成"可删")
  const p3 = partitionStaleByProtection(P_HEAD, STALE, () => null)
  t(
    '③尺子取不到 ⇒ undetermined 且可摘集为空(整批不落)',
    p3.undetermined === true &&
      p3.ok === false &&
      p3.strippable.length === 0 &&
      p3.held.length === 0,
    ` undetermined=${p3.undetermined} ok=${p3.ok} why=${p3.why}`,
  )
  t(
    '③b 未判定档的退出码必须是"多要一次说明"(exit 2),不得落成 0',
    sweepOutcome(p3, { apply: true }).exit === 2 &&
      sweepOutcome(p3, { apply: true }).state === 'undetermined',
    JSON.stringify(sweepOutcome(p3, { apply: true })),
  )
  // 反证:点名归不到本次任何一枚被摘行 ⇒ 解释不了的红不落(而不是"那就全摘")
  const p4 = partitionStaleByProtection(P_HEAD, STALE, (text) =>
    text === P_HEAD ? [] : [{ marker: 'G-7999 无人摘过的编号', id: 'G-7999', shape: 'checkbox' }],
  )
  t(
    '④新增点名归不到被摘行 ⇒ 整批不落并点名(unattributed=1)',
    p4.ok === false && p4.unattributed.length === 1 && p4.why.includes('归不到'),
    ` ok=${p4.ok} unattributed=${p4.unattributed.length} why=${p4.why}`,
  )
  // 反证:跳过「仍保护」那一类之后复验仍被点名 ⇒ 整批不落(绝不部分落)
  const p5 = partitionStaleByProtection(P_HEAD, STALE, (text) => {
    const lost = []
    if (!text.includes(P_R3)) lost.push({ marker: 'G-7003 探针', id: 'G-7003', shape: 'checkbox' })
    if (!text.includes(P_R2) && text.includes(P_R3))
      lost.push({ marker: 'G-7002 探针', id: 'G-7002', shape: 'checkbox' })
    return lost
  })
  t(
    '⑤跳过后复验仍被点名 ⇒ 整批不落(H4 复验臂)',
    p5.ok === false && p5.held.length === 1 && p5.freshVerify > 0 && p5.why.includes('H4 复验'),
    ` ok=${p5.ok} held=${p5.held.length} freshVerify=${p5.freshVerify} why=${p5.why}`,
  )
  // 反证:摘除集里混进未勾行 ⇒ 由守恒(H1)拦下并落「未判定」,不是"放行后少删一行"
  const p6 = partitionStaleByProtection(P_HEAD, [{ line: 2, raw: P_OPEN }], () => [])
  t(
    '⑥摘除集含未勾行 ⇒ 预演即被 H1 拦下(未判定,不落)',
    p6.undetermined === true && p6.ok === false && p6.why.includes('H1'),
    ` undetermined=${p6.undetermined} why=${p6.why}`,
  )
  // 分档退出码契约(守护日志靠它 + SWEEP-RESULT 分三态)
  const allHeld = partitionStaleByProtection(P_HEAD, STALE, (text) =>
    text === P_HEAD
      ? []
      : [
          { marker: 'G-7002 探针', id: 'G-7002' },
          { marker: 'G-7003 探针', id: 'G-7003' },
        ],
  )
  t(
    '⑦全部被判仍保护 ⇒ state=all-held / exit 3(绝不显示成"无需清扫")',
    allHeld.ok &&
      allHeld.strippable.length === 0 &&
      sweepOutcome(allHeld, { apply: true }).state === 'all-held' &&
      sweepOutcome(allHeld, { apply: true }).exit === 3,
    ` ok=${allHeld.ok} strippable=${allHeld.strippable.length} ${JSON.stringify(sweepOutcome(allHeld, { apply: true }))}`,
  )
  t(
    '⑧预演档(不带 --apply)有可摘集 ⇒ 仍是 exit 1(契约不变)',
    sweepOutcome(p1, { apply: false }).exit === 1 && sweepOutcome(p1, { apply: true }).exit === 0,
    JSON.stringify([sweepOutcome(p1, { apply: false }), sweepOutcome(p1, { apply: true })]),
  )
  // 反证(G-928/G-960 型,2026-10-22 根治):同主键多枚滞留已勾拷贝必须一次全检出,
  // 摘完后复量"滞留集==跳过集"必须成立 ⇒ H3 自洽;判据若只报首枚,摘完首枚会冒出
  // 第二枚"新"滞留,H3 恒拒、台账提交管道卡死(门 229 拦一切 × 清扫器摘不动)。
  const DUP_OPEN = '- [ ] G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性'
  const DUP_R1 = '- [x] ✅(2026-10-20/甲) G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性'
  const DUP_R2 = '- [x] ✅(2026-10-20/乙) G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性〔第二枚拷贝〕'
  const DUP_FACE = [DUP_OPEN, DUP_R1, DUP_R2].join('\n')
  const vDup = staleClosedVerdict(DUP_FACE, DUP_FACE)
  t(
    '⑩同号未勾+同主键两枚滞留已勾 ⇒ 两枚拷贝一次全检出(未勾副本不遮蔽、首枚不吞后续)',
    !vDup.undetermined && vDup.stale.length === 2 && vDup.stale.map((r) => r.line).join(',') === '2,3',
    ` stale=${vDup.stale.length} lines=${vDup.stale.map((r) => r.line).join(',')} undetermined=${vDup.undetermined}`,
  )
  const pDup = partitionStaleByProtection(DUP_FACE, vDup.stale, () => [])
  const afterDup = pDup.ok ? staleClosedVerdict(pDup.text, DUP_FACE) : { stale: [{ raw: '(未过档)' }] }
  t(
    '⑩b H3 复量自洽:摘完两枚拷贝后滞留集==跳过集(0==0)⇒ 不再恒拒',
    pDup.ok &&
      pDup.strippable.length === 2 &&
      pDup.held.length === 0 &&
      afterDup.stale.length === pDup.held.length &&
      afterDup.stale.map((r) => r.raw).sort().join('\n') ===
        [...pDup.held].map((h) => h.row.raw).sort().join('\n'),
    ` ok=${pDup.ok} strippable=${pDup.strippable.length} held=${pDup.held.length} after=${afterDup.stale.length}${pDup.why ? ' why=' + pDup.why : ''}`,
  )
  // 机读结论行形状:三态必须能被 state= 区分,且三个计数恒在场
  const shape = `state=stripped stale=2 held=1 stripped=1`
  t(
    '⑨SWEEP-RESULT 行可被守护按 state= 解析(形状锁)',
    /^SWEEP-RESULT state=[a-z-]+( \S+=\S+)+$/.test(`SWEEP-RESULT ${shape}`.trim()) &&
      /state=(clean|preflight|stripped|all-held|refused|undetermined)\b/.test(shape),
    `SWEEP-RESULT ${shape}`,
  )

  // 反证:判据 import 的是守门本体,不是本地抄一份
  let wired = false
  try {
    wired = git(['show', 'HEAD:scripts/check-plan-closed-stock.mjs']).includes('staleClosedVerdict')
  } catch {
    wired = false
  }
  console.log(
    `${wired ? C.green + '✓' : C.yellow + '⚠'}${C.reset} 判据来源:守门脚本${wired ? '已在 HEAD 面导出 staleClosedVerdict' : '尚未落地(本枚一起落)'}`,
  )
  let g71wired = false
  try {
    const s = git(['show', 'HEAD:scripts/check-plan-line-loss.mjs'])
    g71wired = ['historyMarkers', 'missingFrom', 'closedRegistrationOf', 'lastHistoryWindow'].every(
      (n) => s.includes(`export function ${n}`),
    )
  } catch {
    g71wired = false
  }
  console.log(
    `${g71wired ? C.green + '✓' : C.yellow + '⚠'}${C.reset} H4 尺子来源:守门 71${g71wired ? '已在 HEAD 面导出 historyMarkers/missingFrom/closedRegistrationOf/lastHistoryWindow(本器零复算)' : '出口尚未落地(本枚一起落)'}`,
  )
  console.log(`${C.cyan}自检 ${total - fails}/${total}${C.reset}`)
  return fails ? 1 : 0
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  const apply = args.includes('--apply')

  const headText = blobOf('HEAD:' + FILE)
  const baseText = blobOf('HEAD^:' + FILE)
  if (headText === null || baseText === null) {
    console.error(`${C.yellow}⏭ 未判定:${C.reset}HEAD 或 HEAD^ 面的 ${FILE} 取不到 ⇒ 不清扫(§0.3)`)
    emitResult('undetermined', {
      stale: 'unknown',
      held: 'unknown',
      stripped: 0,
      why: 'face-unavailable',
    })
    process.exit(2)
  }
  const v = staleClosedVerdict(headText, baseText)
  if (v.undetermined) {
    console.error(`${C.yellow}⏭ 未判定:登记行解析异常 ⇒ 不得读成"没有滞留行"${C.reset}`)
    emitResult('undetermined', {
      stale: 'unknown',
      held: 'unknown',
      stripped: 0,
      why: 'rows-parse-failed',
    })
    process.exit(2)
  }
  if (v.stale.length === 0) {
    console.log(
      `${C.green}✅ 无跨枚滞留的已完成登记行${C.reset}(HEAD 面已勾 ${v.faceClosed} 条,均为刚翻勾的一枚宽限)`,
    )
    emitResult('clean', { stale: 0, held: 0, stripped: 0, closed: v.faceClosed })
    process.exit(0)
  }
  if (v.stale.length > BATCH_CAP) {
    console.error(
      `${C.red}❌ 拒绝自动回写:${v.stale.length} 条 > 单批上限 ${BATCH_CAP}${C.reset} —— 这个量级要么是清扫本身出问题,` +
        `要么是台账被整片带回;交人工按守门提示分批处理,不静默批量删。`,
    )
    emitResult('refused', {
      stale: v.stale.length,
      held: 'unknown',
      stripped: 0,
      why: 'over-batch-cap',
    })
    process.exit(1)
  }
  console.log(
    `${C.cyan}📊 跨枚滞留已勾登记行 ${v.stale.length} 条${C.reset}(HEAD 面已勾共 ${v.faceClosed} 条)`,
  )
  for (const r of v.stale.slice(0, 10)) console.log(`   L${r.line} ${r.raw.slice(0, 110)}`)

  // ── H4:动手摘任何一行之前,先问守门 71 用的同一把尺子 ─────────────────────
  const ruler = buildLineLossRuler()
  if (!ruler.ok) {
    console.error(
      `${C.yellow}⏭ 未判定(H4 尺子):${C.reset}${ruler.why} ⇒ 整批不落。` +
        `绝不把"量不到"读成"摘了不会被回捞",也不读成"全部仍保护"(§0.3/§0.10)。`,
    )
    emitResult('undetermined', {
      stale: v.stale.length,
      held: 'unknown',
      stripped: 0,
      why: 'ruler-unavailable',
    })
    process.exit(2)
  }
  console.log(
    `${C.cyan}⚖️ H4 尺子(守门 71 本体,本器零复算):保护集 ${ruler.seen.size} 条 / 窗口 ${ruler.window.commits} 枚提交` +
      `(最旧 ${ruler.window.oldestDate ?? '?'})/ 已勾销 ${ruler.window.retired} 条${C.reset}`,
  )
  const part = partitionStaleByProtection(headText, v.stale, ruler.lossesOf)
  const outcome = sweepOutcome(part, { apply })

  if (part.held.length) {
    console.log(
      `${C.yellow}⏸ 本轮不摘 ${part.held.length} 条:守门 71 的历史裁定是「仍保护」——` +
        `摘掉它门 71 会按**未勾形态**把同一条票还原(G-815944 型),等于清扫白做一轮 + 台账抖一次。` +
        `交人工处置:把这行的历史形态定成「已勾销」(补一枚配平翻勾),或由人工连未勾形态一起清掉。${C.reset}`,
    )
    for (const h of part.held.slice(0, 20))
      console.log(
        `   ${C.yellow}·${C.reset} L${h.row.line} 跳过原因:摘它会引出守门 71 点名「${h.reasons.join(' / ')}」⇒ 仍保护 ${h.row.raw.slice(0, 90)}`,
      )
    if (part.held.length > 20)
      console.log(`   …另有 ${part.held.length - 20} 条(同上,逐条见复跑本器不带 --apply)`)
  }

  if (!part.ok) {
    console.error(
      `${part.undetermined ? C.yellow + '⏭ 未判定(H4 尺子)' : C.red + '❌ 整批不落(H4/守恒)'}${C.reset}:` +
        `${part.why ?? '分档未通过'}`,
    )
    emitResult(outcome.state, {
      stale: v.stale.length,
      held: part.held.length,
      stripped: 0,
      why: part.undetermined ? 'ruler-undetermined' : 'conservation-or-attribution',
    })
    process.exit(outcome.exit)
  }

  if (outcome.state === 'all-held') {
    console.error(
      `${C.red}⚠ 有滞留 ${v.stale.length} 条,但**全部**被守门 71 判为仍保护 ⇒ 本轮一条未摘。${C.reset}` +
        `这一档不等于"账面干净":清扫没有做成,滞留仍在 HEAD,只是做它会被门 71 回捞。交人工逐条裁定(出路见上方点名)。`,
    )
    emitResult('all-held', {
      stale: v.stale.length,
      held: part.held.length,
      stripped: 0,
      why: 'gate71-protects-all',
    })
    process.exit(outcome.exit)
  }

  if (outcome.state === 'preflight') {
    console.log(
      `${C.yellow}只读预演(零副作用):将摘 ${part.strippable.length} 条、跳过 ${part.held.length} 条。落地:--apply${C.reset}`,
    )
    emitResult('preflight', {
      stale: v.stale.length,
      held: part.held.length,
      stripped: 0,
      willStrip: part.strippable.length,
    })
    process.exit(outcome.exit)
  }

  const plan = { text: part.text, removed: part.removed }
  if (!plan.text || plan.removed !== part.strippable.length) {
    console.error(`${C.red}❌ 守恒不过,整批不落:${C.reset}清扫条数与可摘集不等`)
    emitResult('refused', {
      stale: v.stale.length,
      held: part.held.length,
      stripped: 0,
      why: 'count-mismatch',
    })
    process.exit(1)
  }
  // H3(加固后的口径):摘完仍滞留的行必须**恰好等于**本轮跳过的「仍保护」集,不得多出无人负责的一条。
  // 基线取 HEAD^(与本轮判滞留同一面),不取 headText:拿 headText 当基线会把每一行"刚翻勾、
  // 本就该由下一枚提交摘掉"的宽现行也读成滞留,把 H3 变成"只要台账里有刚翻勾的行就整批不落"的假红。
  const after = staleClosedVerdict(plan.text, baseText)
  const heldRaws = [...part.held]
    .map((h) => h.row.raw)
    .sort()
    .join('\n')
  const afterRaws = after.stale
    .map((r) => r.raw)
    .sort()
    .join('\n')
  if (after.undetermined || after.stale.length !== part.held.length || afterRaws !== heldRaws) {
    console.error(
      `${C.red}❌ H3 不过:摘完仍有 ${after.stale.length} 条被判滞留,而本轮跳过集是 ${part.held.length} 条` +
        ` ⇒ 行号集与判据不自洽(或冒出一条没人负责的红),不落${C.reset}`,
    )
    emitResult('refused', {
      stale: v.stale.length,
      held: part.held.length,
      stripped: 0,
      why: 'H3-mismatch',
    })
    process.exit(1)
  }

  // 落地前先钉住 HEAD:留痕的凭据是"面上真的摘掉了",而落地器的退出码答不了这一问 ——
  // 实测 2026-10-23:落地器 CAS 成功推进 HEAD,却因提交面回读"git 问不到"返 exit 2;
  // 若按退出码跳过留痕,这一批就成了**无凭据摘除**,下一轮合并必把它们带回。
  // 必须声明在 try 之外:留痕段在 try/finally 之后读取它(声明在 try 内会 ReferenceError,
  // 落地成功也写不进留痕 ⇒ 正是"摘一次、回一次"的根因)。
  const headBefore = git(['rev-parse', 'HEAD']).trim()
  const dir = mkScratch('ihui-strip-closed-')
  // 落地器的退出码要带出 try 块:留痕段(try 之后)要拿它决定"该怎么解释这次推进"。
  let landStatus = 0
  try {
    const newPath = path.join(dir, 'new.md')
    writeFileSync(newPath, plan.text, 'utf8')
    const blob = git(['hash-object', '-w', newPath]).trim()
    const blobsPath = path.join(dir, 'blobs.json')
    const scopePath = path.join(dir, 'clash.json')
    writeFileSync(blobsPath, JSON.stringify({ files: [{ path: FILE, blob }] }))
    writeFileSync(
      scopePath,
      JSON.stringify({
        files: [{ path: FILE, removed: part.strippable.map((r) => r.raw), added: [] }],
      }),
    )
    const env = {
      ...process.env,
      LAND_PATHS: FILE,
      LAND_BLOBS: blobsPath,
      LAND_CLASH_SCOPE: scopePath,
      LAND_BLOB_PROOF:
        `滞留集由守门 check-plan-closed-stock 的同一判据算出(HEAD ∩ HEAD^ 同复合主键都已勾);` +
        `复算: node scripts/check-plan-closed-stock.mjs(全量档点名同一批行)。` +
        `H4 摘除前问过守门 71 的同一把尺子(historyMarkers + missingFrom,本器零复算):` +
        `保护集 ${ruler.seen.size} 条 / 窗口 ${ruler.window.commits} 枚,摘掉本批 ${plan.removed} 条后复验点名 0 条;` +
        `另有 ${part.held.length} 条被判「仍保护」故本轮未摘(门 71 会按未勾形态还原,交人工)。` +
        `守恒:H1 未勾 ${(plan.text.match(/^\s*- \[ \]/gm) || []).length} 行逐字节同序 / ` +
        `H2 行数 -${plan.removed} / H3 摘后滞留集 == 跳过集(${part.held.length} 条)`,
      LAND_MSG:
        `chore(plan): 自动摘除 ${plan.removed} 条跨枚滞留的已完成登记行(完成即删兜底轮;` +
        `未勾行逐字节守恒,判据 import 守门 check-plan-closed-stock,` +
        `摘除前按守门 71 同一把尺子复核 ⇒ 另跳过 ${part.held.length} 条"仍保护"的行交人工)`,
    }
    const land = spawnSync(process.execPath, [path.join(ROOT, 'scripts/object-space-land.mjs')], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = `${land.stdout ?? ''}${land.stderr ?? ''}`
    landStatus = land.status ?? 0
    console.log(out.split('\n').slice(-12).join('\n'))
    if (land.status !== 0) {
      console.error(
        `${C.red}❌ 落地器拒绝(exit ${land.status})${C.reset} ⇒ 不重试、不强推,交人工看上面的点名`,
      )
      emitResult('refused', {
        stale: v.stale.length,
        held: part.held.length,
        stripped: 0,
        why: 'landing-rejected-' + land.status,
      })
      process.exit(1)
    }
  } finally {
    rmScratch(dir)
  }

  // 留痕必须在**面上真的摘掉之后**:这是两条回潮防线(scrub-declared-removals 的逐字比对 /
  // union-converge 的活文档 union)唯一认得"这行曾被正当摘除"的凭据。落地被拒而先写台账,
  // 会把"面上还在"的行说成"已删" ⇒ 复洁器误剔 ⇒ 丢别人的行(§0.10 明令禁止)。
  // 判据是 **HEAD 有没有被推进**,不是落地器的退出码:退出码 2 的语义是"回读未判定",
  // 而 CAS 可能已经成功(实测 2026-10-23:HEAD 推进了、退出码 2、行确实摘了)。
  const landedSha = git(['rev-parse', 'HEAD']).trim()
  const advanced = Boolean(landedSha) && landedSha !== headBefore
  if (advanced) {
    const baseSha = git(['rev-parse', 'HEAD^']).trim()
    const ledger = appendDropLedger(part.strippable.map((r) => r.raw), {
      seat: 'stale-closed-sweep',
      commit: landedSha,
      baseline: baseSha,
    })
    if (!ledger.ok) {
      // 留痕写不进去 ⇒ 这一批下次必被 union 带回,等于本轮白做。大声点名,但不改落地成败
      // (行确实已经摘掉了,修好留痕后重跑即可补上)。
      console.error(
        `${C.red}❌ 摘除留痕写入失败(${ledger.why})——本轮 ${plan.removed} 行已摘但**无凭据**,下一轮合并会把它们带回;修好留痕后重跑即可${C.reset}`,
      )
    } else {
      console.log(
        `${C.cyan}📝 摘除留痕 ${ledger.written} 条 → ${ledger.file}(回潮防线的凭据)` +
          (landStatus !== 0 ? ` —— 落地器 exit ${landStatus} 属回读未判定,而 HEAD 已推进 ⇒ 按推进事实留痕` : '') +
          C.reset,
      )
    }
  } else {
    console.error(
      `${C.yellow}⚠️ HEAD 未推进(${headBefore.slice(0, 11)} ⇒ ${landedSha.slice(0, 11) || '取不到'})⇒ 本轮不写留痕` +
        `(少了凭据最多是回潮一次,写了假凭据会害复洁器去剔别人的行)${C.reset}`,
    )
  }

  // 旁路落地不跑 post-commit ⇒ 推送腿必须自带(AGENTS §5b 回潮通道①:origin 还带旧行就会被合并带回)
  const push = spawnSync(process.execPath, [path.join(ROOT, 'scripts/git-push-guard.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  console.log(
    `${push.status === 0 ? C.green + '✅ 推送腿已派发' : C.yellow + '⚠️ 推送腿 exit ' + push.status + '(不阻断,交 converge)' + C.reset}`,
  )
  console.log(
    `${C.green}✅ 清扫完成:摘除 ${plan.removed} 条(跳过 ${part.held.length} 条仍保护者,已逐条点名);HEAD 现为 ${git(['rev-parse', 'HEAD']).trim().slice(0, 11)}${C.reset}`,
  )
  emitResult('stripped', {
    stale: v.stale.length,
    held: part.held.length,
    stripped: plan.removed,
    lostOnHead: part.baseLostCount,
  })
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  buildStripPlan,
  appendDropLedger,
  emitResult,
  buildLineLossRuler,
  partitionStaleByProtection,
  sweepOutcome,
  FILE,
  BATCH_CAP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
