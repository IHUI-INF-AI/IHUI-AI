#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks.mjs —— PROJECT_PLAN.md 任务状态的单一查询/问责入口(2026-09-26 立)
 *
 * 存在的理由:计划文档被当台账用却没有主键约束,于是"同一件事既像已完成又像没人做"
 * 可以无限累积(实测 HEAD 面 270 个复合主键里 37 组两态并存、42 行自带作废声明)。
 * 既有防护链全部**单向防丢**(门 71 / 84 / 100 / 工作区自愈),没有一道判"状态分叉"。
 * 本 CLI 把状态从文本行里抽出来,给出可复核的三条确定性判据读数,并作为派单口径的唯一出口
 * —— `--open` 才是"真没人做"的清单,而不是 `grep '^- [ ]'`。
 *
 * 用法:
 *   node scripts/plan-tasks.mjs                  # 人读汇总
 *   node scripts/plan-tasks.mjs --open           # 真·无人认领清单(已剔除他人已认领、作废声明与分叉副本)
 *   node scripts/plan-tasks.mjs --forks          # F1 同主键两态并存
 *   node scripts/plan-tasks.mjs --void           # F2 带作废声明却未落账
 *   node scripts/plan-tasks.mjs --pointers       # F3 行号指针已腐烂
 *   node scripts/plan-tasks.mjs --open --dispatchable --conflicts
 *                                                # 派单叠层:逐行点名"这行点名的文件此刻正被他在飞改动占着"
 *   node scripts/plan-tasks.mjs --open --dispatchable --exclude-inflight
 *                                                # 同上一档的判据,但把那些行**暂移**出出单面(对方收口后自动回来;
 *                                                # 不判完成、不改勾选、"核验不了"档一律不剔)
 *                                                # 纯滞后副本(工作树 blob = 该路径某个历史版本)不算"别人在飞",
 *                                                # 不暂移 —— 懒判,只对被点名的脏路径问祖先(blobInAncestry 四态)
 *                                                # (默认档不打扰 —— 下游有按行解析这份输出的消费者)
 *   node scripts/plan-tasks.mjs --open --dispatchable --order=late
 *                                                # 时间排序档(2026-10-23 机主令"计划文档要按时间排序,
 *                                                # 以后做任务也要有先后顺序、要按时间去做"):出单按每行
 *                                                # **"最后一次被人动过"**的时刻排序,`late`=最近的在最前、
 *                                                # `early`=最陈旧的在最前。锚点是 blame∧行内日期的较新者,
 *                                                # 单源 `lib/plan-line-age.mjs`(本文件零复算,§0.6);
 *                                                # **量不到锚点的行恒排末尾并逐行点名** —— 拿"没量到"
 *                                                # 冒充"最新"或"最旧"是同一种失效的两个方向。
 *                                                # 只在显式旗标下生效:默认档行序有下游按行解析的消费者。
 *   node scripts/plan-tasks.mjs --gate [--strict] # 判据档(默认存量只报数;--strict 判红)
 *   node scripts/plan-tasks.mjs --reopened-flips --since=YYYY-MM-DD [--max-commits=N]
 *                                                 # F10 翻勾回写候选(只报数,**必须显式窗口**;见 scanReopenedFlipEvidence 头注)
 *   node scripts/plan-tasks.mjs --next-id G      # 取号出口:下一个空闲的 G- 编号(登记新条目前问一次,别手抄)
 *   node scripts/plan-tasks.mjs --json | --self-test | --staged | --worktree
 *
 * 取材面纪律(同守门 70/77/83/98/101/118):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 只作人工逃生舱;两面旗同给 ⇒ exit 2;任一面取不到 ⇒ **exit 2「无法判定」,不回落**。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { flagValue, describeFlagToken } from './lib/flag-value.mjs'
// 派单叠层要问的两件事,本仓已各有一把尺子,禁止在这里再抄一份解析:
//   · "这一行点名了哪些文件" ← 守门 184 的 `extractRefs`(只认反引号内,已剥行号/fragment/glob);
//   · "哪些文件此刻不干净"   ← 守门 54 的 `parsePorcelainZ`(`git status --porcelain -z` 记录格式)。
import { extractRefs } from './check-live-doc-references.mjs'
// 同题分组**只此一份实现**(§0.6):直接委托守门 203 的 `findDuplicateGroups`(含它自己的最小长度阈
// 与 2026-10-16 新加的「无号同题」第三类)。派单面不得另拍阈值 —— 上一版这里自己写了个 `length < 20`,
// 而 203 的阈更宽,结果"门判得出的组、清单点名不出",两份尺子的分歧正是本仓记过最多次的那一型。
import { findDuplicateGroups } from './check-plan-task-duplicates.mjs'
import { parsePorcelainZ } from './check-uncommitted-age.mjs'
// 第三件事:"这个工作树 blob 是不是该路径的某个历史版本"(纯滞后副本 vs 真在飞)——
// 唯一出口是工作区自愈的 `blobInAncestry`(与守门 84 同一把尺子,四态对象)。
// 同一件事只许一份实现:禁止在本文件再抄一份 `git log`/rev-list 式的祖先判据。
import { blobInAncestry } from './heal-worktree-tracked.mjs'
import {
  auditPlan,
  compositeKeyOf,
  dispatchSlotOf,
  dispositionOfV2,
  // F13「已勾行被捣回未勾」的判据本体(2026-10-27 补牙):主键分组与勾选态一律走该库单源
  // (compositeKeyOf / parseTaskRows / isClaimExcludedPointer),本文件零新正则、不写第二套
  // "什么算同一件事"(§0.6;守门 191 专拦复制判据)。
  findClosedToOpenRegressions,
  findReopenedFlipCandidates,
  FLIPPED_ROW_RE,
  isDeclarationRow,
  isDispatchKeptSlot,
  nextTaskIdLabel,
  ownerLabelOf,
  OWNER_EVIDENCE_COMMIT_WINDOW,
  parseTaskRows,
  usedIdsOfPrefix,
  LEDGER_TTL_DAYS,
} from './lib/plan-task-index.mjs'
// F9 定级层(什么算"真撞号")的**单一实现**:台账层只分"声明位/引用/畸形"三档,
// "已完成的题面还算不算撞号"这一层住在自己的模块里(见其头注:那一层只 import 台账既有导出、
// 不新增台账导出 —— 台账层归 b25-poolG 席,本席不碰)。
import { HISTORY_REASON, splitLiveCollisions } from './lib/plan-collision.mjs'
import { FIELDS_REL, loadFields } from './lib/plan-fields.mjs'
import { headAges } from './lib/plan-line-age.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_REL = 'PROJECT_PLAN.md'
/** F10 史证遍历的默认提交上限:实测每枚提交一次 `git show` 读 7MB blob,900 枚 ≈ 210s(Windows 进程派生占大头)。
 *  必须**显式截断并如实报出是否截断** —— 把"没扫到那么早"写成"整段历史没有"是本仓最高频失效型。 */
const F10_DEFAULT_MAX_COMMITS = 900
/** 真实形态样本钉在"首次归并的前一版"上 —— 清偿之后当前 HEAD 不再含那批行(见 selfTest 注释)。 */
const SAMPLE_REV = '0bc0af653df^'
const LABEL = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }

export function parseArgs(argv) {
  const has = (f) => argv.includes(f)
  const sel = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
  const rootFlag = flagValue(argv, '--root')
  // `--next-id G` 与 `--next-id=G` 都收;旗标在位但族名缺失/被下一条旗标吃掉 ⇒ 记成"要取号但没给族名",
  // 由 main 判用法错 exit 2(未知/残缺开关静默掉进默认分支,是本仓登记过的失效型)。
  const niIdx = argv.indexOf('--next-id')
  const niEq = argv.find((x) => x.startsWith('--next-id='))
  const nextIdRequested = niIdx >= 0 || niEq !== undefined
  let nextId = null
  if (niEq !== undefined) nextId = niEq.slice('--next-id='.length)
  else if (niIdx >= 0) {
    const v = argv[niIdx + 1]
    nextId = v !== undefined && !v.startsWith('-') ? v : ''
  }
  // F10 `--reopened-flips` 的**显式窗口**参数。窗口必须有:取证要遍历提交 diff,无窗口无法定界
  // (见 scanReopenedFlipEvidence 头注)。`--since` 与 `--max-commits` 都收等号与空格两种写法。
  const sinceEq = argv.find((x) => x.startsWith('--since='))
  const sinceFlag = flagValue(argv, '--since')
  const sinceRaw = sinceEq !== undefined ? sinceEq.slice('--since='.length) : sinceFlag.value
  const since = typeof sinceRaw === 'string' && sinceRaw !== '' ? sinceRaw : null
  // G-322(派单入口本身):旧写法 `argv[indexOf('--since')+1]` / `[...+1]` 把"被下一枚旗标顶值"读成
  // 一个普通值或 null —— `--since` 那一支侥幸还会被后面的窗口校验拦住,但报的是"你没给窗口",
  // 而调用方明明给了(只是值被吞);`--max-commits` 那一支则**静默退回默认 900**:同一道 `--reopened-flips`
  // 在不同 argv 顺序下扫深浅不同,而"⚠ 已截断"那行照样按默认上限打出来,读数看起来完全自洽。
  // 判据交单源出口(§22c),错误先收进 flagIssues,由 CLI 侧在任何输出之前统一 exit 2。
  const flagIssues = []
  if (sinceFlag.present && !sinceFlag.valid)
    flagIssues.push(
      `--since 需要一个 YYYY-MM-DD —— 紧邻的 token 实得:${describeFlagToken(sinceFlag)}(不得静默当成"没给窗口")`,
    )
  const mcEq = argv.find((x) => x.startsWith('--max-commits='))
  const mcFlag = flagValue(argv, '--max-commits')
  const mcRaw = mcEq !== undefined ? mcEq.slice('--max-commits='.length) : mcFlag.value
  if (mcFlag.present && !mcFlag.valid)
    flagIssues.push(
      `--max-commits 需要一个正整数 —— 紧邻的 token 实得:${describeFlagToken(mcFlag)}(不得静默退回默认 ${F10_DEFAULT_MAX_COMMITS})`,
    )
  if (mcEq === undefined && mcFlag.valid && !/^\d+$/.test(mcFlag.value))
    flagIssues.push(`--max-commits 必须是正整数,实得:${JSON.stringify(mcFlag.value)}`)
  if (mcEq !== undefined && !/^\d+$/.test(mcEq.slice('--max-commits='.length)))
    flagIssues.push(`--max-commits= 必须是正整数,实得:${JSON.stringify(mcEq.slice('--max-commits='.length))}`)
  const maxCommits = Number.isFinite(Number(mcRaw)) && Number(mcRaw) > 0 ? Number(mcRaw) : F10_DEFAULT_MAX_COMMITS
  // `--order` 时间排序档(2026-10-23,只在 --open 生效)。带值旗标一律走单源判据 `flagValue`
  // (G-322 那一族的正解),**必须显式给 late|early** —— 不给值 / 给了别的 ⇒ flagIssues ⇒ exit 2,
  // 绝不静默退回"不按时间排":静默退回会让"我要时间序"这次调用交出默认序的清单,而账面看起来
  // 就是一份正常派单单(顺序本身不带证据,读的人无法看出它不是按时间排的)。
  // 等号与空格两种写法都收,与 --since / --max-commits / --next-id 同口径。
  const orderEq = argv.find((x) => x.startsWith('--order='))
  const orderFlag = flagValue(argv, '--order')
  const orderRaw =
    orderEq !== undefined ? orderEq.slice('--order='.length) : orderFlag.valid ? orderFlag.value : null
  if (orderEq !== undefined || orderFlag.valid) {
    if (orderRaw !== 'late' && orderRaw !== 'early')
      flagIssues.push(
        `--order 只认 late(最近的在最前)或 early(最陈旧的在最前),实得:${JSON.stringify(orderRaw)}`,
      )
  } else if (orderFlag.present) {
    flagIssues.push(
      `--order 需要一个值(late|early)—— 紧邻的 token 实得:${describeFlagToken(orderFlag)}(不得静默退回默认序)`,
    )
  }
  const order = orderRaw === 'late' || orderRaw === 'early' ? orderRaw : null
  return {
    json: has('--json'),
    nextIdRequested,
    nextId,
    open: has('--open'),
    forks: has('--forks'),
    void: has('--void'),
    pointers: has('--pointers'),
    reopenedFlips: has('--reopened-flips'),
    since,
    flagIssues,
    maxCommits,
    gate: has('--gate'),
    strict: has('--strict'),
    stale: has('--stale'),
    undisposed: has('--undisposed'),
    dispatchable: has('--dispatchable'),
    order,
    conflicts: has('--conflicts'),
    excludeInflight: has('--exclude-inflight'),
    selfTest: has('--self-test'),
    updateBaseline: has('--update-baseline'),
    face: sel.face,
    faceError: sel.error,
    // G-322:--root 给了却没收到合法值(无值是旧 `resolve(undefined)` 裸栈、空串静默落 cwd)
    // ⇒ 记成用法错,由 main 同 faceError 的既有通道拒绝;不带 --root 行为一字不变。
    rootError: rootFlag.present && !rootFlag.valid ? `--root 需要一个目录参数 —— 紧邻的 token 实得:${describeFlagToken(rootFlag)}(不得静默退回仓库根)` : null,
    root: rootFlag.valid ? path.resolve(rootFlag.value) : ROOT,
  }
}

/**
 * ── 派单叠层:一行活点名的文件,此刻是不是正被别人握着(在飞、未入库) ──
 *
 * 立因:`--open --dispatchable` 答的是"这件事归谁、在等什么",它**不看文件**。
 * 而本机常年有数百个路径停在他席的未提交态(2026-10-09 值守现读 700+ 条 porcelain 记录),
 * 于是两件都"可做"的活一旦点名同一个文件,两个 agent 就会在同一份在飞副本上互相写回 ——
 * 这正是机主要禁掉的"打架重复做同一件任务"。本叠层不猜"谁在写",只陈述可核的事实:
 * **该行点名的路径当前不干净**(索引或工作树与 HEAD 不一致,含未跟踪新文件)。
 *
 * 三态绝不并桶:
 *  - 冲突  点名路径在 status 里 ⇒ 派单人避让,或等对方收口后再领;
 *  - 干净  路径在 HEAD 树里且不在 status ⇒ 此刻无人改动它;
 *  - 核验不了  两头都找不到 ⇒ 该行点名的路径本身不可核(拼错 / 已搬家),
 *    **既不记成"没人碰",也不据此判冲突**,逐条报名。
 * 纯函数:两个集合与惰判回调都由调用方注入,自检不碰 git(§22b 同源取向)。
 *
 * `lagJudge`(懒判回调,G-1105309):**只对本叠层真正命中的脏路径**调用,问
 * "这条脏路径的工作树 blob 是否就是该路径的某个历史版本(纯滞后副本)"。
 *  - 只对命中问,绝不对整张 dirtySet 逐条判 —— 祖先判据每条要跑一次祖先窗口取材,
 *    对全表判会把一次派单扫描从秒级拖到小时级(约束①);
 *  - 回调返回 `blobInAncestry` 的**四态对象**,本函数**逐字**比 `verdict === 'proven'`:
 *    四态对象本身恒为真值,写成 `if (res)` 会把全部命中判成滞后 ⇒ 本功能反向变成
 *    "永远不避让"(约束③,配 LG3 变异锁);
 *  - 非 `proven`(absent / beyond-window / undetermined / 判不了 / 超 cap)一律**留在
 *    "真在飞"继续让位**,并经 `judgedList` 逐条报名,绝不静默少判(约束④);
 *  - 不传 lagJudge ⇒ 判据与旧版逐字同值(所有命中都算冲突)。
 */
/**
 * 派单面的「同题副本」分组(2026-10-16 立)。指纹一律取**守门 203 那一份实现**(见上方 import 注),
 * 本器不另归一化一遍 —— 两处各算一次必然漂开,而漂开的表现不是报错,是"门报 N 组、清单一个没点名"。
 *
 * 为什么要有这一格:同一件事被登记两份时,派单清单会把两份**都**发出去(2026-10-16 实测:默认档
 * 425 行可派单里 37 组 / 99 行同题)⇒ 两个会话各读一份、各领一张票,做完还被记两遍账 —— 正是机主
 * 禁止的"agent 打架重复做同一件任务"。
 * 口径与上一格 `sameIdDone` 一致:**只点名,不剔名额、不判红**。按基号把副本剔出派单面等于替人判定
 * "这条没人要了",而"没做完的活被记成做过的"是本仓反复记过的失效型(§1 F4 同一条禁令)。
 * 最小长度阈与"什么算同题"一律由门 203 决定(本器只把行号映射回来),不在此处另拍一条。
 */
export function sameTitleDispatchGroups(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) =>
    String(r?.raw ?? '').startsWith('- [ ]'),
  )
  if (list.length < 2) return []
  const sub = findDuplicateGroups(list.map((r) => String(r.raw)).join('\n'))
  return sub
    .map((g) => ({
      fingerprint: g.fingerprint,
      members: g.members.map((mm) => {
        const src = list[mm.line - 1]
        return { line: Number(src?.line) || 0, title: String(src?.title ?? '').slice(0, 46) }
      }),
    }))
    .filter((g) => g.members.length > 1)
    .sort((a, b) => a.members[0].line - b.members[0].line)
}

export function fileConflictOverlay({ rows, dirtySet, headSet, lagJudge = null }) {
  const hasAnyUnder = (set, key) => hasPathUnder(set, key)
  const list = []
  const absentList = []
  let refsTotal = 0
  let cleanRefs = 0
  // 叠层命中的脏路径(唯一化、保持行序)—— 懒判的射程**只有**这张短名单,不是整张 dirtySet。
  const hitKeys = []
  const hitSeen = new Set()
  for (const r of rows || []) {
    const refs = extractRefs(String(r.raw || ''), 'PROJECT_PLAN.md')
    const hits = new Set()
    for (const [key, rec] of refs) {
      refsTotal += 1
      const dirty = rec.form === 'dir' ? hasAnyUnder(dirtySet, key) : dirtySet.has(key)
      if (dirty) {
        hits.add(key)
        if (!hitSeen.has(key)) {
          hitSeen.add(key)
          hitKeys.push(key)
        }
        continue
      }
      const inHead = rec.form === 'dir' ? hasAnyUnder(headSet, key) : headSet.has(key)
      if (inHead) {
        cleanRefs += 1
        continue
      }
      absentList.push({ line: r.line, key })
    }
    if (hits.size > 0) list.push({ line: r.line, paths: [...hits].sort() })
  }
  // 懒判:每条命中路径只问一次(缓存由回调自己持有也无妨,这里再兜一层去重)。
  const judged = new Map()
  if (lagJudge) {
    for (const key of hitKeys) {
      let res
      try {
        res = lagJudge(key)
      } catch (e) {
        res = { verdict: 'undetermined', reason: `惰判回调抛错:${String(e?.message ?? e).slice(0, 120)}` }
      }
      judged.set(
        key,
        res && typeof res === 'object' && typeof res.verdict === 'string'
          ? res
          : { verdict: 'undetermined', reason: '惰判回调未回带字符串 verdict 的四态对象' },
      )
    }
  }
  // 约束③:逐字比 verdict,真值域只有 'proven' 算滞后副本。绝不写成 if (res)(对象恒真)。
  const isLagging = (key) => judged.get(key)?.verdict === 'proven'
  const conflictList = []
  const releasedList = []
  for (const item of list) {
    const live = item.paths.filter((p) => !isLagging(p))
    if (live.length > 0) conflictList.push({ line: item.line, paths: live })
    else releasedList.push({ line: item.line, paths: item.paths })
  }
  let conflictRefs = 0
  for (const c of conflictList) conflictRefs += c.paths.length
  return {
    rowsTotal: (rows || []).length,
    rowsWithConflict: conflictList.length,
    refsTotal,
    cleanRefs,
    conflictRefs,
    absent: absentList.length,
    conflictList,
    absentList,
    /** 每条被惰判过的命中路径的四态读数(proven 带 commit 证据)—— 报名面,不含未命中的脏路径。 */
    judgedList: [...judged].map(([k, v]) => ({ path: k, ...v })),
    /** 脏命中全部判为滞后副本而**放回**的行(不算冲突 ⇒ --exclude-inflight 不剔它),点名哪几条路径。 */
    releasedList,
  }
}

/** 台账里点名的是**目录**时(`deploy/prod-bundle/`),脏面按"任一路径以其为前缀"命中。
 *  抽成模块级函数是因为归属证据尺(③ 脏面)与文件叠层问的是同一件事 —— 两处各写一遍必然漂。 */
function hasPathUnder(set, key) {
  if (!set || !key) return false
  const pre = key + '/'
  for (const p of set) if (p === key || p.startsWith(pre)) return true
  return false
}

/**
 * 在飞路径集合(索引/工作树与 HEAD 不一致 + 未跟踪新文件)。
 * 取不到 ⇒ 返回 null,由调用方喊"未判定" —— 把没量到写成"都没有在飞"就是替打架发合格证。
 * ⚠ 空集合在这里是**合法值**(整仓干净就会为空),因此它只能与"非 null 的 headSet"搭配解读:
 *   调用方必须先确认 HEAD 树取到了(git 可问),才能把空 status 读成"确实没有在飞"。
 * ⚠ 必须锚到 git 的 toplevel 再问:`git -C <子目录> status` 输出的是**相对该目录**的路径,
 *   拿它和台账里写的仓根相对路径比,会把全部点名读成"核验不了"(2026-10-09 在无 .git 的
 *   HEAD 抽取目录里实测到,当时读成"干净 0 / 核验不了 176",像结论而其实什么都没量到)。
 */
export function collectDirtyPaths(root) {
  const top = repoToplevel(root)
  if (!top) return null
  try {
    const raw = gitRaw(['status', '--porcelain', '-z', '--untracked-files=all'], top)
    if (typeof raw !== 'string') return null
    const set = new Set()
    for (const e of parsePorcelainZ(raw)) set.add(e.path)
    return set
  } catch {
    return null
  }
}

/** HEAD 树路径全集(用来区分"干净"与"点名的路径根本不在面上")。取不到 ⇒ null。 */
export function collectHeadPaths(root) {
  const top = repoToplevel(root)
  if (!top) return null
  let raw
  try {
    raw = gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], top)
  } catch {
    return null
  }
  if (typeof raw !== 'string') return null
  const set = new Set(raw.split('\0').filter(Boolean))
  // 空集合**不是**"HEAD 里没有文件",而是 git 不可问或问错了面 —— 正常仓的 HEAD 树必有上千条路径。
  if (set.size === 0) return null
  return set
}

/** git 的仓库根;问不到(不是仓 / git 不可用 / 输出为空)⇒ null,调用方一律落"未判定"。 */
function repoToplevel(root) {
  try {
    const out = String(gitRaw(['rev-parse', '--show-toplevel'], root) ?? '')
      .trim()
      .replace(/\r/g, '')
    return out === '' ? null : out.replace(/\\/g, '/')
  } catch {
    return null
  }
}

/** ② 的取材窗口 = 判据层那一份(§0.6:窗口只有一个出处,CLI 不复写数字)。 */
export const OWNER_EVIDENCE_COMMITS = OWNER_EVIDENCE_COMMIT_WINDOW
/**
 * 最近 N 枚提交信息(②「持有者短名出现在提交史里」的**唯一**取材出口)。
 * 取不到(不是仓 / git 不可问 / 空输出)⇒ **null**,判据据此落"未判定"。
 * 绝不返回空串冒充"最近没人提交":那会把每一枚散文标签都盖上"无证据"的章,
 * 而盖章的后果是这些行被**放回派单面** —— 拿"没量到"当"量到没有"就是给打架发合格证(§0.3)。
 */
export function readRecentCommitText(root, n = OWNER_EVIDENCE_COMMITS) {
  const top = repoToplevel(root)
  if (!top) return null
  try {
    const raw = gitRaw(['log', `-${n}`, '--format=%s%n%b'], top, { maxBuffer: 1 << 28 })
    if (typeof raw !== 'string' || raw.trim() === '') return null
    return raw
  } catch {
    return null
  }
}

/**
 * 归属证据的三条输入里需要 IO 的那两条(② 提交史 / ③ 脏面),一次装配、同面同轮。
 * 判据本体在 `lib/plan-task-index.mjs` 的 `ownershipEvidenceOf`(纯函数,输入注入),本函数只取数。
 * 任一路取不到 ⇒ 对应字段为 null,由判据落 `undetermined` 并**点名是哪一路** ——
 * 禁止在这里回落成空集合/空串(§0.3:取不到不等于量到没有)。
 */
export function ownerEvidenceFace(root) {
  const recentCommitText = readRecentCommitText(root)
  const dirtySet = collectDirtyPaths(root)
  const dirtyRefs = (line) => {
    if (!dirtySet) return null
    const refs = extractRefs(String(line ?? ''), PLAN_REL)
    const hits = []
    for (const [key, rec] of refs) {
      const dirty = rec.form === 'dir' ? hasPathUnder(dirtySet, key) : dirtySet.has(key)
      if (dirty) hits.push(key)
    }
    return hits
  }
  return {
    recentCommitText,
    dirtyRefs,
    now: new Date(),
    why:
      recentCommitText === null && dirtySet === null
        ? '最近 200 枚提交信息与 git status 脏面都取不到'
        : recentCommitText === null
          ? '最近 200 枚提交信息取不到'
          : dirtySet === null
            ? 'git status 脏面取不到'
            : null,
  }
}

/**
 * 把"点名文件当前不干净"的行**暂移**出派单面(纯函数)。
 *
 * 只吃 `conflictList` —— `absentList`(路径两头都找不到)一律保留:核验不了 ≠ 在飞,
 * 拿"没看清"去剔掉一件真活,就是"把没做的记成做过的"的反向版本(§1 同一条禁令)。
 * 也不动已勾/指针行等其它维度,这里只回答"这一行现在会不会和别人撞同一个文件"。
 */
export function excludeInflightRows(rows, cf) {
  const bad = new Set((cf?.conflictList ?? []).map((c) => c.line))
  const kept = []
  const dropped = []
  for (const r of rows || []) (bad.has(r.line) ? dropped : kept).push(r)
  return { kept, dropped }
}

/** 惰判预算:一次派单叠层最多对这么多条**命中**脏路径问祖先(每条 = 一次 hash-object + 一次祖先窗口取材)。
 *  超预算一律回 undetermined ⇒ 该路径留在"真在飞"继续让位并逐条报名 —— 宁可多让位,绝不静默少判(约束④)。
 *  上限对齐守门 84 暂存集的 MAX_FILES=300:再高会把一次派单扫描拖到分钟级,再低则常态命中都判不完。 */
export const LAG_JUDGE_CAP = 300

/**
 * 惰判回调(G-1105309):回答"这条**被叠层命中**的脏路径,工作树 blob 是否就是该路径的某个历史版本"。
 *
 * 四条硬约束逐条落在这一个出口里:
 *  ① 懒判由调用方(`fileConflictOverlay` 只对命中调用)保证,本函数只按 key 单判 + 缓存,
 *     绝不去扫整张脏表;
 *  ② 祖先判据唯一出口是 `blobInAncestry`(工作区自愈/守门 84 同一把尺子)——这里**不许**再出现
 *     任何 `git log`/`rev-list` 式的第二份实现;本函数只负责把工作树内容变成一枚 blob oid;
 *  ③ 返回值**原样保留四态对象**(proven / absent / beyond-window / undetermined),布尔化是调用方
 *     逐字比 `verdict === 'proven'` 的事 —— 对象恒为真,任何 `if (res)` 都会把全部脏路径判成滞后,
 *     功能反向变成"永远不避让";
 *  ④ 判不了(盘上不在 / 目录形态 / 超 cap / hash-object 输出不可信 / git 抛错)一律回 undetermined,
 *     即留在"真在飞"继续让位,且 reason 会被逐条报名,不静默少判;
 *  ⑤ 只判**盘上还在**的路径:暂存删除/已删路径喂 `git hash-object` 会让派生 fatal,故先 stat 再喂;
 *     `hash-object` 输出必须**恰为一行** oid,行数对不上 ⇒ 整条判取不到,绝不采信半截结果。
 */
export function makeLagJudge(root, { cap = LAG_JUDGE_CAP } = {}) {
  const top = repoToplevel(root)
  const cache = new Map()
  let spent = 0
  const und = (reason) => ({ verdict: 'undetermined', reason })
  const judge = (key) => {
    if (!top) return und('git toplevel 取不到 ⇒ 判不了,留在"真在飞"')
    let st = null
    try {
      st = statSync(path.join(top, key))
    } catch {
      st = null
    }
    // 盘上不在(暂存删除/已删)⇒ 不喂 hash-object —— 喂进去整条派生 fatal,同型停摆本仓记过。
    if (!st) return und('盘上不在(暂存删除/已删)⇒ 不喂 hash-object,留在"真在飞"')
    if (st.isDirectory()) return und('目录形态点名 ⇒ 不逐文件哈希,留在"真在飞"')
    if (spent >= cap) return und(`超出惰判预算 cap=${cap} 条 ⇒ 判不了,留在"真在飞"(逐条报名)`)
    spent += 1
    let blob
    try {
      const out = String(gitRaw(['hash-object', '--', key], top) ?? '')
      const lines = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
      if (lines.length !== 1 || !/^[0-9a-f]{40,64}$/.test(lines[0]))
        return und(`hash-object 回 ${lines.length} 行(应恰 1 行 oid)⇒ 整条判取不到,不采信半截结果`)
      blob = lines[0]
    } catch (e) {
      return und(`hash-object 失败:${String(e?.message ?? e).slice(0, 140)}`)
    }
    try {
      // 四态对象原样回传 —— 这里不做任何布尔化/改写(约束③:取值判据只在调用方逐字比 verdict)。
      return blobInAncestry(top, key, blob)
    } catch (e) {
      return und(`blobInAncestry 失败:${String(e?.message ?? e).slice(0, 140)}`)
    }
  }
  return (key) => {
    if (cache.has(key)) return cache.get(key)
    let res
    try {
      res = judge(key)
    } catch (e) {
      res = und(`惰判抛错:${String(e?.message ?? e).slice(0, 140)}`)
    }
    cache.set(key, res)
    return res
  }
}

/** 只读一条文档。整面取不到 ⇒ 抛 Undetermined(调用方转 exit 2),绝不静默换面。 */
export function readPlan(root, face) {
  if (face === 'worktree') {
    const got = readWorktreeFile(root, PLAN_REL)
    if (got === null || got === undefined)
      throw new Undetermined(`工作树(逃生舱)取不到 ${PLAN_REL}`)
    return got
  }
  const spec = face === 'staged' ? `:${PLAN_REL}` : `HEAD:${PLAN_REL}`
  const got = catBatch(root, [spec], { maxBuffer: 1 << 28 })
  // catBatch 返回 Map<rev, text|null> —— 按 rev 取,按数组下标取会恒得 undefined 并伪装成"取不到"
  const text = got.get(spec)
  if (text === null || text === undefined)
    throw new Undetermined(`${LABEL[face]} 取不到 ${PLAN_REL}`)
  return text
}

const clip = (s, n = 96) => s.replace(/\s+/g, ' ').trim().slice(0, n)

/** git 规格一律正斜杠:`FIELDS_REL` 由 `path.join` 造,在本机是 `scripts\data\…`,
 *  而 `cat-file` 的 rev 规格只认 posix 分隔符 —— 照原样送会恒判"取不到"(§12f:出路必须真跑得通)。 */
const fieldsSpecRel = () => FIELDS_REL.split(path.sep).join('/')

/**
 * 侧车与台账**同面同轮**(§0.4):全量档读 HEAD blob、`--staged` 读索引 blob、`--worktree` 读工作树。
 * 取不到 ⇒ 落 `undetermined` 并点名,既不回落另一个面、也不把"文件不存在"读成"零条记录"
 * (后者会让派单面冒"散文依赖 0 枚")。空文件才是零条记录。
 */
export function readFieldsFace(root, face) {
  const rel = fieldsSpecRel()
  let text
  try {
    if (face === 'worktree') {
      text = readWorktreeFile(root, rel)
    } else {
      const spec = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
      text = catBatch(root, [spec], { maxBuffer: 1 << 26 }).get(spec)
    }
  } catch (e) {
    return { ...loadFields(root, null), why: `侧车取材失败:${String(e?.message ?? e).split('\n')[0]}` }
  }
  if (text === null || text === undefined)
    return { ...loadFields(root, null), why: `${LABEL[face] ?? face} 取不到 ${rel}` }
  return loadFields(root, text)
}

/**
 * 派单面自报"这一轮靠什么判"(规格 §2)。`prose` 枚数就是迁移进度尺:侧车每搬进一条,
 * 这个数才少一条 —— 它必须由判据自己数,不能写成措辞(措辞会漂,数不会)。
 * 取不到侧车 ⇒ 明写未判定,绝不冒"零散文依赖"(§0.3)。
 */
export function dispositionSummary(rows, fields) {
  let fieldsN = 0
  let proseN = 0
  let conflictN = 0
  for (const r of rows) {
    const d = dispositionOfV2({ line: r.raw, fields })
    if (d.source === 'fields') fieldsN++
    else proseN++
    if (d.conflict) conflictN++
  }
  const undetermined = !!fields?.undetermined
  return {
    fields: fieldsN,
    prose: proseN,
    conflict: conflictN,
    undetermined,
    line:
      `归属判定来源:侧车 ${fieldsN} 枚 / 仍靠散文判定 ${proseN} 枚` +
      (conflictN ? ` / 两侧矛盾 ${conflictN} 枚(以侧车为准,由门报数)` : '') +
      (undetermined ? ' —— 侧车取不到 ⇒ 本轮未判定,不得读成"零散文依赖"' : ''),
  }
}

/**
 * 判定面 = 取材 + `auditPlan` + **F9 的编号位收窄**,三件事同面同轮一次做完。
 *
 * 为什么收窄必须住在这里而不是各调用点:差值棘轮拿两把面(a 与 before)比键集,基线档拿 a 的键集
 * 比台账 —— 任何一处漏收窄,那一档就仍在按"全文窗口命中"判撞号,而账面看起来是同一把尺子
 * (两处算同一件事必漂移,本仓记过多次)。取材失败照旧抛 Undetermined ⇒ 调用方 exit 2,不回落。
 */
export function auditFace(root, face) {
  const content = readPlan(root, face)
  // 侧车与台账**同面同轮**(§0.4):F11 名单吃 v2 尺(侧车优先),必须与这份 content 同一枚面。
  const a = auditPlan(content, { fields: readFieldsFace(root, face) })
  // 宽口径读数必须留在面上(只报数不判红):收窄不是"看不见",报告里必须能说"摘掉了几个标题"
  a.counts.f9WideGroups = (a.collisions ?? []).length
  // 派单面的"F1 看不见的那一型"计数(逐对清单只打人读面,不进 json 以免把整行正文带出去)
  a.counts.sameIdDonePairs = (a.sameIdDone?.pairs ?? []).length
  // F13 的**跨面**判据要吃两面的全文。两面的全文必须来自同一轮取材(§0.4 同面同轮):把这一面
  // 的全文钉在面上,锚点面就复用这个对象,绝不再开一次 `git show` —— 两次取材之间别人推进
  // HEAD,算出来的就是"别人那一半改动"的债,记在本次提交头上(§12e 同族)。
  a.__contentText = content
  return narrowF9Face(a, content)
}

/**
 * 用 git 历史把"到期"这一维从**只有行内日期**升级成**行内日期 ∧ blame 较新者**。
 *
 * 为什么必须补这一步:索引层只看行内日期 ⇒ HEAD 面 308 条未勾选行里有 127 条一个日期都没有,
 * 这批账在旧口径下**永远隐形**(判据恒绿不是因为它们不老,而是量不到)。而"给这 127 行补日期"
 * 等于和全部并发会话抢同一份活文档,所以年龄改问仓库(见 `lib/plan-line-age.mjs` 头注)。
 *
 * 只在**全量档(HEAD)**跑:一次 blame ≈ 9s,而 runner 给提交链传的是 `--staged` ——
 * 索引面里本次新写的行本来就没有历史,一律按"刚出生"处理(把"没有历史"读成"很老"是反向失效)。
 */
/**
 * 同步版:年龄来自 `lib/plan-line-age.mjs`(内部是 `execFileSync` 的一次 blame,≈9s 全文件)。
 * 静态 import 而非动态 —— 动态 import 会把 main() 变成 async,而 §22d 的入口守卫与
 * 现有调用面都按"main 同步返回退出码"写;为一次派生改入口形态不值当。
 */
function enrichStale(a, root) {
  const { ages } = headAges(root)
  const byLine = new Map(ages.map((x) => [x.line, x]))
  // 全量锚点留给时间排序档用(--order)。**一次 blame 供两个消费者**:headAges 内部是全文件
  // blame(真仓 ≈9s),为排序再派一次等于把一次派单扫描的耗时翻倍,而两处的锚点必须同瞬间
  // (分开取 ⇒ 两次 blame 之间别人提交 ⇒ 到期读数与出单顺序来自不同瞬间的仓库,对不上账)。
  a.ageByLine = byLine
  const stale = []
  let unmeasurable = 0
  // 重新按同一 TTL 过一遍全部未勾选行(锚点换成 blame ∧ 行内日期)
  for (const [line, x] of byLine) {
    if (x.ageDays === null) {
      unmeasurable++
      continue
    }
    if (x.ageDays > LEDGER_TTL_DAYS)
      stale.push({
        line,
        raw: x.raw,
        anchor: new Date(x.anchorTs).toISOString().slice(0, 10),
        age: x.ageDays,
        source: x.source,
      })
  }
  stale.sort((p, q) => q.age - p.age)
  a.staleRows = stale
  a.counts.stale = stale.length
  a.counts.ageUnmeasurable = unmeasurable
  a.counts.ageCovered = byLine.size
  return a
}

/**
 * 时间排序档 —— 把出单顺序交给"这一行最后一次被人动过"的时刻(2026-10-23 立,机主令
 * 「计划文档要按时间排序,以后做任务也要有先后顺序、要按时间去做」)。
 *
 * 为什么排**工具面**而不是把 PROJECT_PLAN.md 物理重排:现读台账 29034 行 / 611 个标题,
 * 主体是批次编年史(一个标题下挂着同一任务的 ①②③ 子项族,§1 明令机械拆散是净损失),
 * 而它由多会话并发 append + 行级 union 归并 —— 一次全文件移动会让 merge-live-doc 的行锚点
 * 配对大面积失配(本仓「改锚点的行会被报成丢行」记过多次),且下一批登记当场把它洗回无序。
 * 顺序要成为口径,必须住在派单入口里,而不是住在一份会腐烂的文件排版里。
 *
 * 三条判据(纯函数:rows 与锚点表都由调用方注入,自检不碰 git):
 *  1. 锚点只问 `lib/plan-line-age.mjs`(blame∧行内日期较新者),本层零复算(§0.6);
 *  2. **量不到锚点的行恒排末尾,两种 mode 都一样** —— 按 mode 把它排到头部等于拿"没量到"
 *     冒充"最新"(§0.3「没判绝不写成判过」在排序维的同型:不得替它编一个位置);
 *  3. 同锚点 / 同无锚点 ⇒ 回退行号升序 ⇒ 输出确定。不稳定排序会让两次调用给出两种顺序,
 *     下游按行 diff 会把顺序抖动读成内容变化。
 */
export function orderRowsByTime(rows, ageByLine, mode) {
  if (mode !== 'late' && mode !== 'early')
    throw new Error(`orderRowsByTime: mode 只认 late|early,实得 ${JSON.stringify(mode)}`)
  const tsOf = (r) => {
    const t = ageByLine?.get(r.line)?.anchorTs
    return typeof t === 'number' ? t : null
  }
  const anchored = []
  const unanchored = []
  for (const r of rows) (tsOf(r) === null ? unanchored : anchored).push(r)
  anchored.sort((p, q) => {
    const d = mode === 'late' ? tsOf(q) - tsOf(p) : tsOf(p) - tsOf(q)
    return d !== 0 ? d : p.line - q.line
  })
  unanchored.sort((p, q) => p.line - q.line)
  return { rows: [...anchored, ...unanchored], unanchored, anchoredCount: anchored.length }
}

/**
 * F10「翻勾回写候选」的**史证取证**:遍历 git 历史里**新增过** `- [x] ✅(日期)…` 行的提交 diff。
 *
 * 为什么要**显式窗口 + 上限**(票面定级:单次取证 > 60s ⇒ 只做"显式窗口/显式提交范围"档):
 * 本仓台账提交量极大(现读近 30 天 **4468** 枚触及 PROJECT_PLAN.md),而每枚都要
 * `git show --unified=0` 读一遍 7MB blob ⇒ 实测 900 枚 ≈ 210s(Windows 进程派生占大头)。
 * 全窗口遍历单次远 > 60s、且它要进的是 post-commit 链 ⇒ 结构上不能压在默认档上。
 * 故本档**必须**由调用方给 `--since` 定界、在 `--max-commits` 处截断,并**如实报出是否截断**。
 *
 * 结论面与扫描面**同一瞬间**取:调用方先 `rev-parse HEAD` 钉住 sha,再用 `<sha>:PROJECT_PLAN.md`
 * 取结论面(不得先扫历史、再另开一次 HEAD —— 那之间别人的 post-commit 自愈层会把勾带回来,
 * 报出来的候选早已不存在;本仓"消红前先复测"同型)。
 *
 * @param root 仓根
 * @param since `git log --since` 的窗口起点(YYYY-MM-DD)
 * @param maxCommits 只扫最新的 N 枚(超出截断,读数里报出)
 * @param headSha 钉住的 HEAD sha(扫描面与结论面必须同一枚)
 * @param shas 可选:调用方预筛的提交清单(2026-10-24,清扫器消费前置)。传入时**跳过本函数的
 *   log 枚举**,直接逐枚取 diff 提取 —— 枚举策略(pickaxe 预筛/增量区间)是调用方的事,
 *   "怎么从一枚 diff 里剥出翻勾行"只许这一份实现(§0.6)。空数组 ⇒ 回落默认枚举。
 * @returns {{flipped:Array<{raw:string,sha:string,day:?string}>, commits:number}}
 */
export function scanReopenedFlipEvidence(root, { since, maxCommits, headSha, shas }) {
  const list = (
    Array.isArray(shas) && shas.length
      ? shas
      : gitRaw(['log', headSha, `--since=${since}`, '--format=%H', '--', PLAN_REL], root)
          .split(/\r?\n/)
          .filter(Boolean)
  ).slice(0, maxCommits)
  const flipped = []
  for (const sha of list) {
    let diff = ''
    try {
      diff = gitRaw(['show', '--format=', '--unified=0', sha, '--', PLAN_REL], root, {
        maxBuffer: 512 << 20,
      })
    } catch {
      // 单枚取不到 ⇒ 跳过,靠调用方报出的"扫了几枚"暴露(不静默当作"这枚没翻过")
      continue
    }
    for (const line of diff.split(/\r?\n/)) {
      if (line[0] !== '+' || line.startsWith('+++')) continue
      const raw = line.slice(1)
      if (!FLIPPED_ROW_RE.test(raw)) continue
      const d = /✅\((\d{4}-\d{2}-\d{2})\)/.exec(raw)
      flipped.push({ raw, sha: sha.slice(0, 11), day: d ? d[1] : null })
    }
  }
  return { flipped, commits: list.length }
}

function report(a, face) {
  const c = a.counts
  console.log(`判定面:${LABEL[face]}`)
  console.log(`条目行 ${a.rows}(未勾选 ${c.open} / 已完成 ${a.doneRows}),其中带租约 ${c.claimed}`)
  console.log(`复合主键 ${a.composites} 组`)
  console.log(`  F1 同主键两态并存 : ${c.forks} 组 / 涉及未勾选行 ${c.forkOpenLines}`)
  console.log(`  F2 带作废声明未落账: ${c.voidRows} 行`)
  console.log(`  F3 行号指针        : ${c.rotatedPointers} 处 —— 其中可自动收口 ${c.rotatedAuto} 处、无出口交人工 ${c.rotatedNoExit} 处`)
  console.log(
    `  F4 同一件事多条待办: ${c.dupOpenGroups} 组 / 副本 ${c.dupOpenCopies} 行(不进派单口径)`,
  )
  console.log(
    `  F4b 无主键的逐字孪生待办: ${c.verbatimDupGroups} 组 / 副本 ${c.verbatimDupCopies} 行(不进派单口径)` +
      ` —— F4 按复合主键分组,而叙述式待办没有编号,所以这一族在 F4 里恒为 0 而账面照样一人两句`,
  )
  console.log(
    `  F6 整块登记重复(块级,行级四条判不到这一维): ${c.dupBlocks} 块 / 共 ${c.dupBlockCopies} 份` +
      ` —— 逐字相同才可自动收口;另有 ${c.dupBlockDrifted} 块首行相同而正文漂移(必须人工判哪份作数)`,
  )
  // ── F4c:头注承诺"只报数**并逐条点名**",而这一档此前只有 counts 两个整数、点名出口是空的 ──
  // ⚠ 病根:lib 侧算出了 `a.prefixNested`(pairs 带 key/short/long/state),`plan-tasks.mjs` 里
  //   `prefixNested` 出现 0 次、`--json` 顶层 12 个键也没有它 ⇒ 478 对只剩两个数字,
  //   "报数"退化成"报一个没人能定位的数"。本仓"报数不报名"记过多次(守门 70/76/81/128 同族)。
  // 为什么这一档**不判红**:存量现读 179 组,接 blocking = 与任何提交无关的恒红门(§12e/§12f)。
  // 人读文案走 `f4cHumanLine`(唯一出口,否则 selfTest 够不着 ⇒ slice 阈值被改坏全绿放过)。
  console.log(f4cHumanLine(a.prefixNested, c))
  console.log(
    `  F9 撞号(只认**声明位**:同一编号的声明位挂多个不同标题): ${c.collisionGroups} 组` +
      ` —— F1/F4 的键是"编号+标题逐字等值",抓不到"两个不同任务抢同一个号";存量绝大多数是子项命名惯例,` +
      `只报数,差值棘轮只拦新增撞号组(逐组看 --json)。宽口径(窗口内任意命中)${c.f9WideGroups ?? c.collisionGroups} 组,` +
      `其中 ${(c.f9WideGroups ?? 0) - c.collisionGroups} 组整组是行文引用/畸形号子串造成的伪组(不是第二次登记),` +
      `已按 G-417 收窄、自 G-460 起分组输入根本不造它们`,
  )
  console.log(`  同态重复(done 侧只报数): done ${c.dupDoneGroups} 组`)
  // ── F9 定级档:降为只报数的组必须报名 ──────────────────────────────────────
  const f9Settled = a.f9Settled ?? []
  const f9Total = c.f9SettledGroups ?? f9Settled.length
  // 成因拆分只在**量到了**的时候印(`?? 0` 会把"没带这个字段"印成"整组已完成 0 组"= 替人下结论)。
  const f9Breakdown =
    typeof c.f9SettledAllDone === 'number'
      ? ` —— 其中整组都已完成 ${c.f9SettledAllDone} 组 / 只剩一个活题面 ${f9Total - c.f9SettledAllDone} 组`
      : ''
  console.log(
    `  F9 已完成历史行(降为只报数、永不判红): ${f9Total} 组` +
      f9Breakdown +
      (f9Settled.length
        ? ` —— ${f9Settled.slice(0, 6).map(f9GroupLine).join(' / ')}` +
          (f9Settled.length > 6 ? ` (另 ${f9Settled.length - 6} 组见 --json 的 settled)` : '') +
          ` —— 判据按**活题面数**判:一个题面名下还有一行未勾选就算活(G-455:已完成行改不掉,拿它判红即恒红门)`
        : ' —— 本面没有"活题面 <2"的撞号组(这一句是"量到了 0",不是"没量")'),
  )
  // ── F9 另外两档:被从判据里挪出来的东西必须**报名**,否则"挪到报数档"与"没人看过"同形 ──
  const f9Refs = a.f9References ?? []
  console.log(
    `  F9 引用图(别人的正文里点了我的号 ⇒ 只报数、永不判红): ${c.f9ReferenceIds ?? f9Refs.length} 个编号 / ${c.f9NonIdTitles ?? 0} 处非声明位标题` +
      (f9Refs.length
        ? ` —— 逐条:${f9Refs.slice(0, 6).map(f9ReferenceLine).join(' / ')}` +
          (f9Refs.length > 6 ? ` (另 ${f9Refs.length - 6} 个编号见 --json 的 references)` : '')
        : ' —— 本面没有非声明位命中(这一句是"量到了 0",不是"没量")'),
  )
  const f9Mal = a.f9MalformedMasquerade ?? []
  console.log(
    `  F9 畸形号挂到正常号(前缀重复那族,单独点名、不与正常号同组): ${c.f9MalformedMasqueradeIds ?? f9Mal.length} 个编号` +
      (f9Mal.length
        ? ` —— ${f9Mal.slice(0, 6).map((m) => m.key).join(' / ')}` +
          (f9Mal.length > 6 ? ` (另 ${f9Mal.length - 6} 个见 --json 的 malformedMasquerade)` : '') +
          `;逐行原文与修复出口见 F9b(counts.malformedIds)`
        : ''),
  )
  // ── F10 翻勾回写候选(守门 130 维度落地的**报数档**)──
  // 只报数、**永不判红**,两条结构性理由:① 它是**瞬时**读数(post-commit 自愈层会把勾带回来),
  // 接 blocking = 与任何提交无关的恒红门(§12e);② 取证要遍历提交 diff,实测 900 枚 ≈ 210s
  // ⇒ 结构上不能压在默认档上。所以默认档**只印"没扫"**——把"没量"与"量到 0"分开(本仓最高频失效型)。
  console.log(
    `  F10 翻勾回写候选(只报数、永不判红): ` +
      (typeof c.reopenedFlips === 'number'
        ? `${c.reopenedFlips} 个(其中未判定 ${c.reopenedFlipUndetermined} 个 / 史证主键 ${c.reopenedFlipSweptKeys} 个 / 扫 ${c.reopenedFlipCommits} 枚提交${c.reopenedFlipCapped ? ',已截断' : ''})`
        : '未扫描 —— 取证要遍历提交 diff,须显式跑 `--reopened-flips --since=<日期>`(见该旗标头注)'),
  )
  // ── F13 已勾行被捣回未勾(2026-10-27 补牙)──
  // 三条读数必须分行:F1 是"组内两态并存"的**面内**读数,本维是"锚点面已勾 ∧ 被审面未勾"的
  // **跨面**读数;而"枚举到 0 候选"与"没量到"是两种结论(§0.3)—— 所以未判定时把原因印出来,
  // 绝不让这一行退化成"0 = 干净"。
  {
    const hits = a.f13Hits ?? []
    const stock = new Set(a.f13StockKeys ?? [])
    const newHits = hits.filter((h) => !stock.has(h.key))
    console.log(
      `  F13 已勾行被捣回未勾(跨面对账:锚点面已勾 ∧ 被审面未勾): 命中 ${hits.length} 枚` +
        ` / 其中锚点面自身存量 ${newHits.length === hits.length ? 0 : hits.length - newHits.length} 枚(只报数)` +
        ` / 本次带回 ${newHits.length} 枚(差值棘轮只判这一档)` +
        ` —— 锚点面已勾主键 ${c.f13AnchorDoneKeys ?? '未判定'} 枚 / 锚点面条目行 ${c.f13AnchorRows ?? '未判定'} / 被审面条目行 ${c.f13FaceRows ?? '未判定'}` +
        (a.f13CrossNotMeaningful
          ? ' —— 本档两面同源(全量档),跨面差集结构上算不出"本次新增",只报存量'
          : '') +
        (a.f13Unjudged ? ` —— ⚠ 未判定:${a.f13Unjudged}` : ''),
    )
    for (const h of newHits.slice(0, 6)) console.log(`     ${f13HitLine(h)}`)
    if (newHits.length > 6)
      console.log(`     … 其余 ${newHits.length - 6} 枚见 --json 的 f13Hits`)
  }
  console.log(`派单口径 —— 真·无人认领: ${c.claimable} 行`)
  console.log(
    `  分解(逐层互斥,可直接相加):未勾选 ${c.open} = 已认领 ${c.claimed} + 其余排除 ${c.unclaimed - c.claimable} + 真待办 ${c.claimable}`,
  )
  console.log(
    `  其余排除项**明细**(同一行可同时命中多项,故只能当诊断看、不得拿去减法核账):` +
      `同题已完成副本 ${c.forkOpenLines} / 自带作废声明 ${c.voidRows} / 当次算出的同题待办副本 ${c.dupOpenCopies} / 无主键逐字孪生副本 ${c.verbatimDupCopies} / 已标副本指针 ${c.dupPointerRows}`,
  )
  // ── F7 归属分层(未认领口径)──
  // 这一层答的是"这 198 条里有多少**现在就能做**"。不踢出派单口径,只报名 ——
  // 正则推错一条的代价是一件真活从此没人看得见,那比虚高的数字更难发现。
  console.log(
    `归属分层(未认领 ${c.unclaimed} 行按正文推导,逐桶互斥可相加):` +
      `现在可做 ${c.dispActionable} / 等人拍板 ${c.dispWaitingHuman} / 等条件 ${c.dispWaitingEnv} / 归他人 ${c.dispOwnedElsewhere}`,
  )
  // ── F7b 同一分层的**派单口径**读数(G-1058610 病①)──
  // 上面那行的基数混着两千多行"已标副本指针/当次算出的同题副本",所以它的"等人拍板"是**行数**
  // 而不是**事项数**(实测 70 行 → 20 个独立事项)。派单/提问一律看下面这行,它已扣副本。
  console.log(
    `  └ 同一分层按**派单口径**重算(基数 ${c.claimable} 行,已扣同题副本/作废/分叉;分桶尺=v2 侧车优先、无侧车回落散文,与 --dispatchable 过滤同尺):` +
      `现在可做 ${c.dispClaimActionable} / 等人拍板 ${c.dispClaimWaitingHuman} / 等条件 ${c.dispClaimWaitingEnv} / 归他人 ${c.dispClaimOwnedElsewhere}` +
      ` [散文影子 可做 ${c.dispClaimActionableProse}/归他人 ${c.dispClaimOwnedElsewhereProse} —— 与正读数之差=侧车迁移进度,派单不得消费影子]` +
      ` —— 两行不得互相顶结论:上行答"账面有几行挂着",下行答"真有几件事"`,
  )
  if (c.dispWaitingHuman > 0 || c.dispClaimWaitingHuman > 0)
    console.log(
      '  ⚠ 等人拍板桶非空 = 违反 2026-10-23 机主强制令(待拍板条目一律禁止,agent 代裁代执行,见 AGENTS §1;提交链由守门 130 F11 差值棘轮拦新增)',
    )
  if (c.dispWaitingEnv > 0 || c.dispClaimWaitingEnv > 0)
    console.log(
      '  ⚠ 等条件桶非空 = 违反 2026-10-25 机主令(等条件条目与待拍板同型禁止:当场做 / 改归机主动作面 / 观察类结清,见 AGENTS §1;提交链由守门 130 F12 差值棘轮拦新增)',
    )
  // ── F8 寿命 ──
  console.log(
    `账的交代:无交代 ${c.undisposed} 行(其中 ${c.undated} 行连日期都没有 = 只看行内日期时判不到龄)` +
      ` / 超 ${LEDGER_TTL_DAYS} 天无进展 ${c.stale} 行`,
  )
  if (c.ageSource)
    console.log(
      `  年龄来源:${c.ageSource}` +
        (c.ageCovered ? `(量到 ${c.ageCovered} 行 / 量不到 ${c.ageUnmeasurable} 行)` : ''),
    )
  if (typeof c.newUndisposed === 'number')
    console.log(`  本次提交新带入且无交代: ${c.newUndisposed} 行(F8a,差值档才判红)`)
  else
    console.log('  本次提交新带入且无交代: **未判定**(无基准面 —— 全量档算不出"新增",不得当作 0)')
}

function listRows(rows, face, ages = null) {
  console.log(`── ${rows.length} 行(判定面:${LABEL[face]})──`)
  // ages 传入时(时间排序档)逐行带上锚点,让"按时间排"这件事在出单面上可核;
  // 不传时输出与旧档**逐字节相同** —— 下游有按行解析这份输出的消费者,默认档格式不许动。
  for (const r of rows) {
    if (!ages) {
      console.log(`  L${r.line}  ${clip(r.raw)}`)
      continue
    }
    const ts = ages.get(r.line)?.anchorTs
    const anchor =
      typeof ts === 'number' ? new Date(ts).toISOString().slice(0, 16).replace('T', ' ') : '锚点未判定'
    console.log(`  L${r.line}  ${anchor}  ${clip(r.raw)}`)
  }
}

/**
 * 判据档。三层强度,各守不同的失效面:
 *  1. **差值棘轮(本门的主判据)**:`--staged` 档把**索引面**与 **HEAD 面**同轮各算一次,
 *     只在"本次提交让某一项变多"时判红。为什么必须是差值而不是绝对值:runner 会给每道门
 *     追加 `--staged`,而存量(F1/F2/F3)本来就非零 —— 拿绝对量判红等于把别人已入库的债
 *     钉在无关提交上,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e 同型)。
 *     差值判据还有一条好处:**不需要维护会腐烂的基线台账**才能成立。
 *  2. **基线棘轮**(可选,`scripts/plan-task-state-baseline.json` 在位时):防"有人跳门把增长
 *     塞进 HEAD" —— 那一型差值判据看不见(索引面与 HEAD 面同时变大)。基线只许人工下调。
 *  3. **`--strict`**:存量一律判红,给人工清偿与 CI 问责。默认档只报数。
 */
const BASELINE_REL = 'scripts/plan-task-state-baseline.json'

/**
 * F8a —— **本次提交新带入**且没有任何交代的登记行。
 *
 * 为什么只能判"新增":存量 308 条未勾选行里 182 条连日期都没有,上线当天把它们集体判红
 * 就是一台与任何提交都无关的恒红门,唯一结局是各会话 `--no-verify`、连带全部守门作废(§12e)。
 * 差值棘轮因此是这一维唯一的正确量纲:基准面里没有这一行 ⇒ 它是这次写进来的 ⇒ 必须交代。
 *
 * "交代"三选一:已认领(租约)/ 落在非 actionable 归属桶(说清了等什么、归谁)/ 有可算日期。
 * @param now 当前判定面的 auditPlan 结果
 * @param before 基准面(HEAD)的 auditPlan 结果;取不到 ⇒ 返回 0,调用方必须如实喊"未判定"
 */
export function countNewUndisposed(now, before) {
  if (!before?.rowTexts) return 0
  return now.undisposed.filter((r) => !before.rowTexts.has(r.raw)).length
}

/** 前五条判据的读数(只判变多),按同一顺序成对比较;F5 方向相反,单独在 grewViolations / gate 里判。
 *  导出理由:同一份维度清单还被 `git-sync-converge` 的合并落地闸用(它拿基线核合并结果),
 *  在别处再抄一遍 `['F1', ...]` 就是第二个真相 —— 加一维时漏抄一处,那一维就静默不判。 */
export const probe = (a) => [
  ['F1', '同主键两态并存(组)', a.counts.forks],
  ['F2', '带作废声明未落账(行)', a.counts.voidRows],
  ['F3', '行号指针可自动收口(处)', a.counts.rotatedAuto],
  ['F4', '同一件事多条待办(副本行)', a.counts.dupOpenCopies],
  // F4b:F4 的分组键是复合主键,而"叙述式待办"永远没有编号 ⇒ 同一句话被复制两遍时 F4 报 0。
  // 单独一维而不是并进 F4:并进 F4 会让"两处各计一次债"的锚点互相顶掉(守门 134 扩布尔档键那一课)。
  ['F4b', '无主键的逐字孪生待办(副本行)', a.counts.verbatimDupCopies],
  // F6 是**块**级量纲:一整块多行登记被追加两遍时,行级四条(F1–F4)一路通过 ——
  // 每一行看起来都"只是又一个孪生行"。本仓 2026-09-26 真实自伤过三次(2 份 → 3 份)。
  ['F6', '整块登记重复(块)', a.counts.dupBlocks],
  // F8 只在**差值档**有意义(本次提交新带入的无交代登记行)。基线里刻意不写这一项:
  // 全量档它恒为 0,写成基线 0 就等于宣称"存量已清零",而存量并没有 —— 那是替人做判断。
  ['F8', '新增登记无交代(行)', a.counts.newUndisposed ?? 0],
  // F9 撞号(2026-09-27 G-267):同编号不同标题前缀 >1 的组数。存量非零且绝大多数是子项命名惯例
  // (见 lib findIdCollisions 头注),所以它**只进差值/基线棘轮**(只拦新增撞号组),
  // gate() 里 --strict 也不判它的红 —— 判存量红就是与任何提交无关的恒红门(§12e)。
  ['F9', '撞号:同编号挂多个不同标题(组)', a.counts.collisionGroups ?? 0],
  // F11 等人拍板(2026-10-23 机主强制令):与 F8 同理**只在差值档有意义**(全量档 newWaitingHuman
  // 算不出 ⇒ 兜 0,基线里写 0 就是替人宣称存量已清)。绝对层由 F11 键集基线单独看守,见 f11Ratchet。
  ['F11', '新增等人拍板未勾行(行)', a.counts.newWaitingHuman ?? 0],
  // F12 等条件(2026-10-25 机主令,与 F11 同型):只在差值档有意义,绝对层由 F12 键集基线看守。
  ['F12', '新增等条件未勾行(行)', a.counts.newWaitingEnv ?? 0],
  // F13 已勾行被捣回未勾(2026-10-27 立,主席 16:30 实测补牙):某席把工作树/索引里那份滞后副本
  // 交进提交时,同一件事从"已完成"变回"待办",而 F1/F4/F4b/F6 全在**一面之内**数数 ⇒ 那一型
  // 结构性失明(现读实测四档全 0、差值棘轮全绿)。量纲 = 复合主键枚数,跨面判据本体在 lib。
  // 锚点 = 同一把尺子跑在**锚点面自身**(HEAD 面自己的两态并存存量)⇒ 存量只报数、只有本次
  // 带进来的回退判红(§0.2/§12e:存量没归零就上绝对零容忍 = 恒红门,唯一结局是逼人 --no-verify)。
  // 基线 JSON 刻意**不写 F13 键**(缺项不判 = ratchetViolations 既有善意):回退一旦进 HEAD,
  // 该主键的 done 份就从所有后续面上消失,基线键集锚结构上守不住它 —— 拦点只能在链上。
  ['F13', '已勾行被捣回未勾(主键枚)', a.counts.f13Regressed ?? 0],
  // 自 2026-09-28 G-312:基线里 F9 存的是**排序后的键集**而不是组数 —— 判红只认"基线里没有的键",
  // 所以"等量换掉一组撞号键"也红(计数锚点在这一型上恒绿),而同键再多挂一行不移动读数。
  // 镜像 M9 要求每一维都必须有基线键:缺项 = 那一维静默不判,而账面看不出来。
]

/** F9 差值明细:相对基准面**新出现**的撞号组(组数上涨 ⇔ 新组;给已撞号组再加标题不改组数,
 *  那一型由取号出口在登记那一刻拦,见 lib usedIdsOfPrefix 头注)。
 *  没有基准面 ⇒ **不判**(返回空)而不是"全部算新增" —— 与 countNewUndisposed 同一条禁令:
 *  把"没判"写成"判过了且有问题"会造出与提交无关的恒红门(§12e)。 */
export function newCollisionGroups(now, before) {
  if (!before?.collisions) return []
  const prev = new Set(before.collisions.map((g) => g.key))
  return (now?.collisions ?? []).filter((g) => !prev.has(g.key))
}

/**
 * F9 基线锚点的**形状** = 排序去重的撞号键数组(2026-09-27 G-312;此前是一个整数计数)。
 *
 * 为什么不是计数:计数锚点下的"红"只会说"变多了",说不出是哪几组。差值档手里有两把同轮
 * 读数所以能点名(`newCollisionGroups`),基线档只拿到一个数 —— 于是"别人跳门把增长塞进 HEAD"
 * 那一型虽然拦得住,被拦的人却拿不到可执行名单(G-312 立项起因:HEAD 面 59→71 红了一整晚,
 * 而这 12 组增长要逐组判"哪侧是后来者"、且明令不得批量改号 ⇒ 当天的红给不出出口)。
 * 与守门 134"锚点粒度不够细 ⇒ 换个写法就净零逃逸"同族:键集还额外抓住**等量换键**
 * (清掉一组 + 新撞一组 ⇒ 组数不变而键集变),计数锚对那一型恒绿。
 * @param a auditPlan 结果,或任何带 `collisions: [{key}]` 的构造面
 */
export function f9KeySetOf(a) {
  return [
    ...new Set(
      (a?.collisions ?? []).map((g) => g.key).filter((k) => typeof k === 'string' && k !== ''),
    ),
  ].sort()
}

/**
 * F9 基线层的纯函数判据。**结论分态,绝不并桶**(把"没看清"写成"有问题"或写成"没问题",
 * 都是本仓最高频的失效型):
 *  - `absent`     基线不存在 / 没有 F9 键 ⇒ 不判该项(与 `ratchetViolations` 同一条"缺项不判"善意)
 *  - `unmigrated` F9 仍是旧形状(整数,或数组里混进非字符串)⇒ **不得静默放行**:那一维等于关着
 *  - `blind`      有撞号组数却拿不到逐组明细 ⇒ 判"未判定",不冒红也不记绿
 *  - `ok` / `red` 键集对账:只有"出现基线里没有的键"才红 —— 同键再多挂一行不移动读数
 */
export function f9Ratchet(base, a) {
  if (!base || !Object.hasOwn(base, 'F9')) return { kind: 'absent', added: [] }
  const v = base.F9
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x === ''))
    return {
      kind: 'unmigrated',
      added: [],
      message: `基线 F9 不是"排序后的键数组"形状(实测 ${JSON.stringify(v ?? null).slice(0, 60)})`,
    }
  if ((a?.counts?.collisionGroups ?? 0) > 0 && !Array.isArray(a?.collisions))
    return {
      kind: 'blind',
      added: [],
      message: '判定面给了撞号组数却没带逐组明细 ⇒ 键集无从对账(不记为通过)',
    }
  const prev = new Set(v)
  const added = f9KeySetOf(a).filter((k) => !prev.has(k))
  return { kind: added.length ? 'red' : 'ok', added }
}

/**
 * F9 逐组点名的**唯一**文案出口(差值档与基线档共用一份)。
 * 两处各写一遍必然漂移(本仓"两处算同一件事必漂移"记过多次)。
 * ⚠ 证据文本只给「编号 + 各标题」—— 行号在任何一次 append 后都会挪位,§1 明令它不得当判据、
 *   也不得写进证据文本(旧版在这里印 `@L…`,于是每条红都自带一句下一轮就失效的话;定位需要时
 *   读 `--json` 的 `collisions[].titles[].lines`,那是机器字段而不是证据)。
 */
export function f9GroupLine(g) {
  return (
    `编号 ${g.key} 被 ${g.titleCount} 个不同标题共用 —— ` +
    `${(g.titles ?? []).map((t) => `「${t.title}」`).join(' / ')}`
  )
}

/**
 * F11 —— **等人拍板未勾行一律禁止**(2026-10-23 机主强制令,AGENTS §1)。
 *
 * 病型:F8a 把"落在等待桶"当作**正当交代**之一,而强制令之后 waiting-human 不再是交代、
 * 是违禁状态本身 —— 所以必须单独一维,而不是给 F8 的判据加豁免(§12f:不得为消红改判据)。
 * 量纲与 F9 同型:差值档只判"本次新带入"(存量 19 行不随任何提交移动,判存量红=恒红门,§12e);
 * 绝对层由基线**键集**看守"跳门把增长塞进 HEAD"那一型。清偿之后基线 F11=[] 即永久地板
 * ——禁令没有"下一批再放一点"的档。
 * 键 = 复合主键;无主键的行退回**逐字原文**(与 F8a 同口径:行一改写即视为新增,逼作者交代)。
 */
export function f11KeyOf(r) {
  return compositeKeyOf(r.raw) ?? r.raw
}
export function f11KeySetOf(a) {
  return [...new Set((a?.waitingHumanRows ?? []).map(f11KeyOf))].sort()
}
/** 差值档:相对基准面**新出现**的等人拍板未勾行。没有基准面 ⇒ **不判**(返回空),
 *  与 countNewUndisposed/newCollisionGroups 同一条禁令:把"没判"写成"判过了且有问题"会造恒红门。 */
export function newWaitingHumanRows(now, before) {
  if (!before?.waitingHumanRows) return []
  const prev = new Set(before.waitingHumanRows.map(f11KeyOf))
  return (now?.waitingHumanRows ?? []).filter((r) => !prev.has(f11KeyOf(r)))
}
/** F11 基线层纯函数判据,分态绝不并桶(与 f9Ratchet 同一套形状纪律)。 */
export function f11Ratchet(base, a) {
  if (!base || !Object.hasOwn(base, 'F11')) return { kind: 'absent', added: [] }
  const v = base.F11
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x === ''))
    return {
      kind: 'unmigrated',
      added: [],
      message: `基线 F11 不是"排序后的键数组"形状(实测 ${JSON.stringify(v ?? null).slice(0, 60)})`,
    }
  if ((a?.counts?.waitingHuman ?? 0) > 0 && !Array.isArray(a?.waitingHumanRows))
    return {
      kind: 'blind',
      added: [],
      message: '判定面给了等人拍板行数却没带逐行名单 ⇒ 键集无从对账(不记为通过)',
    }
  const prev = new Set(v)
  const added = f11KeySetOf(a).filter((k) => !prev.has(k))
  return { kind: added.length ? 'red' : 'ok', added }
}
/** F11 逐行点名的唯一文案出口(差值档与基线档共用一份;行号不得进证据文本,§1)。 */
export function f11RowLine(r) {
  const key = compositeKeyOf(r.raw)
  return `等人拍板未勾行 ${key ? `〔${key}〕` : '〔无主键〕'}:${clip(r.raw, 120)}`
}

/**
 * F12 —— **等条件未勾行一律禁止**(2026-10-25 机主令,AGENTS §1;与 F11 待拍板禁令同型同日族)。
 *
 * 病型:「等条件」桶成了拖延借口桶 —— 与 2026-10-16 机主令「等环境/等他人类发现不进台账」
 * 相抵触的存量挂账。禁令语义:agent 侧能当场做的当场做;真正卡在机主动作面(供值/资质/控制台/
 * 真机会话)的**改归属为"归:机主X面"出桶**(那是 owned-elsewhere,不是 waiting-env);两者
 * 都不是的按观察类结清。**不存在"挂在等条件桶等人送条件"这一档**,也不得改措辞绕 v2 尺(§12f)。
 * 量纲与 F9/F11 同型:差值档只判"本次新带入"(存量随清偿批逐行出桶,判存量红=恒红门,§12e);
 * 绝对层由基线**键集**看守,清偿完成后基线 F12=[] 即永久地板。键 = 复合主键,无主键退逐字原文。
 */
export function f12KeyOf(r) {
  return compositeKeyOf(r.raw) ?? r.raw
}
export function f12KeySetOf(a) {
  return [...new Set((a?.waitingEnvRows ?? []).map(f12KeyOf))].sort()
}
/** 差值档:相对基准面**新出现**的等条件未勾行。没有基准面 ⇒ **不判**(返回空),与 F11 同一条禁令。 */
export function newWaitingEnvRows(now, before) {
  if (!before?.waitingEnvRows) return []
  const prev = new Set(before.waitingEnvRows.map(f12KeyOf))
  return (now?.waitingEnvRows ?? []).filter((r) => !prev.has(f12KeyOf(r)))
}
/** F12 基线层纯函数判据,分态绝不并桶(与 f9/f11 Ratchet 同一套形状纪律)。 */
export function f12Ratchet(base, a) {
  if (!base || !Object.hasOwn(base, 'F12')) return { kind: 'absent', added: [] }
  const v = base.F12
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x === ''))
    return {
      kind: 'unmigrated',
      added: [],
      message: `基线 F12 不是"排序后的键数组"形状(实测 ${JSON.stringify(v ?? null).slice(0, 60)})`,
    }
  if ((a?.counts?.waitingEnv ?? 0) > 0 && !Array.isArray(a?.waitingEnvRows))
    return {
      kind: 'blind',
      added: [],
      message: '判定面给了等条件行数却没带逐行名单 ⇒ 键集无从对账(不记为通过)',
    }
  const prev = new Set(v)
  const added = f12KeySetOf(a).filter((k) => !prev.has(k))
  return { kind: added.length ? 'red' : 'ok', added }
}
/** F12 逐行点名的唯一文案出口(差值档与基线档共用一份;行号不得进证据文本,§1)。 */
export function f12RowLine(r) {
  const key = compositeKeyOf(r.raw)
  return `等条件未勾行 ${key ? `〔${key}〕` : '〔无主键〕'}:${clip(r.raw, 120)}`
}

/**
 * F9 的"编号位"判据:本行的主键必须**真的落在编号位**(剥掉复选框、状态装饰、markdown 强调记号
 * 之后的正文开头),否则那一次命中只是**行文引用**或**畸形号的子串**。
 *
 * 立项凭据(2026-09-28 现读,`--gate --json` 的 collisions 逐组判):
 *  ① `keyOfRow` 按"正文开头 48 字窗口内的第一个编号形态"取主键。登记行的编号位**没有**编号形态时
 *    (如 `- [x] ✅(2026-09-28) **一条归因更正**:06:24 本会话 D48 提交触发…`),窗口就会把叙述里
 *    提到的 `D48` 当成本行主键 ⇒ 这一行凭空成为 `D48` 的"第二个标题",F9 判一组撞号。
 *  ② 双前缀畸形号(`G-G-334` / `G-G-385` / `DD128` / `86G-2`)的编号位**不是**一个合法号,
 *    窗口却从它肚子里切出 `G-334` / `D128` / `G-2` ⇒ 又造出一组"撞号"。
 * 两种都不是"两个不同任务抢同一个号",而差值棘轮把每一组都算进 F9 ⇒ 拦的是**碰台账的人**,
 * 不是造出撞号的人。判据失效方向按票面:宁可少判(漏几组真撞号由人工清偿),也不能把引用判成撞号
 * —— 后者会让每一个与撞号无关的提交被拦,唯一结局是各会话绕钩子、连带全部守门作废(§12e)。
 *
 * 实现只复用台账既有出口,不另抄编号正则(`compositeKeyOf`/`titleOf` 判"编号位"用的就是这一对):
 *  - `bodyOfRow` 剥复选框 + 状态装饰(租约 `（进行中@…）` / `✅(日期)` / `【已完成】`);
 *  - `stripOwnKey` 只在"正文开头(可含 `*`/反引号/空白)就是本行主键"时才剥掉主键区 ⇒
 *    **剥得动 ⇒ 编号位;剥不动 ⇒ 不是**。
 * `G-NNN(新登记)` 那一族 `stripOwnKey` 刻意不剥(M16 的撞号误翻勾防线),但它同时被
 * `titleIsDegenerate` 摘掉题面,所以它在 F9 里本来就不贡献标题 —— 本判据没有把它洗回来。
 */
export function registersKeyAtIdPosition(rawLine, key) {
  return isDeclarationRow(rawLine, key)
}

/**
 * 把一把面上的撞号组**收窄到只认编号位**(F9 唯一的判据出口,三档读数都从它取)。
 * @param content 被审面全文(与 collisions 必须同面同轮 —— 两处各取一次面就是自洽却错位的尺子)
 * @param collisions `auditPlan().collisions`(宽口径原样产物)
 * @returns {groups:Array, droppedTitles:number, droppedGroups:number} 只留"编号位上 ≥2 个不同标题"的组
 */
export function narrowCollisionsToIdPosition(content, collisions) {
  const rawByLine = new Map()
  for (const r of parseTaskRows(content)) rawByLine.set(r.line, r.raw)
  const groups = []
  let droppedTitles = 0
  for (const g of collisions ?? []) {
    const kept = []
    for (const t of g.titles ?? []) {
      const lines = (t.lines ?? []).filter((ln) =>
        registersKeyAtIdPosition(rawByLine.get(ln) ?? '', g.key),
      )
      if (lines.length) kept.push({ title: t.title, lines })
      else droppedTitles += 1
    }
    if (kept.length >= 2) groups.push({ key: g.key, titleCount: kept.length, titles: kept })
  }
  return {
    groups,
    droppedTitles,
    droppedGroups: (collisions ?? []).length - groups.length,
  }
}

/**
 * F9 **定级**:把"已完成历史行"从**判红面**剔出,降为只报数(2026-10-06 立 2026-10-29 改判据)。
 *
 * ## 判据(2026-10-29 G-455 收口后的一句话)
 * **真撞号 = 同一编号下 ≥2 个「仍有未勾活行」的不同题面。**
 * 实现**不在本文件**:单一实现在 `scripts/lib/plan-collision.mjs` 的 `splitLiveCollisions`
 * (它只 import 台账层的 `parseTaskRows` / `f9Faces`,不抄任何一条编号正则)。本函数只做
 * "旧签名 → 新实现"的适配,保留旧名是因为三个既有调用点(自测/镜像/收敛闸)都在用它。
 *
 * ## 改判据的理由(票面 G-455 + §12e)
 * 旧判据是"组内**每一行**都已勾选才降档" ⇒ "done 1 行 + open 1 行"的**混合组**仍判红。
 * 病在**不可清偿**:已完成行是历史快照,改号=改历史(G-312 明令禁止批量改号)、删行=抹掉已发生的事。
 * 于是"两个题面同号、其中一个早已完成"这一形态一旦入库,红就与任何提交无关地恒亮 ——
 * 唯一结局是全队跳钩子、连带全部守门作废(§12e 原句)。现判据按**活题面数**判:
 * 只剩一个活题面时,活的那一行没有竞争者,不是"两件事抢一个号"。
 *
 * ## 为什么按"题面"而不是按"行"或按"号"
 *  - **按行剔**:一个题面下"done 1 行 + open 1 行"(F1 的分叉形态)会被算成 0 个活题面 ⇒
 *    真撞号被吃掉。本实现数的是**题面**,只要该题面名下还有一行 `- [ ]` 就整题面算活,不吃。
 *  - **按号剔**:一个号下可以同时有"全 done 的历史组"与"两个活题面互撞的组",按号判会把后者一起放过。
 *  - **按题面剔**:上面两型的失效方向都被堵住,且与票面那句判据逐字同形。
 *
 * ## 为什么这一刀是"定级"而不是"放过"
 * 判据覆盖面变窄,只有一条纪律兜底:**降档的组必须报名**(`counts.f9SettledGroups` +
 * `f9Settled` 名单 + 逐组文案),否则"从红路挪走"与"没人看过"同形 —— 本仓"报数不报名"记过多次
 * (守门 70/76/81/128 同族)。人读摘要与 `--json` 都给出这一档,并按两种成因分开报名
 * (`counts.f9SettledAllDone` = 整组已完成的那部分)。
 *
 * ## 削覆盖面这件事本身的红线
 * 这一族**只把"活题面 <2"的组剔出红路**,不做任何"看起来像已完成"的推断(不认行内日期、不认
 * `【已完成】`装饰)。放宽窗口/加近似条件是本族唯一禁止的改法:
 * 豁免一旦变成放过真活票,差值棘轮就再也拦不住新增撞号(§12e/§12f)。
 *
 * ## fail-closed:读不到组内行 ⇒ 仍判红
 * 组明细里出现**取不到的行号**(面被换过、裁剪过)时**不得**当成"没有活行":
 * 只有"行号非空 ∧ 每一行都明确是 done"才认成历史题面,其余一律算活。判据失效方向按票面:宁可多判。
 *
 * @param content 被审面全文(必须与 groups 同一面同轮)
 * @param groups 已收窄到编号位的组集(`narrowCollisionsToIdPosition` 或 `f9Declared` 的产物)
 * @returns {{groups:Array, settled:Array}} `groups` = 仍判红的组;`settled` = 降为只报数的组(原样保留)
 */
export function splitF9SettledGroups(content, groups) {
  const { live, history } = splitLiveCollisions(content, groups)
  return { groups: live, settled: history.map((h) => h.group) }
}

/**
 * F4c「同题前缀套叠」一行的**唯一**文案出口(人读面与 `--json` 都从它取,两处各写一遍必漂移)。
 * 为什么必须有:lib 侧算出了 pairs,但 `plan-tasks.mjs` 此前 0 次提及 `prefixNested` ⇒
 * 那一档"只报数"退化成两个无人能定位的整数(本仓"报数不报名"同族)。
 * 形态说清是"哪一行是另一行的前缀",不写"重复/多余"—— 这一族**合法**(台账截断回放),
 * 报数是为了让人自己判"哪一份是完整的",不是判它有罪。
 * ⚠ 与 `f9GroupLine` 同一条禁令:行号不进证据文本(每次 append 都会挪位,§1 明令它不得当判据);
 *   要定位读 `--json` 的 `prefixNested[].short.line` / `.long.line`,那是机器字段而不是证据。
 */
export function f4cPairLine(p) {
  // ⚠ `short`/`long` 是 `parseTaskRows` 的**整行 row**(`raw`/`body`/`key`/`state`…),没有 `title` 字段
  //   —— 取 `title` 会静默拿到 undefined 并印出「undefined」,那正是"证据文本看着有内容、其实没指名谁"。
  const bodyOf = (side) => (side?.raw ?? '').replace(/^\s*- \[[ xX]\]\s*/, '').slice(0, 60)
  return `编号 ${p.key}：「${bodyOf(p.short)}」是「${bodyOf(p.long)}」的精确前缀`
}

/**
 * `--json` 输出面的**纯函数组装**(判据面 → 机器可读面),供 CLI 与 selfTest 共用。
 * 为什么抽出来:`--json` 那一大坨原先是 `main()` 里的内联字面量 ⇒ **selfTest 够不着它**,
 * 于是"把 `prefixNested` 名单整段删掉"这种变异**全绿放过**(2026-10-07 变异验证当场抓出 ESCAPED)。
 * 判据失效的表现永远是安静 ⇒ **判据面与输出面之间必须有一条可测的缝**,不能靠"读代码看着对"。
 * 这一族只做**形状投影**,不含任何判据(判据全在 `auditPlan`/本文件上面的并列导出里)。
 * @param a 判定面(通常已过 `narrowF9Face`)
 * @param clip 正文截断函数(文本字段用它,行号字段原样透出)
 */
export function buildJsonFace(a, clip) {
  return {
    face: LABEL[a.__face ?? 'head'],
    counts: a.counts,
    rows: a.rows,
    composites: a.composites,
    open: a.claimableRows.map((r) => ({ line: r.line, key: r.key, text: clip(r.raw, 160) })),
    forks: a.forks.map((f) => ({
      key: f.key,
      done: f.done.map((r) => r.line),
      open: f.open.map((r) => r.line),
    })),
    void: a.voidRows.map((r) => ({ line: r.line, text: clip(r.raw, 160) })),
    pointers: a.rotated.map((r) => ({ line: r.line, target: r.target, reason: r.reason })),
    collisions: a.collisions.map((g) => ({
      key: g.key,
      titleCount: g.titleCount,
      titles: g.titles.map((t) => ({ title: t.title, lines: t.lines })),
    })),
    references: (a.f9References ?? []).map((g) => ({
      key: g.key,
      titleCount: g.titleCount,
      titles: g.titles.map((t) => ({ title: t.title, lines: t.lines })),
    })),
    malformedMasquerade: (a.f9MalformedMasquerade ?? []).map((m) => ({ key: m.key, lines: m.lines })),
    settled: (a.f9Settled ?? []).map((g) => ({
      key: g.key,
      titleCount: g.titleCount,
      titles: g.titles.map((t) => ({ title: t.title, lines: t.lines })),
    })),
    // F4c 同题前缀套叠(只报数,但**逐对可定位** —— 与 F9 的 settled 同一条纪律:
    // 报数不报名就只剩一个无人能定位的整数)。行号在这一档**是允许的**:
    // 它是 `--json` 的机器字段(定位用),不是证据文本;证据文本走 `f4cPairLine`,那里不印行号。
    prefixNested: (a.prefixNested?.pairs ?? []).map((p) => ({
      key: p.key,
      state: p.state,
      lenShort: p.lenShort,
      lenLong: p.lenLong,
      short: { raw: p.short?.raw, line: p.short?.line },
      long: { raw: p.long?.raw, line: p.long?.line },
    })),
    // F10 翻勾回写候选名单(只报数、永不判红)。`null` = **本次没扫**(须显式窗口),不是"扫了且为零"
    // —— 这两件事同形就是本仓最高频失效型"把没量写成量到了 0"。
    reopenedFlips: a.reopenedFlips ?? null,
  }
}

/**
 * F4c 一行**人读**文案的**唯一**出口(与 `f4cPairLine` 同一纪律:人读面与机器面各一份实现必然漂移)。
 *
 * 为什么必须抽成函数而不是内联在 `main()` 里:内联时 selfTest 够不着它 ⇒
 * "把 slice 阈值从 5 改成 1(只报第一对)"这种变异**全绿放过**(2026-10-07 变异验证实测 ESCAPED)。
 * 与 `buildJsonFace` 同一个病根:**判据面/输出面之间必须有一条可测的缝**,
 * 否则"人读面看着有报名"是没法验证的信念,不是事实。
 * @param prefixNested `a.prefixNested`
 * @param c `a.counts`
 * @param head 人读面一次最多逐条点名几对(超出的走"另 N 对见 --json",不许静默截断)
 */
export function f4cHumanLine(prefixNested, c, head = 5) {
  const f4c = prefixNested ?? { pairs: [], groupKeys: [] }
  const open = f4c.pairs.filter((p) => p.state === 'open')
  const done = f4c.pairs.filter((p) => p.state !== 'open')
  return (
    `  F4c 同题"前缀套叠"副本(只报数、永不判红): ${c.prefixNestedGroups ?? f4c.groupKeys.length} 组 / ` +
    `${c.prefixNestedPairs ?? f4c.pairs.length} 对 —— 其中含未勾选行 ${open.length} 对 / ` +
    `整对都已勾选 ${done.length} 对` +
    (open.length
      ? ` —— 逐条点名(前 ${head} 对):${open.slice(0, head).map(f4cPairLine).join(' / ')}` +
        (open.length > head ? ` (另 ${open.length - head} 对见 --json 的 prefixNested)` : '')
      : ' —— 本面没有含未勾选行的套叠对(这一句是"量到了 0",不是"没量")')
  )
}

/**
 * 判定面 = `auditPlan` 的产物,但 **F9 这一维按编号位收窄后的组集覆盖宽口径读数**
 * (counts.collisionGroups 与 collisions 必须同面同轮同步,否则"组数"与"名单"分叉 ——
 * 差值棘轮读组数、逐组点名读名单,两者不同形时红会点不出名)。
 * 其余六维(F1/F2/F3/F4/F4b/F6)一字未动:本票只动 F9。
 *
 * ── F9 定级(2026-10-06):收窄之后再过一道 `splitF9SettledGroups`,"组内全 done"的组降为只报数。
 * 三处读数必须**同批同步**,少改一处账面就会自相矛盾:
 *  `counts.collisionGroups` / `collisions`(组数与名单) / 新增 `counts.f9SettledGroups` + `f9Settled`(降档名单)。
 *
 * ✅ **那一格已收口(2026-10-02 枚 4547745e1a,不再是待办)**:`scripts/git-sync-converge.mjs` 的第②把尺子
 * (合并落地闸的基线档)原先走 `probe(auditPlan(merged))` —— 它自己调 lib 的宽口径 `auditPlan`,
 * 绕过本函数。那一档已改成 `probe(narrowF9Face(auditPlan(merged), merged))`;`narrowF9Face` 由
 * 该文件从本文件 import,**复用同一份实现、未在彼处另写一遍收窄逻辑**(两处算同一件事必漂移)。
 * 所以下面这段触发条件**已经踩响过、也已消解**:合并落地闸现在吃的与 `--gate` 同一把声明位口径的面。
 *
 * ⚠ **但基线形状变了,本函数的下游读者必须跟着重算**:现读(2026-10-04)窄面 104 组 / 宽面 121 组,
 * 而基线 `scripts/plan-task-state-baseline.json` 的 F9 是 73 键的**声明位口径**键集 ⇒ 两档量纲已不同。
 * 判据本尊对此的处置是 `--update-baseline` 的 `refuse-widen`:`added`(现读有、基线无)非空即拒绝写盘,
 * 所以**基线不会被宽口径追着跑**。真正要人做事的仍是那 62 个 `added` 键的逐组清偿(票 G-1018210);
 * `--update-baseline` 只能收窄、不能替它们发通行证。
 * ⚠ **`refuse-widen` 是全有全无的**:`added` 对**整份现读键集**算,不是对"这次清了哪几个"算 ⇒
 * 部分清偿后它照样拒绝(实测:清掉 25 个全已勾键后 added 仍有 37)。**"先清几个零风险的再收窄基线"
 * 这条捷径在判据层面不存在** —— 要么把 added 清零、让它第一次落 `write`(顺带收掉 31 个不再撞号的键),
 * 要么基线原地不动。另注:`--update-baseline` **只写 F9 一维**,F1 得另找人工改 JSON(见票面登记)。
 *
 * ⚠ **别再照抄"git-sync-converge.mjs:220"这个行号**:它已随文件生长漂走(220 行现在是 spawnSync 的
 * stdio/timeout 参数段,与 F9 无关);要定位就读该文件里 `ratchetViolations(base, probe(narrowF9Face(` 那一行。
 * §1 规矩:行号不进证据文本 —— 它每次提交都会挪位。
 */
export function narrowF9Face(a, content) {
  const wide = (a?.collisions ?? []).length
  // 台账层(G-460)已经按声明位分好三档 ⇒ 判定面优先取那一份现成的,不再本地重筛一遍:
  // 两处各算一次"什么算声明行"就是第二个真相,而它漂开时的表现是引用又被打回判据。
  const narrowed =
    Array.isArray(a?.f9Declared) && a?.counts?.f9NonIdTitles !== undefined
      ? {
          groups: a.f9Declared,
          droppedTitles: a.counts.f9NonIdTitles,
          droppedGroups: wide - a.f9Declared.length,
        }
      : narrowCollisionsToIdPosition(content, a?.collisions)
  // F9 定级(2026-10-06 立 / 2026-10-29 按 G-455 改判据):"还有没有两个活题面"决定去留。
  // 判据本体在 `lib/plan-collision.mjs`(single source);这里只把两份名单落面。
  // 降档名单必须与判红组集**同批**落到面上,否则"组数"与"名单"分叉。
  const split = splitLiveCollisions(content, narrowed.groups)
  const settled = split.history.map((h) => h.group)
  a.counts.f9WideGroups = wide
  a.counts.f9NonIdTitles = narrowed.droppedTitles
  a.collisions = split.live
  a.counts.collisionGroups = split.live.length
  a.f9Settled = settled
  a.counts.f9SettledGroups = settled.length
  // 两种成因分开报数:整组已完成 / 只剩一个活题面。合成一个数就说不清"为什么这组不判红"。
  a.counts.f9SettledAllDone = split.history.filter((h) => h.reason === HISTORY_REASON.ALL_DONE).length
  return a
}

/**
 * F9「引用图」的一行点名文案(只报数档唯一的出口,人读面与 `--json` 都从它取)。
 * 为什么必须报名而不是报数:被正文引用的号**改不掉** —— 换号只会让旧号继续挂在别人的句子
 * 里(票面后果②),所以这一档存在的意义就是让人看得见"哪些号被谁点了多少次"。
 * ⚠ 与 `f9GroupLine` 同一条禁令:行号不进证据文本,定位读 `--json` 的 `references[].lines`。
 */
export function f9ReferenceLine(g) {
  return (
    `编号 ${g.key} 被 ${g.titleCount} 处正文引用挂到非声明位 —— ` +
    `${(g.titles ?? []).map((t) => `「${t.title}」`).join(' / ')}`
  )
}

/**
 * F9 红之后必须跟的一句**避让指引**(差值档与基线档共用一份,两处各写一遍必漂移)。
 *
 * 为什么这句属于判据的交付面而不是提示语:撞号这一型绝大多数不是"有人故意抢号",而是**取号竞态**——
 * 两条会话各自在**自己那侧的当下 HEAD** 上按 max+1 取号,分叉时两个号都合法,合到同一份账面才第一次
 * 相遇(本会话 2026-09-28 实测一次合并带进 5 组)。所以拦下红的人必须知道"下一次怎么不撞",
 * 否则他会做两件更糟的事:批量改号(G-312 明令禁止)或跳门。
 * 三句都是可执行动作,且都指向仓里真存在的出口(不写跑不通的出路 —— §1 登记过同型教训)。
 */
export function f9AvoidGuidance() {
  return [
    '   避让(撞号的成因几乎都是"取号竞态",不是有人抢号):',
    '   ① 取号面必须含 **HEAD ∪ FETCH_HEAD ∪ 归档件** —— 只看工作树/只看本地 HEAD 都会把已推未合的号段、',
    '      以及"取过又让出"的号当成空闲。现读出口:`node scripts/plan-tasks.mjs --next-id <族>`(按被审面算),',
    '      占用面只按台账现面计(存档机制已于 2026-10-16 退役,.ihui-agent/archive/ 不再存在)。',
    '   ② 登记新条目一律经 `node scripts/live-doc-edit.mjs` 的 `{{NEXT_ID:<族>}}` 令牌:它在**每次 CAS 尝试**里',
    '      按当下底稿重算,所以"查号"与"写行"之间的竞态窗口被消掉 —— 手工 max+1 抄进正文必撞。',
    '   ③ 令牌展开值本身已含族名,正文不得再手写字面值(`G-` + `{{NEXT_ID:G}}` 产出 `G-G-334` 这一型,',
    '      本仓实测两次)—— 畸形号还会被 F9 的窗口口径读成撞号,虽已不计判据,但它是台账里的脏号。',
  ].join('\n')
}

/**
 * F13 读数的**唯一装配出口**(2026-10-27 立):CLI 两个档与镜像测试都只走这里,禁止在别处
 * 再拼一遍"拿两面全文调 lib"的装配(两处各装一次必漂移,§0.6)。
 *
 * 两档:
 *  - 提交链(`--staged`)⇒ 被审面 = 索引 blob、锚点面 = HEAD blob(两次取材同轮,见调用点);
 *  - 全量档(`--gate`)⇒ 两面同为 HEAD(退化成一面对账)⇒ 命中集 == 面内存量集 ⇒ 差集恒空。
 *    这一档的作用是把"账面此刻有几枚两态并存"量出来给人看,并把**结构上算不出新增**这件事
 *    大声说出来(`f13CrossNotMeaningful`)—— 不得让读的人把它当成"这一维判过且没问题"(§0.3)。
 * 任一面的全文不在手 ⇒ **不判**:读数落 0 但同时置 `f13Unjudged`,报告行与 gate 都点名原因,
 * 既不记绿也不冒红。
 *
 * @param a      被审面的判定面对象(auditFace 的产物,带 __contentText)
 * @param anchor 锚点面的判定面对象(提交链 = HEAD 面;全量档 = a 自身)
 */
export function wireF13(a, anchor, opts = {}) {
  const faceLabel = opts.faceLabel ?? LABEL[a?.__face] ?? '被审面'
  const anchorLabel = opts.anchorLabel ?? LABEL[anchor === a ? a?.__face : 'head'] ?? '锚点面'
  a.f13Hits = []
  a.f13CrossKeys = []
  a.f13StockKeys = []
  a.counts.f13Regressed = 0
  a.counts.f13Stock = 0
  a.f13Unjudged = null
  a.f13CrossNotMeaningful = false
  const faceText = a?.__contentText
  const anchorText = anchor?.__contentText
  if (typeof faceText !== 'string' || faceText === '') {
    a.f13Unjudged = `${faceLabel}的全文不在手(auditFace 没钉上 __contentText)⇒ 这一维本轮没有判`
    return a
  }
  if (typeof anchorText !== 'string' || anchorText === '') {
    a.f13Unjudged = `${anchorLabel}的全文不在手 ⇒ 分不清存量与本次带回,这一维本轮没有判`
    return a
  }
  const cross = findClosedToOpenRegressions(anchorText, faceText)
  const self = findClosedToOpenRegressions(faceText, faceText)
  a.f13Hits = cross.hits
  a.f13CrossKeys = cross.hits.map((h) => h.key)
  // 差值锚点 = **被审面自身**的两态并存存量(auditFace(head) 时面==锚点 ⇒ 就是"HEAD 面自身的命中数";
  // 索引面档下它代表"不靠本次改动就已经在账面成立的那批主键")。
  a.f13StockKeys = self.anchorStockKeys
  a.counts.f13Regressed = cross.hits.length
  a.counts.f13Stock = self.hits.length
  a.counts.f13AnchorDoneKeys = cross.anchorDoneKeys
  a.counts.f13AnchorRows = cross.anchorRows
  a.counts.f13FaceRows = cross.faceRows
  if (anchor === a) a.f13CrossNotMeaningful = true
  return a
}

/** F13 逐枚点名的唯一文案出口(报告档与 gate 的红档共用一份;行号只做定位、不进判据,§1)。 */
export function f13HitLine(h) {
  return (
    `F13 回退主键 ${h.key} —— 锚点面已勾 ${h.anchorDoneLines.length} 行(L${h.anchorDoneLines.join(',L')})` +
    ` 而被审面未勾 ${h.faceOpenLines.length} 行(L${h.faceOpenLines.join(',L')})`
  )
}

/**
 * 棘轮纯函数:基线里没有某项 ⇒ 不判该项(既不"0 容忍"也不"通过")。
 *
 * F9 例外(2026-09-27 G-312):它的锚点是**键集合**,精确判据需要判定面的逐组明细。
 * 给了第三参 `a` ⇒ 走键集档(`gate()` 就是这么调的);没给(如 `git-sync-converge` 只拿
 * `probe()` 的组数)⇒ 退化成粗尺"组数 > 基线键数",并在文案里明写自己是粗尺、点名去哪拿名单。
 * 粗尺只可能漏"等量换键"那一型,而提交链走的是精确档 ⇒ 这次改动没有新增任何漏报面。
 */
export function ratchetViolations(base, items, a) {
  if (!base) return []
  const f9IsKeySet = Array.isArray(base.F9)
  const out = items
    // 键集形状下 F9 不吃"比数量"这条通用规则;整数旧形状照旧走通用规则(由 gate() 大声判"未迁移")
    .filter(
      ([k, , n]) => (k !== 'F9' || !f9IsKeySet) && typeof base[k] === 'number' && n > base[k],
    )
    .map(([k, label, n]) => `${k} ${label} 由基线 ${base[k]} 涨到 ${n}`)
  // F11 键集臂(2026-10-23 机主强制令):基线 F11 是键数组时不吃通用"比数量"规则(通用规则要求
  // typeof number,数组天然被滤掉),这里走与 F9 同型的精确档。没给 `a` ⇒ 这一维**无法判**而不是
  // 判过 —— 调用方(converge)必须传面,否则等于静默关掉禁令的绝对层(与 F9 粗尺不同:F11 没有
  // 可用的粗尺量纲,差值计数在全量面上恒 0,拿它比基线键数会恒绿)。
  if (Array.isArray(base.F11) && a) {
    const f11 = f11Ratchet(base, a)
    if (f11.kind === 'red')
      out.push(
        `F11 等人拍板:出现基线键集里没有的未勾行 ${f11.added.length} 条(强制令禁止该桶存在;名单跑 \`node scripts/plan-tasks.mjs --gate\` 逐条点名)`,
      )
  }
  // F12 键集臂(2026-10-25 机主令,与 F11 同型):数组形状不吃通用"比数量"规则,走精确键集档。
  if (Array.isArray(base.F12) && a) {
    const f12 = f12Ratchet(base, a)
    if (f12.kind === 'red')
      out.push(
        `F12 等条件:出现基线键集里没有的未勾行 ${f12.added.length} 条(机主令禁止该桶存在;名单跑 \`node scripts/plan-tasks.mjs --gate\` 逐条点名)`,
      )
  }
  if (!f9IsKeySet) return out
  if (a) {
    const f = f9Ratchet(base, a)
    if (f.kind === 'red')
      out.push(
        `F9 撞号:出现基线键集里没有的编号 ${f.added.join(' ')}(共 ${f.added.length} 组)`,
      )
    return out
  }
  const n = items.find(([k]) => k === 'F9')?.[2] ?? 0
  if (n > base.F9.length)
    out.push(
      `F9 撞号(粗尺:调用方未提供逐组明细)组数 ${n} 超过基线键集 ${base.F9.length} 个 ⇒ 逐组名单跑 \`node scripts/plan-tasks.mjs --gate\``,
    )
  return out
}

/**
 * `--update-baseline` 的判据(纯函数,**只写 F9 这一维、只许收窄**)。
 *
 * 为什么其余维度一律拒绝:① F1–F4/F4b/F6 的拦点是差值棘轮(本次改动 vs HEAD),基线只是
 * 第二道;把"当次现读"整体刷一遍等于谁都能在跳门后把自己的账冻成新的地板。② F5 方向相反、
 * F8 是全量档算不出的 0 地板,让它们跟着"顺手重写"会被抹成当次读数。
 * 为什么只许收窄:扩大键集 = 给新撞号发通行证,与"为过门调高基线"同一条禁令。
 * @param oldBase 基线文件解析结果
 * @param nextKeys 当次判定面现读的撞号键集
 */
export function planF9BaselineRewrite(oldBase, nextKeys) {
  if (!oldBase || !Object.hasOwn(oldBase, 'F9'))
    return {
      action: 'refuse-shape',
      reason: `基线里没有 F9 键 —— "只许收窄"要拿既有键集来比,凭空写一份等于重开这一维`,
    }
  if (!Array.isArray(oldBase.F9) || oldBase.F9.some((x) => typeof x !== 'string' || x === ''))
    return {
      action: 'refuse-shape',
      reason: `基线 F9 仍是旧形状(实测 ${JSON.stringify(oldBase.F9 ?? null).slice(0, 60)})—— 先人工迁移成排序键数组,否则"是否收窄"无从判定`,
    }
  const prev = new Set(oldBase.F9)
  const next = [...new Set(nextKeys.filter((k) => typeof k === 'string' && k))].sort()
  const added = next.filter((k) => !prev.has(k))
  if (added.length)
    return {
      action: 'refuse-widen',
      added,
      reason: `本次现读有 ${added.length} 个键不在基线里:${added.join(' ')}`,
    }
  const removed = oldBase.F9.filter((k) => !next.includes(k))
  if (!removed.length)
    return { action: 'noop', reason: `现读键集与基线逐字相同(${oldBase.F9.length} 个),不必写盘` }
  return {
    action: 'write',
    next,
    removed,
    reason: `收窄 ${oldBase.F9.length} → ${next.length}(清偿掉 ${removed.join(' ')})`,
  }
}

/**
 * 在 JSON 原文里**原位**替换一个顶层键的值文本,其余字节逐字不动(2026-09-27 G-312)。
 *
 * 为什么不用 `JSON.stringify(parsed)`:整文件重写会把别人的注记键/审计台账冲掉 —— 守门 83
 * 那条 `--update-baseline` 同型事故(注记键被整文件重写抹掉)在本仓已经付过账。
 * @throws 找不到该键时抛错(不静默"当作没有")
 */
export function replaceTopLevelJsonValueText(text, key, valueText) {
  const m = new RegExp(`(^|\\n)\\s*"${key}"\\s*:`).exec(text)
  if (!m) throw new Error(`基线里找不到顶层键 ${key}`)
  const colon = m.index + m[0].length - 1
  let i = colon + 1
  while (i < text.length && /\s/.test(text[i])) i++
  let depth = 0
  let inStr = false
  let esc = false
  let end = i
  for (; end < text.length; end++) {
    const c = text[end]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') {
      if (depth === 0) break
      depth--
    } else if ((c === ',' || c === '\n') && depth === 0) break
  }
  return text.slice(0, i) + valueText + text.slice(end)
}

/**
 * 差值棘轮纯函数:两把同形读数(候选面 vs 基准面)只比"变多"。
 *
 * 第三参 absFloor(G-1102638 批2,2026-10-08):F5 维的**绝对下限豁免**。落账注记行随物理
 * 归并专项真删是拍板过的合法清偿,但"注记被合法清掉"与"被一次旧计划文档整文件提交抹掉"
 * 在差值面上长得一模一样,差值尺自己分不出来 —— 豁免下限从基线文件的 F5 维读(gate 调用点
 * 传 base?.F5),缺省不传 = 旧行为逐字不变(任何下跌都红)。判红条件 now < min(b5, absFloor):
 * absFloor 只能把下限放宽到基线水位,不得反向比旧行为更紧。批2 清偿后基线 F5=0 ⇒ 差值 F5
 * 随专项退役(注记形态在新账面不再增长,登记行防丢归门 71,留痕在归档 md 豁免面);要恢复
 * 看守力把基线 F5 抬回非零即可,判据无须再动。
 */
export function grewViolations(now, before, absFloor) {
  const items = probe(now)
  const prev = new Map(probe(before).map(([k, label, n]) => [k, { label, n }]))
  const out = items
    .filter(([k, , n]) => typeof prev.get(k)?.n === 'number' && n > prev.get(k).n)
    .map(([k, label, n]) => `${k} ${label} 由 ${prev.get(k).n} 涨到 ${n}(+$ ${n - prev.get(k).n})`)
  // F5 方向相反(只许增不许减),**不塞进上面那个"比变多"的循环** —— 一把尺子对同一维
  // 既判涨又判跌,读的人就无法知道哪个方向是坏。
  const b5 = before?.counts?.mergeNotes
  const floor = typeof absFloor === 'number' ? Math.min(b5, absFloor) : b5
  if (typeof b5 === 'number' && now.counts.mergeNotes < floor)
    out.push(
      `F5 归并落账注记由 ${b5} 条掉到 ${now.counts.mergeNotes} 条(被一次旧计划文档整文件提交抹掉了)`,
    )
  // ── F13 已勾行被捣回未勾(2026-10-27 补牙,主席 16:30 实测"滞后副本交进提交、四档全绿")──
  // 通用"比变多"那一循环**量不到这一族**:滞后副本把旧短版交进来时,常常一边消掉一枚既有分叉
  // (F1/F13 的存量读数因此往下走)而同时带回一枚新回退 ⇒ 枚数持平 ⇒ 恒绿(等量换键那一型,
  // F9 的 G-312 同一课)。所以拦点是**回退主键集合的差集**:回退永远以"锚点面已勾"为前提,
  // 锚点面(HEAD)自身永远产不出它 ⇒ 跨面命中里凡不在锚点面存量集里的键,都是本次改动带进来的。
  // 存量(锚点面自己就两态并存的那批主键)只报数不判红 —— 绝对零容忍 = 与任何提交无关的恒红门,
  // 唯一结局是逼人 --no-verify 并连带废掉全部守门(§0.2/§12e)。
  // 输入不全时**不在这里判红也不在这里判绿**:未判定由 gate() 大声打印(与"差值棘轮未判定"
  // 同一条既有先例 —— 差值层的输入缺失不构成一次可处置的红,但绝不静默,§0.3)。
  if (Array.isArray(now.f13CrossKeys) && Array.isArray(now.f13StockKeys)) {
    const stock = new Set(before.f13StockKeys ?? [])
    const added = now.f13CrossKeys.filter((k) => !stock.has(k))
    if (added.length)
      out.push(
        `F13 已勾行被捣回未勾:本次改动带回 ${added.length} 枚回退主键 ${added.slice(0, 6).join(' ')}${added.length > 6 ? ` …其余 ${added.length - 6} 枚见 --gate 点名` : ''}`,
      )
  }
  return out
}

function readBaseline(root) {
  const abs = path.join(root, BASELINE_REL)
  if (!existsSync(abs)) return null
  try {
    return JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    // 坏 JSON 不得静默当"没有基线" —— 那等于把棘轮关掉而不吭声
    throw new Undetermined(`${BASELINE_REL} 解析失败:${String(e?.message ?? e).split('\n')[0]}`)
  }
}

/**
 * @param a      当前判定面的读数
 * @param before 差值棘轮的基准面读数(仅 `--staged` 档给:索引面 vs HEAD 面同轮各算一次)
 *               取不到基准面 ⇒ **不判差值**并喊出来(把"没判"写成"判过了"是本仓最高频失效型)
 */
/**
 * 绝对层(基线棘轮 / 存续性棘轮)在**哪一种档**里才参与退出码 —— 定级判据只留这一份。
 *
 * 两层比的是"当次面的存量 vs 基线文件",与本次提交改了什么无关:别人跳门塞进 HEAD 的增长,
 * 会让**每一次无关提交**都变红,而红门的唯一结局是各会话 --no-verify、连带链上全部守门作废
 * (§12f;AGENTS §1 也早已写明"提交链上跑的是差值棘轮,存量永不拦")。所以:
 *  - 提交链(有 `before` ⇒ 差值档)⇒ **不拦**,但必须逐维打印 + 给问责出口,不得静默;
 *  - 全量档 / `--strict`(人工与 CI 问责)⇒ 照常判红。
 * 差值棘轮(`grewViolations`)不在此函数管辖内 —— 它才是链上的拦点,一行没被放宽。
 */
export function absoluteLayerBlocks({ strict, before }) {
  return Boolean(strict) || !before
}

/** 导出给自检与镜像测试用(§22c):判据的红/绿两向都必须能拿构造面证明,不能只靠 CLI 跑真仓。 */
/**
 * `baseOverride` 是**测试通道**(G-1105306):镜像要证的是"键集锚在给定基线下的四臂行为",
 * 而 `readBaseline(root)` 只会去读实盘那份 —— 夹具的键集不在实盘基线里时,九组会被全算成"新键",
 * 那条"同键多挂一行不得拦提交"的臂就永远过不去(它量的根本不是自己的行为)。
 * 缺省 `null` ⇒ 一行都不变:提交链、CLI、converge 全部照旧从实盘取基线。
 */
export function gate(a, strict, root, before, beforeErr, baseOverride = null) {
  const items = probe(a)
  const nonZero = items.filter(([, , n]) => n > 0)
  // F9 存量只报数、**--strict 也不判红**(定级理由见 lib findIdCollisions 头注:存量绝大多数是
  // 子项命名惯例,判红=与任何提交无关的恒红门,§12e)。它唯一的红路是差值/基线棘轮(只拦新增撞号组)。
  const strictNonZero = nonZero.filter(([k]) => k !== 'F9')
  let base = null
  try {
    base = baseOverride ?? readBaseline(root)
  } catch (e) {
    console.log(`⚠️ 无法判定 —— ${e.message}`)
    return 2
  }
  // F9 基线锚点必须是键集合(G-312)。旧形状 = 这一维关着 —— 静默放行等于把它写成"判过了且没问题",
  // 而它恰恰是那层"别人跳门把增长塞进 HEAD"唯一的看守者,所以这里按**无法判定**处理(exit 2)。
  const f9b = f9Ratchet(base, a)
  // F11 基线锚点同样必须是键数组(2026-10-23 强制令)。形状不对 = 这一维关着 = 静默放行等于
  // 把"没判"写成"判过了且没问题",按无法判定处理(与 f9b 同一条纪律)。
  const f11b = f11Ratchet(base, a)
  if (f11b.kind === 'unmigrated' || f11b.kind === 'blind') {
    console.log(`⚠️ 无法判定 —— F11 基线层:${f11b.message}`)
    console.log(
      f11b.kind === 'unmigrated'
        ? `   出路:人工把 ${BASELINE_REL} 的 F11 写成排序去重的键数组(强制令之下地板应为 \`[]\`)。**禁止**改成整数蒙过去 —— 那等于关掉这一维而账面看不出来。`
        : `   出路:判定面必须带 waitingHumanRows 明细(auditPlan 的产物本来就有 ⇒ 这一格只会是调用方自己拼了半个面)。`,
    )
    return 2
  }
  // F12 基线锚点同样必须是键数组(2026-10-25 机主令,与 F11 同一条纪律)。
  const f12b = f12Ratchet(base, a)
  if (f12b.kind === 'unmigrated' || f12b.kind === 'blind') {
    console.log(`⚠️ 无法判定 —— F12 基线层:${f12b.message}`)
    console.log(
      f12b.kind === 'unmigrated'
        ? `   出路:人工把 ${BASELINE_REL} 的 F12 写成排序去重的键数组(禁令之下地板应为 \`[]\`;存量清偿前 = 当次现读键集)。**禁止**改成整数蒙过去。`
        : `   出路:判定面必须带 waitingEnvRows 明细(auditPlan 的产物本来就有 ⇒ 这一格只会是调用方自己拼了半个面)。`,
    )
    return 2
  }
  if (before) {
    // F5 豁免水位取基线文件(G-1102638 批2):基线 F5=0 ⇒ 差值 F5 退役;缺省/非数字 ⇒ 旧行为。
    const grew = grewViolations(a, before, base?.F5)
    if (grew.length) {
      console.log(`❌ 差值棘轮:本次改动让状态分叉变多 —— ${grew.join(';')}`)
      // F9 上涨 ⇒ 逐组点名"编号 G-x 被 N 个不同标题共用"(票面要求的报名形态;只报数不点名
      // 等于让改的人自己再去跑一遍全量档找差异)。
      for (const g of newCollisionGroups(a, before))
        console.log(`   F9 新增撞号:${f9GroupLine(g)}`)
      // F11 新增必须**逐行点名**(与 F9 同一条理由:只报数等于让改的人自己再跑一遍全量档)。
      for (const r of a.newWaitingHumanRows ?? [])
        console.log(`   F11 ${f11RowLine(r)}`)
      if ((a.newWaitingHumanRows ?? []).length)
        console.log(
          '   2026-10-23 机主强制令:等人拍板条目一律禁止。出路只有两条:agent 深度分析后直接按最优推荐方案执行并结清(决策与依据写进注记/commit message),或摘除本行把事实写进 commit message。不存在"保留待拍板"这一档,也不得改措辞绕过 v2 尺(改判据=§12f 红线)。',
        )
      // F12 新增同样逐行点名(2026-10-25 机主令,与 F11 同型)。
      for (const r of a.newWaitingEnvRows ?? [])
        console.log(`   F12 ${f12RowLine(r)}`)
      if ((a.newWaitingEnvRows ?? []).length)
        console.log(
          '   2026-10-25 机主令:等条件条目与待拍板同型禁止。出路只有三条:agent 当场做完结清;真卡在机主动作面(供值/资质/控制台/真机会话)的改归属为「归:机主X面」出桶;两者都不是的按观察类结清摘行。不存在"挂着等条件"这一档,也不得改措辞绕 v2 尺(§12f)。',
        )
      console.log('   归并掉新增的那几条(把副本行翻勾或改成内容锚点),别调基线、别削判据。')
      console.log(f9AvoidGuidance())
      return 1
    }
    console.log(
      `✅ 差值棘轮:相对 HEAD,本次提交未新增状态分叉(${items.map(([k, , n]) => `${k}=${n}`).join(' ')})`,
    )
  } else if (beforeErr) {
    console.log(`⚠️ 差值棘轮未判定 —— ${beforeErr}`)
  }
  // ── F13 的"没量到"必须自报(§0.3:未判定既不是绿也不是红)────────────────
  // 这一维是**跨面**的:任何一侧的输入不在手,差值臂就结构上判不了。判不了还印 ✅(那一行的
  // 读数清单里 F13=0 看起来就像"量到 0")= 把"没判"写成"判过",正是门 239 那句"两面逐字相同"
  // 的同型缺陷(2026-10-27 实测:blob 不同而结论说相同)。
  if (a.f13Unjudged)
    console.log(
      `⚠️ F13 未判定 —— ${a.f13Unjudged};这一维本轮没有判,不得读成"没有已勾行被捣回未勾"`,
    )
  else if (before && !Array.isArray(before.f13StockKeys))
    console.log(
      '⚠️ F13 未判定 —— 差值基准面没给"面内存量主键集"(f13StockKeys)⇒ 分不清存量与本次带回;' +
        '调用方须走 auditFace()(它把该面全文钉在 __contentText 上)或 wireF13(face, anchor) 装配,不得自己拼半个面',
    )
  if (f9b.kind === 'unmigrated' || f9b.kind === 'blind') {
    console.log(`⚠️ 无法判定 —— F9 基线层:${f9b.message}`)
    console.log(
      f9b.kind === 'unmigrated'
        ? `   出路:人工把 ${BASELINE_REL} 的 F9 写成当次 HEAD 面现读的撞号**键数组**(排序、去重),或跑 \`--update-baseline\`(它只认键集形状)。**禁止**改回整数蒙过去 —— 那等于把这一维关掉而账面看不出来。`
        : `   出路:判定面必须带 collisions 明细(auditPlan 的产物本来就有 ⇒ 这一格只会是调用方自己拼了半个面)。`,
    )
    return 2
  }
  // G-681 归属过滤:差值基准面(HEAD 面)在手时,基线层 F9 只认"基线缺 ∧ HEAD 也没有"的键;
  // 其余键是别人跳门塞进 HEAD 的存量 ⇒ 打印而不判红(静默等于放行),也不进点名名单。
  // 问责档(--strict / 全量档)不过滤。退出码逐位不变(链上绝对层本就非 blocking,归
  // absoluteLayerBlocks 管辖;这里只改打印面与 addedKeys 名单)—— 唯一新增的非零出口是
  // "基准面盲 ⇒ 无法判定 exit 2"(分不清存量与新增时既不冒红也不记绿,与 blind 档同型)。
  const f9Filter = Boolean(before) && !strict && f9b.added.length > 0
  let f9Attributed = f9b.added
  const f9Stock = []
  if (f9Filter) {
    if (!Array.isArray(before.collisions) && (before.counts?.collisionGroups ?? 0) > 0) {
      console.log(
        '⚠️ 无法判定 —— F9 归属:差值基准面给了撞号组数却没带逐组明细 ⇒ 分不清"HEAD 已有存量"与"本次新增"(既不冒红也不记绿)',
      )
      return 2
    }
    const f9HeadKeys = new Set(f9KeySetOf(before))
    f9Attributed = f9b.added.filter((k) => !f9HeadKeys.has(k))
    for (const k of f9b.added) if (f9HeadKeys.has(k)) f9Stock.push(k)
    if (f9Stock.length)
      console.log(
        `ℹ F9 基线缺项 ${f9Stock.length} 组此刻已在 HEAD 面 ⇒ 不记在本次提交头上(问责档 --strict/全量面照旧判红)`,
      )
  }
  // G-45 出口乙补全(2026-10-26,§24 代裁):把上面 G-681 的"存量归属"从 F9 一维扩到
  // F11/F12 键集臂与整数臂(F1–F4/F4b/F6/F8)—— 同一条纪律、同一型盲档:差值档(有 before
  // ∧ 非 strict)下,"基线缺 ∧ HEAD 已有"= 别人跳门塞进 HEAD 的存量 ⇒ ℹ 报名而不记在本次
  // 提交头上;"基线缺 ∧ HEAD 也没有"仍 ❌;基准面缺该维明细 ⇒ 分不清存量与新增 ⇒ exit 2
  // (既不冒红也不记绿,与 M681-B 同型)。--strict/全量档不过滤 —— 票面(乙)要的"别人跳门
  // 塞进 HEAD 的增长必须仍被另一层看到"由这两腿承担。拦点仍在差值棘轮,一行未放宽。
  const attribOn = Boolean(before) && !strict
  // F11 归属(键集臂,与 F9 同型;盲档判据与 f11Ratchet 的 blind 同形:有行数没名单)。
  const f11Filter = attribOn && f11b.added.length > 0
  let f11Attributed = f11b.added
  if (f11Filter) {
    if (!Array.isArray(before.waitingHumanRows) && (before.counts?.waitingHuman ?? 0) > 0) {
      console.log(
        '⚠️ 无法判定 —— F11 归属:差值基准面给了等人拍板行数却没带逐行名单 ⇒ 分不清"HEAD 已有存量"与"本次新增"(既不冒红也不记绿)',
      )
      return 2
    }
    const f11HeadKeys = new Set(f11KeySetOf(before))
    f11Attributed = f11b.added.filter((k) => !f11HeadKeys.has(k))
    if (f11b.added.length > f11Attributed.length)
      console.log(
        `ℹ F11 基线缺项 ${f11b.added.length - f11Attributed.length} 条此刻已在 HEAD 面 ⇒ 不记在本次提交头上(问责档 --strict/全量面照旧判红)`,
      )
  }
  // F12 归属(键集臂,与 F11 同型)。
  const f12Filter = attribOn && f12b.added.length > 0
  let f12Attributed = f12b.added
  if (f12Filter) {
    if (!Array.isArray(before.waitingEnvRows) && (before.counts?.waitingEnv ?? 0) > 0) {
      console.log(
        '⚠️ 无法判定 —— F12 归属:差值基准面给了等条件行数却没带逐行名单 ⇒ 分不清"HEAD 已有存量"与"本次新增"(既不冒红也不记绿)',
      )
      return 2
    }
    const f12HeadKeys = new Set(f12KeySetOf(before))
    f12Attributed = f12b.added.filter((k) => !f12HeadKeys.has(k))
    if (f12b.added.length > f12Attributed.length)
      console.log(
        `ℹ F12 基线缺项 ${f12b.added.length - f12Attributed.length} 条此刻已在 HEAD 面 ⇒ 不记在本次提交头上(问责档 --strict/全量面照旧判红)`,
      )
  }
  // 整数臂归属:F1–F8 的读数本身就是明细(组数/行数),基准面缺该维读数 ⇒ 同样按盲档 exit 2。
  const intStockKeys = new Set()
  if (attribOn) {
    const bCounts = new Map(probe(before).map(([k, , n]) => [k, n]))
    for (const [k, label, n] of items) {
      if (k === 'F9' || typeof base?.[k] !== 'number' || !(n > base[k])) continue
      const bk = bCounts.get(k)
      if (typeof bk !== 'number') {
        console.log(
          `⚠️ 无法判定 —— ${k} 归属:差值基准面没给该维读数 ⇒ 分不清"HEAD 已有存量"与"本次新增"(既不冒红也不记绿)`,
        )
        return 2
      }
      if (bk >= n) {
        intStockKeys.add(k)
        console.log(
          `ℹ ${k} ${label} 由基线 ${base[k]} 涨到 ${n} —— 此刻已在 HEAD 面 ⇒ 不记在本次提交头上(问责档 --strict/全量面照旧判红)`,
        )
      }
    }
  }
  // 把摘除存量后的面喂给基线棘轮;else 臂保留字面调用给镜像 M20 的源码锁(无过滤时与改前逐字等价)
  let baselineFace = a
  if (f9Filter)
    baselineFace = {
      ...baselineFace,
      collisions: (a.collisions ?? []).filter((g) => f9Attributed.includes(g.key)),
    }
  if (f11Filter)
    baselineFace = {
      ...baselineFace,
      waitingHumanRows: (a.waitingHumanRows ?? []).filter((r) => f11Attributed.includes(f11KeyOf(r))),
    }
  if (f12Filter)
    baselineFace = {
      ...baselineFace,
      waitingEnvRows: (a.waitingEnvRows ?? []).filter((r) => f12Attributed.includes(f12KeyOf(r))),
    }
  const baselineItems = intStockKeys.size ? items.filter(([k]) => !intStockKeys.has(k)) : items
  const vsBase =
    baselineFace !== a || baselineItems !== items
      ? ratchetViolations(base, baselineItems, baselineFace)
      : ratchetViolations(base, items, a)
  if (vsBase.length) {
    console.log(`❌ 基线棘轮:${vsBase.join(';')}`)
    console.log(`   差值判据看不见"别人跳门把增长塞进 HEAD"那一型,这一层就是为它留的。`)
    // F9 红必须**逐组点名**(键 / 两侧标题 / 行号)—— "只报数不报名"等于让改的人再跑一遍全量档,
    // 而这一维的存量按设计不判红,所以红只可能是新键:名单就是可执行出口本身。
    const addedKeys = f9b.kind === 'red' ? new Set(f9Attributed) : new Set()
    for (const g of a?.collisions ?? [])
      if (addedKeys.has(g.key)) console.log(`   F9 基线新增撞号:${f9GroupLine(g)}`)
    // F11 基线层点名(跳门塞进 HEAD 那一型):红只可能是基线外的键,名单即出口。
    // G-45 出口乙补全:摘除"HEAD 已有"的存量键后,名单只剩真新增 —— 存量键不得被点名在本次头上。
    if (f11b.kind === 'red') {
      const f11Added = new Set(f11Attributed)
      for (const r of a?.waitingHumanRows ?? [])
        if (f11Added.has(f11KeyOf(r))) console.log(`   F11 ${f11RowLine(r)}`)
      console.log(
        '   强制令出路同上:代裁代执行结清,或摘行把事实写进 commit message;基线 F11 的地板是 \`[]\`,把它抬高 = 关掉禁令。',
      )
    }
    if (addedKeys.size)
      console.log(
        '   (行号只当定位用,每次 append 都会挪位、不得当判据,也不写进本条证据;复核请用"编号 + 标题"逐字对照 `--json` 的 collisions 清单)',
      )
    if (addedKeys.size) console.log(f9AvoidGuidance())
    console.log(
      addedKeys.size
        ? `   出路:逐组判"哪侧是后来者"并归并(G-312 明令不得批量改号)。清偿后人工跑 \`node scripts/plan-tasks.mjs --update-baseline\` —— 它只允许**收窄**键集,把新键写进基线等于关掉这一维。`
        : `   出路:清偿后人工跑 \`node scripts/plan-tasks.mjs --update-baseline\` 并说明为什么 —— 调高基线等于关掉这一维。`,
    )
    if (absoluteLayerBlocks({ strict, before })) return 1
    console.log(
      '   ↑ 本层比的是"HEAD 当下存量 vs 基线",与本次提交改了什么无关 ⇒ 在提交链(差值档)只报数不拦提交。',
    )
    console.log(
      '     定级理由见函数 absoluteLayerBlocks 头注(§12f:与提交无关的恒红门 = 全队跳钩子 = 全部守门作废);',
    )
    console.log('     问责口径不变:`pnpm check:plan-task-state`(= --gate --strict)照判红;差值棘轮照旧 blocking。')
  }
  // F5 与上面同层但方向相反:基线记的是"至少要有这么多条落账注记",**掉了**才判红。
  // 这一维专治"四条状态判据全绿而内容已被旧副本顶掉"(2026-09-26 一小时内实测发生两次)。
  if (typeof base?.F5 === 'number' && a.counts.mergeNotes < base.F5) {
    // G-45 出口乙补全:同一条归属纪律 —— HEAD 面此刻已低于基线水位 ⇒ 掉账是别人塞的存量,
    // ℹ 报名不记在本次头上;基准面没给该维读数 ⇒ 分不清 ⇒ exit 2(与整数臂/F9 盲档同型)。
    const bMerge = before?.counts?.mergeNotes
    if (attribOn && typeof bMerge !== 'number') {
      console.log(
        '⚠️ 无法判定 —— F5 归属:差值基准面没给归并落账注记读数 ⇒ 分不清"HEAD 已掉账的存量"与"本次抹掉"(既不冒红也不记绿)',
      )
      return 2
    }
    if (attribOn && bMerge < base.F5) {
      console.log(
        `ℹ 存续性棘轮:归并落账注记此刻在 HEAD 面已只剩 ${bMerge} 条(基线 ${base.F5})⇒ 掉账存量不记在本次提交头上(问责档 --strict/全量面照旧判红)`,
      )
    } else {
      console.log(`❌ 存续性棘轮:归并落账注记由基线 ${base.F5} 条掉到 ${a.counts.mergeNotes} 条`)
      console.log(
        '   成因只会是"按内存里那份旧计划文档整文件提交"或跳门回写;出路是重放那批注记,不是下调基线。',
      )
      if (absoluteLayerBlocks({ strict, before })) return 1
      console.log('   ↑ 同上:绝对层在提交链只报数,问责档 --strict 判红。')
    }
  }
  // ── F8b 到期清单 ─────────────────────────────────────────────
  // 默认档**只报数并报名**,`--strict` 才判红。理由是这一维与其余六条不同:
  // 它随日历增长,与"本次提交改了什么"无关。挂进提交链判红 = 今天登记的 300 条账
  // 在 21 天后同一轮提交里集体变红,那是一台谁都无法通过的门,唯一出路是各会话跳钩子、
  // 连带全部守门作废(§12e 那一型)。所以压力放在**新增侧**(F8a blocking),
  // 存量侧由问责档(CI / 人工跑 `--strict`)逐批清。
  const stale = a.staleRows ?? []
  if (stale.length) {
    const head =
      `⏳ 超过 ${LEDGER_TTL_DAYS} 天没有进展的登记行 ${stale.length} 条` +
      `(另有 ${a.counts.undated} 条连日期都没有 = 无从判龄,不在本清单内)`
    if (!strict) {
      console.log(`${head} —— 默认档只报数。逐条看:node scripts/plan-tasks.mjs --stale`)
    } else {
      console.log(
        `❌ ${head} —— 每条只剩三种正当处置:推进并追加进展日期 / 说清等什么(归入等待桶) / 归并到父任务并翻勾。`,
      )
      for (const r of stale.slice(0, 12))
        console.log(`     L${r.line} 锚点 ${r.anchor}(距今 ${r.age} 天) ${clip(r.raw, 70)}`)
      if (stale.length > 12) console.log(`     … 其余 ${stale.length - 12} 条见 --stale 清单`)
      return 1
    }
  }
  if (!strictNonZero.length) {
    const f9 = items.find(([k]) => k === 'F9')?.[2] ?? 0
    console.log(
      `✅ 全部"只判变多"的状态判据为零(F1–F4 + F6 块级 + F8 新增无交代;F5 注记存续性另判,见上;` +
        `F9 撞号存量 ${f9} 组只报数,棘轮只拦新增,定级理由见 lib findIdCollisions 头注)`,
    )
    return 0
  }
  if (!strict) {
    console.log(
      `⚠️  存量只报数(默认档):${nonZero.map(([k, label, n]) => `${k} ${label} ${n}`).join(' / ')}`,
    )
    console.log(
      `   问责跑 \`--strict\`;存量清到零之前不得对它升 blocking(防恒红门)。基线在位:${base ? '是' : `否(缺 ${BASELINE_REL})`}`,
    )
    return 0
  }
  // F9 不在判红名单里(见上方 strictNonZero 注释):存量红等于恒红门。
  console.log(
    `❌ 状态判据成立:${strictNonZero.map(([k, label, n]) => `${k} ${label} ${n}`).join(' / ')}`,
  )
  return 1
}

// ── 自检:判据跑在**构造面**上,不依赖仓库瞬时状态(§22c:镜像测试只复读实现就是复读机)──
const FIXTURE = [
  '# 计划',
  '- [x] ✅(2026-09-26) **D99 复合主键正例**:说明文字。',
  '- [ ] **D99 复合主键正例**:同一件事的旧副本还挂着 —— 该被 F1 点名。',
  '- [ ] **D98 未做的任务**:这条是真待办,不得被任何判据点名。',
  '- [ ] **D97 作废声明**:〔本行判:已完成,勿照本行派单〕—— 该被 F2 点名。',
  '- [ ] **D96 指针**:本行正题逐字存活于 L1 的同编号登记 —— L1 不是条目行,该被 F3 点名。',
  '- [ ]（进行中@2026-09-26/someone） **D94 别人已认领**:必须**不进**派单口径(第一版把它算进去了)。',
  // F4 夹具:两条都是未勾选、主键同题 ⇒ 副本那条不得进派单口径(同一件活不能派两遍)
  '- [ ] **D93 重复待办**:第一条登记。',
  '- [ ] **D93 重复待办**:与上一条同主键的第二次登记。',
  // F4 夹具:两条都是未勾选、主键同题 ⇒ 副本那条不得进派单口径(同一件活不能派两遍)
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '',
].join('\n')

function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (cond, name) => {
    if (cond) {
      pass++
    } else {
      fail++
      console.log(`  ❌ ${name}`)
    }
  }
  const a = auditPlan(FIXTURE)
  const c = a.counts
  ok(a.rows === 10, `条目行数应为 10(含 F4 那一对同题待办),实测 ${a.rows}`)
  ok(
    c.forks === 1 && a.forks[0].key.startsWith('D99'),
    `F1 应恰好点到 D99,实测 ${a.forks.map((f) => f.key).join(',')}`,
  )
  ok(a.forks[0].done.length === 1 && a.forks[0].open.length === 1, 'F1 组内应各一态一行')
  ok(a.voidRows.length === 1 && a.voidRows[0].raw.includes('D97'), 'F2 应点到带作废声明的那一行')
  ok(
    a.rotated.length === 1 && a.rotated[0].target === 1,
    `F3 应点到腐烂指针 L1,实测 ${JSON.stringify(a.rotated.map((r) => r.target))}`,
  )
  ok(
    c.dupDoneGroups === 1 && c.dupOpenGroups === 1,
    `done 侧同态重复只报数、open 侧由 F4 判:实测 open=${c.dupOpenGroups} done=${c.dupDoneGroups}`,
  )
  // ── F4c 点名出口(2026-10-07):这一族此前只有 counts 两个整数、名单在 --json 里缺失 ──
  // 成对写:一条"必须逐对可定位"(正)+ 一条"整对已勾选也必须在名单里"(反向:别只报含活的)。
  // ⚠ 这一档**永不判红**(存量 179 组,接 blocking 就是恒红门),所以它的自测只能钉"可定位 + 分档齐",
  //   钉不到"会不会误判红" —— 那一条由「counts 里没有把 F4c 送进差值棘轮」结构性保证。
  // ⚠ 夹具形态要点(两条实测踩出来的,不是猜的):
  //   ① F4c 判的是 **`raw` 全行逐字前缀**(含复选框),而 `- [x]` 与 `- [ ]` 第 4 字符不同
  //   ⇒ **"一 open 一 done"的两行结构上不可能成对**(混合对在这一族不可达)。
  //   ② 同主键靠 `titleOf`(截断到 24 字)⇒ 两行必须**题面前缀逐字相同**、正文才有长短差。
  //   真实形态是:短行是裸行,长行逐字以它开头 + 行尾挂 〔【归并】…〕指针(下面逐字取自真台账)。
  const f4cShort = '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型'
  const f4cLong =
    f4cShort +
    ' 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「68 · 流式中切换模型→终止后自动带入新模型」,派单以那条为准,本行不再单独派单。〕'
  const f4cShortDone = '- [x] 69. 终止后自动带入新模型'
  const f4cLongDone =
    f4cShortDone +
    ' 〔【归并】重复登记副本(2026-09-30):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
  const f4cFace = auditPlan([f4cShort, f4cLong, f4cShortDone, f4cLongDone].join('\n'))
  const f4cPairs = f4cFace.prefixNested?.pairs ?? []
  ok(
    f4cPairs.length === 2,
    `F4c 应逐对点名(两个编号各一对),实测 ${f4cPairs.length} —— 名单缺失时这一条会读 0`,
  )
  ok(
    f4cPairs.every((p) => p.key && p.short?.raw && p.long?.raw) &&
      f4cPairs.some((p) => p.state === 'open') &&
      f4cPairs.some((p) => p.state !== 'open'),
    `F4c 名单必须逐条带 key/两侧题面,且 open 与 done 两档都在场(只报含活的那一档=半份名单),实测 ${JSON.stringify(f4cPairs.map((p) => [p.key, p.state]))}`,
  )
  ok(
    (f4cFace.counts.prefixNestedPairs ?? 0) === f4cPairs.length &&
      (f4cFace.counts.prefixNestedGroups ?? 0) === (f4cFace.prefixNested?.groupKeys?.length ?? -1),
    `F4c 计数与名单必须同形(数与名单分叉时读者对不上账),实测 ${JSON.stringify([f4cFace.counts.prefixNestedPairs, f4cPairs.length, f4cFace.counts.prefixNestedGroups, f4cFace.prefixNested?.groupKeys?.length])}`,
  )
  ok(
    !f4cPairLine(f4cPairs[0]).match(/L\d+/) && f4cPairLine(f4cPairs[0]).includes(f4cPairs[0].key),
    `F4c 证据文本不得印行号(§1:每次 append 都会挪位),且必须点名编号,实测 ${JSON.stringify(f4cPairLine(f4cPairs[0]))}`,
  )
  // ⚠ 下面三条是**补上去的反向锁**:2026-10-07 第一版自测缺了它们,变异验证当场抓出 3 条 ESCAPED
  //   (删掉 --json 名单 / 只报第一对 / 取不存在的 title 字段 —— 三条都 130/0 全绿放过)。
  //   教训:**"用例跑绿"不等于"用例有牙"** —— 每条新判据都必须配一条"把出口拆掉仍绿"的变异。
  const f4cLine = f4cPairLine(f4cPairs[0])
  ok(
    !/undefined|\[object Object\]/.test(f4cLine) && f4cLine.includes('流式中切换模型'),
    `F4c 证据文本取字段取错时会静默印 undefined/"[object Object]" —— 那是"看着有内容、其实没指名谁",实测 ${JSON.stringify(f4cLine)}`,
  )
  ok(
    f4cLine.includes(f4cShort.slice(6, 30)) && f4cLine.includes(f4cShort.slice(6, 30)),
    `F4c 证据文本必须真的指名两侧题面(短侧正文逐字在场),实测 ${JSON.stringify(f4cLine)}`,
  )
  // 人读点名的"半份名单"防线:改 slice 阈值只报第一对时,这条靠**逐对文案互不相同**咬住
  ok(
    new Set(f4cPairs.map((p) => f4cPairLine(p))).size === f4cPairs.length,
    'F4c 每对文案必须互不相同(同名文案 ⇒ 人读面分不出是哪一对)',
  )
  // 机器面:走 buildJsonFace 那个**唯一出口**(不是另抄一份形状),把"名单被拆掉"这类变异钉住。
  const f4cJson = buildJsonFace(f4cFace, clip)
  ok(
    Array.isArray(f4cJson.prefixNested) &&
      f4cJson.prefixNested.length === f4cPairs.length &&
      f4cJson.prefixNested.every(
        (p) => p.key && p.short?.line && p.long?.line && p.short.raw && p.long.raw,
      ),
    `--json 的 prefixNested 名单必须逐对带 key/两侧行号与原文(删掉这段时本条读 0),实测 ${JSON.stringify(f4cJson.prefixNested)}`,
  )
  ok(
    Array.isArray(f4cJson.settled) &&
      Array.isArray(f4cJson.collisions) &&
      Array.isArray(f4cJson.references) &&
      Array.isArray(f4cJson.malformedMasquerade),
    '机器面四份名单(判红/降档/引用图/畸形号)必须同形 —— 少一份就是那一档在机器面上失明',
  )
  // 人读面:走 `f4cHumanLine`(唯一出口)。这条钉住"逐条点名不许静默截断"——
  //   slice 阈值从 5 改成 1 时,超出的那几对必须在文案里**说出来**(另 N 对见 --json),
  //   悄悄只报第一对 = 半份名单(2026-10-07 变异验证第一版就是在这儿 ESCAPED 的)。
  const f4cHuman = f4cHumanLine(f4cFace.prefixNested, f4cFace.counts, 5)
  ok(
    f4cHuman.includes('逐条点名(前 5 对)') && f4cHuman.includes(f4cPairs[0].key),
    `F4c 人读文案必须标明本次点名了几对并点名首对,实测 ${JSON.stringify(f4cHuman)}`,
  )
  // "余量必须说出来"这条要用**真超过 head 的面**验(夹具只有 1 对 open 时 head=1 恰好不触发,
  //   那时这条断言会绿得毫无意义 —— 断言必须落在它真的会响的地方)。
  const f4cThreeOpen = [70, 71, 72].map((n) => {
    const s = `- [ ] ${n}. 流式中切换模型 → 终止后自动带入新模型`
    return [s, s + ' 〔【归并】重复登记副本(2026-10-07):同主键的另一条登记,派单以那条为准。〕']
  }).flat()
  const f4cBig = auditPlan(f4cThreeOpen.join('\n'))
  const f4cHead1 = f4cHumanLine(f4cBig.prefixNested, f4cBig.counts, 1)
  ok(
    f4cBig.prefixNested.pairs.length === 3 &&
      !f4cHead1.includes('前 5 对') &&
      f4cHead1.includes('前 1 对') &&
      f4cHead1.includes('另 2 对见 --json'),
    `F4c 人读点名被收窄时必须把余量说出来(静默截断 = 报数不报名),实测 ${JSON.stringify(f4cHead1)}`,
  )
  // ⚠ 这条钉的是"head 参数**真的被尊重**":传 3 就得报 3 对。
  //   变异"open.slice(0, head) → open.slice(0, 1)"(人读点名无视 head、少报)就是被它咬住的
  //   —— 2026-10-07 第一版只钉了"余量话术在不在",那样子"只报 1 对"输出仍是合法文案 ⇒ 放过了。
  const f4cHead3 = f4cHumanLine(f4cBig.prefixNested, f4cBig.counts, 3)
  const f4cHead3Keys = [f4cBig.prefixNested.pairs[0].key, f4cBig.prefixNested.pairs[1].key, f4cBig.prefixNested.pairs[2].key]
  ok(
    f4cHead3.includes('前 3 对') &&
      f4cHead3Keys.every((k) => f4cHead3.includes(k)) &&
      !f4cHead3.includes('另 '),
    `F4c 人读点名必须真的按 head 报满(传 3 报 3 对,一条不许少),实测 ${JSON.stringify(f4cHead3)}`,
  )
  ok(
    f4cHumanLine(f4cBig.prefixNested, f4cBig.counts, 5).includes('前 5 对') &&
      !f4cHumanLine(f4cBig.prefixNested, f4cBig.counts, 5).includes('另 '),
    'F4c 名单短于 head 时不得打印"另 0 对"这类占位话',
  )
  // ⚠ done 档的人数必须被钉住:2026-10-07 变异验证第一版把它漏了,
  //   变异"const done = f4c.pairs.filter(...) → []"(只报含活的那一半)因此 141/0 全绿放过。
  ok(
    f4cHuman.includes('整对都已勾选 1 对') &&
      f4cHuman.includes('含未勾选行 1 对'),
    `F4c 人读文案必须把"含未勾选行/整对已勾选"两档都报出来(只报含活的那一半 = 报数不报名),实测 ${JSON.stringify(f4cHuman)}`,
  )
  ok(
    !f4cHuman.includes('undefined') && !f4cHuman.includes('[object Object]'),
    'F4c 人读文案不得出现 undefined/[object Object](取错字段时的静默失效)',
  )
  ok(
    f4cHumanLine({ pairs: [] }, { prefixNestedGroups: 0, prefixNestedPairs: 0 }).includes('量到了 0'),
    'F4c 空面必须明写"量到了 0"而不是静默不打印这一行(报数不报名同族)',
  )
  ok(
    !probe(f4cFace).some(([k]) => k === 'F4c'),
    'F4c 绝不许进 probe 差值棘轮(存量 179 组 ⇒ 恒红门,§12e/§12f),这一条是结构性防线',
  )
  // 派单口径:未勾选 5 行(D99 副本 / D98 / D97 / D96 / D94 已认领),
  // 扣掉 F1 分叉行、F2 作废行与**带租约的 D94** ⇒ 只剩 D98 与 D96
  ok(c.open === 7, `夹具应有 7 行未勾选,实测 ${c.open}`)
  ok(c.claimed === 1 && c.unclaimed === 6, `租约计数应为 1/6,实测 ${c.claimed}/${c.unclaimed}`)
  ok(c.claimable === 3, `派单口径应为 3(D98 + D96 + D93 幸存者),实测 ${c.claimable}`)
  ok(
    c.dupOpenGroups === 1 && c.dupOpenCopies === 1,
    `F4 应计 1 组 1 副本,实测 ${c.dupOpenGroups}/${c.dupOpenCopies}`,
  )
  ok(
    !a.claimableRows.some((r) => r.raw.includes('第一条登记')),
    'F4 的副本行不得进派单口径 —— 同一件活被派两遍,正是"计划里怎么还有重复的"那一格',
  )
  ok(
    !a.claimableRows.some((r) => r.raw.includes('D94')),
    '已带租约的行不得进派单口径 —— 否则 §1 的认领标记形同虚设,别人正在做的事会被再派一遍',
  )
  // ── G-1058653:第二个副本指针形态(`副本指针(编号 …)` 行首族)也得出派单口径 ──
  // 病:那些行**逐字自述"只加指针不动勾选"**(= DUP_POINTER_RE 当初要认的那件事),只因措辞
  // 换了另一种就被派出去,现读 9/9 进派单口径。夹具用**逐字取自真实台账**的形态,不是自造形态。
  const ptrRow = '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。'
  const ptrFix = auditPlan(
    [
      '- [ ]（进行中@2026-09-27/someone） **62 ChatSearchBar 持有行**:带租约的那条。',
      ptrRow,
      '- [ ] **D96 无关真活票**:不含指针标记。',
    ].join('\n'),
  )
  ok(
    !ptrFix.claimableRows.some((r) => r.raw.includes('副本指针(编号')),
    '`副本指针(编号 …)` 行首族不得进派单口径 —— 它逐字自述"只加指针不动勾选"',
  )
  ok(
    ptrFix.claimableRows.length === 1 && ptrFix.claimableRows[0].raw.includes('D96'),
    `该夹具派单口径应只剩 D96 一行,实测 ${ptrFix.claimableRows.length} 行`,
  )
  // ── F8 指针豁免(接线补齐):派单侧早认指针,F8 侧原来不认 ──
  // 病:`副本指针(编号 …)` 早被 `isClaimExcludedPointer` 认成"指针不是待办"(上一组断言),
  // 而 F8 的 `hasDisposition` 三个出口(租约/非 actionable 桶/日期)一个都不占指针
  // ⇒ 那批行既不是待办、又被 F8 判成"无交代的活待办"。现读真台账:指针共 4193 行,
  // 其中恰好 8 行落进 F8 面,F8 由 175 降到 167。
  // ⚠ 这两条断言是**本条判据唯一的牙**:先前 142 条自测 + 46 条用例没有一条钉它,
  // 拿掉那一支账面照样全绿(2026-10-07 实测)—— 所以必须在这里钉死。
  const f8PtrFace = auditPlan(
    [
      '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。',
      '- [ ] **D96 无关真活票**:不含指针标记,也没有任何日期或租约。',
    ].join('\n'),
  )
  ok(
    !f8PtrFace.undisposed.some((r) => r.raw.includes('副本指针(编号')),
    'F8 无交代面不得把 `副本指针(编号 …)` 行首族算成活待办 —— 指针不是待办,不占这个量纲',
  )
  ok(
    f8PtrFace.undisposed.length === 1 && f8PtrFace.undisposed[0].raw.includes('D96'),
    `该夹具 F8 面应只剩 D96 一行,实测 ${f8PtrFace.undisposed.length} 行`,
  )
  // **反向锁**:正文里**提到**该形态而自己仍是真活票的行,照旧计债(不得被措辞连坐)。
  ok(
    auditPlan(
      '- [ ] **G-1058653 派单口径漏认第二个副本指针形态：副本指针(编号 …) 行首族被当活待办派出去,本票要修它**',
    ).undisposed.length === 1,
    '正文只是**提及**指针形态的行仍必须计债 —— 判据只认逐字行首族',
  )
  // **反向锁(这一族最要紧的一条)**:正文里**提到**「副本指针(编号 N)」而自己仍是真活票的行,
  // 必须**仍然进**派单口径。第一版把窗口写成"复选框后 24 字内任意内容",自测当场抓到假阳性
  // (`某某票 正文里提到副本指针(编号 62)…` 被误认)⇒ 收紧成"只容状态装饰"。
  // **这一条是钉住那个收紧的**:没有它,下一个人把窗口放宽回来不会有任何用例变红,
  // 而放宽的后果是永久放过真活票(比门红着更糟 —— 红会被人看见,放过不会)。
  const mentionFix = auditPlan(
    [
      '- [ ] 某某票 正文里提到副本指针(编号 62) 这个说法但本行是独立活账。',
      '- [ ] 另一票 前置有别的东西 副本指针(编号 51)：也不该被认。',
      '- [ ] 第三个 提到「副本指针」两个字但没有编号段,同样不该被认。',
    ].join('\n'),
  )
  ok(
    mentionFix.claimableRows.length === 3,
    `正文里"提到"副本指针的真活票必须仍进派单口径(3 行),实测 ${mentionFix.claimableRows.length} 行`,
  )
  // 编号段不限形态:纯数字 / 带后缀 / 带圈号 三种都必须认(第一版曾写死`\d+`,自测逮住)
  for (const [n, id] of [
    ['纯数字', '62'],
    ['带·后缀', '4·观察期'],
    ['带圈号', 'P1-①'],
  ]) {
    const one = auditPlan(`- [ ] 副本指针(编号 ${id})：同主键第二份未勾选副本,只加指针不动勾选。\n- [ ] **D96 别的活票**:对照。`)
    ok(
      one.claimableRows.length === 1 && one.claimableRows[0].raw.includes('D96'),
      `编号段为${n}「${id}」的指针行仍须被逐出派单口径,实测留 ${one.claimableRows.length} 行`,
    )
  }
  // 反向对照:一条什么都没做坏的文档不得产生任何红
  const clean = auditPlan(
    ['- [ ] **D90 干净任务**:无人认领。', '- [x] ✅(2026-09-26) **D91 干净完成**:已落账。'].join(
      '\n',
    ),
  )
  ok(
    clean.counts.forks === 0 && clean.counts.voidRows === 0 && clean.counts.rotatedAuto === 0,
    '干净文档必须三条全零',
  )
  ok(clean.counts.claimable === 1, `干净文档派单口径应为 1,实测 ${clean.counts.claimable}`)
  // 空面不得记绿(§门 118/126 同一条禁令)
  ok(auditPlan('').rows === 0, '空文档应零条目')
  // 真实形态样本取自**固定的历史 blob**(`0bc0af653df^` = 首次归并的前一版),不取当前 HEAD:
  // 清偿之后 HEAD 上就没有"判:裸副本"的未勾选行了,拿 HEAD 当夹具的断言会在成功那一轮变红。
  // 读不到该历史版本必须失败 —— 静默跳过等于把"没判"写成"判过了"。
  let sample = ''
  try {
    sample = gitRaw(['show', `${SAMPLE_REV}:PROJECT_PLAN.md`], ROOT)
  } catch (e) {
    ok(false, `样本历史版本取不到(${SAMPLE_REV}):${String(e?.message ?? e).split('\n')[0]}`)
  }
  const real = parseTaskRows(sample).filter((r) => r.state === 'open' && /判:裸副本/.test(r.raw))
  ok(real.length > 0, `${SAMPLE_REV} 里应读到"判:裸副本"的未勾选行,否则本条正向证明失去载体`)
  const realAudit = auditPlan(real.map((r) => r.raw).join('\n'))
  ok(
    realAudit.voidRows.length === real.length,
    `真实样本 F2 应全中:${realAudit.voidRows.length}/${real.length}`,
  )
  ok(compositeKeyOf(real[0]?.raw ?? '') !== null, '真实行应能算出复合主键')
  // 棘轮纯函数:只有"涨"才判红。等值/下降/基线缺项三种都不许点名 ——
  // 缺项判红会变成"台账没登记的维度一被扫到就红",那是替人关掉这一维的反面。
  const items = [
    ['F1', '同主键两态并存(组)', 5],
    ['F2', '带作废声明未落账(行)', 3],
    ['F3', '行号指针可自动收口(处)', 0],
  ]
  ok(ratchetViolations(null, items).length === 0, '没有基线时棘轮不得凭空判红')
  ok(
    ratchetViolations({ F1: 4, F2: 3, F3: 0 }, items).join() ===
      'F1 同主键两态并存(组) 由基线 4 涨到 5',
    `棘轮应只点名上涨的那一项,实测 ${JSON.stringify(ratchetViolations({ F1: 4, F2: 3, F3: 0 }, items))}`,
  )
  ok(ratchetViolations({ F1: 9, F2: 9 }, items).length === 0, '低于基线不得判红(清偿应当变绿)')
  ok(
    ratchetViolations({ F1: 'x' }, items).length === 0,
    '基线值不是数字时不得判红,也不得当作通过(由 --json 现读兜底)',
  )
  // F5 存续性:方向与前四条**相反**(只许增不许减),故三例各判一个方向,缺一条就可能把"抹掉注记"当成好转绿
  const noted = auditPlan(
    '- [x] ✅(2026-09-26) **D9 带注记**:说明。〔【归并】D9 落账:复测 2026-09-26: 取证。\n' +
      '- [x] ✅(2026-09-26) **D10 带注记**:说明。〔【归并】D10 落账:复测 2026-09-26: 取证。',
  )
  const unnoted = auditPlan(
    '- [x] ✅(2026-09-26) **D9 带注记**:说明。\n- [x] ✅(2026-09-26) **D10 带注记**:说明。',
  )
  ok(noted.counts.mergeNotes === 2, `注记计数应为 2,实测 ${noted.counts.mergeNotes}`)
  ok(
    !grewViolations(noted, unnoted).some((x) => x.startsWith('F5')),
    '注记由 0 涨到 2 不得判红(那是好转)—— 反方向才判红,下一例核',
  )
  const loss = grewViolations(unnoted, noted)
  ok(
    loss.some((x) => x.includes('F5') && x.includes('掉到')),
    `注记被抹掉必须判红,实测 ${JSON.stringify(loss)}`,
  )
  // absFloor 绝对下限豁免(G-1102638 批2)三向:未跌破水位不红(合法清偿)/跌破仍红(不是关闸)/
  // 水位高于实际值时 min 归位旧行为(只能放宽不能反向收紧)。noted=2 → unnoted=0。
  ok(
    !grewViolations(unnoted, noted, 0).some((x) => x.startsWith('F5')),
    'absFloor=0(基线退役水位)时注记全清不得判红 —— 物理归并专项的合法清偿出口',
  )
  ok(
    grewViolations(unnoted, noted, 5).some((x) => x.startsWith('F5')),
    '跌破 absFloor 水位仍必须判红(豁免不得写成关闸)',
  )
  ok(
    grewViolations(unnoted, noted, 99).some((x) => x.startsWith('F5')),
    'absFloor 高于实际值时 min 归位旧行为(2→0 仍红,不得反向比旧行为更松)',
  )
  ok(auditPlan('').counts.mergeNotes === 0, '空面不得凭空数出注记')
  // F6 块级重复:行级四条(F1–F4)对"整块被追加两遍"完全失明,所以这一组必须自成一把尺子。
  // 阈值(>=3 行 / 每行 >=40 字符)是实测调出来的:低于它,台账里天然的成对短行会把噪声当债务。
  const B1 = '- 第一行:整块登记的探针结论与取证命令,长度必须过阈值才纳入统计口径说明段'
  const B2 = '- 第二行:同一块的第二条 bullet,同样要够长,短行(`- [x]` 之类)不参与块级判据'
  const B3 = '- 第三行:第三条,三行构成一个"块";块是 F6 的量纲,单行不是 —— 这是本条的存在理由'
  const blk = [B1, B2, B3]
  const pad = (s) => s + '　'.repeat(Math.max(0, 42 - [...s].length))
  const block = blk.map(pad).join('\n')
  // 尾行刻意不是 bullet:bullet 会把上一个块"续"成 4 行 run,而 run 里只要有一行不够长,
  // 整个 run 就不入统计 —— 第一版夹具就栽在 `- 别的行` 这一行上(报 0 而非 1)。
  const oneCopy = auditPlan(`## 段\n${block}\n## 另一段\n尾部说明不是 bullet`)
  const twoCopies = auditPlan(`## 段\n${block}\n## 另一段\n${block}\n\n尾部说明不是 bullet`)
  ok(oneCopy.counts.dupBlocks === 0, `单份块不得数出重复,实测 ${oneCopy.counts.dupBlocks}`)
  ok(
    twoCopies.counts.dupBlocks === 1,
    `逐字相同的两份应算 1 块重复,实测 ${twoCopies.counts.dupBlocks}`,
  )
  ok(twoCopies.counts.dupBlockCopies === 2, `份数应为 2,实测 ${twoCopies.counts.dupBlockCopies}`)
  // 漂移(首行同而正文不同)不得混进"可自动收口"那一档 —— 机器折半必然有损,与 F4 同一条理由。
  // 首行**必须是登记行**(带复选框):这是 drifted 的候选条件,不是装饰 —— 判据侧按 `bodyOfRow` 剔掉
  // 切分产物(头注①:实测 24 组里 6 组是"续行小项裹进块",首行缺复选框压根不是登记两次),
  // 再用正文 Jaccard >= 5% 剔掉"首行撞号是巧合"(头注②)。所以本夹具首行必须写 `- [ ] …`。
  // 首行形态与判据同源 ⇒ 真实台账现读 `dupBlockDrifted = 8`(2026-10-06),这一维是活的。
  const R1 = `- [ ] ${B1.slice(2)}`
  const drift = auditPlan(
    `## 段\n${[pad(R1), pad(B2), pad(B3)].join('\n')}\n## 另一段\n${[pad(R1), pad(B2 + '(改)'), pad(B3)].join('\n')}`,
  )
  ok(drift.counts.dupBlocks === 0, `漂移副本不得算逐字重复,实测 ${drift.counts.dupBlocks}`)
  ok(drift.counts.dupBlockDrifted === 1, `漂移应单独计 1,实测 ${drift.counts.dupBlockDrifted}`)
  // 反向锁:裸 bullet 首行 + 正文漂移**恒为 0** —— 收窄语义是判据的有意设计(头注①②),不是漏报。
  // 没有这一条,下一个人会把 R1 改回裸 bullet 并把drifted 的实报数说成"坏了"(2026-10-06 本票的起因)。
  const driftNaked = auditPlan(
    `## 段\n${block}\n## 另一段\n${[pad(B1), pad(B2 + '(改)'), pad(B3)].join('\n')}`,
  )
  ok(
    driftNaked.counts.dupBlockDrifted === 0,
    `首行非登记行的漂移块不入drifted 候选(有意收窄),实测 ${driftNaked.counts.dupBlockDrifted}`,
  )
  // 阈值两向:2 行块与短行块都不算(否则会产出成百条噪声,把这一维淹掉)
  ok(auditPlan(`${pad(B1)}\n${pad(B2)}`).counts.dupBlocks === 0, '2 行块不得纳入块级判据')
  ok(auditPlan('- a\n- b\n- c\n- a\n- b\n- c').counts.dupBlocks === 0, '短行块不得纳入块级判据')
  // 方向:多出一份必点名,收口掉一份(清偿)不得判红
  ok(
    grewViolations(twoCopies, oneCopy).some((x) => x.startsWith('F6')),
    `由 0 块涨到 1 块必须判红,实测 ${JSON.stringify(grewViolations(twoCopies, oneCopy))}`,
  )
  ok(
    !grewViolations(oneCopy, twoCopies).some((x) => x.startsWith('F6')),
    '清偿(1 块降到 0)不得判红 —— 反方向判红等于没人敢做归并',
  )
  // 差值棘轮(提交链上的主判据):基准取不到时调用方根本不传 before,这里只比"变多"
  const mk = (f1, f2, f3) => ({
    counts: { forks: f1, voidRows: f2, rotatedPointers: f3, rotatedAuto: f3, rotatedNoExit: 0 },
  })
  ok(grewViolations(mk(4, 0, 0), mk(3, 0, 0)).length === 1, '相对 HEAD 变多必须点名')
  ok(grewViolations(mk(3, 0, 0), mk(3, 0, 0)).length === 0, '等值不得判红(存量债不归本次提交)')
  ok(grewViolations(mk(2, 5, 0), mk(3, 0, 0)).length === 1, '一项降一项升时只点名上涨的那项')
  // ── F7 归属分层 + F8 交代(2026-09-27 立,答的是"总量为什么一直在涨")──
  // 与 F1–F6 不同的量纲:那六条判"重复",这两条判"一条账有没有交代"。
  // 正例三形态各一条(带日期的活 / 已认领 / 归他人),反例一条(裸无日期无归属)——
  // 只有正反都钉住,才排除"分类恒返回 actionable 所以什么都不报"与"恒报"两种失效。
  const F7FIX = [
    '- [ ] **T1 有日期的活**:今晚就能做,进度见 2026-09-27。',
    '- [ ]（进行中@2026-09-27/someone） **T2 已认领**:有人在做。',
    '- [ ] **T3 归他人**:本票不认领,归属:守门 116 持有者。',
    '- [ ] **T4 等环境**:本机结构性缺环境(adb 不存在),解阻 = 环境到位。',
    '- [ ] **T5 等人拍板**:是否对外发布需用户确认,属 §24。',
    '- [ ] **T6 裸账**:既没日期、没说归谁、也没认领 —— 只该被这一条点名。',
    '',
  ].join('\n')
  const f7 = auditPlan(F7FIX)
  ok(
    f7.counts.dispOwnedElsewhere === 1 &&
      f7.counts.dispWaitingEnv === 1 &&
      f7.counts.dispWaitingHuman === 1,
    `归属三桶应各命中 1,实测 归他人 ${f7.counts.dispOwnedElsewhere} / 等条件 ${f7.counts.dispWaitingEnv} / 待人 ${f7.counts.dispWaitingHuman}`,
  )
  ok(
    f7.counts.dispActionable === 2,
    // T2 已认领 ⇒ 不进未认领分层(桶的基数是 unclaimed,不是全部未勾选);
    // T1 有日期但没有归属 ⇒ 仍算 actionable。有日期 ≠ 已交代归属,这两件事分开判。
    `可自派应为 2(T1 有日期 / T6 裸账),实测 ${f7.counts.dispActionable}`,
  )
  ok(
    f7.counts.dispActionable +
      f7.counts.dispWaitingHuman +
      f7.counts.dispWaitingEnv +
      f7.counts.dispOwnedElsewhere ===
      f7.counts.unclaimed,
    '四桶相加必须等于未认领行数(互斥且完备 —— 漏一桶就会有一批账在任何分层里都不现身)',
  )
  ok(
    f7.undisposed.length === 1 && f7.undisposed[0].raw.includes('T6'),
    `无交代必须只点 T6,实测 ${f7.undisposed.map((r) => r.raw.slice(0, 20)).join(' | ')}`,
  )
  // 反例逐条钉死:三样"算交代"的东西各一条 —— 少钉一条,实现退化成一刀切也照样绿
  ok(
    f7.undisposed.every((r) => !/T1|T2|T3|T4|T5/.test(r.raw)),
    '带日期/已认领/已归桶的行都算有交代,不得计成裸账',
  )
  // 优先级:同一行既说"归他人"又说"等环境" ⇒ 算别人的账(能不能做由该端决定,不是本机解阻)
  const prio = auditPlan('- [ ] **T7 双命中**:归属:desktop 持有人,阻塞主体在生产侧。')
  ok(
    prio.counts.dispOwnedElsewhere === 1 && prio.counts.dispWaitingEnv === 0,
    `双命中必须落"归他人",实测 归他人 ${prio.counts.dispOwnedElsewhere} / 等条件 ${prio.counts.dispWaitingEnv}`,
  )
  // ── F7c 遮"转述"必须成对钉死(G-1058610 病②)──
  // 同一句等待话,包在反引号里 = 转述别人的代码/文案 ⇒ 不得算成这条票在等人;
  // 包在中文引号里 = 本仓正当的拍板措辞 ⇒ 必须照算。
  // 两条必须同时成立:只留前者,判据会把真等待项一起洗成"可做"(摘牙);只留后者,
  // 派单人就照着一堆转述句去问用户 —— 实测这条把一条零阻塞可做的票挂成了"等人拍板"。
  const F7CFIX = [
    '- [ ] **T8 转述上游**:该态的成文理由写在源码里:`paused-log 正在等待用户继续上传` —— 我方现状 0 命中。',
    '- [ ] **T9 正当拍板措辞**:台账明写「属 §24 需用户确认」。',
    '',
  ].join('\n')
  const f7c = auditPlan(F7CFIX)
  ok(
    f7c.counts.dispActionable === 1 &&
      f7c.counts.dispWaitingHuman === 1 &&
      f7c.dispBuckets.actionable.length === 1 &&
      f7c.dispBuckets.actionable[0].raw.includes('T8'),
    `反引号内的转述不得算等待(应落 T8),中文引号内的正当措辞必须仍算(应落 T9),实测 可做=${f7c.counts.dispActionable} 待人=${f7c.counts.dispWaitingHuman} 名单=${f7c.dispBuckets.actionable
      .map((r) => r.raw.slice(0, 12))
      .join('|')}`,
  )
  // ── F7d 派单口径分桶(G-1058610 病①)──
  // 副本行在"未认领分层"里照旧计数(那是账面),但在"派单口径分层"里必须不现身 ——
  // 否则派单人照 70 去问,实际只有 20 件事,同一件会被问七遍。
  const F7DFIX = [
    '- [ ] **T10 原件**:是否对外发布需用户确认,属 §24。',
    '- [ ] **T10 原件**:是否对外发布需用户确认,属 §24。 〔【归并】重复登记副本(2026-10-05):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕',
    '',
  ].join('\n')
  const f7d = auditPlan(F7DFIX)
  ok(
    f7d.counts.dispWaitingHuman === 2 && f7d.counts.dispClaimWaitingHuman === 1,
    `同一件事的两份副本:账面口径必须仍数到 2 行,派单口径必须只留 1 件,实测 账面 ${f7d.counts.dispWaitingHuman} / 派单 ${f7d.counts.dispClaimWaitingHuman}`,
  )
  ok(
    f7d.counts.dispClaimActionable +
      f7d.counts.dispClaimWaitingHuman +
      f7d.counts.dispClaimWaitingEnv +
      f7d.counts.dispClaimOwnedElsewhere ===
      f7d.counts.claimable,
    `派单口径四桶相加必须等于 claimable(漏桶=有一件事在任何清单里都不现身),实测相加 ${
      f7d.counts.dispClaimActionable +
      f7d.counts.dispClaimWaitingHuman +
      f7d.counts.dispClaimWaitingEnv +
      f7d.counts.dispClaimOwnedElsewhere
    } vs claimable ${f7d.counts.claimable}`,
  )
  // ── F7e 派单面与过滤面同尺(票 G-1182552,2026-10-26)──
  // 立因是本席现读的真仓缺陷:文本 `--open --dispatchable` 报"可做 0",同一瞬间 JSON 的
  // counts.dispClaimActionable=5 —— 那 5 行侧车 owner 全部命中(归他人),照 JSON 派单的会话
  // 会把别人持有的票再领一遍(§1 认领即租约要防的"两席领同一张票";机主 2026-10-26 明令
  // 不允许两个 agent 打架重复做同一件任务)。这里把"派单桶 = v2 尺"与"v1 只准当影子"钉成契约:
  // 摘掉 v2 接线(换回裸 dispositionOf)必红,散文尺影子不报数也必红 —— 正反都钉死。
  const F7EFIX = [
    // 复刻 HEAD 面 G-957/G-863 那一型:散文一个归属字没写(v1 兜底算"可做"),侧车记着"归他人"。
    // 编号必须取本尺认得的族形态(实测裸 `T11` 取不到复合主键 ⇒ 夹具自己先被尺否证)。
    '- [ ] **D-11 侧车有主而散文沉默**:把登录页的按钮换成图标。',
    // 阳性对照:两侧都没说归属 ⇒ 两把尺必须一致判"可做"(证明 F7e 不是把派单面整体掐死)。
    '- [ ] **D-12 真无人认领的活**:明文字段加掩码,今晚可做。',
    '',
  ].join('\n')
  const t11Line = F7EFIX.split('\n')[0]
  const t11Key = compositeKeyOf(t11Line)
  ok(
    !!t11Key,
    `F7e 夹具的 D-11 必须能取到复合主键(取不到=夹具写法与本尺脱节),实测 ${t11Key}`,
  )
  // 夹具侧车刻意不落盘(§15b:判据夹具走 loadFields 的 text 入参,不碰真台账侧车)
  const f7efixFields = loadFields(
    ROOT,
    [
      JSON.stringify({
        key: t11Key,
        owner: 'fixture web 前端持有人',
        waiting: 'none',
        updatedAt: '2026-10-26T00:00:00.000Z',
        updatedBy: 'selftest-fixture',
      }),
      '',
    ].join('\n'),
  )
  const f7e = auditPlan(F7EFIX, { fields: f7efixFields })
  // 分母锁:侧车记录必须**真的命中**这一行(键对不上 ⇒ v2 静默回落散文,整组断言全部空转)
  ok(f7efixFields.map.get(t11Key)?.owner === 'fixture web 前端持有人', 'F7e 夹具侧车必须命中的 D-11 的复合主键')
  ok(
    // 反证:同一夹具不给侧车 ⇒ v2 回落散文 ⇒ 与 v1 影子同读数(证明正读数的变化全部来自侧车,不是换尺附带)
    (() => {
      const noFields = auditPlan(F7EFIX)
      return (
        noFields.counts.dispClaimActionable === 2 &&
        noFields.counts.dispClaimActionable === noFields.counts.dispClaimActionableProse
      )
    })(),
    '不给侧车时 v2 必须逐字回落散文尺(与影子同读数)',
  )
  ok(
    // 正读数(v2 尺):D-11 必须被剔出"可做"——否则"照 JSON 派单领别人票"的通道又开了
    f7e.counts.dispClaimActionable === 1 &&
      f7e.dispClaimBuckets.actionable.length === 1 &&
      f7e.dispClaimBuckets.actionable[0].raw.includes('D-12') &&
      f7e.counts.dispClaimOwnedElsewhere === 1 &&
      f7e.dispClaimBuckets['owned-elsewhere'][0].raw.includes('D-11'),
    `派单桶必须按 v2 尺把侧车有主的 D-11 记"归他人"、只把 D-12 留"可做",实测 可做=${f7e.counts.dispClaimActionable} 归他人=${f7e.counts.dispClaimOwnedElsewhere}`,
  )
  ok(
    // 影子读数(v1 尺):D-11 在散文尺下仍落"可做"(差值=侧车迁移进度),影子必须逐字报数,
    // 把影子删成 0/删键 = 拆掉迁移进度尺(§12f 不移别人锚点的另一面:也不许把自己的尺藏起来)。
    f7e.counts.dispClaimActionableProse === 2 &&
      f7e.counts.dispClaimOwnedElsewhereProse === 0 &&
      f7e.counts.dispClaimActionableProse - f7e.counts.dispClaimActionable === 1,
    `v1 影子必须如实报出散文尺读数(侧车不表态时兜底 actionable),实测 影子可做=${f7e.counts.dispClaimActionableProse} 影子归他人=${f7e.counts.dispClaimOwnedElsewhereProse}`,
  )
  ok(
    f7e.counts.dispClaimActionable +
      f7e.counts.dispClaimWaitingHuman +
      f7e.counts.dispClaimWaitingEnv +
      f7e.counts.dispClaimOwnedElsewhere ===
      f7e.counts.claimable,
    `换尺后四桶闭合必须照旧:相加=${
      f7e.counts.dispClaimActionable +
      f7e.counts.dispClaimWaitingHuman +
      f7e.counts.dispClaimWaitingEnv +
      f7e.counts.dispClaimOwnedElsewhere
    } vs claimable ${f7e.counts.claimable}`,
  )
  // 与过滤面的同尺性由形状锁保证(§0.6):过滤用 dispositionOfV2(dispatchable 档 :3285),
  // 桶用同一个 dispositionOfV2 —— 两消费点共读一个出口,任何一侧换尺都不会偷偷发生在这里。
  // 账面口径(F7 的 dispActionable*)不受本切换影响:它必须继续量"散文怎么说"(§12f)。
  ok(
    f7e.counts.dispActionable === 2 && f7e.counts.dispOwnedElsewhere === 0,
    `账面口径必须仍是 v1 散文尺(换尺只动派单桶),实测 账面可做=${f7e.counts.dispActionable} 账面归他人=${f7e.counts.dispOwnedElsewhere}`,
  )
  // F8a 只在差值档有意义:全量档它算不出来,必须显式"未判定"而不是悄悄当 0
  const headFace = auditPlan(F7FIX)
  const withNew = auditPlan(`${F7FIX}- [ ] **T8 本次新登记**:没有任何交代。`)
  ok(countNewUndisposed(headFace, null) === 0, '没有基准面时不得凭空数出"新增"')
  ok(headFace.counts.newUndisposed === undefined, '全量档不写 newUndisposed —— 报告据此喊"未判定"')
  ok(
    countNewUndisposed(withNew, headFace) === 1,
    `只有本次带进来的那一行计债(T8;存量 T6 已在基准面上,不算这次),实测 ${countNewUndisposed(withNew, headFace)}`,
  )
  ok(countNewUndisposed(headFace, headFace) === 0, '同一面自比必须为 0(否则每台提交都红)')
  // 反向对照:新增行**带了出生日**就不该计债 —— 这是"登记时顺手写个日期"的正当出路,
  // 也是这条判据不会退化成"新登记一律拦"的边界证明
  const okNew = auditPlan(`${F7FIX}- [ ] **T9 新登记带日期**:2026-09-27 立,解阻判据见正文。`)
  ok(
    countNewUndisposed(okNew, headFace) === 0,
    `带出生日的新登记不该加债,实测 ${countNewUndisposed(okNew, headFace)}`,
  )
  // F8 进 probe ⇒ 走同一套差值棘轮(涨判红 / 等值与下降不判)
  ok(
    probe(withNew).some(([k, , n]) => k === 'F8' && n === 0),
    'probe 必须带 F8 这一维(否则它不进差值棘轮 = 不判)',
  )
  withNew.counts.newUndisposed = 1
  headFace.counts.newUndisposed = 0
  ok(
    grewViolations(withNew, headFace).some((x) => x.startsWith('F8')),
    '新增无交代行变多必须点名',
  )
  ok(
    !grewViolations(headFace, withNew).some((x) => x.startsWith('F8')),
    '清偿(2 降到 0)不得判红 —— 否则没人敢补交代',
  )
  // 恒红门检查:默认档遇存量不得 exit 1;--strict 才判红(压力在新增侧与问责档)
  const staleRows = [
    {
      line: 7,
      raw: '- [ ] **T6 裸账**:老账。',
      anchor: '2020-01-01',
      age: 2400,
      disposition: 'actionable',
    },
    {
      line: 9,
      raw: '- [ ] **T8 老账**:也没人动。',
      anchor: '2020-01-02',
      age: 2400,
      disposition: 'actionable',
    },
  ]
  const gateFace = {
    counts: {
      forks: 0,
      voidRows: 0,
      rotatedPointers: 0,
      rotatedAuto: 0,
      rotatedNoExit: 0,
      newUndisposed: 0,
      stale: 2,
      undated: 5,
    },
    staleRows,
  }
  const log = console.log
  const capOf = (strict) => {
    const cap = []
    console.log = (s) => cap.push(String(s))
    try {
      return { rc: gate(gateFace, strict, ROOT, null, null), cap }
    } finally {
      console.log = log
    }
  }
  const d = capOf(false)
  const s = capOf(true)
  ok(d.rc === 0, `默认档遇到期存量不得 exit 1,实测 ${d.rc}`)
  ok(
    d.cap.some((x) => x.includes('默认档只报数') && x.includes('2 条')),
    `默认档必须报数并给出条数,实测 ${JSON.stringify(d.cap.slice(0, 2))}`,
  )
  ok(
    d.cap.some((x) => x.includes('无从判龄')),
    '默认档必须单独报"无从判龄"的条数(把看不见混进没问题是本仓最高频失效型)',
  )
  ok(s.rc === 1, `--strict 遇到期存量应判红,实测 ${s.rc}`)
  ok(
    s.cap.some((x) => x.includes('T6')),
    `--strict 必须报名(逐条列出),实测 ${JSON.stringify(s.cap.slice(0, 3))}`,
  )
  // 取号出口(不在提交链,是生产侧防线)。为什么不做成判据:同编号抢两个不同任务这件事**事后判不了** ——
  // 2026-09-27 实测真仓 HEAD 面 227 个带前缀编号里 57 个挂着多个标题,逐条看绝大多数是本仓子项命名惯例
  // (D30① / D30② / D19的"派发前置"),按它判红就是造一台噪声门。所以防线只能摆在登记那一刻。
  const nid =
    '- [ ] **G-1 甲**:说明\n- [ ] **G-7 乙**:说明\n- [ ] **O13b 丙**:说明\n- [ ]75. 章节内裸序号\n'
  ok(
    nextTaskIdLabel(nid, 'G') === 'G-8',
    `G 族下一个空闲号应为 G-8,实测 ${nextTaskIdLabel(nid, 'G')}`,
  )
  const gUsed = usedIdsOfPrefix(nid, 'G')
  ok(
    gUsed !== null && gUsed.used === 2 && gUsed.max === 7,
    `G 族应只数到 2 个号、最大 7(行首裸编号不占号段),实测 ${JSON.stringify(gUsed)}`,
  )
  ok(
    nextTaskIdLabel(nid, 'O') === 'O14',
    `O13b 与主号同段且本仓 O 族不带连字符 ⇒ 应为 O14,实测 ${nextTaskIdLabel(nid, 'O')}`,
  )
  ok(nextTaskIdLabel(nid, 'Z') === null, '该族一条都没有 ⇒ 判不出(null),不得给 "Z-1" 这种号')
  ok(nextTaskIdLabel(nid, '') === null, '空族名必须判不出,而不是退化成全族扫描')
  ok(
    usedIdsOfPrefix('- [ ]75. 只有裸序号\n', 'G') === null,
    '只有章节内裸编号的面 ⇒ G 族仍应报"一条没有",不是"0 号已用"',
  )
  // ── F9 撞号(2026-09-27 G-267):同编号不同标题前缀 >1 即点名;存量只报数,棘轮只拦新增 ──
  const F9FIX = [
    '- [ ]（进行中@2026-09-27/甲）**G-262 水印载荷按 HEAD 面补齐**:说明。',
    '- [ ] **G-262 git 进程积压另计**:另一件事。',
    '',
  ].join('\n')
  const f9 = auditPlan(F9FIX)
  ok(
    f9.counts.collisionGroups === 1 && f9.collisions[0].key === 'G-262' && f9.collisions[0].titleCount === 2,
    `F9 应恰好点名 G-262 被 2 个标题共用,实测 ${JSON.stringify(f9.collisions.map((g) => [g.key, g.titleCount]))}`,
  )
  // 反例 1:同题副本(标题逐字等值)是 F4 的病,不是撞号。
  ok(
    auditPlan('- [ ] **G-9 同一件事**:第一条。\n- [ ] **G-9 同一件事**:第二条。').counts
      .collisionGroups === 0,
    '同题副本不得算撞号(F4 与 F9 判据不串门)',
  )
  // 反例 2:退化标题(切完只剩编号)不贡献"第二个标题"—— M16 钉过的形态不得在 F9 里复活。
  ok(
    auditPlan(
      '- [x] ✅(2026-09-27) **G-257. 审计日志族「参数校验失败被掩盖成 500」已修(7 站点/2 文件)**:病灶形态\n' +
        '- [ ] **G-257(新登记)**:`check-agent-engine-parity.mjs` 的可跑性依赖 cwd',
    ).counts.collisionGroups === 0,
    '两行退化标题同编号不得算撞号(它们给不出"编号之外的实质标题")',
  )
  // 反例 3:一个实质标题 + 一个退化标题 ⇒ 只有 1 个标题,不算撞号。
  ok(
    auditPlan(
      '- [ ] **G-258 实质议题**:真标题。\n- [ ] **G-258(新登记)**:退化标题行',
    ).counts.collisionGroups === 0,
    `退化标题不得被算成第二个标题,实测 ${auditPlan('- [ ] **G-258 实质议题**:真标题。\n- [ ] **G-258(新登记)**:退化标题行').counts.collisionGroups}`,
  )
  // 修法不自伤:归并器 F4 指针追加在行尾(标题不变)、F1 翻勾产出 `**【归并】**` 前缀(标题被切为空)
  // ⇒ 两条正当修法都不得制造新撞号(否则"唯一正确修法"会被自己的判据拦)。
  const healForm = auditPlan(
    '- [x] ✅(2026-09-26) **D99 复合主键正例**:说明。\n' +
      '- [x] ✅(2026-09-27) **【归并】** 本行与已完成登记同题 ⇒ 只落状态、不删行。 **D99 复合主键正例**:旧副本。',
  )
  ok(healForm.counts.collisionGroups === 0, `F1 归并产物不得算撞号,实测 ${healForm.counts.collisionGroups}`)
  // ── F9 的"编号位"收窄(2026-09-28 G-417):行文引用与畸形号子串**不是**第二次登记 ──
  // 三条各守一个方向,且都自带"旧口径(全文窗口命中)一定会判红"的对照 —— 那才是变异自证:
  // 反向用例绿了,必须绿在"只看编号位"这一条上,而不是绿在"这一型本来就没被扫到"。
  const f9TruePair = '- [ ] **G-300 真撞号甲**:第一件事。\n- [ ] **G-300 真撞号乙**:另一件事。'
  const f9Ref =
    '- [ ] **G-300 交叉引用甲**:第一件事。\n' +
    '- [x] ✅(2026-09-28) 本行只是回顾 G-300 已收口,没有登记新任务,不得算第二次登记。'
  const f9Malformed =
    '- [ ] G-302 **真登记行**:一件事。\n- [ ] G-G-302 **畸形号行**:取号令牌已含族名、正文又手填了一个 G-。'
  const f9Archived =
    '<!-- 已归档(2026-09-20):G-303 任务,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-09-20.md -->\n' +
    '- [ ] **G-303 真登记**:一件事。\n' +
    '- [x] ✅(2026-09-20) 归档说明:本条 G-303 的正文已搬入 .ihui-agent/archive/PROJECT_PLAN_2026-09-20.md。'
  const narrowOf = (content) =>
    narrowCollisionsToIdPosition(content, auditPlan(content).collisions)
  ok(
    narrowOf(f9TruePair).groups.length === 1 &&
      narrowOf(f9TruePair).groups[0].titleCount === 2,
    `两行编号位同号必须**仍然**判撞号(收窄不是放松),实测 ${JSON.stringify(narrowOf(f9TruePair).groups.map((g) => [g.key, g.titleCount]))}`,
  )
  ok(
    auditPlan(f9Ref).counts.collisionGroups === 1,
    '变异自证:旧口径(窗口内任意命中)必须仍把这条叙述引用判成撞号,否则"收窄"这一笔没有牙',
  )
  ok(
    narrowOf(f9Ref).groups.length === 0,
    `行文引用不得算第二次登记(编号位给不出本行主键),实测 ${JSON.stringify(narrowOf(f9Ref).groups)}`,
  )
  ok(
    auditPlan(f9Malformed).counts.collisionGroups === 1,
    '变异自证:畸形双前缀号在旧口径下确实被切成主键并造出撞号组',
  )
  ok(
    narrowOf(f9Malformed).groups.length === 0,
    `G-G-302 里的「G-302」是子串命中而非编号位 ⇒ 不得计入,实测 ${JSON.stringify(narrowOf(f9Malformed).groups)}`,
  )
  ok(
    narrowOf(f9Archived).groups.length === 0 && narrowOf(f9Archived).droppedTitles === 1,
    `归档占位/说明行里的历史号不得计入(非条目行不入面 + 条目行的编号位没有号),实测 ${JSON.stringify(narrowOf(f9Archived))}`,
  )
  // 判据与读数必须同步收窄:probe / 键集 / 差值三处都从同一把面取,不得一处宽一处窄。
  const narrowFace = narrowF9Face(auditPlan(f9Ref), f9Ref)
  ok(
    narrowFace.counts.collisionGroups === 0 &&
      narrowFace.collisions.length === 0 &&
      narrowFace.counts.f9WideGroups === 1,
    `narrowF9Face 必须同时改 counts.collisionGroups 与 collisions(组数与名单分叉时,红会点不出名),实测 ${JSON.stringify([narrowFace.counts.collisionGroups, narrowFace.collisions.length, narrowFace.counts.f9WideGroups])}`,
  )
  ok(f9KeySetOf(narrowFace).length === 0, '收窄后的键集不得再把叙述引用号喂给基线棘轮')
  // ── F9 题面归一的三型取材口径(2026-10-05,修"F9 数到自己产的形态")──────────
  // 成对写:三型各一条"必须绿",真撞号与**分叉前缀**各一条"必须红"。
  // 只留绿的那三条 = 没有牙(判据失效的表现永远是安静);摘掉任何一型,§22c 镜像测试
  // `scripts/tests/plan-task-index-f9-title-normalization.test.mjs` 里对应的变异用例会翻红点名。
  const f9TailNote =
    '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型\n' +
    '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记,派单以那条为准。〕'
  const f9PrefixNest =
    '- [ ] **G-500 D6-G1 v2 执行器:适配器入库 + 四个 surface 全部接线** —— 交付说明。\n' +
    '- [ ] **G-500 D6-G1 v2 执行器适配器已入库并单测真跑,但四个 surface 刻意未接** —— 交付说明。'
  const f9ForeignLead =
    '- [ ] **G-501 登录态串号甲**:第一件事。\n' +
    '- [ ] **G-501 D129 登录态串号甲**:同一件事,只是题面开头多写了别人的号(承 D129,不占该号)。'
  const f9ThinForeign =
    '- [ ] **G-504 D160 补注**:指针行。\n- [ ] **G-504 运维班次这一格已补**:另一件事。'
  const f9Branched =
    '- [ ] **G-503 登录态串号**:一件事。\n' +
    '- [ ] **G-503 登录态串号已修**:第二件事。\n' +
    '- [ ] **G-503 登录态串号复发**:第三件事。'
  for (const [name, face] of [
    ['①行尾〔…〕注记', f9TailNote],
    ['②精确前缀套叠', f9PrefixNest],
    ['③题面开头他号引用', f9ForeignLead],
  ]) {
    const got = narrowF9Face(auditPlan(face), face)
    ok(
      got.counts.collisionGroups === 0 && got.collisions.length === 0,
      `F9 归一:「${name}」是同一件事的合法形态,不得算第二次登记,实测 ${JSON.stringify(got.collisions.map((g) => [g.key, g.titleCount]))}`,
    )
  }
  const f9True2 = narrowF9Face(auditPlan(f9TruePair), f9TruePair)
  ok(
    f9True2.counts.collisionGroups === 1 && f9True2.collisions[0].titleCount === 2,
    `F9 归一不得放松判据:两个互不相干的标题同号必须仍判一组,实测 ${JSON.stringify(f9True2.collisions.map((g) => [g.key, g.titleCount]))}`,
  )
  const f9Branch = narrowF9Face(auditPlan(f9Branched), f9Branched)
  ok(
    f9Branch.counts.collisionGroups === 1 && f9Branch.collisions[0].titleCount === 2,
    `并桶只认**精确前缀**不认相似度:甲 ⊂ 甲乙 与 甲 ⊂ 甲丙 分叉时必须仍剩 2 个标题,实测 ${JSON.stringify(f9Branch.collisions[0]?.titles?.map((t) => t.title))}`,
  )
  const f9Thin = narrowF9Face(auditPlan(f9ThinForeign), f9ThinForeign)
  ok(
    f9Thin.counts.collisionGroups === 1 && f9Thin.collisions[0].titles.some((t) => t.title === 'D160补注'),
    `他号让位在"剥完给不出实质题面"时必须逐字退回原样(不许没收覆盖面),实测 ${JSON.stringify(f9Thin.collisions[0]?.titles?.map((t) => t.title))}`,
  )
  // ── F9 定级(2026-10-06 立 / 2026-10-29 按 G-455 改判据):按**活题面数**判 ─────────
  // 成对写:一条"已完成历史行必须降档"(正向)+ 一条"两个活题面必须仍红"(反向锁,也是**变异自证**)
  // + 两条"读不到行仍红"(fail-closed)。反向锁这一条最要紧:任何"顺手放宽"的改法(按号剔、
  // 按行剔、把活题面判成历史)都会让它变红 —— 它是本族唯一会变红的那条。
  const f9AllDone =
    '- [x] **G-610 历史快照甲**:当年的一件事。\n' +
    '- [x] **G-610 历史快照乙**:同一件事的另一份措辞(措辞随时间演进,不是逐字重复)。'
  // 混合组:甲已完成、乙未勾。旧判据(组内每一行都 done 才降档)判红;G-455 的判据只认
  // "还有没有两个活题面" ⇒ 只剩一个活题面,不判红、但必须报名。
  const f9Mixed =
    '- [x] **G-611 历史快照甲**:当年的一件事。\n' +
    '- [ ] **G-611 历史快照乙**:同一件事的另一份措辞。'
  // 真撞号:两个题面各自都有未勾行 ⇒ 无论判据怎么收窄都必须仍红(变异自证用这一条)。
  const f9LivePair =
    '- [ ] **G-612 活票甲**:一件事。\n' +
    '- [ ] **G-612 活票乙**:完全另一件事。'
  const f9SettledFace = narrowF9Face(auditPlan(f9AllDone), f9AllDone)
  ok(
    f9SettledFace.counts.collisionGroups === 0 &&
      f9SettledFace.collisions.length === 0 &&
      f9SettledFace.counts.f9SettledGroups === 1 &&
      f9SettledFace.counts.f9SettledAllDone === 1 &&
      f9SettledFace.f9Settled[0]?.key === 'G-610',
    `已完成历史行必须降为只报数(且降档名单与成因可定位),实测 ${JSON.stringify([f9SettledFace.counts.collisionGroups, f9SettledFace.counts.f9SettledGroups, f9SettledFace.counts.f9SettledAllDone, f9SettledFace.f9Settled.map((g) => g.key)])}`,
  )
  const f9MixedFace = narrowF9Face(auditPlan(f9Mixed), f9Mixed)
  ok(
    f9MixedFace.counts.collisionGroups === 0 &&
      f9MixedFace.counts.f9SettledGroups === 1 &&
      f9MixedFace.counts.f9SettledAllDone === 0 &&
      f9MixedFace.f9Settled[0]?.key === 'G-611',
    `G-455:只剩一个活题面的组不是"两件事抢一个号",降为只报数且必须报名(不得静默消失),实测 ${JSON.stringify([f9MixedFace.counts.collisionGroups, f9MixedFace.counts.f9SettledGroups, f9MixedFace.counts.f9SettledAllDone, f9MixedFace.f9Settled.map((g) => g.key)])}`,
  )
  const f9LiveFace = narrowF9Face(auditPlan(f9LivePair), f9LivePair)
  ok(
    f9LiveFace.counts.collisionGroups === 1 &&
      f9LiveFace.collisions[0]?.key === 'G-612' &&
      f9LiveFace.counts.f9SettledGroups === 0,
    `变异自证(反向锁):两个题面各有未勾活行 ⇒ 必须仍判红。把本族改成"按号剔/按行剔/把活题面算历史"任一种,只有这一条会红,实测 ${JSON.stringify([f9LiveFace.counts.collisionGroups, f9LiveFace.counts.f9SettledGroups, f9LiveFace.collisions.map((g) => g.key)])}`,
  )
  ok(
    narrowCollisionsToIdPosition(f9Mixed, auditPlan(f9Mixed).collisions).groups.length === 1,
    '变异自证:定级这一刀不得顺带改掉"收窄到编号位"那一层(两笔改动互相掩盖时,一条坏了另一条会顶着看不出来)',
  )
  ok(
    splitF9SettledGroups(f9Mixed, [{ key: 'X-1', titleCount: 2, titles: [] }]).groups.length === 1,
    'fail-closed:组明细里取不到任何题面 ⇒ 那是"没量到"不是"量到没有活行",必须仍判红',
  )
  ok(
    splitF9SettledGroups(f9Mixed, [
      { key: 'Y-1', titleCount: 2, titles: [{ title: '甲', lines: [999] }, { title: '乙', lines: [998] }] },
    ]).groups.length === 1,
    'fail-closed:行号取不到对应行(面被换过/裁剪过)时必须仍判红,不得当成历史行放过',
  )
  ok(
    splitF9SettledGroups(f9AllDone, [
      { key: 'Z-1', titleCount: 2, titles: [{ title: '甲', lines: [1] }, { title: '乙', lines: [2] }] },
    ]).settled.length === 1,
    '纯函数自证:两条 `- [x]` 的组必须被认成历史行(否则上面那条正向用例是碰巧过的)',
  )
  ok(
    narrowF9Face(auditPlan(f9AllDone), f9AllDone).counts.collisionGroups +
      narrowF9Face(auditPlan(f9AllDone), f9AllDone).counts.f9SettledGroups ===
      auditPlan(f9AllDone).counts.f9DeclaredGroups,
    `判红组数 + 降档组数 必须等于收窄后的总组数(少同步一处,账面就会自相矛盾),实测 ${JSON.stringify([narrowF9Face(auditPlan(f9AllDone), f9AllDone).counts, auditPlan(f9AllDone).counts.f9DeclaredGroups])}`,
  )
  // 成套性 + 方向:进 probe ⇒ 走同一套差值棘轮;涨点名、平不点名;存量(含 --strict)不判红。
  ok(
    probe(f9).some(([k, , n]) => k === 'F9' && n === 1),
    'F9 未进 probe 维度清单 ⇒ 提交链根本不判它',
  )
  const f9face = (n, groups) => ({
    counts: {
      forks: 0,
      voidRows: 0,
      rotatedPointers: 0,
      rotatedAuto: 0,
      rotatedNoExit: 0,
      dupOpenCopies: 0,
      verbatimDupCopies: 0,
      dupBlocks: 0,
      newUndisposed: 0,
      mergeNotes: 99,
      collisionGroups: n,
    },
    staleRows: [],
    collisions: groups,
  })
  const g1 = [{ key: 'G-262', titleCount: 2, titles: [{ title: '水印载荷按HEAD面补齐', lines: [2] }, { title: 'git进程积压另计', lines: [3] }] }]
  ok(
    grewViolations(f9face(1, g1), f9face(0, [])).some((x) => x.startsWith('F9')),
    '新增撞号组必须被差值棘轮点名',
  )
  ok(
    !grewViolations(f9face(0, []), f9face(1, g1)).some((x) => x.startsWith('F9')),
    '清偿撞号(合并标题)不得判红 —— 否则没人敢修',
  )
  const newG = newCollisionGroups(f9face(1, g1), f9face(0, []))
  ok(newG.length === 1 && newG[0].key === 'G-262', `newCollisionGroups 应点名 G-262,实测 ${JSON.stringify(newG.map((g) => g.key))}`)
  ok(newCollisionGroups(f9face(0, []), null).length === 0, '没有基准面时不得凭空数出新增撞号')
  // 恒红门检查:存量撞号(哪怕 --strict)只报数不判红 —— 定级理由见 lib findIdCollisions 头注。
  const f9log = console.log
  const f9cap = []
  console.log = (s) => f9cap.push(String(s))
  let f9rc
  try {
    f9rc = gate(f9face(59, []), true, ROOT, null, null)
  } finally {
    console.log = f9log
  }
  ok(f9rc === 0, `--strict 遇存量撞号不得判红(恒红门),实测 exit ${f9rc}`)
  ok(
    f9cap.some((x) => x.includes('F9') && x.includes('59')),
    `--strict 绿档也必须把存量撞号数报出来,实测 ${JSON.stringify(f9cap.slice(0, 2))}`,
  )
  // ── F9 基线锚点 = 键集合(2026-09-27 G-312):四态各一条,成对 ──
  const KEYS = ['D17', 'D30', 'G-262']
  const grp = (key, n = 2) => ({
    key,
    titleCount: n,
    titles: Array.from({ length: n }, (_, i) => ({
      title: `${key} 标题${'甲乙丙'[i] ?? i + 1}`,
      lines: [i + 1],
    })),
  })
  const kface = (gs) => f9face(gs.length, gs)
  ok(f9Ratchet({ F9: KEYS }, kface(KEYS.map(grp))).kind === 'ok', '基线含全部现键必须判绿')
  const rAdd = f9Ratchet({ F9: KEYS }, kface([...KEYS.map(grp), grp('Z-9')]))
  ok(rAdd.kind === 'red' && rAdd.added.join() === 'Z-9', `新撞号键必须只点名 Z-9,实测 ${JSON.stringify(rAdd)}`)
  ok(
    f9Ratchet({ F9: KEYS }, kface([grp('D17', 3), grp('D30'), grp('G-262')])).kind === 'ok',
    '同键多挂一行(键集不变)不得移动读数 —— 这正是与计数锚的语义差',
  )
  ok(
    f9Ratchet({ F9: KEYS }, kface([grp('D30'), grp('G-262'), grp('Z-9')])).kind === 'red',
    '等量换键(组数不变而键集变)必须红 —— 计数锚对这一型恒绿,本次迁移换来的就是它',
  )
  const rOld = f9Ratchet({ F9: 59 }, kface(KEYS.map(grp)))
  ok(rOld.kind === 'unmigrated', `整数旧形状必须判"形状未迁移"而不是静默放行,实测 ${JSON.stringify(rOld)}`)
  ok(
    f9Ratchet({ F9: KEYS }, { counts: { collisionGroups: 2 } }).kind === 'blind',
    '有组数却没带逐组明细 ⇒ 判"未判定",不记通过',
  )
  ok(f9Ratchet({ F1: 0 }, kface([])).kind === 'absent', '基线缺 F9 键 ⇒ 不判该项(与 ratchet 同一条善意)')
  const pWiden = planF9BaselineRewrite({ F9: KEYS }, [...KEYS, 'Z-9'])
  ok(pWiden.action === 'refuse-widen', `扩大键集必须拒绝,实测 ${JSON.stringify(pWiden)}`)
  ok(
    planF9BaselineRewrite({ F9: 59 }, KEYS).action === 'refuse-shape' &&
      planF9BaselineRewrite({ F1: 0 }, KEYS).action === 'refuse-shape',
    '旧形状 / 缺 F9 键都不得由 --update-baseline 凭空补一份地板',
  )
  ok(
    planF9BaselineRewrite({ F9: KEYS }, [...KEYS].reverse()).action === 'noop' &&
      planF9BaselineRewrite({ F9: KEYS }, ['D17']).action === 'write',
    '同键集(乱序)不写盘、收窄才写盘',
  )
  const splice = replaceTopLevelJsonValueText('{"F1": 0,\n  "F9": 59\n}\n', 'F9', '["D17"]')
  ok(
    splice === '{"F1": 0,\n  "F9": ["D17"]\n}\n',
    `原位替换必须只动 F9 那一段值,实测 ${JSON.stringify(splice)}`,
  )
  let spliceThrew = false
  try {
    replaceTopLevelJsonValueText('{"F1": 0}\n', 'F9', '[]')
  } catch {
    spliceThrew = true
  }
  ok(spliceThrew, '找不到 F9 键时必须抛错,不得静默"当作没有"')
  ok(
    ratchetViolations({ F9: 59 }, [['F9', '撞号:同编号挂多个不同标题(组)', 60]]).join() ===
      'F9 撞号:同编号挂多个不同标题(组) 由基线 59 涨到 60',
    '整数旧形状在两参调用方(converge)一侧文案不得变 —— 改动只能落在 F9 的新形状上',
  )
  ok(
    ratchetViolations({ F9: KEYS }, probe(kface([...KEYS.map(grp), grp('Z-9')]))).join().includes('粗尺'),
    '键集形状 + 未给判定面 ⇒ 退化成粗尺且必须自报',
  )
  ok(
    !ratchetViolations({ F9: KEYS }, probe(kface(KEYS.map(grp)))).length,
    '粗尺:组数没超过基线键数时不得判红(恒红门)',
  )
  // ── F3 的"可自动收口"资格(2026-09-28 立):它决定的是**归并器能不能落笔**,不是"这条烂没烂" ──
  // 判据必须与"改上去那句锚点说什么"逐字同形,否则:
  //  · 两句都不成立却判 auto ⇒ 出口把一句核验不了的话写进台账(= 替别人编证据);
  //  · 一律判 not-auto ⇒ 这一维永不为红,而它挂在 blocking 提交链上,等于把 F3 的自动档关掉。
  // 三条各钉一个方向(键等值 / 两边都无键 / 无键但有逐字孪生),缺任一条都另一种失效不会被发现。
  const keyedPair = [
    '# 计划',
    '- [x] ✅(2026-09-26) **D90 权威登记**:正文。',
    '- [x] ✅(2026-09-26) **D90 权威登记**:副本,同主键的另一条登记在 L2。',
  ].join('\n')
  const kp = auditPlan(keyedPair).rotated
  ok(kp.length === 1 && kp[0].autoFixable === true, '两侧同复合主键(且都有主键)⇒ 那句「同主键登记」是真话,必须可自动收口')
  // 两边都**没有**主键:`compositeKeyOf` 一律返回 null,而 null===null 不是"同主键"。
  // 旧判据正是从这里放行,于是给一句"与本行正文逐字相同"写给一份孪生都没有的行(2026-09-28 实测:
  // 面上逐字相同份数 = 1 的那一行被认成可自动收口);而它随任何一次 append 自己长回红 —— 这一维在
  // blocking 提交链上,红自己会长回来 = 每台每次提交被逼 --no-verify(§12f 那一型)。
  const keylessPair = [
    '# 计划',
    '- [x] ✅(2026-09-26) **[归并]** 无主键的行甲:正文不同。',
    '- [x] ✅(2026-09-27) **[归并]** 无主键的行乙:同主键的另一条登记在 L2。',
  ].join('\n')
  const kl = auditPlan(keylessPair).rotated
  ok(
    kl.length === 1 && kl[0].autoFixable === false,
    `两边都无主键时 null===null 不得算"同主键"(实测 ${JSON.stringify(kl.map((x) => x.autoFixable))})`,
  )
  ok(
    kl.length === 1 && kl[0].reason === '行号指针即使还指得准也不许存在(§1 要求内容锚点)',
    '收紧资格不得让这条指针从账上消失 —— 它仍须被点名交人工(否则"不判红"就是"没判")',
  )
  // 无主键**但确有逐字孪生**:出口那句"与本行正文逐字相同,可按正文检索"就是可核验的事实 ⇒ 必须允许。
  // 这一条同时是"上面收紧没有把自动档关掉"的反向对照(2026-09-28 由 --heal 收掉 21 行的正是这一型)。
  const twinLine = '- [ ] 无主键行:存活于 L2 的同编号登记。〔孪生〕'
  const twinFixture = ['# 计划', '- [x] ✅(2026-09-26) **D91 权威登记**:正文。', twinLine, twinLine].join('\n')
  const tw = auditPlan(twinFixture).rotated
  ok(
    tw.length === 2 && tw.every((x) => x.autoFixable === true),
    `有逐字孪生的无主键行必须可自动收口(实测 ${JSON.stringify(tw.map((x) => x.autoFixable))})`,
  )
  // ── F10 翻勾回写候选(守门 130 缺的那个维度)──
  // 红 / 绿 / **未判定**三例各一,缺一条就分不出"回写型"与"有意重开"(票面:`候选 ≠ 结论`)。
  // 史证行取**真实形态**:历史提交里新增的 `- [x] ✅(日期) **编号 标题**…`(经 FLIPPED_ROW_RE 认)。
  const f10Ev = (raw, sha = 'deadbeef000', day = '2026-09-29') => ({ raw, sha, day })
  const f10Flip = '- [x] ✅(2026-09-29) **D99 复合主键正例**:说明文字。'
  const f10OpenSame = '- [ ] **D99 复合主键正例**:说明文字。'
  const f10Red = findReopenedFlipCandidates(f10OpenSame, [f10Ev(f10Flip)])
  ok(
    f10Red.candidates.length === 1 &&
      f10Red.candidates[0].id === 'D99' &&
      f10Red.candidates[0].verdict === 'rewrite',
    `F10 红例:已勾份数为 0 而仍有未勾行、且与首次翻勾行逐字同句 ⇒ 回写型候选,实测 ${JSON.stringify(f10Red.candidates)}`,
  )
  ok(
    f10Red.candidates[0].openLines.length === 1 &&
      f10Red.candidates[0].firstDay === '2026-09-29' &&
      f10Red.candidates[0].key.includes('#'),
    'F10 候选必须带未勾行号 / 首次翻勾日期 / 复合主键(只报数不报名就是没人能定位的数)',
  )
  // 绿例:结论面该主键**还有已勾份** ⇒ 属 F1 射程,本维不得重复判债(否则与 F1 顶结论)。
  const f10Green = findReopenedFlipCandidates(`${f10Flip}\n${f10OpenSame}`, [f10Ev(f10Flip)])
  ok(
    f10Green.candidates.length === 0,
    `F10 绿例:既有已勾份又未勾 ⇒ 归 F1,本维不得点名,实测 ${f10Green.candidates.length}`,
  )
  // 未判定例:未勾行措辞与首次翻勾行不同(多半带了重开说明)⇒ 落 undetermined 交人工,**绝不自动翻勾**。
  const f10Undet = findReopenedFlipCandidates(
    '- [ ] **D99 复合主键正例**:〔已复核,证据更新,有意重开〕',
    [f10Ev(f10Flip)],
  )
  ok(
    f10Undet.candidates.length === 1 &&
      f10Undet.candidates[0].verdict === 'undetermined' &&
      f10Undet.undetermined === 1,
    `F10 未判定例:措辞已变必须落 undetermined(不是 rewrite),实测 ${JSON.stringify(f10Undet.candidates.map((c) => c.verdict))}`,
  )
  // 反向锁:没有史证(flippedRows 空)时**恒不成候选** —— 否则本维会退化成"凡未勾者皆可疑"。
  ok(
    findReopenedFlipCandidates(f10OpenSame, []).candidates.length === 0,
    'F10 无史证时不得点名(本维的前提是"历史上确实翻过勾",没史证就是没量到)',
  )
  // 结构性防线:本维绝不许进 probe 差值棘轮 —— 瞬时读数 + 210s 取证 ⇒ 恒红门(§12e)。
  // 与 F4c 那条同一纪律(见其自测注释):"把出口拆掉仍绿"的变异必须被咬住。
  ok(
    !probe({ counts: {} }).some(([k]) => k === 'F10'),
    'F10 绝不许进 probe 差值棘轮(会变成与任何提交无关的恒红门,§12e/§12f)',
  )
  // ── F11 等人拍板一律禁止(2026-10-23 机主强制令)──
  // 名单尺 = v2(侧车优先、散文回落);无 fields 的构造面即散文档。
  const WH1 = '- [ ] **G-900 等人拍板**:是否对外发布需用户确认,属 §24。'
  const f11Face = auditPlan(`# 计划\n- [ ] **T1 真活**:现在就能做。\n${WH1}\n`)
  ok(
    f11Face.counts.waitingHuman === 1 && f11Face.waitingHumanRows[0].raw === WH1,
    `F11 名单必须恰好点出 G-900,实测 ${JSON.stringify(f11Face.waitingHumanRows.map((r) => r.raw.slice(0, 20)))}`,
  )
  // 差值档:带租约与否都算(禁令没有"已认领"豁免档);同主键改写不算新增,无主键改写算新增。
  const f11Before = auditPlan('# 计划\n- [ ] **T1 真活**:现在就能做。\n')
  ok(
    newWaitingHumanRows(f11Face, f11Before).length === 1,
    `新带入一条等人拍板必须点名 1 行,实测 ${newWaitingHumanRows(f11Face, f11Before).length}`,
  )
  ok(
    newWaitingHumanRows(f11Face, f11Face).length === 0,
    '同一行两把面都有 ⇒ 存量不得记在本次提交头上',
  )
  ok(
    newWaitingHumanRows(f11Face, null).length === 0 &&
      typeof newWaitingHumanRows(f11Face, {})[0] === 'undefined',
    '没有基准面 ⇒ 不判(返回空),绝不"全部算新增"(与 F8a/F9 同一条禁令)',
  )
  const f11EditedSameKey = auditPlan('# 计划\n- [ ] **G-900 等人拍板**:需用户确认(补注@2026-10-23)。\n')
  ok(
    f11EditedSameKey.counts.waitingHuman === 1,
    '改写行必须仍被 v2 尺判为等人拍板(否则"同主键不算新增"一例是空转)',
  )
  ok(
    newWaitingHumanRows(f11EditedSameKey, f11Face).length === 0,
    '同复合主键的行改写不得算新增(否则没人敢给存量结清追加进展注记)',
  )
  const keylessOld = auditPlan('# 计划\n- [ ] 需用户确认后才能做的叙述式待办(无编号)。\n')
  const keylessNew = auditPlan('# 计划\n- [ ] 需用户确认后才能做的叙述式待办(无编号)(补注)。\n')
  ok(
    newWaitingHumanRows(keylessNew, keylessOld).length === 1,
    '无主键行按逐字原文比(与 F8a 同口径):改写即新增,逼作者交代',
  )
  // 基线层四臂:absent(缺项不判)/ unmigrated(形状不对=关着,不得静默)/ blind(有数无名单)/ red-ok。
  ok(f11Ratchet({}, f11Face).kind === 'absent', '基线缺 F11 键 ⇒ 不判该项(缺项不判的既有善意)')
  ok(f11Ratchet({ F11: 0 }, f11Face).kind === 'unmigrated', 'F11 写成整数 = 这一维关着,必须报未迁移')
  ok(
    f11Ratchet({ F11: [] }, { counts: { waitingHuman: 1 } }).kind === 'blind',
    '有行数却没名单 ⇒ 判"未判定",不冒红也不记绿',
  )
  ok(f11Ratchet({ F11: [] }, f11Face).kind === 'red', '强制令地板 []:任何等人拍板键都是基线外新增')
  ok(
    f11Ratchet({ F11: [] }, auditPlan('# 计划\n- [ ] **T1 真活**:现在就能做。\n')).kind === 'ok',
    '名单为空 ⇒ 绿(清偿后的目标态)',
  )
  // 绝对层接线:ratchetViolations 拿到面必须走 F11 精确档;没拿到面 ⇒ 不判(无粗尺可用,头注已明写)。
  ok(
    ratchetViolations({ F11: [] }, probe(f11Face), f11Face).some((x) => x.startsWith('F11')),
    '基线棘轮必须报 F11 红(只靠 gate 点名而 ratchetViolations 失明 = converge 那一型漏看守)',
  )
  ok(
    !ratchetViolations({ F11: [] }, probe(f11Face)).some((x) => x.startsWith('F11')),
    '没给判定面 ⇒ F11 不判(差值计数在全量面恒 0,冒充粗尺会恒绿)',
  )
  // 方向锁:涨必红、清必绿(反方向判红 = 没人敢清存量)。
  ok(
    grewViolations({ counts: { newWaitingHuman: 1 } }, { counts: { newWaitingHuman: 0 } }).some(
      (x) => x.startsWith('F11'),
    ),
    'F11 由 0 涨到 1 必须进差值红名单',
  )
  ok(
    !grewViolations({ counts: { newWaitingHuman: 0 } }, { counts: { newWaitingHuman: 1 } }).some(
      (x) => x.startsWith('F11'),
    ),
    'F11 清偿(1 降到 0)不得判红',
  )
  // ── F12 等条件一律禁止(2026-10-25 机主令,与 F11 同型;例形状与 F11 逐条对齐)──
  const WE1 = '- [ ] **G-901 等条件**:等机主提供 XX 后才能做。'
  const f12Face = auditPlan(`# 计划\n- [ ] **T1 真活**:现在就能做。\n${WE1}\n`)
  ok(
    f12Face.counts.waitingEnv === 1 && f12Face.waitingEnvRows[0].raw === WE1,
    `F12 名单必须恰好点出 G-901,实测 ${JSON.stringify(f12Face.waitingEnvRows.map((r) => r.raw.slice(0, 20)))}`,
  )
  const f12Before = auditPlan('# 计划\n- [ ] **T1 真活**:现在就能做。\n')
  ok(
    newWaitingEnvRows(f12Face, f12Before).length === 1,
    `新带入一条等条件必须点名 1 行,实测 ${newWaitingEnvRows(f12Face, f12Before).length}`,
  )
  ok(
    newWaitingEnvRows(f12Face, f12Face).length === 0,
    'F12 同一行两把面都有 ⇒ 存量不得记在本次提交头上',
  )
  ok(
    newWaitingEnvRows(f12Face, null).length === 0 &&
      typeof newWaitingEnvRows(f12Face, {})[0] === 'undefined',
    'F12 没有基准面 ⇒ 不判(返回空),绝不"全部算新增"',
  )
  const f12EditedSameKey = auditPlan('# 计划\n- [ ] **G-901 等条件**:等环境条件(补注@2026-10-25)。\n')
  ok(
    f12EditedSameKey.counts.waitingEnv === 1,
    '改写行必须仍被 v2 尺判为等条件(否则"同主键不算新增"一例是空转)',
  )
  ok(
    newWaitingEnvRows(f12EditedSameKey, f12Face).length === 0,
    'F12 同复合主键的行改写不得算新增',
  )
  ok(f12Ratchet({}, f12Face).kind === 'absent', 'F12 基线缺键 ⇒ 不判该项')
  ok(f12Ratchet({ F12: 0 }, f12Face).kind === 'unmigrated', 'F12 写成整数 = 这一维关着,必须报未迁移')
  ok(
    f12Ratchet({ F12: [] }, { counts: { waitingEnv: 1 } }).kind === 'blind',
    'F12 有行数却没名单 ⇒ 判"未判定"',
  )
  ok(f12Ratchet({ F12: [] }, f12Face).kind === 'red', 'F12 禁令地板 []:任何等条件键都是基线外新增')
  ok(
    f12Ratchet({ F12: [] }, auditPlan('# 计划\n- [ ] **T1 真活**:现在就能做。\n')).kind === 'ok',
    'F12 名单为空 ⇒ 绿(清偿后的目标态)',
  )
  ok(
    ratchetViolations({ F12: [] }, probe(f12Face), f12Face).some((x) => x.startsWith('F12')),
    'F12 基线棘轮必须报红(绝对层接线)',
  )
  ok(
    !ratchetViolations({ F12: [] }, probe(f12Face)).some((x) => x.startsWith('F12')),
    'F12 没给判定面 ⇒ 不判',
  )
  ok(
    grewViolations({ counts: { newWaitingEnv: 1 } }, { counts: { newWaitingEnv: 0 } }).some((x) =>
      x.startsWith('F12'),
    ),
    'F12 由 0 涨到 1 必须进差值红名单',
  )
  ok(
    !grewViolations({ counts: { newWaitingEnv: 0 } }, { counts: { newWaitingEnv: 1 } }).some((x) =>
      x.startsWith('F12'),
    ),
    'F12 清偿(1 降到 0)不得判红',
  )
  // ── F13 已勾行被捣回未勾(2026-10-27 补牙,主席 16:30 实测"滞后副本交进提交、四档全绿")──
  // 三型构造面(全部纯函数、不碰 git):
  //   ① 真回退:锚点面该主键只有已勾行,被审面同一主键变成未勾 ⇒ 跨面命中,且不在存量集 ⇒ 判红;
  //   ② 存量:锚点面自己就两态并存的主键 ⇒ 跨面命中 ∧ 在存量集 ⇒ 只报数不判红(§12e);
  //   ③ 等量换键:消掉一枚存量分叉 + 带回一枚新回退 ⇒ 枚数持平 ⇒ 通用"比变多"那把尺恒绿,
  //      必须由**主键集合差集**才拦得住(G-312 同一课)。
  const F13_DONE = '- [x] ✅(2026-10-20) **G-777 回退正例**:已结清的票,滞后副本会把它捣回未勾。'
  const F13_OPEN_OLD = '- [ ] **G-777 回退正例**:已结清的票,滞后副本会把它捣回未勾。'
  const F13_STOCK_DONE = '- [x] ✅(2026-10-19) **G-779 存量分叉甲**:同一件事的已勾登记。'
  const F13_STOCK_OPEN = '- [ ] **G-779 存量分叉甲**:同一件事的另一份未勾登记(HEAD 面上就并存)。'
  const f13Anchor = ['# 计划', F13_DONE, F13_STOCK_DONE, F13_STOCK_OPEN].join('\n')
  const f13Face = ['# 计划', F13_OPEN_OLD, F13_STOCK_DONE, F13_STOCK_OPEN].join('\n')
  const f13Cross = findClosedToOpenRegressions(f13Anchor, f13Face)
  ok(
    f13Cross.hits.map((h) => h.key).join(',') ===
      [...f13Cross.hits.map((h) => h.key)].sort().join(',') &&
      f13Cross.hits.length === 2 &&
      f13Cross.hits.every((h) => /^G-77[79]#/.test(h.key)),
    `F13 跨面命中应恰好两枚(G-777 真回退 + G-779 存量),实测 ${JSON.stringify(f13Cross.hits.map((h) => h.key))}`,
  )
  ok(
    f13Cross.anchorStockKeys.join(',') === f13Cross.hits[1].key,
    `F13 锚点面自身存量应恰好是 G-779 那一组,实测 ${JSON.stringify(f13Cross.anchorStockKeys)}`,
  )
  ok(
    f13Cross.anchorDoneKeys === 2 && f13Cross.anchorRows === 3 && f13Cross.faceRows === 3,
    `F13 候选面读数(枚举到 0 不得被读成通过):实测 ${JSON.stringify([f13Cross.anchorDoneKeys, f13Cross.anchorRows, f13Cross.faceRows])}`,
  )
  const f13AnchorObj = { ...auditPlan(f13Anchor), __face: 'head', __contentText: f13Anchor }
  const f13AnchorFace = wireF13(f13AnchorObj, f13AnchorObj)
  const f13ReviewFace = wireF13(
    { ...auditPlan(f13Face), __face: 'staged', __contentText: f13Face },
    f13AnchorFace,
  )
  ok(
    grewViolations(f13ReviewFace, f13AnchorFace).some((x) => x.startsWith('F13')),
    'F13 真回退必须进差值红名单(①型)',
  )
  ok(
    !grewViolations(f13AnchorFace, f13AnchorFace).some((x) => x.startsWith('F13')),
    'F13 存量(两面同源)不得判红(②型,§12e)',
  )
  // ③ 等量换键:被审面把 G-779 的未勾行删掉(消掉一枚存量分叉)同时把 G-777 捣回未勾(带回一枚)
  const f13Swap = ['# 计划', F13_OPEN_OLD, F13_STOCK_DONE].join('\n')
  const f13SwapFace = wireF13(
    { ...auditPlan(f13Swap), __face: 'staged', __contentText: f13Swap },
    f13AnchorFace,
  )
  ok(
    f13SwapFace.counts.f13Regressed === f13AnchorFace.counts.f13Regressed,
    `③型构造前提:枚数必须持平(实测 ${f13SwapFace.counts.f13Regressed} vs ${f13AnchorFace.counts.f13Regressed}),否则本例没量到"等量换键"`,
  )
  ok(
    grewViolations(f13SwapFace, f13AnchorFace).some((x) => x.startsWith('F13')),
    '③ 等量换键必须由主键集合差集拦下(通用"比变多"那一循环在这一型恒绿)',
  )
  // 反向对照(§22c 的形状锁):摘掉 F13 装配 ⇒ 退回未补牙前的形状,同一夹具必须读不出红。
  // ⚠ 摘的必须是**整维**(明细数组 + 读数一起摘):只摘明细时,probe 的 F13 读数仍在、由 1 涨到 2,
  // 通用"比变多"那一循环照样红 —— 那种摘法证明不了"红来自这一维的差集臂",是恒真断言的孪生兄弟。
  const stripF13 = (f) => ({
    ...f,
    f13CrossKeys: undefined,
    f13StockKeys: undefined,
    counts: { ...f.counts, f13Regressed: undefined },
  })
  ok(
    !grewViolations(stripF13(f13ReviewFace), stripF13(f13AnchorFace)).some((x) =>
      x.startsWith('F13'),
    ),
    '摘掉 F13 装配后同一夹具必须不红(证明红来自这一维本身,不是别的维度代跑)',
  )
  ok(
    grewViolations(f13ReviewFace, f13AnchorFace).some((x) => x.startsWith('F13')),
    '装回去必须立刻翻红(与上一条成对;只留一条就是恒真断言)',
  )
  // 面取不到 ⇒ 不判、不冒 0 绿:读数留 0 但 f13Unjudged 必须点名原因(§0.3)
  const f13NoAnchor = wireF13(
    { ...auditPlan(f13Face), __face: 'staged', __contentText: f13Face },
    null,
  )
  ok(
    f13NoAnchor.counts.f13Regressed === 0 &&
      typeof f13NoAnchor.f13Unjudged === 'string' &&
      f13NoAnchor.f13Unjudged.includes('全文不在手'),
    `F13 锚点面取不到必须落未判定并点名,实测 ${JSON.stringify([f13NoAnchor.counts.f13Regressed, f13NoAnchor.f13Unjudged])}`,
  )
  // ── 时间排序档 --order(2026-10-23 立)──
  // 夹具只用构造面(锚点表由本例注入),不碰 git ⇒ 确定性(§22b 取向:形状判据要用纯函数+构造面证明)。
  const tOld = Date.UTC(2026, 8, 1)
  const tMid = Date.UTC(2026, 9, 1)
  const tNew = Date.UTC(2026, 9, 20)
  const oRows = [
    { line: 10, raw: '- [ ] 最陈旧的一张' },
    { line: 20, raw: '- [ ] 中间那张' },
    { line: 30, raw: '- [ ] 最近动过的这张' },
    { line: 40, raw: '- [ ] 量不到锚点的这张' },
  ]
  const oAges = new Map([
    [10, { anchorTs: tOld }],
    [20, { anchorTs: tMid }],
    [30, { anchorTs: tNew }],
    [40, { anchorTs: null }],
  ])
  const late = orderRowsByTime(oRows, oAges, 'late')
  ok(
    late.rows.map((r) => r.line).join(',') === '30,20,10,40',
    `--order=late 应"最近的在最前、无锚点在末尾",实测 ${late.rows.map((r) => r.line).join(',')}`,
  )
  const early = orderRowsByTime(oRows, oAges, 'early')
  ok(
    early.rows.map((r) => r.line).join(',') === '10,20,30,40',
    `--order=early 应"最陈旧在最前、无锚点仍在末尾",实测 ${early.rows.map((r) => r.line).join(',')}`,
  )
  // 反向锁(这一档最重要的一条):无锚点的行在**两种 mode 下都不得进头部**。
  // 按 mode 把它排到最前 = 拿"没量到"冒充"最新"(或"最旧"),正是 §0.3 禁止的那种失效。
  ok(
    late.rows[0].line !== 40 && early.rows[0].line !== 40,
    '无锚点行不得因 mode 而占据头部(量不到既不读成最新、也不读成最陈旧)',
  )
  // 阳性对照:同一把尺子必须真能区分新旧 —— 若两档输出同一个顺序,上面两条正控是空过的。
  ok(
    late.rows.map((r) => r.line).join(',') !== early.rows.map((r) => r.line).join(','),
    'late 与 early 必须给出不同顺序(相同说明锚点根本没参与排序,判据空转)',
  )
  ok(
    late.unanchored.length === 1 && late.unanchored[0].line === 40 && late.anchoredCount === 3,
    `未判龄行必须逐行点名并可数,实测 unanchored=${JSON.stringify(late.unanchored.map((r) => r.line))} anchored=${late.anchoredCount}`,
  )
  // 行数守恒:排完不许少一行(排序档丢行等于把票从派单面上静默摘掉)。
  ok(
    [...late.rows, ...early.rows].every((r) => r.raw !== undefined) &&
      late.rows.length === oRows.length &&
      early.rows.length === oRows.length,
    `两种 mode 都必须原样出 ${oRows.length} 行,实测 late=${late.rows.length} early=${early.rows.length}`,
  )
  // 确定性:同锚点 ⇒ 回退行号升序(两次调用必须给同一个顺序,否则下游按行 diff 会把抖动读成变化)。
  const tie = orderRowsByTime(
    [
      { line: 7, raw: '- [ ] 同刻 B' },
      { line: 5, raw: '- [ ] 同刻 A' },
    ],
    new Map([
      [5, { anchorTs: tMid }],
      [7, { anchorTs: tMid }],
    ]),
    'late',
  )
  ok(
    tie.rows.map((r) => r.line).join(',') === '5,7',
    `同锚点必须回退行号升序以保证确定,实测 ${tie.rows.map((r) => r.line).join(',')}`,
  )
  // 锚点表缺失(取不到 blame / 索引面)⇒ 一律落"无锚点",绝不静默按时间声称排过。
  const noMap = orderRowsByTime(oRows, null, 'late')
  ok(
    noMap.rows.length === oRows.length && noMap.unanchored.length === oRows.length,
    `锚点表为 null 时全部行必须进 unanchored(由调用方大声报名"未判定"),实测 anchored=${noMap.rows.length - noMap.unanchored.length}`,
  )
  // 非法 mode ⇒ 当场抛,不退回某一种顺序(静默退回 = 账面看着像按时间排的默认单)。
  let threwMode = false
  try {
    orderRowsByTime(oRows, oAges, 'newest-first')
  } catch {
    threwMode = true
  }
  ok(threwMode, 'mode 非 late|early 必须抛(不得静默挑一种顺序)')
  // 旗标判据:--order 少值 / 顶值 / 被下一枚旗标吃掉 ⇒ 收进 flagIssues,由 CLI 在任何输出前 exit 2。
  ok(
    parseArgs(['--open', '--order']).flagIssues.length === 1 &&
      parseArgs(['--open', '--order=bogus']).flagIssues.length === 1 &&
      parseArgs(['--open', '--order', '--gate']).flagIssues.length === 1,
    '--order 少值/错值/吞旗标三种都必须记成用法错(不得静默退回默认序)',
  )
  ok(
    parseArgs(['--open', '--order=late']).order === 'late' &&
      parseArgs(['--open', '--order', 'early']).order === 'early' &&
      parseArgs(['--open']).order === null &&
      parseArgs(['--open']).flagIssues.length === 0,
    '--order 的等号与空格两种写法都要收到;不带该旗标必须为 null 且零用法错(默认档一字不动)',
  )
  console.log(`\n自检:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  const o = parseArgs(argv)
  // F10 判定面锚定的那枚提交(结论面与史证扫描面必须同一枚,见 scanReopenedFlipEvidence 头注)
  let f10HeadSha = null
  if (o.selfTest) return selfTest()
  // G-322:被吞的 `--since` / `--max-commits` 先于任何输出判死(放在 self-test 之后 —— 自检不吃这两个旗标,
  // 不该因调用方少打一个值就跑不起来)。逐条点名实得 token,不静默退回默认窗口/默认上限。
  if (o.flagIssues?.length) {
    for (const m of o.flagIssues) console.log(`⚠️ 无法判定 —— ${m}`)
    return 2
  }
  if (o.faceError) {
    console.log(`⚠️ 无法判定 —— ${o.faceError}`)
    return 2
  }
  if (o.rootError) {
    console.log(`⚠️ 无法判定 —— ${o.rootError}`)
    return 2
  }
  if (o.nextIdRequested) {
    if (!o.nextId) {
      console.log('❌ 用法错 —— --next-id 需要族名(如 --next-id G):它回答的是下一个空闲的该族编号')
      return 2
    }
    let content
    try {
      content = readPlan(o.root, o.face)
    } catch (e) {
      const why =
        e instanceof Undetermined ? e.message : `取材失败:${String(e?.message ?? e).split('\n')[0]}`
      console.log(`⚠️ 无法判定 —— ${why}`)
      return 2
    }
    const detail = usedIdsOfPrefix(content, o.nextId)
    const label = nextTaskIdLabel(content, o.nextId)
    if (!detail || label === null) {
      console.log(
        `❌ 判不出 —— ${LABEL[o.face]} 面上 ${o.nextId} 族一条登记行都没有,` +
          '故不给 "<族>-1" 这种号:空扫与"该族确实还没用过"在账面上同形,而取错号比不取号更贵',
      )
      return 2
    }
    console.log(
      `下一个空闲编号 = ${label} ` +
        `(现读 ${LABEL[o.face]}:该族已用 ${detail.used} 个号、最大 ${detail.max},` +
        `形状按该族现读的写法推得(${detail.template.replace('%d', 'N')};本仓 G 族带连字符而 O/D 族不带);` +
        '只认带字母前缀的编号族,行首裸编号是章节内序号、不占号段)',
    )
    return 0
  }
  let a
  try {
    a = auditFace(o.root, o.face)
  } catch (e) {
    const why =
      e instanceof Undetermined ? e.message : `取材失败:${String(e?.message ?? e).split('\n')[0]}`
    console.log(`⚠️ 无法判定 —— ${why}`)
    return 2
  }
  // 侧车与台账**同面同轮**(§0.4):与上面那次取材同一枚 HEAD / 同一份索引。
  // 取不到不抛、也不回落另一个面 —— 落 `undetermined`,由消费点如实报名(§0.3)。
  const fieldsFace = readFieldsFace(o.root, o.face)
  // 年龄只在"有历史可问"的面上判(全量 HEAD 档)。`--staged`(提交链)结构上没有本次新行的历史,
  // 所以那一档连 blame 都不派生 —— 既省 9s,也免得把"没有历史"读成"很老"。
  // blame 取不到 ⇒ **显式降级并喊出来**,不得静默退回"只看行内日期"那把较窄的尺子。
  if (o.face === 'head') {
    try {
      enrichStale(a, o.root)
      a.counts.ageSource = 'blame∧行内日期(较新者)'
    } catch (e) {
      a.counts.ageSource = `仅行内日期(blame 取不到:${e instanceof Undetermined ? e.message : String(e?.message ?? e).split('\n')[0]})`
      console.log(`⚠️ 年龄追溯未判定 —— 本次到期读数只看行内日期,那 127 条无日期账不在其视野内`)
    }
  } else {
    a.counts.ageSource = '未判定(索引面无历史可追溯;本次新写的行一律按刚出生处理)'
  }
  // F8a 的基准面必须在**报告之前**算完 —— 放在报告之后,报告就会印一句"未判定"而门其实判了,
  // 读报告的人据此得出"这一维没牙"的判断(把已量到的结论写在它抵达之前,是本仓那一型)。
  // 刻意不在无基准面时写成 0:那会把"没判"记成"判过了没问题"。
  let preBefore = null
  let preBeforeErr = null
  if (o.face === 'staged') {
    try {
      preBefore = auditFace(o.root, 'head')
    } catch (e) {
      preBeforeErr = `HEAD 基准面取不到(${e instanceof Undetermined ? e.message : String(e?.message ?? e).split('\n')[0]})`
    }
  }
  if (preBefore) {
    a.counts.newUndisposed = countNewUndisposed(a, preBefore)
    // F11 差值名单同基准面同轮(与 F8a 一条纪律:基准面取不到就**不判**,不得冒 0)。
    const nh = newWaitingHumanRows(a, preBefore)
    a.newWaitingHumanRows = nh
    a.counts.newWaitingHuman = nh.length
    // F12 差值名单同轮同纪律(2026-10-25 机主令)。
    const ne = newWaitingEnvRows(a, preBefore)
    a.newWaitingEnvRows = ne
    a.counts.newWaitingEnv = ne.length
  }
  // ── F13 已勾行被捣回未勾(2026-10-27 补牙,主席 16:30 实测"滞后副本交进提交、四档全绿")──
  // 这一维是**跨面**的:被审面 vs HEAD 锚点面,两面全文同轮取(§0.4)。
  //  · 提交链(--gate --staged):被审面 = 索引 blob,锚点面 = 上面那次 auditFace('head') 的同一枚 blob;
  //    锚点面自己也要过一遍同一把尺(存量档),否则"分不清存量与本次带回"。
  //  · 全量档(--gate):面 == 锚点 ⇒ 走"面内存量"档,命中只报数(这一档结构上算不出"本次新增",
  //    与 F8/F11/F12 兜 0 同一条理由,不拿它冒充"判过")。
  // 锚点面取不到 ⇒ **不判**:读数落 0 但 `f13Unjudged` 点名原因,报告行与 gate 都如实写未判定,
  // 既不记绿也不冒红(§0.3);绝不回落工作树副本 —— 工作树那份正是本次要判的那一型(§0.4)。
  if (preBefore) wireF13(preBefore, preBefore, { faceLabel: 'HEAD 锚点面', anchorLabel: 'HEAD 锚点面' })
  wireF13(a, o.face === 'head' ? a : preBefore, {
    faceLabel: `被审面(${LABEL[o.face] ?? o.face})`,
    anchorLabel: `HEAD 锚点面`,
  })
  // ── F10 翻勾回写候选(仅在显式旗标下跑:取证要遍历提交 diff,≈210s/900 枚,绝不压在默认档)──
  if (o.reopenedFlips) {
    if (!o.since) {
      console.log(
        '❌ 用法错 —— --reopened-flips 必须给**显式窗口** `--since=YYYY-MM-DD`:' +
          '取证要遍历提交 diff,无窗口无法定界(全窗口近 30 天 4468 枚 ≈ 17min,不可接受)。' +
          '\n   例:`node scripts/plan-tasks.mjs --reopened-flips --since=2026-09-08 --max-commits=900`',
      )
      return 2
    }
    let conclusionFace
    try {
      // 结论面与扫描面**同一瞬间**取:先钉 sha,再用 `<sha>:PROJECT_PLAN.md` —— 不得先扫历史再另开 HEAD。
      f10HeadSha = gitRaw(['rev-parse', 'HEAD'], o.root).trim()
      conclusionFace = gitRaw(['show', `${f10HeadSha}:${PLAN_REL}`], o.root, { maxBuffer: 512 << 20 })
    } catch (e) {
      console.log(`⚠️ 无法判定 —— F10 结论面取不到:${e instanceof Undetermined ? e.message : String(e?.message ?? e).split('\n')[0]}`)
      return 2
    }
    const t0 = Date.now()
    let scanned
    try {
      scanned = scanReopenedFlipEvidence(o.root, { since: o.since, maxCommits: o.maxCommits, headSha: f10HeadSha })
    } catch (e) {
      console.log(`⚠️ 无法判定 —— F10 史证遍历失败:${e instanceof Undetermined ? e.message : String(e?.message ?? e).split('\n')[0]}`)
      return 2
    }
    const res = findReopenedFlipCandidates(conclusionFace, scanned.flipped)
    a.reopenedFlips = res.candidates
    a.counts.reopenedFlips = res.candidates.length
    a.counts.reopenedFlipUndetermined = res.undetermined
    a.counts.reopenedFlipSweptKeys = res.sweptKeys
    a.counts.reopenedFlipUnkeyable = res.unkeyable
    a.counts.reopenedFlipCommits = scanned.commits
    a.counts.reopenedFlipCapped = scanned.commits >= o.maxCommits
    a.counts.reopenedFlipPerfMs = Date.now() - t0
    a.counts.reopenedFlipSince = o.since
  }
  // ⚠ 基线取的是**当次当面的实测数**,换一次提交就会变。所以它只能由人工在清偿之后刷新,
  // 且只允许在全量档执行 —— 从索引/工作树面刷基线等于把别人未提交的中间态冻进台账。
  if (o.updateBaseline) {
    if (o.face !== 'head') {
      console.log('❌ --update-baseline 只允许在全量档(HEAD blob)执行,不得从索引/工作树面刷基线')
      return 2
    }
    const abs = path.join(o.root, BASELINE_REL)
    if (!existsSync(abs)) {
      console.log(`❌ 拒绝写基线:${BASELINE_REL} 不在位 —— 键集锚点要拿既有键集比才能判"只许收窄"`)
      return 2
    }
    const raw = readFileSync(abs, 'utf8')
    let oldBase = null
    try {
      oldBase = JSON.parse(raw)
    } catch (e) {
      console.log(`⚠️ 无法判定 —— ${BASELINE_REL} 解析失败:${String(e?.message ?? e).split('\n')[0]}`)
      return 2
    }
    const plan = planF9BaselineRewrite(oldBase, f9KeySetOf(a))
    if (plan.action === 'refuse-shape') {
      console.log(`❌ 拒绝写基线 —— ${plan.reason}`)
      console.log('   为什么不能"顺手补一份":没有旧键集就没法判这次是收窄还是放行新撞号。')
      return 2
    }
    if (plan.action === 'refuse-widen') {
      console.log(`❌ 拒绝:F9 基线只允许**收窄**。${plan.reason}`)
      for (const g of a?.collisions ?? [])
        if (plan.added.includes(g.key)) console.log(`   F9 ${f9GroupLine(g)}`)
      console.log(
        '   把它们写进基线 = 给新撞号发通行证(与"为过门调高基线"同一条禁令)。出路只有逐组判"哪侧是后来者"并归并 —— G-312 明令不得批量改号。',
      )
      return 1
    }
    if (plan.action === 'noop') {
      console.log(`✅ 无变化:${plan.reason}(未写盘)`)
      return 0
    }
    // 原位写回:只替换 F9 那一段值文本,F1–F8 与任何注记键/顺序逐字保留。
    const valueText = JSON.stringify(plan.next, null, 2).replace(/\n/g, '\n  ')
    let nextRaw
    try {
      nextRaw = replaceTopLevelJsonValueText(raw, 'F9', valueText)
    } catch (e) {
      console.log(`❌ 拒绝写盘 —— 原位替换失败:${String(e?.message ?? e).split('\n')[0]}`)
      return 2
    }
    // 落地前自证:只有 F9 变了,其余键(含注记)与顺序逐字未动。工具的自证不等于它对,
    // 但"整文件重写抹掉别人注记键"那一型(守门 83)至少不再可能悄悄发生。
    let check = null
    try {
      check = JSON.parse(nextRaw)
    } catch (e) {
      console.log(`❌ 拒绝写盘 —— 原位替换产出的 JSON 解析不过:${String(e?.message ?? e).split('\n')[0]}`)
      return 2
    }
    const sameKeys = JSON.stringify(Object.keys(check)) === JSON.stringify(Object.keys(oldBase))
    const othersOk =
      sameKeys &&
      Object.keys(oldBase).every(
        (k) => k === 'F9' || JSON.stringify(oldBase[k]) === JSON.stringify(check[k]),
      )
    if (!othersOk || JSON.stringify(check.F9) !== JSON.stringify(plan.next)) {
      console.log('❌ 拒绝写盘 —— 自证未过:除 F9 之外的维度/注记键或键顺序发生了变化')
      return 2
    }
    writeFileSync(abs, nextRaw, 'utf8')
    console.log(`已更新 F9 基线(${LABEL[o.face]} 现读):${plan.reason}`)
    console.log(
      `其余维度(F1–F8)与注记键逐字未变(已 JSON.parse 自证):本工具自 G-312 起**只写 F9 这一维、只许收窄**。`,
    )
    console.log(
      '   为什么其余维度不再由它刷:F1–F4/F4b/F6 的拦点是差值棘轮,把"当次现读"整体冻成新地板 = 跳一次门就能把自己的账洗成基线;F5 方向相反、F8 全量档算不出。要动它们只有人工改这份 JSON 并说明理由。',
    )
    return 0
  }
  if (o.json) {
    // 机器面一律经 `buildJsonFace`(唯一出口):此前这段是 `main()` 里的内联字面量 ⇒ selfTest
    // 够不着 ⇒ "把 prefixNested 名单整段删掉"这种变异全绿放过(2026-10-07 变异验证实测 ESCAPED)。
    // 两处各写一遍输出面必然漂移,而漂开时账面看起来是同一份 json。
    console.log(JSON.stringify(buildJsonFace({ ...a, __face: o.face }, clip), null, 2))
    return 0
  }
  if (o.open) {
    // `--open --dispatchable`:把"现在就能做的活"从"等着别人/等环境的账"里分出来。
    // 默认口径不变 —— 分层只在这条显式旗标下生效,免得一次正则误判把真活踢出派单面。
    // 过滤面按 v2 尺逐行剔(票 G-1182552:JSON 的 dispClaim* 已改为同尺,两不再各说各话)。
    const F = fieldsFace
    const bucketV2 = (r) => dispositionOfV2({ line: r.raw, fields: F }).bucket
    // 归属证据尺(2026-10-26 立,任务书「v2 归属尺只在有真实归属证据时才剔」):
    // `dispositionOfV2` 说"归他人"之后**还要问一句"这份归属现在还立得住吗"** ——
    // ① ≤72h 完整租约 / ② 持有者短名在最近 200 枚提交信息里 / ③ 点名文件此刻在脏面。
    // 三条皆不成立 ⇒ `stale-owner-label`,**默认保留在出单面并逐条点名**(不是静默剔除:
    // 一个不会过期的散文标签冒充"现在有人在动",正是派单面读成 0 行的成因)。
    // 判据本体在 `lib/plan-task-index.mjs`,这里只取数(提交史 / 脏面),取不到即"未判定"。
    const EV = o.dispatchable ? ownerEvidenceFace(o.root) : null
    const slotOf = (r) => dispatchSlotOf({ line: r.raw, fields: F, evidence: EV ?? {} })
    const slots = o.dispatchable ? a.claimableRows.map((r) => ({ row: r, v: slotOf(r) })) : null
    const rows = o.dispatchable
      ? slots.filter((s) => isDispatchKeptSlot(s.v.slot)).map((s) => s.row)
      : a.claimableRows
    if (o.dispatchable) {
      console.log(
        `── 派单口径中"现在可做" ${rows.length} / ${a.claimableRows.length} 行` +
          `(剔除计数:待人拍板 ${a.counts.dispWaitingHuman} / 等条件 ${a.counts.dispWaitingEnv} / 归他人 ${a.counts.dispOwnedElsewhere} —— 这一组是**账面口径 v1 散文尺**的计数;` +
          `过滤面本身按 **v2 尺(侧车优先)**,**归他人一档再经归属证据尺核验**;拿不准的**留在清单里**而不是踢掉)──`,
      )
      // 判定来源必须自己报名:侧车一旦开始有记录,上行那组"按正文推导"的剔除数就会与过滤面分开,
      // 而分开的方向是" fewer 活被踢出清单" —— 不报名就会被当成读数错乱(规格 §2)。
      const sum = dispositionSummary(a.claimableRows, F)
      console.log(`── ${sum.line} ──`)
      if (sum.fields > 0) {
        const v2c = { 'waiting-human': 0, 'waiting-env': 0, 'owned-elsewhere': 0 }
        for (const r of a.claimableRows) {
          const b = bucketV2(r)
          if (b in v2c) v2c[b]++
        }
        console.log(
          `   按 v2 重算的剔除面:待人拍板 ${v2c['waiting-human']} / 等条件 ${v2c['waiting-env']} / 归他人 ${v2c['owned-elsewhere']}` +
            `(与上行不同即两侧都在报数,不静默取其一)`,
        )
      }
      // ── 归属证据尺的四档读数(必须与上面三行**对得上账**:出单 + 仍归他人 + 未判定 + 等人 + 等条件 = claimable)──
      const tally = {}
      for (const s of slots) tally[s.v.slot] = (tally[s.v.slot] ?? 0) + 1
      const owned = slots.filter((s) => s.v.slot === 'owned-elsewhere')
      const heldBy = (k) => owned.filter((s) => s.v.by === k).length
      console.log(
        `── 归属证据尺(2026-10-26):出单 ${rows.length} = 可做 ${tally.actionable ?? 0} + stale-owner-label ${tally['stale-owner-label'] ?? 0};` +
          `仍归他人 ${owned.length} 枚 = 机主面 ${heldBy('human-action-face')} / 侧车 ${heldBy('sidecar')} / 租约 ${heldBy('lease')} / 提交史 ${heldBy('commit')} / 在飞 ${heldBy('dirty')};` +
          `归属未判定 ${tally.undetermined ?? 0} 枚 ──`,
      )
      if (EV?.why)
        console.log(
          `   ⚠ 证据输入未判定(${EV.why})⇒ 这几枚**既不派也不冒充归他人**,先修取材再派单`,
        )
      const stale = slots.filter((s) => s.v.slot === 'stale-owner-label')
      if (stale.length > 0) {
        console.log(
          `  stale-owner-label ${stale.length} 行:票面挂了归属标签,但**无租约 ∧ 持有者不在最近 ${OWNER_EVIDENCE_COMMITS} 枚提交信息里 ∧ 点名文件不脏**` +
            ' ⇒ 按"没人认领的真活"派单。**派前先看标签点名的持有人是否还在动**:在动就让他续租(写 `（进行中@日期/短名）`),不在动就照常领。',
        )
        for (const s of stale)
          console.log(
            `    L${s.row.line}  「${s.v.holder ?? ownerLabelOf(s.row.raw)?.owner ?? '(标签无持有人)'}」 —— ${s.v.detail}`,
          )
      }
      const undet = slots.filter((s) => s.v.slot === 'undetermined')
      if (undet.length > 0) {
        console.log(`  归属未判定 ${undet.length} 行(输入取不到,**不出单也不记成归他人**):`)
        for (const s of undet)
          console.log(`    L${s.row.line}  ${s.v.detail}  「${s.v.holder ?? ownerLabelOf(s.row.raw)?.owner ?? ''}」`)
      }
      // 行内自述"不再单独派单/走持有行"的副本:勾选一字未动(§1 F4 口径),但不再占派单名额。
      // 必须报名而不只报数 —— 拿数字的人会去 grep【归并】字面并据此判定"这一族不存在"。
      const sd = a.counts.selfDedispatchList || []
      if (sd.length > 0) {
        console.log(
          `  另有 ${a.counts.selfDedispatchRows} 行自述"本行不再单独派单/派单一律走持有行"(未勾、不重复派单):`,
        )
        for (const r of sd) console.log(`    L${r.line}  ${r.title}`)
      }
      // 同编号、题面被改写的"一勾一未勾":F1 按复合主键看不见它,派单人就会把做完的事再派一次。
      // 只点名不剔除也不判红 —— 同编号不同题面在本仓合法存在(D30①/D30② 那一族),
      // 按基号剔除等于把别人没做完的活记成做过的(§1 F4 同一条禁令),交人工逐对判。
      const sid = a.sameIdDone ?? { pairs: [], pointerRows: 0, disclaimedRows: 0 }
      if (sid.pairs.length > 0) {
        console.log(
          `  同编号而题面被改写的"一勾一未勾"成对 ${sid.pairs.length} 对(F1 看不见 ⇒ 只点名、不剔除、不判红;` +
            `另有 ${sid.pointerRows} 行带归并指针、${sid.disclaimedRows} 行自述不再派单,本就不进派单面):`,
        )
        for (const p of sid.pairs.slice(0, 12)) {
          console.log(
            `    ${p.id} 未勾 L${p.openLine}「${p.openTitle}」 ⇄ 已勾 L${p.doneLine}「${p.doneTitle}」`,
          )
        }
        if (sid.pairs.length > 12) console.log(`    …另 ${sid.pairs.length - 12} 对见 --json 的 counts.sameIdDonePairs`)
      }
      // 同题多份未勾行混在派单清单里 ⇒ 两个会话各读一份、各领一张票,做完的事还被记两遍账。
      // 与上一格同口径:点名到行,不剔名额、不判红(剔名额就是 §1 禁止的"替人判定这条没人要")。
      const stg = sameTitleDispatchGroups(rows)
      if (stg.length > 0) {
        const stRows = stg.reduce((s, g) => s + g.members.length, 0)
        console.log(
          `  ⚠️ 同题副本(与守门 203 **同一份指纹**量得):本清单里 ${stg.length} 组 / ${stRows} 行是同一件事的第二次以上登记` +
            ' ⇒ 一组只该领一张票。本档只点名、不剔名额;' +
            '结清出口:整行逐字节相同的走 `node scripts/plan-tasks-merge.mjs --fold-identical-open-rows`(无注记 N→1),' +
            '正文已漂开的那一族机器折半即有损,交人工按标题锚点对齐(禁止手写归并注记)。',
        )
        for (const g of stg.slice(0, 8))
          console.log(
            `    ${g.members.length} 份 @ L${g.members.map((m) => m.line).join(',L')}: ${g.members[0].title}`,
          )
        if (stg.length > 8)
          console.log(`    …另 ${stg.length - 8} 组(全量读数跑 node scripts/check-plan-task-duplicates.mjs)`)
      }
    }
    // 文件归属叠层只在显式旗标下生效 —— 默认派单口径的输出面已有下游按行解析(归并器/自检),
    // 把新维度塞进默认档等于替别人改契约;要叠层/要剔活的人显式要。
    let rowsOut = rows
    if (o.conflicts || o.excludeInflight) {
      const dirtySet = collectDirtyPaths(o.root)
      const headSet = collectHeadPaths(o.root)
      if (!dirtySet || !headSet) {
        console.log(
          '  ⚠️ 文件归属叠层**未判定**:git status / HEAD 树取不到 ⇒ 既不读成"没有在飞的路径",' +
            '`--exclude-inflight` 也一律照派(拿"量不到"去剔真活就是反向的"把没做的记成做过的")',
        )
      } else {
        // 惰判回调:只对叠层命中的脏路径问祖先(懒判),四态对象在 fileConflictOverlay 里逐字比 verdict。
        const cf = fileConflictOverlay({ rows, dirtySet, headSet, lagJudge: makeLagJudge(o.root) })
        if (o.conflicts) {
          console.log(
            `  文件归属叠层:${cf.rowsWithConflict} / ${cf.rowsTotal} 行点名了**当前不干净**的路径` +
              `(点名 ${cf.refsTotal} 处:冲突 ${cf.conflictRefs} / 干净 ${cf.cleanRefs} / 核验不了 ${cf.absent})`,
          )
          for (const c of cf.conflictList) {
            const shown = c.paths.slice(0, 6).join(', ')
            console.log(
              `    L${c.line} 在飞:${shown}${c.paths.length > 6 ? ` …另 ${c.paths.length - 6} 条` : ''}`,
            )
          }
          for (const a of cf.absentList) {
            console.log(
              `    L${a.line} 点名的路径在 HEAD 与在飞集合里都找不到:${a.key}(不判冲突,也不判干净)`,
            )
          }
        }
        if (o.excludeInflight) {
          const { kept, dropped } = excludeInflightRows(rows, cf)
          const who = dropped.slice(0, 10).map((r) => 'L' + r.line).join(' / ')
          console.log(
            `  --exclude-inflight:暂移 ${dropped.length} 行(点名的文件此刻正被在飞改动占着)⇒ 出单 ${kept.length} 行` +
              `(对方收口后自动回来;这不是判"做完",也不改勾选)` +
              (dropped.length ? ` —— ${who}${dropped.length > 10 ? ` …另 ${dropped.length - 10} 行` : ''}` : ''),
          )
          rowsOut = kept
        }
        // 惰判读数(G-1105309 约束③④):放回的行逐行点名"哪条路径 proven@commit"(可复核,防为升而升);
        // 非 proven 的命中路径**逐条报名** —— 判不了 / 超 cap 的都留在"真在飞"继续让位,但绝不静默少判。
        if (cf.judgedList.length > 0) {
          const proven = cf.judgedList.filter((j) => j.verdict === 'proven')
          const rest = cf.judgedList.filter((j) => j.verdict !== 'proven')
          console.log(
            `  惰判(只对叠层命中的 ${cf.judgedList.length} 条脏路径问祖先,唯一出口 heal 的 blobInAncestry):` +
              `滞后副本 ${proven.length} / 留在"真在飞" ${rest.length} ⇒ 放回 ${cf.releasedList.length} 行`,
          )
          const byPath = new Map(cf.judgedList.map((j) => [j.path, j]))
          for (const r of cf.releasedList) {
            const why = r.paths
              .map((p) => `${p}${byPath.get(p)?.commit ? `@${byPath.get(p).commit}` : ''}`)
              .join(', ')
            console.log(`    放回 L${r.line} ← ${why}(工作树 blob = 该路径祖先版本 proven)`)
          }
          for (const j of rest)
            console.log(`    留在"真在飞"${j.path}:${j.verdict}${j.reason ? ` —— ${j.reason}` : ''}`)
        }
      }
    }
    // 时间排序档:只在显式 --order 下动手,且**永远不冒充判过**。锚点表来自 enrichStale 那一次
    // blame(同一瞬间);face!=='head' 或 blame 取不到 ⇒ a.ageByLine 不在 ⇒ 大声点名"未判定"、
    // 按默认行号出单(把"量不到"读成"按时间排好了"就是给一份没有牙的清单盖时间序的章)。
    let ageFaceForOrder = null
    if (o.order) {
      if (!a.ageByLine) {
        console.log(
          `  ⚠️ --order=${o.order} **未判定**:${a.counts.ageSource ?? '年龄锚点取不到'}` +
            ` ⇒ 本单仍按行号出,不冒充时间序`,
        )
      } else {
        const or = orderRowsByTime(rowsOut, a.ageByLine, o.order)
        rowsOut = or.rows
        ageFaceForOrder = a.ageByLine
        console.log(
          `  时间排序档 --order=${o.order}:锚点 = blame∧行内日期较新者(单源 lib/plan-line-age.mjs),` +
            `${or.anchoredCount} 行按此刻排序(最近的在最前),` +
            `判不到锚点 ${or.unanchored.length} 行**恒排末尾**(不猜它新还是旧)`,
        )
        for (const r of or.unanchored.slice(0, 10)) console.log(`    L${r.line} 无锚点 ${clip(r.raw)}`)
        if (or.unanchored.length > 10)
          console.log(`    …另 ${or.unanchored.length - 10} 行无锚点,同样排在末尾`)
      }
    }
    listRows(rowsOut, o.face, ageFaceForOrder)
    return 0
  }
  if (o.undisposed) {
    console.log(
      `── 无交代的未勾选行 ${a.undisposed.length} 行(没租约、没说等什么归谁、也没有日期)──`,
    )
    for (const r of a.undisposed) console.log(`  L${r.line}  ${clip(r.raw)}`)
    return 0
  }
  if (o.stale) {
    console.log(`── 超过 ${LEDGER_TTL_DAYS} 天没有进展的未勾选行 ${a.staleRows.length} 行 ──`)
    for (const r of a.staleRows)
      console.log(
        `  L${r.line}  锚点 ${r.anchor}(距今 ${r.age} 天) ${dispositionOfV2({ line: r.raw, fields: fieldsFace }).bucket}  ${clip(r.raw)}`,
      )
    if (a.counts.undated)
      console.log(
        `  ⚠ 另有 ${a.counts.undated} 行连日期都没有 = 无从判龄,不在此清单内(不得读成"它们没问题")`,
      )
    return 0
  }
  if (o.forks) {
    console.log(`── F1 同主键两态并存:${a.forks.length} 组 ──`)
    for (const f of a.forks)
      console.log(
        `  ${f.key}  done@${f.done.map((r) => r.line).join(',')} | open@${f.open.map((r) => r.line).join(',')}`,
      )
    return 0
  }
  if (o.void) {
    listRows(a.voidRows, o.face)
    return 0
  }
  if (o.pointers) {
    console.log(`── F3 指针腐烂:${a.rotated.length} 处 ──`)
    for (const r of a.rotated) console.log(`  L${r.line} → L${r.target}  ${r.reason}`)
    return 0
  }
  if (o.reopenedFlips) {
    // F10 候选清单(只报数、**绝不自动翻勾**)。分流只有一档机器可判:未勾行与**首次翻勾行**逐字等值
    // ⇒ 回写型;措辞已变 ⇒ 未判定交人工。自动动作最多做到"当场再核一次是否仍未勾",绝不补翻。
    const c = a.counts
    const rewrite = (a.reopenedFlips ?? []).filter((x) => x.verdict === 'rewrite').length
    console.log(
      `── F10 翻勾回写候选 ${c.reopenedFlips} 个(窗口 since=${c.reopenedFlipSince} / 扫 ${c.reopenedFlipCommits} 枚提交 / ` +
        `耗时 ${(c.reopenedFlipPerfMs / 1000).toFixed(1)}s / 史证复合主键 ${c.reopenedFlipSweptKeys} 个,其中无主键史证 ${c.reopenedFlipUnkeyable} 条)──`,
    )
    if (c.reopenedFlipCapped)
      console.log(
        `   ⚠ 本次**已截断**(上限 ${o.maxCommits} 枚):更早的提交没扫,别把这里的名单当"整段历史的全集"`,
      )
    console.log(
      `   其中 回写型 ${rewrite} 个 / 未判定(与首次翻勾行措辞已变,交人工)${c.reopenedFlipUndetermined} 个` +
        ` —— 判定面:${LABEL[o.face]} 所锚的那枚提交(${(f10HeadSha ?? '').slice(0, 11)})`,
    )
    for (const x of a.reopenedFlips ?? [])
      console.log(
        `   候选 ${x.id}  判定=${x.verdict === 'rewrite' ? '回写型' : '未判定'}  首次翻勾 ${x.firstSha ?? '?'}/${x.firstDay ?? '?'}  ` +
          `未勾行@${x.openLines.join(',')}  复合主键 ${x.key}`,
      )
    console.log(
      '   候选 ≠ 结论:本清单**只报数、绝不自动翻勾** —— "被回写"与"有人复核后有意重开"同形,' +
        '凭一次扫描补翻就是替别人否决判断(§16 越权同型);且本判据是**瞬时**读数,复核请重跑本命令。',
    )
    return 0
  }
  report(a, o.face)
  if (o.gate) {
    // 基准面在报告之前就算好了(见上面那段)—— 放在报告之后会让报告印一句"未判定"而门其实判了。
    return gate(a, o.strict, o.root, preBefore, preBeforeErr)
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
