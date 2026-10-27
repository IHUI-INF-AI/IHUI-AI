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
 * 2026-10-24 补(治"器物空转 8+ 轮"):落地器 `object-space-land.mjs` 的退出码**不是唯一的真相**——
 * 它在"落地后受影响判据复跑"里跑的是**绝对判据**,面上本来就有的存量红(实测:门 130 的 F4 副本行,
 * 落地前的父提交面同样判红)也会让它 exit 1,而 CAS 早已成功推进 HEAD。此前本器在 `try` 里直接
 * `process.exit(1)`,于是**留痕与推送腿被整段跳过**(无凭据摘除 ⇒ 下一轮 union 又带回 ⇒ 再撞同一堵墙)。
 * 现在:① 留痕/推送腿一律按"HEAD 有没有推进"执行,不看退出码;② 落地前预探 + 落地后复跑
 * (同一实现 `lib/land-gate-rerun`)逐臂比判红证据,若判红全是**存量红**(证据行未增)⇒ 落
 * `state=stripped … preexisting=<门号>`,并大声点名"门照旧红、提交链照旧拦";
 * 归因不了(新红臂 / verdict=2 未判定 / HEAD 未推进)⇒ 照旧 `state=refused` + exit 1。
 * 归因成功**不放宽任何判据**:门红仍是红,变的只是"这枚摘除造成了判红"这句话。
 *
 * 2026-10-26 补(治"摘了却一行留痕都没写",主席实测 G-17/G-39 那一轮):留痕腿**本来就挂在
 * 落地之后**,可它照样丢 —— 因为派发层 `git-guardian.mjs` 的 `sweepStaleClosedRows` 用
 * `execFileSync(..., {timeout: 10*60*1000})` 起本器,而落地器在推进 HEAD 之后还要复跑受影响判据
 * (实测有凭据那 10 枚的留痕时刻距提交时刻 24~233s,长尾直接顶穿 600s)。父进程被 SIGKILL 时
 * 行已摘、HEAD 已推进,代码却根本没跑到那一句。现读:近 500 枚提交里 36 枚清扫提交,**26 枚零留痕**。
 * 新增的**留痕回捞腿** `reconcileDropLedgerDebt()` 排在每轮开工第一件事:按"提交已在 HEAD 历史里
 * ∧ 两面差集确实少了那几行"这笔既成事实补写欠账(凭据仍是 HEAD 推进,不是退出码;只认历史里
 * 已存在的提交 ⇒ 天然排在落地成功之后)。取不到面 / 差集冒出非「已勾登记行」⇒ 该枚一条不写并
 * 逐枚点名,整腿落「未判定」exit 2(§0.3)。
 *
 * 2026-10-27 补(治"回捞腿把 16 枚历史提交误判成前提破了、死锁违禁桶结清通道";取证
 * `.ihui-agent/tmp/g63-debt/evidence.md`,逐枚定性 0 真丢失):差集分类补**两档判据**——
 *   档① `removedRowsBetween` 的行尾符/末空行归一(`\r` 尾与文件末空行不参与「非已勾行」计数,
 *       只动这一维,别处逐字比对不碰);
 *   档② 未勾登记行先过两问(`adjudicateUnexpectedOpenRows`):(a) 同题形态是否仍在被审面
 *       (落地面 ∪ HEAD 面),(b) 是否有摘除台账 rowBefore 或已入库归档件的逐字凭据;
 *       **两问皆否才整枚记 lost**(lost 照旧 = 前提破了 ⇒ undetermined,红线不动)。
 * 同题判据零复算:指纹 import `check-plan-task-duplicates` 的 `extractTaskFingerprint`,
 * 主键 import `lib/plan-task-index` 的 `keyOfRow`,台账凭据 import `scrub-declared-removals`
 * 的 `declaredRows`(§0.6/§22c)。
 *
 * 用法:
 *   node scripts/strip-stale-closed-rows.mjs           # 只读预演(零副作用)
 *   node scripts/strip-stale-closed-rows.mjs --apply    # 落地 + 推送(先跑留痕回捞腿)
 *   node scripts/strip-stale-closed-rows.mjs --reconcile [--dry]  # 只跑回捞腿(--dry 只点名不写)
 *   node scripts/strip-stale-closed-rows.mjs --self-test
 * 退出码(0/1/2 语义与 2026-10-20 初版一致,3 是本轮加固新增的第三态):
 *   0 无跨枚滞留 / 已成功摘除 N 条(可能同时跳过 M 条并逐条点名)
 *   1 预演发现滞留(未落地) / 超单批上限 / 守恒不过 / 点名归不到本次摘除行
 *     / `--reconcile --dry` 量到欠账待补
 *   2 未判定(HEAD 或 HEAD^ 面取不到、登记行解析异常、门 71 的尺子取不到、
 *     留痕回捞腿取不到清单或两面取不到)
 *   3 有滞留但**全部**被判「门 71 仍保护」⇒ 本轮一条未摘(这不是"无需清扫",交人工)
 */

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseTaskRows, keyOfRow } from './lib/plan-task-index.mjs'
import { gitRaw } from './lib/face-reader.mjs'
import { staleClosedVerdict } from './check-plan-closed-stock.mjs'
// 留痕回捞腿的档②(同题存续/凭据接住)判据**一律借既有单源**(§0.6/§22c,2026-10-27 立):
//   题面指纹 = check-plan-task-duplicates 的 extractTaskFingerprint,
//   摘除台账 rowBefore 集合 = scrub-declared-removals 的 declaredRows,
//   复合主键 = lib/plan-task-index 的 keyOfRow。
// 在本器里再抄一份"什么算同一件事"的正则 = 第二份真相,下一次必然漂开。
import { extractTaskFingerprint } from './check-plan-task-duplicates.mjs'
import { declaredRows } from './scrub-declared-removals.mjs'
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
// 落地器 exit≠0 的归因**不另写一份判据**:落地前预探与落地后复跑都走 lib 的同一个出口
// (`rerunAffectedGates`:选门 = 注册表 stagedTriggers 现读,判据 = 各门自己的全量档)。
// 本器只做"两面的判红证据逐行比对",不解析任何门的业务语义(§0.6/§22c)。
//
// 为什么是**带守卫的动态 import** 而不是静态 import(2026-10-24 现读):`scripts/lib/land-gate-rerun.mjs`
// 属另一个在批的半格(现读 `git ls-files` 为空、HEAD 版 lander 也没有这行 import)—— 静态 import 会让
// 本器在**净检出**上直接 ERR_MODULE_NOT_FOUND 崩掉;那种失效方向是"清扫器整体消失",绝不能接受(§0.8)。
// 取不到 ⇒ 归因恒落「未判定」(照旧 refused),与"没有复跑能力时行为一字不变"等价。
let rerunAffectedGates = null
try {
  ;({ rerunAffectedGates } = await import('./lib/land-gate-rerun.mjs'))
} catch {
  rerunAffectedGates = null
}

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

/**
 * 清扫提交题面的**唯一模板**(2026-10-26 抽出)。
 *
 * 为什么要抽出来(§0.6 单一真相源,不是审美问题):下面的留痕回捞腿要靠这道题面认出
 * "哪几枚提交是本器摘的行",而题面正是本器自己写进 `LAND_MSG` 的那一句。两处各写一份,
 * 那么任何一次措辞改动都会让回捞腿**静默失明**(认不出 ⇒ 不报 ⇒ 又回到"摘了没留痕"那一型,
 * 而这一型的失效方向按 §12f 永远是安静)。所以:题面只有这一个出口,`SWEEP_SUBJECT_RE` 只能配它,
 * 镜像测试里有一条专门钉"正则必须能解析本器自己生成的题面"。
 */
export function sweepCommitSubject(removed, held) {
  return (
    `chore(plan): 自动摘除 ${removed} 条跨枚滞留的已完成登记行(完成即删兜底轮;` +
    `未勾行逐字节守恒,判据 import 守门 check-plan-closed-stock,` +
    `摘除前按守门 71 同一把尺子复核 ⇒ 另跳过 ${held} 条"仍保护"的行交人工)`
  )
}

/** 与 `sweepCommitSubject` 配对:从题面读回"这枚提交自称摘了几行";不匹配 ⇒ 不是清扫提交 */
export const SWEEP_SUBJECT_RE =
  /^chore\(plan\): 自动摘除 (\d+) 条跨枚滞留的已完成登记行\(完成即删兜底轮/

/** 回捞腿每轮往前扫多少枚提交(本仓清扫节奏实测:500 枚窗口内 36 枚清扫提交,够用且不刷盘) */
const DEBT_SCAN_DEFAULT = 400

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
  {
    file = FILE,
    seat = 'stale-closed-sweep',
    commit = '',
    baseline = '',
    at = new Date().toISOString(),
    via = '',
    note = '',
  } = {},
  root = ROOT,
) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => typeof r === 'string' && r !== '')
  if (list.length === 0) return { ok: true, file: DROP_LEDGER, written: 0 }
  const abs = path.join(root, DROP_LEDGER)
  try {
    mkdirSync(path.dirname(abs), { recursive: true })
    const payload =
      list
        .map((rowBefore) => {
          // 键序与旧版一致(via/note 只在给了值时追加在末尾)⇒ 既有台账行逐字节不变
          const entry = { at, seat, file, rowBefore, kind: 'stale-closed-sweep', baseline, commit }
          if (via) entry.via = via
          if (note) entry.note = note
          return JSON.stringify(entry)
        })
        .join('\n') + '\n'
    appendFileSync(abs, payload, 'utf8')
    return { ok: true, file: DROP_LEDGER, written: list.length }
  } catch (e) {
    return { ok: false, file: DROP_LEDGER, written: 0, why: String(e?.message ?? e).slice(0, 160) }
  }
}

/**
 * 两面逐行多重集差:`parentText` 里有、`landedText` 里没有了的那些行 ⇒ "这枚提交真的摘掉了什么"。
 *
 * 为什么以差集为准而不是以提交信息里自报的枚数为准:自报数只是**线索**(用它挑出哪些提交是本器写的),
 * 差集才是**面上发生过的事**;而留痕要写的正是逐字整行 —— 下游 `scrub-declared-removals` 的
 * `declaredRows` 与 `union-converge` 的 `declaredDropCaps` 都按整行逐字比对认行,差一个字符这条防线就瞎。
 * 纯函数、零 IO ⇒ 镜像测试直接喂两面文本取证。
 *
 * **档① 行尾符/末空行归一(2026-10-27 立,取证 .ihui-agent/tmp/g63-debt/evidence.md B 节)**:
 * 参与差集比对的行先剥行尾 `\r`、文件末空行不参与计数 —— 实测 `a161d05746ec` 父面末 8 字节
 * `…0a 0d0a` vs 落地面 `…0a 0a`(整面 `\r` 枚数 父=1/落地=0),差集里那枚「非已勾登记行」
 * 其实是同一行只换了行尾符,内容零丢失,却被判成前提破了。归一只作用于**这一维的差集计数**,
 * 别处的原文逐字比对(留痕 rowBefore、H1 同序校验)一律不动 —— 多归一一分就是少一分凭据。
 *
 * @returns {{closed:string[], unexpected:string[], removed:string[]}}
 */
export function removedRowsBetween(parentText, landedText) {
  if (typeof parentText !== 'string' || typeof landedText !== 'string')
    return { closed: [], unexpected: [], removed: [] }
  const normEol = (l) => (l.endsWith('\r') ? l.slice(0, -1) : l)
  const toLines = (text) => {
    // 先剥每行行尾 `\r`,再 pop 归一后为空的**文件末行**(两型都必须排在归一之后:
    // `…0a 0d0a` 收尾的父面 split 出的是伪空行 `'\r'`,先 pop 再归一会让它留在差集里 ——
    // 实测 a161d05746ec / 553cecbeb32c 各留一枚,2026-10-27 修)
    const arr = String(text).split('\n').map(normEol)
    while (arr.length > 0 && arr[arr.length - 1] === '') arr.pop()
    return arr
  }
  const multiset = (lines) => {
    const m = new Map()
    for (const l of lines) m.set(l, (m.get(l) || 0) + 1)
    return m
  }
  const before = multiset(toLines(parentText))
  const after = multiset(toLines(landedText))
  const removed = []
  for (const [line, n] of before) {
    const d = n - (after.get(line) || 0)
    for (let i = 0; i < d; i++) removed.push(line)
  }
  const closed = removed.filter((l) => /^\s*- \[x\]/.test(l))
  // 档①之二:纯空行(含中段被顺手带走的分隔空行)不承载任何登记内容 —— rowBefore 逐字比对
  // 与回潮防线消费的都是 `- [ ]/- [x]` 行,空行既不是"别人的行"也不是"已勾行"。
  // 2026-10-27 实测 `553cecbeb32c`:清扫轮随已勾行带走一枚中段空行(两面 EOF 均正常),
  // 按 EOF 归一挡不住 ⇒ 空行整族不入「非已勾行」计数(仍留在 `removed` 里,不删数据)。
  const unexpected = removed.filter((l) => !/^\s*- \[x\]/.test(l) && l.trim() !== '')
  return { closed, unexpected, removed }
}

/**
 * 留痕欠账判定(纯函数):一枚清扫提交自称摘了 N 行,台账里该枚只记着 M(<N)条 ⇒ 欠 N−M 条。
 *
 * 按 `commit` 计数、**不按 kind** —— 主席手工补账(kind=stale-closed-sweep-backfill)与本器
 * 自动回捞(kind=stale-closed-sweep + via=debt-reconcile)都算"这一枚已付过",否则同一枚会被
 * 每轮重复补写(台账虽按集合语义消费,但"补了多少条"就不再可读)。
 * @param {Array<{sha:string,parent?:string,subject:string}>} commits
 * @param {Array<object>} ledgerEntries
 */
export function findDropLedgerDebt(commits, ledgerEntries, { subjectRe = SWEEP_SUBJECT_RE } = {}) {
  const recorded = new Map()
  for (const e of Array.isArray(ledgerEntries) ? ledgerEntries : []) {
    if (!e || typeof e.commit !== 'string' || e.commit === '') continue
    if (typeof e.rowBefore !== 'string' && typeof e.before !== 'string') continue
    recorded.set(e.commit, (recorded.get(e.commit) || 0) + 1)
  }
  const debt = []
  for (const c of Array.isArray(commits) ? commits : []) {
    const sha = typeof c?.sha === 'string' ? c.sha : ''
    if (!/^[0-9a-f]{40}$/.test(sha)) continue
    const m = subjectRe.exec(String(c?.subject ?? ''))
    if (!m) continue
    const expected = Number(m[1])
    if (!Number.isFinite(expected) || expected <= 0) continue
    const have = recorded.get(sha) || 0
    if (have >= expected) continue
    debt.push({
      sha,
      parent: typeof c?.parent === 'string' ? c.parent : '',
      expected,
      recorded: have,
      missing: expected - have,
    })
  }
  return debt
}

/**
 * 留痕回捞腿的档②输入池(纯函数):给一批候选原文行,建「整行逐字 / 题面指纹 / 复合主键」三面集合。
 * 三面判据全部 import 单源(extractTaskFingerprint / keyOfRow,§0.6/§22c),本器零复算。
 */
export function buildSubjectPool(lines) {
  const verbatim = new Set()
  const fps = new Set()
  const keys = new Set()
  for (const l of Array.isArray(lines) ? lines : []) {
    if (typeof l !== 'string') continue
    verbatim.add(l.endsWith('\r') ? l.slice(0, -1) : l)
    const fp = extractTaskFingerprint(l)
    if (fp) fps.add(fp)
    const k = keyOfRow(l)
    if (k) keys.add(k)
  }
  return { verbatim, fps, keys }
}

/**
 * 档② 未勾行差集先过两问(2026-10-27 立,取证 .ihui-agent/tmp/g63-debt/evidence.md A/C 节)。
 *
 * 立因:回捞腿硬前置「差集全为已勾登记行」把三类**内容零丢失**的形态也读成前提破了 ——
 *   ②a 同票换形存续:`1861acf1d1ae` 摘掉的 10 枚未勾行逐题在面上仍有 `- [ ]` 活行,只是注记/租约换了形态;
 *   ②b 双形态只摘已勾那份 + 凭据齐:未勾旧形态随底稿换形消失,但摘除台账 rowBefore(同主键)
 *       或已入库归档件 `.ihui-agent/archive/PROJECT_PLAN_*.md` 里有它的逐字/同题凭据。
 * 逐枚先问 (a) 同题形态是否仍在被审面(落地面 ∪ HEAD 面)、(b) 是否有台账 rowBefore 或归档件逐字凭据;
 * **两问皆否才整枚记 lost**(真丢失候选 ⇒ 该枚仍 undetermined)。任一为是 ⇒ 记 paid,点名是哪一问接住的。
 * 同题 = 指纹命中 ∨ 复合主键命中(各自仅在能算出时才问);失效方向恒为「少认一个 paid ⇒ 多要一次人工」,
 * 绝不反过来放宽 lost 档(§0.10)。
 *
 * @param {string[]} openRows  差集里的未勾登记行(已按档①归一行尾)
 * @param {{landedText?:string|null, headText?:string|null,
 *          ledgerPool?:{verbatim:Set,fps:Set,keys:Set}|null,
 *          archivePool?:{verbatim:Set,fps:Set,keys:Set}|null}} pools
 *          取不到的输入传 null —— 该通道一条也不认(不猜),而不是报错放行。
 * @returns {{paid:Array<{row:string, via:string}>, lost:Array<string>}}
 */
export function adjudicateUnexpectedOpenRows(openRows, { landedText, headText, ledgerPool, archivePool } = {}) {
  const paid = []
  const lost = []
  const facePools = []
  if (typeof landedText === 'string') facePools.push(buildSubjectPool(landedText.split('\n')))
  if (typeof headText === 'string') facePools.push(buildSubjectPool(headText.split('\n')))
  for (const row of Array.isArray(openRows) ? openRows : []) {
    const fp = extractTaskFingerprint(row)
    const key = keyOfRow(row)
    const hit = (pool, what) =>
      (fp !== null && pool.fps.has(fp) ? what + '(指纹)' : null) ||
      (key !== null && pool.keys.has(key) ? what + '(主键)' : null) ||
      (pool.verbatim.has(row) ? what + '(逐字)' : null)
    let via = null
    for (const pool of facePools) {
      via = hit(pool, '问a:同题形态仍在被审面')
      if (via) break
    }
    if (!via && ledgerPool) via = hit(ledgerPool, '问b:摘除台账 rowBefore 凭据')
    if (!via && archivePool) via = hit(archivePool, '问b:已入库归档件逐字凭据')
    if (via) paid.push({ row, via })
    else lost.push(row)
  }
  return { paid, lost }
}

/**
 * 留痕回捞腿(2026-10-26 立,根治本次实测的"摘了却没留痕")。
 *
 * 立因是**量出来的**,不是推断。现读(2026-10-26):近 500 枚提交里 36 枚是本器的清扫提交,
 * 其中 **26 枚在摘除台账里一条留痕都没有**(应留 100 条,实留 0)。而有凭据的那 10 枚,
 * 留痕时刻距提交时刻分别是 24/113/123/139/155/215/215/225/227/233 秒 —— 也就是
 * **落地器在"推进 HEAD"之后还要跑 0.4~4 分钟**(它落地后复跑受影响判据)。留痕腿挂在这段
 * 长同步链的**末端**,而派发层 `git-guardian.mjs` 的 `sweepStaleClosedRows` 用
 * `execFileSync(..., { timeout: 10 * 60 * 1000 })` 起本器:20:39:09 那枚 `ef9d5081e8` 的轮次,
 * 守护日志 12:44:08.020Z 收尾 = 起跑 12:34:08.02 + 整 600s ⇒ 父进程被派发层超时 SIGKILL,
 * HEAD 已推进、行已摘掉,**那一段代码根本没机会跑到**。日志里"摘除留痕写入失败"0 次、
 * "HEAD 未推进"0 次 ⇒ 既不是写失败,也不是没推进,就是"人没活到那句话"。
 *
 * 所以光把留痕写在落地之后不够(那一腿本来就在那儿,也照样丢)。缺的是**事后认账**的那一半:
 * 每一轮开工第一件事,先按"提交已在 HEAD 历史里 ∧ 差集里确实少了那几行"这笔**既成事实**
 * 把欠着的留痕补上。三条纪律与本轮口径一致:
 *   · 凭据 = HEAD 有没有被推进(提交可达 = 已推进),不是落地器退出码;
 *   · 只认历史里已经存在的提交 ⇒ 天然排在"落地成功之后",不可能把"面上还在"说成"已删";
 *   · 面取不到 ⇒ 该枚**一条不写**;差集分档(2026-10-27 补两档,取证 g63-debt 16 枚全假阳性):
 *     档① 行尾符/末空行归一后不参与「非已勾行」计数;档② 未勾登记行先过两问
 *     (同题形态是否仍在被审面 / 是否有台账 rowBefore 或已入库归档件的逐字凭据),
 *     **两问皆否才整枚记 lost**;非登记行与 lost 行 = 前提破了 ⇒ 一条不写并逐枚点名,
 *     整腿落「未判定」exit 2 —— 绝不把"没量到"写成"补好了"(§0.3/§0.10),
 *     也绝不把"真被吞"读成"换形存续"(红线:真丢失仍判 undetermined)。
 * 幂等:按 `commit` 记账,补过的不再补。
 *
 * @param {{root?:string, file?:string, scan?:number, write?:boolean,
 *          gitRun?:(args:string[])=>string, append?:Function, now?:string}} opts
 * @returns {{state:'clean'|'pending'|'recovered'|'undetermined', scanned:number, debt:number,
 *            written:number, pending:number, items:Array, undetermined:Array, short:Array,
 *            harmless:Array, why?:string}}
 */
export function reconcileDropLedgerDebt({
  root = ROOT,
  file = FILE,
  scan = Number(process.env.IHUI_PLAN_DROP_DEBT_SCAN || DEBT_SCAN_DEFAULT),
  write = true,
  gitRun = null,
  append = appendDropLedger,
  now = new Date().toISOString(),
} = {}) {
  const empty = {
    state: 'clean',
    scanned: 0,
    debt: 0,
    written: 0,
    pending: 0,
    items: [],
    undetermined: [],
    short: [],
    harmless: [],
  }
  const run = gitRun || ((args) => gitRaw(args, root))
  let rawLog = null
  try {
    rawLog = run(['log', '--format=%H%x1f%P%x1f%s', `-n${Number.isFinite(scan) && scan > 0 ? scan : DEBT_SCAN_DEFAULT}`, '--', file])
  } catch (e) {
    return {
      ...empty,
      state: 'undetermined',
      why: `git log 取不到(清扫提交清单无法枚举):${String(e?.message ?? e).slice(0, 140)}`,
    }
  }
  if (typeof rawLog !== 'string')
    return { ...empty, state: 'undetermined', why: 'git log 返回的不是文本 ⇒ 清单未判定' }
  const commits = rawLog
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const [sha = '', parent = '', ...rest] = l.split('\u001f')
      return { sha: sha.trim(), parent: parent.trim(), subject: rest.join('\u001f') }
    })

  const abs = path.join(root, DROP_LEDGER)
  const entries = []
  let malformed = 0
  if (existsSync(abs)) {
    let txt = null
    try {
      txt = readFileSync(abs, 'utf8')
    } catch (e) {
      return {
        ...empty,
        scanned: commits.length,
        state: 'undetermined',
        why: `摘除台账读不到(${String(e?.message ?? e).slice(0, 120)})⇒ 欠账未判定,不得读成"没有欠账"`,
      }
    }
    for (const line of String(txt).split('\n')) {
      if (line.trim() === '') continue
      try {
        entries.push(JSON.parse(line))
      } catch {
        malformed++
      }
    }
  }

  const debt = findDropLedgerDebt(commits, entries)
  const res = {
    ...empty,
    scanned: commits.length,
    debt: debt.length,
    malformed,
    ledgerEntries: entries.length,
  }
  if (debt.length === 0) return { ...res, state: 'clean' }

  const undetermined = []
  const short = []
  const harmless = []
  const items = []
  let archiveList // undefined = 未查过;null = 查不到 ⇒ 归档通道零认
  let written = 0
  let pending = 0
  for (const d of debt) {
    let parentText = null
    let landedText = null
    if (!d.parent) {
      undetermined.push({ sha: d.sha, why: '题面里取不到父提交 ⇒ 两面对比无从下手' })
      continue
    }
    try {
      parentText = run(['cat-file', '-p', `${d.parent}:${file}`])
      landedText = run(['cat-file', '-p', `${d.sha}:${file}`])
    } catch (e) {
      undetermined.push({
        sha: d.sha,
        why: `面取不到(${String(e?.message ?? e).slice(0, 90)})⇒ 这一枚不补`,
      })
      continue
    }
    if (typeof parentText !== 'string' || typeof landedText !== 'string') {
      undetermined.push({ sha: d.sha, why: `${file} 的两面至少一面读不到 ⇒ 这一枚不补` })
      continue
    }
    const { closed, unexpected } = removedRowsBetween(parentText, landedText)
    // 未勾登记行走档②两问(2026-10-27):同题形态仍在被审面 / 台账-归档逐字凭据,两问皆否才是 lost;
    // 其余非登记行(标题、散文、真实少掉的中段空行)不走两问,照旧算「前提破了」——
    // 本器只摘「已勾登记行」(H1/H2 保证),这一档不放宽。
    const openUnexpected = unexpected.filter((l) => /^\s*- \[ \]/.test(l))
    const otherUnexpected = unexpected.filter((l) => !/^\s*- \[ \]/.test(l))
    let lostHere = []
    let paidHere = []
    if (openUnexpected.length > 0) {
      // 输入面按惰性取;取不到 ⇒ 传 null,该通道一条不认(失效方向 = 多落一枚 lost,不放宽)。
      let headText = null
      try {
        const h = run(['cat-file', '-p', `HEAD:${file}`])
        if (typeof h === 'string') headText = h
      } catch {
        headText = null
      }
      let ledgerPool = null
      try {
        const decl = declaredRows(root)
        if (decl && decl.filesSeen > 0 && decl.set && decl.set.size > 0)
          ledgerPool = buildSubjectPool([...decl.set])
      } catch {
        ledgerPool = null
      }
      let archivePool = null
      if (archiveList === undefined) {
        try {
          const out = run(['ls-files', '-z', '--', '.ihui-agent/archive'])
          archiveList = String(out)
            .split('\0')
            .filter((p) => p.startsWith('.ihui-agent/archive/PROJECT_PLAN'))
        } catch {
          archiveList = null
        }
      }
      if (archiveList && archiveList.length > 0) {
        const arcLines = []
        for (const p of archiveList) {
          try {
            const t = run(['cat-file', '-p', `HEAD:${p}`])
            if (typeof t === 'string') arcLines.push(...t.split('\n'))
          } catch {
            // 单份归档件取不到 ⇒ 它不贡献凭据(只减覆盖面,不冒充"有凭据")
          }
        }
        archivePool = buildSubjectPool(arcLines)
      }
      const adj = adjudicateUnexpectedOpenRows(openUnexpected, {
        landedText,
        headText,
        ledgerPool,
        archivePool,
      })
      paidHere = adj.paid
      lostHere = adj.lost
      harmless.push(...paidHere.map((p) => ({ sha: d.sha, row: p.row.slice(0, 90), via: p.via })))
    }
    const brokenHere = otherUnexpected.length + lostHere.length
    if (brokenHere > 0) {
      // 前提破了就一条不写:多写一条假凭据会教复洁器去剔别人的行(§0.10 明令禁止的那一型)。
      undetermined.push({
        sha: d.sha,
        why:
          `差集含 ${brokenHere} 枚两问皆接不住的非「已勾登记行」` +
          `(非登记行 ${otherUnexpected.length} / 真丢失候选 ${lostHere.length};` +
          `同题存续或凭据接住而未补账 ${paidHere.length} 枚)⇒ 前提破了,这一枚一条不补(交人工看)`,
        sample: lostHere.slice(0, 3),
      })
      continue
    }
    if (closed.length === 0) {
      undetermined.push({ sha: d.sha, why: '差集里 0 枚已勾登记行(与题面自报枚数矛盾)⇒ 不补' })
      continue
    }
    if (closed.length < d.expected) short.push({ sha: d.sha, expected: d.expected, found: closed.length })
    if (!write) {
      pending += closed.length
      items.push({ sha: d.sha, rows: closed.length })
      continue
    }
    const r = append(closed, { file, seat: 'stale-closed-sweep', commit: d.sha, baseline: d.parent, via: 'debt-reconcile', at: now }, root)
    if (!r.ok) {
      undetermined.push({ sha: d.sha, why: `补写失败:${r.why ?? '未知'}` })
      continue
    }
    written += r.written
    items.push({ sha: d.sha, rows: r.written })
  }
  res.undetermined = undetermined
  res.short = short
  res.harmless = harmless
  res.items = items
  res.written = written
  res.pending = pending
  if (undetermined.length > 0) return { ...res, state: 'undetermined', why: `${undetermined.length} 枚无法判定(逐枚点名见 items)` }
  if (written > 0) return { ...res, state: 'recovered' }
  return { ...res, state: 'pending' }
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

/**
 * 落地器 exit≠0 的归因(2026-10-24 立,治"清扫器空转 8+ 轮")。
 *
 * 现象(现读,不是推断):`object-space-land.mjs` 的 CAS 成功、本枚提交**已在 HEAD**,但它在
 * "落地后受影响判据复跑"里 exit 1 —— 判红的是**与本枚无关的存量红**(实测 2026-10-24T02:40~06:04
 * 八轮:门 130 的 F4「同一件事多条待办 由基线 0 涨到 1」在落地前的父提交面上同样判红、证据逐字相同)。
 * 清扫器把一枚**已经落地**的摘除报成 refused ⇒ 下一轮又有新滞留、再撞同一堵墙 ⇒ 器物空转。
 *
 * 本函数**不碰判据**:它只回答"这条红是不是本枚带来的"。依据 = 用**同一个复跑实现**
 * (lib/land-gate-rerun,§0.6)在落地前(父提交面)与落地后各测一次,逐臂比对判红证据:
 *   · 落地前没红的臂 ⇒ 新红,归因失败(照旧 refused);
 *   · 落地前红、落地后红但**出现落地前没有的证据行** ⇒ 新红,归因失败;
 *   · 落地后每一条证据行都在落地前那一次里 ⇒ 存量红,可归因。
 * `verdict` 不是 1(含 2 = 无法判定)**一律归因失败** —— 未判定不等于通过(§0.3);
 * 归因成功也**不代表门变绿**:门照旧判红、提交链照旧拦,扫掉的只是"这枚摘除造成的"这句话。
 */
export function redEvidence(out) {
  return String(out ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+$/, ''))
    .filter((l) => {
      const t = l.trimStart()
      if (t === '') return false
      // 判红头行(❌ …)+ 其下的证据明细(`   F11 …` 的逐行点名 / `     - …` 的丢失行)
      return t.startsWith('❌') || /^\s{3,}(?:[-·]|F\d)/.test(l)
    })
}

/**
 * @returns {{ok:boolean, preexisting:Array, newArms:Array, why?:string, preVerdict?:number, postVerdict?:number}}
 */
export function attributePreexistingRed({ pre, post } = {}) {
  if (!pre || !post)
    return { ok: false, preexisting: [], newArms: [], why: '预探或落地后复跑取不到(归因未判定)' }
  if (pre.verdict !== 1 || post.verdict !== 1)
    return {
      ok: false,
      preexisting: [],
      newArms: [],
      preVerdict: pre.verdict,
      postVerdict: post.verdict,
      why: `不是双侧 blocking 判红(pre=${pre.verdict}, post=${post.verdict})⇒ 未判定不按存量放行`,
    }
  const armKey = (a) => `${a.id ?? a.kind ?? '?'}|${a.script ?? ''}`
  const preArms = new Map((pre.failed ?? []).map((f) => [armKey(f), new Set(redEvidence(f.out))]))
  const preexisting = []
  const newArms = []
  for (const f of post.failed ?? []) {
    const key = armKey(f)
    const before = preArms.get(key)
    const lines = redEvidence(f.out)
    if (!lines.length) {
      newArms.push({
        id: f.id ?? null,
        script: f.script ?? null,
        why: '落地后判红证据取不到 ⇒ 无法归因',
      })
      continue
    }
    if (!before) {
      newArms.push({ id: f.id ?? null, script: f.script ?? null, why: '落地前这一臂没判红' })
      continue
    }
    const fresh = lines.filter((l) => !before.has(l))
    if (fresh.length)
      newArms.push({
        id: f.id ?? null,
        script: f.script ?? null,
        why: '出现落地前没有的判红证据',
        sample: fresh.slice(0, 3),
      })
    else preexisting.push({ id: f.id ?? null, script: f.script ?? null, evidence: lines.length })
  }
  if ((post.failed ?? []).length === 0)
    newArms.push({ id: null, script: null, why: '落地后没有判红臂却自称判红' })
  return {
    ok: newArms.length === 0 && preexisting.length > 0,
    preexisting,
    newArms,
    preVerdict: pre.verdict,
    postVerdict: post.verdict,
    why: newArms.length
      ? `本枚引入或无法归因的判红臂 ${newArms.length} 个`
      : '全部判红臂均为存量红',
  }
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
  // ── 留痕回捞腿(2026-10-26 立;本次实测"摘了却没留痕"就是缺这一腿的认账)───────────
  const DEBT_PARENT = 'f'.repeat(40)
  const DEBT_COMMIT = 'e'.repeat(40)
  const DEBT_R1 = '- [x] ✅(2026-10-26/甲) G-9001 回捞腿夹具:一枚'
  const DEBT_R2 = '- [x] ✅(2026-10-26/乙) G-9002 回捞腿夹具:二枚'
  const DEBT_OPEN = '- [ ] G-9003 回捞腿夹具:别人的活,一行都不许动'
  const DEBT_HEAD = [DEBT_OPEN, DEBT_R1, DEBT_R2].join('\n') + '\n'
  const DEBT_LANDED = [DEBT_OPEN].join('\n') + '\n'
  const DEBT_SUBJECT = sweepCommitSubject(2, 0)
  const debtGit = (args) => {
    if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${DEBT_SUBJECT}\n`
    const spec = String(args[2] ?? '')
    if (spec === `${DEBT_PARENT}:PROJECT_PLAN.md`) return DEBT_HEAD
    if (spec === `${DEBT_COMMIT}:PROJECT_PLAN.md`) return DEBT_LANDED
    throw new Error(`夹具没有这一面:${spec}`)
  }
  // 题面单源:正则必须能解析本器自己生成的题面,否则改了措辞 ⇒ 回捞腿静默失明(认不出=不报)
  const subjMatch = SWEEP_SUBJECT_RE.exec(DEBT_SUBJECT)
  t(
    '⑪题面单源:SWEEP_SUBJECT_RE 解析得出自己生成的清扫题面,且枚数读得回 2',
    subjMatch !== null && subjMatch[1] === '2' && DEBT_SUBJECT.startsWith('chore(plan): 自动摘除 2 条'),
    `match=${subjMatch ? subjMatch[1] : 'null'}`,
  )
  const dDiff = removedRowsBetween(DEBT_HEAD, DEBT_LANDED)
  t(
    '⑫差集逐字:两面相减只把「已勾登记行」算作摘除行,未勾行进 unexpected(不冒充凭据)',
    dDiff.closed.length === 2 && dDiff.unexpected.length === 0 && dDiff.closed.includes(DEBT_R1),
    ` closed=${dDiff.closed.length} unexpected=${dDiff.unexpected.length}`,
  )
  const dDebt = findDropLedgerDebt(
    [{ sha: DEBT_COMMIT, parent: DEBT_PARENT, subject: DEBT_SUBJECT }],
    [],
  )
  const dPaid = findDropLedgerDebt(
    [{ sha: DEBT_COMMIT, parent: DEBT_PARENT, subject: DEBT_SUBJECT }],
    [
      { commit: DEBT_COMMIT, rowBefore: DEBT_R1, kind: 'stale-closed-sweep-backfill' },
      { commit: DEBT_COMMIT, rowBefore: DEBT_R2, kind: 'stale-closed-sweep' },
    ],
  )
  t(
    '⑬欠账判定:台账 0 条 ⇒ 欠 2;按 commit 计数不按 kind ⇒ 主席手工补过的那一枚不得重复补账',
    dDebt.length === 1 && dDebt[0].missing === 2 && dPaid.length === 0,
    ` debt=${dDebt.length} missing=${dDebt[0]?.missing ?? '-'} paid=${dPaid.length}`,
  )
  const debtDir = mkScratch('ihui-drop-debt-selftest-')
  let dRec1 = null
  let dRec2 = null
  let dLines = []
  let dFileExists = false
  try {
    dRec1 = reconcileDropLedgerDebt({ root: debtDir, gitRun: debtGit, now: '2026-10-26T13:00:00.000Z' })
    dFileExists = existsSync(path.join(debtDir, DROP_LEDGER))
    dLines = dFileExists
      ? readFileSync(path.join(debtDir, DROP_LEDGER), 'utf8')
          .split('\n')
          .filter((l) => l.trim() !== '')
          .map((l) => JSON.parse(l))
      : []
    dRec2 = reconcileDropLedgerDebt({ root: debtDir, gitRun: debtGit, now: '2026-10-26T13:00:05.000Z' })
  } finally {
    rmScratch(debtDir)
  }
  t(
    '⑭端到端:清扫提交推进了 HEAD 而台账空 ⇒ 回捞腿逐字补写 2 条(commit/baseline/via 齐),再跑一次归零(幂等)',
    dRec1 &&
      dRec1.state === 'recovered' &&
      dRec1.written === 2 &&
      dLines.length === 2 &&
      dLines.map((o) => o.rowBefore).sort().join('\n') === [DEBT_R1, DEBT_R2].sort().join('\n') &&
      dLines.every(
        (o) =>
          o.commit === DEBT_COMMIT &&
          o.baseline === DEBT_PARENT &&
          o.kind === 'stale-closed-sweep' &&
          o.via === 'debt-reconcile' &&
          o.file === 'PROJECT_PLAN.md',
      ) &&
      dRec2 &&
      dRec2.state === 'clean' &&
      dRec2.written === 0,
    ` state=${dRec1?.state} written=${dRec1?.written} 行数=${dLines.length} 二次=${dRec2?.state}/${dRec2?.written}`,
  )
  const dryDir = mkScratch('ihui-drop-debt-dry-')
  let dDry = null
  let dDryFile = false
  try {
    dDry = reconcileDropLedgerDebt({ root: dryDir, gitRun: debtGit, write: false })
    dDryFile = existsSync(path.join(dryDir, DROP_LEDGER))
  } finally {
    rmScratch(dryDir)
  }
  t(
    '⑭b dry 档只点名不落盘(预演档不得有副作用 —— 与主流程 --check 契约同一条)',
    dDry && dDry.state === 'pending' && dDry.pending === 2 && dDry.written === 0 && dDryFile === false,
    ` state=${dDry?.state} pending=${dDry?.pending} written=${dDry?.written} 落盘=${dDryFile}`,
  )
  const unjDir = mkScratch('ihui-drop-debt-unj-')
  let dUnj = null
  let dUnjLines = 0
  try {
    dUnj = reconcileDropLedgerDebt({
      root: unjDir,
      gitRun: (args) => {
        if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${DEBT_SUBJECT}\n`
        throw new Error('夹具:面取不到')
      },
    })
    dUnjLines = existsSync(path.join(unjDir, DROP_LEDGER))
      ? readFileSync(path.join(unjDir, DROP_LEDGER), 'utf8').split('\n').filter((l) => l.trim()).length
      : 0
  } finally {
    rmScratch(unjDir)
  }
  t(
    '⑮未判定:面取不到 ⇒ state=undetermined 且一条不写(绝不把"没量到"写成"补好了",§0.3)',
    dUnj &&
      dUnj.state === 'undetermined' &&
      dUnj.written === 0 &&
      dUnj.undetermined.length === 1 &&
      dUnjLines === 0,
    ` state=${dUnj?.state} written=${dUnj?.written} 未判定=${dUnj?.undetermined?.length} 台账行=${dUnjLines}`,
  )
  const brokeDir = mkScratch('ihui-drop-debt-broke-')
  let dBroke = null
  let dBrokeLines = 0
  try {
    // 差集里冒出未勾登记行 ⇒ 这枚提交不是(只是)本器摘的 ⇒ 前提破了,一条不写
    dBroke = reconcileDropLedgerDebt({
      root: brokeDir,
      gitRun: (args) => {
        if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${DEBT_SUBJECT}\n`
        const spec = String(args[2] ?? '')
        if (spec === `${DEBT_PARENT}:PROJECT_PLAN.md`) return DEBT_HEAD
        if (spec === `${DEBT_COMMIT}:PROJECT_PLAN.md`) return '# 台账\n'
        throw new Error('夹具:' + spec)
      },
    })
    dBrokeLines = existsSync(path.join(brokeDir, DROP_LEDGER))
      ? readFileSync(path.join(brokeDir, DROP_LEDGER), 'utf8').split('\n').filter((l) => l.trim()).length
      : 0
  } finally {
    rmScratch(brokeDir)
  }
  t(
    '⑮b 前提破了:差集含非「已勾登记行」⇒ 该枚整枚不补(写了假凭据会教复洁器去剔别人的行)',
    dBroke &&
      dBroke.state === 'undetermined' &&
      dBroke.written === 0 &&
      dBroke.undetermined.length === 1 &&
      /前提破了/.test(dBroke.undetermined[0].why) &&
      dBrokeLines === 0,
    ` state=${dBroke?.state} why=${dBroke?.undetermined?.[0]?.why ?? '-'}`,
  )

  // 档①/档②(2026-10-27 立,取证 g63-debt:16 枚 undetermined 全为假阳性)────────────
  // 档① 正控:纯行尾符/末空行/中段空行差异不再进「非已勾行」计数
  const EOL_PARENT = [DEBT_OPEN, DEBT_R1 + '\r', '', DEBT_R2].join('\n') + '\n\n'
  const EOL_LANDED = [DEBT_OPEN, DEBT_R2].join('\n') + '\n'
  const dEol = removedRowsBetween(EOL_PARENT, EOL_LANDED)
  t(
    '⑯档① 行尾归一:`\\r` 尾、文件末空行、随已勾行被带走的空行都不参与差集,只剩真摘掉的已勾行(正向对照:不再 undetermined)',
    dEol.closed.length === 1 &&
      dEol.closed[0] === DEBT_R1 &&
      dEol.unexpected.length === 0 &&
      dEol.removed.some((l) => l === ''),
    ` closed=${dEol.closed.length} unexpected=${dEol.unexpected.length} removed=${dEol.removed.length}`,
  )
  const eolGit = (args) => {
    if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${sweepCommitSubject(1, 0)}\n`
    const spec = String(args[2] ?? '')
    if (spec === `${DEBT_PARENT}:PROJECT_PLAN.md`) return EOL_PARENT
    if (spec === `${DEBT_COMMIT}:PROJECT_PLAN.md`) return EOL_LANDED
    throw new Error(`夹具没有这一面:${spec}`)
  }
  const eolDir = mkScratch('ihui-drop-debt-eol-')
  let dEolRec = null
  try {
    dEolRec = reconcileDropLedgerDebt({ root: eolDir, gitRun: eolGit, now: '2026-10-27T00:00:00.000Z' })
  } finally {
    rmScratch(eolDir)
  }
  t(
    '⑯b 档①端到端:仅行尾符差异的父面不再被读成前提破了 ⇒ recovered(undetermined=0)',
    dEolRec &&
      dEolRec.state === 'recovered' &&
      dEolRec.written === 1 &&
      dEolRec.undetermined.length === 0,
    ` state=${dEolRec?.state} written=${dEolRec?.written} 未判定=${dEolRec?.undetermined?.length}`,
  )
  // 档②(a) 同题换形存续:未勾行换了注记形态仍在落地面上 ⇒ paid,不拦补账
  const OPEN_RESHAPE = DEBT_OPEN + '〔2026-10-27 别席改写:注记与租约换了形态,题面未动〕'
  const reshapeGit = (args) => {
    if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${DEBT_SUBJECT}\n`
    const spec = String(args[2] ?? '')
    if (spec === `${DEBT_PARENT}:PROJECT_PLAN.md`) return DEBT_HEAD
    if (spec === `${DEBT_COMMIT}:PROJECT_PLAN.md`) return OPEN_RESHAPE + '\n'
    throw new Error(`夹具没有这一面:${spec}`)
  }
  const reshapeDir = mkScratch('ihui-drop-debt-reshape-')
  let dReshape = null
  try {
    dReshape = reconcileDropLedgerDebt({ root: reshapeDir, gitRun: reshapeGit })
  } finally {
    rmScratch(reshapeDir)
  }
  t(
    '⑰档②(a) 同题换形存续:未勾行差集被「仍在被审面」接住 ⇒ 已付/无害点名 via=问a,已勾行照常补账',
    dReshape &&
      dReshape.state === 'recovered' &&
      dReshape.written === 2 &&
      dReshape.harmless.length === 1 &&
      /问a/.test(dReshape.harmless[0].via),
    ` state=${dReshape?.state} written=${dReshape?.written} 已付=${dReshape?.harmless?.length} via=${dReshape?.harmless?.[0]?.via ?? '-'}`,
  )
  // 档②(b) 台账 rowBefore 凭据:整题不在面上,但摘除台账里存着它的逐字原文 ⇒ paid
  const ledgerGit = (args) => {
    if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${DEBT_SUBJECT}\n`
    const spec = String(args[2] ?? '')
    if (spec === `${DEBT_PARENT}:PROJECT_PLAN.md`) return DEBT_HEAD
    // 落地面把已勾行与未勾行**全**摘掉(未勾行无同题存续)
    if (spec === `${DEBT_COMMIT}:PROJECT_PLAN.md`) return '# 台账\n- [ ] G-8888 无关题:与夹具票既不同题也不同号\n'
    throw new Error(`夹具没有这一面:${spec}`)
  }
  const ledgDir = mkScratch('ihui-drop-debt-ledgerpool-')
  let dLedgerPool = null
  try {
    mkdirSync(path.join(ledgDir, path.dirname(DROP_LEDGER)), { recursive: true })
    appendDropLedger([DEBT_OPEN], { commit: 'd'.repeat(40), baseline: 'c'.repeat(40), note: '别轮正当摘除该未勾行' }, ledgDir)
    dLedgerPool = reconcileDropLedgerDebt({ root: ledgDir, gitRun: ledgerGit })
  } finally {
    rmScratch(ledgDir)
  }
  t(
    '⑱档②(b) 台账凭据:未勾行整题消失但有摘除台账 rowBefore 逐字凭据 ⇒ via=问b 接住,不冒充真丢失',
    dLedgerPool &&
      dLedgerPool.state === 'recovered' &&
      dLedgerPool.written === 2 &&
      dLedgerPool.harmless.length === 1 &&
      /问b/.test(dLedgerPool.harmless[0].via),
    ` state=${dLedgerPool?.state} 已付=${dLedgerPool?.harmless?.length} via=${dLedgerPool?.harmless?.[0]?.via ?? '-'}`,
  )
  // 档②(b) 归档件凭据:题面逐字在已入库归档件里 ⇒ paid(取证 C 节的 G-964/D-07 形状)
  const arcGit = (args) => {
    if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${DEBT_SUBJECT}\n`
    if (args[0] === 'ls-files') return '.ihui-agent/archive/PROJECT_PLAN_test_snapshot.md\u0000'
    const spec = String(args[2] ?? '')
    if (spec === `${DEBT_PARENT}:PROJECT_PLAN.md`) return DEBT_HEAD
    if (spec === `${DEBT_COMMIT}:PROJECT_PLAN.md`) return '# 台账\n- [ ] G-8888 无关题:与夹具票既不同题也不同号\n'
    if (spec === 'HEAD:.ihui-agent/archive/PROJECT_PLAN_test_snapshot.md')
      return '# 归档\n' + DEBT_OPEN + '\n'
    throw new Error(`夹具没有这一面:${spec}`)
  }
  const arcDir = mkScratch('ihui-drop-debt-archive-')
  let dArchive = null
  try {
    dArchive = reconcileDropLedgerDebt({ root: arcDir, gitRun: arcGit })
  } finally {
    rmScratch(arcDir)
  }
  t(
    '⑲档②(b) 归档件凭据:题面逐字在已入库归档件里 ⇒ via=问b(归档),两问其一为是即不记 lost',
    dArchive &&
      dArchive.state === 'recovered' &&
      dArchive.harmless.length === 1 &&
      /归档件/.test(dArchive.harmless[0].via),
    ` state=${dArchive?.state} 已付=${dArchive?.harmless?.length} via=${dArchive?.harmless?.[0]?.via ?? '-'}`,
  )
  // 红线反证:未勾行**真被吞**(无留痕、无归档、同题形态不在任何面上)⇒ 仍 undetermined,一条不写
  const swallowGit = (args) => {
    if (args[0] === 'log') return `${DEBT_COMMIT}\u001f${DEBT_PARENT}\u001f${DEBT_SUBJECT}\n`
    const spec = String(args[2] ?? '')
    if (spec === `${DEBT_PARENT}:PROJECT_PLAN.md`) return DEBT_HEAD
    if (spec === `${DEBT_COMMIT}:PROJECT_PLAN.md`) return '# 台账\n- [ ] G-8888 无关题:与夹具票既不同题也不同号\n'
    throw new Error(`夹具没有这一面:${spec}`) // HEAD 面 / ls-files 都不给 ⇒ 三通道取不到 ⇒ 一律不认
  }
  const swDir = mkScratch('ihui-drop-debt-swallow-')
  let dSw = null
  let dSwLines = 0
  try {
    dSw = reconcileDropLedgerDebt({ root: swDir, gitRun: swallowGit })
    dSwLines = existsSync(path.join(swDir, DROP_LEDGER))
      ? readFileSync(path.join(swDir, DROP_LEDGER), 'utf8').split('\n').filter((l) => l.trim()).length
      : 0
  } finally {
    rmScratch(swDir)
  }
  t(
    '⑳红线:已勾行被摘且未勾行真被吞(无留痕/无归档/同题不在面上)⇒ 照旧 undetermined+前提破了+零写入',
    dSw &&
      dSw.state === 'undetermined' &&
      dSw.written === 0 &&
      dSwLines === 0 &&
      dSw.undetermined.length === 1 &&
      /前提破了/.test(dSw.undetermined[0].why) &&
      /真丢失候选 1/.test(dSw.undetermined[0].why),
    ` state=${dSw?.state} written=${dSw?.written} 台账行=${dSwLines} why=${dSw?.undetermined?.[0]?.why ?? '-'}`,
  )
  // 形状锁:档②判据必须 import 三处单源,不许在本器里抄第二份指纹/主键/台账解析(§0.6/§22c)
  {
    const srcSelf = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    const locks = [
      /import\s*\{\s*extractTaskFingerprint\s*\}\s*from\s*'\.\/check-plan-task-duplicates\.mjs'/,
      /import\s*\{[^}]*\bkeyOfRow\b[^}]*\}\s*from\s*'\.\/lib\/plan-task-index\.mjs'/,
      /import\s*\{\s*declaredRows\s*\}\s*from\s*'\.\/scrub-declared-removals\.mjs'/,
    ]
    t(
      '㉑单源锁:档②的三面判据(指纹/主键/台账凭据)都从既有单源 import,本器零复算',
      locks.every((re) => re.test(srcSelf)) &&
        typeof adjudicateUnexpectedOpenRows === 'function' &&
        typeof buildSubjectPool === 'function',
      locks.map((re, i) => (re.test(srcSelf) ? '' : `缺 import #${i}`)).join(' ') ||
        `adj=${typeof adjudicateUnexpectedOpenRows} pool=${typeof buildSubjectPool}`,
    )
  }

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
  const reconcileOnly = args.includes('--reconcile')
  const dryRun = args.includes('--dry')

  // ── 留痕回捞腿:每轮**开工第一件事**(2026-10-26 立;立因与逐枚实测见函数头注)──────
  // 为什么排在所有重活前面:本器随时可能被派发层在 600s 处 SIGKILL(实测 36 枚清扫提交里 26 枚
  // 就是这样丢了留痕),而"摘了没留痕"的代价是两条回潮防线同时瞎 ⇒ 行必被带回、别的会话再领一次。
  // 认旧账这一腿若挂在重活后面,就和留痕腿一起被杀掉 —— 等于没装。
  // 写盘只在 --apply(派发档)或显式 --reconcile 时发生;裸跑/`--check` 仍是零副作用预演(契约不变)。
  if (apply || reconcileOnly) {
    const rec = reconcileDropLedgerDebt({ write: !dryRun })
    const tag =
      rec.state === 'clean'
        ? C.green
        : rec.state === 'undetermined'
          ? C.yellow
          : C.cyan
    console.log(
      `${tag}🧾 留痕回捞腿${C.reset}:扫 ${rec.scanned} 枚提交 / 台账 ${rec.ledgerEntries ?? '?'} 条(坏行 ${rec.malformed ?? 0})` +
        `/ 欠账 ${rec.debt} 枚 → ` +
        (dryRun
          ? `待补 ${rec.pending} 条(dry:只点名,不写)`
          : `已补 ${rec.written} 条`) +
        (rec.short && rec.short.length
          ? ` / 另 ${rec.short.length} 枚与题面自报枚数不符(以两面差集为准,不照自报数补)`
          : ''),
    )
    for (const u of rec.undetermined || [])
      console.error(`${C.red}❗ 无法判定 ${String(u.sha).slice(0, 12)}:${u.why}${C.reset}`)
    // 机读行前缀刻意不叫 SWEEP-RESULT:派发层按**第一条** SWEEP-RESULT 分档,
    // 这里再发一条会把本轮的三态读数顶掉(等于把"清扫做没做成"读错)。
    console.log(
      `DROP-DEBT debt-state=${rec.state} scanned=${rec.scanned} debt=${rec.debt} written=${rec.written} pending=${rec.pending} undetermined=${(rec.undetermined || []).length} harmless=${(rec.harmless || []).length}`,
    )
    if (rec.state === 'undetermined') {
      console.error(
        `${C.yellow}⏭ 未判定(留痕回捞腿):${rec.why ?? '逐枚点名见上'}${C.reset} ⇒ 本轮不清扫、不落地。` +
          `"没量到"绝不写成"补好了",也不写成"没有欠账"(§0.3)。`,
      )
      process.exit(2)
    }
    if (reconcileOnly) process.exit(dryRun && rec.pending > 0 ? 1 : 0)
  }

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
  // 落地前预探受影响判据(只读):**与落地后复跑同一实现**,判的是落地前的父提交面。
  // 用途只有一格 —— 落地器 exit≠0 时把"存量红"与"本枚带来的红"分开(见 attributePreexistingRed)。
  // 预探自身不改判据、不跳过任何门;跳过开关跟着落地器那一格走(IHUI_LAND_SKIP_AFFECTED_GATES)。
  let preProbe = null
  if (!rerunAffectedGates)
    console.log(
      `${C.yellow}⏭ 落地前受影响门预探未跑:${C.reset}lib/land-gate-rerun.mjs 取不到(净检出形态)⇒ 归因不可用,落地器 exit≠0 时照旧落 refused(不猜"存量红")`,
    )
  else if (process.env.IHUI_LAND_SKIP_AFFECTED_GATES !== '1') {
    console.log(
      `${C.cyan}🔎 落地前受影响门预探(只读;与落地后复跑同一实现 lib/land-gate-rerun,不跳过任何门)${C.reset}`,
    )
    preProbe = rerunAffectedGates({ root: ROOT, paths: [FILE] })
    console.log(
      `   预探结论:verdict=${preProbe.verdict}(0 全绿 / 1 判红 / 2 未判定)` +
        (preProbe.failed.length
          ? ` 已判红 ${preProbe.failed.length} 臂:${preProbe.failed.map((f) => f.id ?? f.kind).join(' / ')}(落地后若仍是同一批证据 ⇒ 归为存量红)`
          : ' 无判红臂'),
    )
  }
  const dir = mkScratch('ihui-strip-closed-')
  // 落地器的退出码要带出 try 块:留痕段(try 之后)要拿它决定"该怎么解释这次推进"。
  // **绝不在 try 里 process.exit**:那会让留痕与推送腿被整段跳过 —— 2026-10-24 实测
  // (02:40~06:04 八轮)落地器的 exit 1 全部来自"落地后复跑判红",而 HEAD 已推进 ⇒
  // 每一轮都成了"无凭据摘除 + 推送腿不跑",行摘了又回潮、下一轮再撞同一堵墙。
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
      LAND_MSG: sweepCommitSubject(plan.removed, part.held.length),
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
    if (landStatus !== 0)
      console.error(
        `${C.red}❌ 落地器 exit ${landStatus}${C.reset} ⇒ 先按 HEAD 是否推进取凭据(留痕/推送腿照跑),` +
          `归因(存量红 vs 本枚判红)在推送腿之后给出`,
      )
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
          (landStatus !== 0 ? ` —— 落地器 exit ${landStatus} 但 HEAD 已推进 ⇒ 按推进事实留痕` : '') +
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

  // ── 落地器 exit≠0 的归因(2026-10-24 立)──────────────────────────────────────
  // 落地器复跑的是**绝对判据**:它不区分"本枚带来的红"与"面上本来就有的存量红"。
  // 2026-10-24T02:40~06:04 八轮实测:门 130 的 F4 副本行在落地前的父提交面上同样判红、
  // 证据逐字相同,而清扫器把一枚**已经落地**(HEAD 已推进、留痕已写、推送已派发)的摘除
  // 报成 refused ⇒ 每轮都"失败",器物空转。这里只做归因,**不改任何门的判据/阈值/豁免**:
  // 归因成功 = 报告"摘除已落地 + 存量红仍在(点名)",门照旧红、提交链照旧拦。
  if (landStatus !== 0) {
    let postProbe = null
    if (advanced && rerunAffectedGates) {
      console.log(`${C.cyan}🔎 落地后受影响门复跑(归因用;与预探同一实现)${C.reset}`)
      postProbe = rerunAffectedGates({ root: ROOT, paths: [FILE] })
    }
    const attribution = attributePreexistingRed({ pre: preProbe, post: postProbe })
    if (attribution.ok) {
      const ids = attribution.preexisting.map((p) => p.id ?? p.script ?? '?').join(',')
      console.error(
        `${C.yellow}⚠️ 落地器 exit ${landStatus} 经归因为**存量红**${C.reset}:判红臂 ${ids} 在落地前同一面已判红,` +
          `落地后证据行逐行未增 ⇒ 这枚摘除未引入新判红。判据未豁免、未改,门照旧红、提交链照旧拦;` +
          `本条只纠正"这枚摘除造成了判红"的错误归因。`,
      )
      console.log(
        `${C.green}✅ 清扫完成(带存量红):摘除 ${plan.removed} 条(跳过 ${part.held.length} 条仍保护者,已逐条点名);` +
          `HEAD 现为 ${git(['rev-parse', 'HEAD']).trim().slice(0, 11)};存量红:${ids}${C.reset}`,
      )
      emitResult('stripped', {
        stale: v.stale.length,
        held: part.held.length,
        stripped: plan.removed,
        lostOnHead: part.baseLostCount,
        preexisting: ids,
      })
      process.exit(0)
    }
    console.error(
      `${C.red}❌ 落地器拒绝(exit ${landStatus})${C.reset} ⇒ 不重试、不强推,交人工看上面的点名` +
        `(归因:${attribution.why ?? '未判定'}${attribution.newArms?.length ? `;新红臂 ${attribution.newArms.map((a) => a.id ?? a.script ?? '?').join(',')}` : ''})` +
        (advanced
          ? `;本枚已在 HEAD ${git(['rev-parse', 'HEAD']).trim().slice(0, 11)},留痕与推送腿已按推进事实执行`
          : ';HEAD 未推进,本轮不写留痕'),
    )
    emitResult('refused', {
      stale: v.stale.length,
      held: part.held.length,
      stripped: 0,
      why: 'landing-rejected-' + landStatus,
    })
    process.exit(1)
  }

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
  sweepCommitSubject,
  removedRowsBetween,
  findDropLedgerDebt,
  buildSubjectPool,
  adjudicateUnexpectedOpenRows,
  reconcileDropLedgerDebt,
  DROP_LEDGER,
  SWEEP_SUBJECT_RE,
  emitResult,
  buildLineLossRuler,
  partitionStaleByProtection,
  sweepOutcome,
  redEvidence,
  attributePreexistingRed,
  FILE,
  BATCH_CAP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
