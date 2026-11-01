// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * union-converge 的纯逻辑判据层(2026-11-01 自 scripts/union-converge.mjs **原样搬出**,零行为改动)。
 *
 * 立因:union-converge.mjs 突破架构契约 C1 的 6000 行上限(守门 103,blocking,stagedTriggers 为全 glob)⇒ 全仓每次
 * 提交撞红 = §12e 恒红门形状。本层把其中**自洽、可单测、不碰 git 的纯函数**(判据/解析/排版/集合
 * 运算一族)整体搬来,由 union-converge import 回来并原样再导出,参数面 / 退出码 / 结论字段零变化。
 *
 * 收录的判据族(与搬出前逐字节同文,仅 counter 加 export、ROOT/LIVE_DOCS 改为本层自持):
 *  · 行重数 multiset 底线:counter / lostAddedLines / excessAddedLines / capAddedDuplicates /
 *    isDupCapStrictPath / liveDocPointerCaps / liveDocExpectedCounts
 *  · 台账状态分叉与注记口径:planStateRegressions / mergeNoteCrossLineCaliber / f3ExitCaliber /
 *    markerTripleRecallCaps
 *  · 折叠与举证:foldLedgerOf / attestFoldPair / supersedeProof / foldDedupe / formatFoldReport
 *  · 摘除台账认账:declaredDropCaps / declaredFamilyCaps / yieldedIdCaps / theirsRewriteCaps /
 *    rawMentionsId / formatLedgerEvidence
 *  · 行级 union 本体:unionLinesCore / unionLines / ensureTrailingNewline / sideLossEntryProblem /
 *    formatPointerCapReport / generatedArtifactMarker 同族的排版出口
 *
 * 纪律:这里**只有纯函数**——一切 git 取材、落地、CAS、自测编排仍住在 union-converge 本器;
 * 镜像测试经 union-converge 的具名导出/`__test__` 使用本层实现(§22c,禁止在测试里复制判据)。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditPlan,
  malformedLine,
  f9GroupLine,
  DUP_POINTER_RE,
  lineNoteCount,
  mergeNoteUnits,
  keyOfRow,
  compositeKeyOf,
} from './plan-task-index.mjs'
import { SIM_THRESHOLD, jaccard, tokenize, stripState } from './live-doc-similarity.mjs'
import { classifyMarkerTriples } from './conflict-marker-triples.mjs'
import { subtractSuppressed } from './ledger-move-aware.mjs'
import { dedupeByFingerprint, dedupeGroups, uniqueNotes, selfIdOf, noteSegments } from './dedupe-ledger.mjs'
import { extractTaskFingerprint } from '../check-plan-task-duplicates.mjs'
import { declaredRows, rowStateOf, titleFpOf } from '../scrub-declared-removals.mjs'
import { archiveDropCaps } from './live-doc-archive-drops.mjs'

// 与本器同一枚 ROOT 语义(仓库根,由本文件自身位置推导,§15 不得 process.cwd());
// declaredDropCaps / declaredFamilyCaps 的"现读摘除台账"缺省面用它。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** 活文档清单(原住 union-converge:216,随本层搬入后由本器 import 回来,导出面不变)。 */
export const LIVE_DOCS = ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md']

export const counter = (s) => {
  const m = new Map()
  for (const l of s.split('\n')) m.set(l, (m.get(l) || 0) + 1)
  return m
}


/**
 * 一侧相对基底**新增**的行(字符行 multiset),扣掉另一侧对同名基底行的显式删除后,
 * 必须在归并结果里保住。底线判据:只保证"重数不减少",不判顺序与语义交织
 * (真三方把两侧改动接到不同位置时顺序本就会变,那不是丢行)。
 */
/**
 * 归并结果的任务状态分叉**不得高于任何一侧**(纯函数,不碰 git)。
 * 三条判据同守门 130:F1 同主键两态并存 / F2 自带作废声明未落账 / F3 行号指针已腐烂。
 * 取"各侧最大值"而不是"对侧值"作基准,是因为本侧也可能带着未清存量 —— 归并只许持平或变好。
 * 解析不出(空文本/非计划文档)⇒ 返回空数组并**不**声称通过:调用方只对真做了判定的路径说话。
 *
 * 2026-09-28 G-606 补两维,它们**不进上面那个计数档循环**、各判各的形状:
 *  · **F9b 畸形登记号**:判**行集**而不判计数 —— 计数档对"合并抹掉一侧的旧畸形号、同时造出一枚
 *    新的"恒净零(G-312 为 F9 付过的学费在这里同形重演)。点名到逐行原文,因为修复动作是一行字符。
 *  · **F9 撞号组**:判**键集**——只有"两侧都不撞、而归并结果撞了"的键才算合并造的债。
 *    两侧都不撞而结果撞 ⇒ 是归并把两条不同议题的行拼到同一编号下(取号器并发让号失败的形状);
 *    已有一侧就撞的组**刻意不判红**:让同组多挂一行只能靠人工让号(F9 的差值档在提交链上拦),
 *    而落地闸若为此拒绝归并,唯一出路是删掉某一侧的行 —— 那违反本工具的零丢失承诺,更贵。
 */
export function planStateRegressions(mergedText, sideTexts, accepted = null, noteCredits = null) {
  const KEYS = [
    ['forks', 'F1 同主键两态并存(组)'],
    ['voidRows', 'F2 带作废声明未落账(行)'],
    // 比较量必须是本行标签说的那个东西(2026-09-29 改,原先拿 rotatedPointers 当判据):
    // `rotatedPointers` = **全部**腐烂指针,其中绝大多数**没有任何自动出口**(目标行已被归档搬走、
    // 或作者意图不可推断)。拿它当"归并不得放大"的放行条件,等于要求合并把一个**谁都无法下降**
    // 的数字降下来 —— 而活文档归并本身就是"两侧行的并集",这条维只会随合并单调上升。
    // 实测后果:落地闸连 30+ 轮报「各侧最多 277,归并结果 284 ⇒ 判需人工」,部署环停摆。
    // 一台永远无法满足的 blocking 门 = 每台每次被逼跳门 = 全部守门对每次提交作废(§12f 实测三道同型)。
    // 现在判的是"有出口却变大"= 本次归并新造出**能收却没收**的债;无出口那一半仍每次大声点名,
    // 只是不再当放行条件(点名出口见 f3ExitCaliber,不得删)。
    ['rotatedAuto', 'F3 行号指针·此刻有出口可收(处)'],
    ['dupOpenCopies', 'F4 同一件事多条待办(副本行)'],
    // F6 是块级量纲:整块被并集追加两遍时行级四条一路绿灯,而"每行重数 = max(两侧)"
    // 正是它的生产机制 —— 所以这一维必须在落地闸上判,合并提交不跑 pre-commit。
    ['dupBlocks', 'F6 整块登记重复(块)'],
  ]
  /**
   * `accepted`(2026-09-28 补的**声明式**出口,由 CLI 的 `--accept-state-growth <维>=<理由>` 喂进来):
   * 三条量纲 F1/F4/F3-rotatedAuto 判的是"归并结果不得高于任何一侧",而活文档归并的定义就是
   * **两侧行的并集** —— 同一件事在两台机器各登记一份(一台已勾一台未勾)时,并集必然把它变成
   * 一组新分叉,这一维**只许持平或变好**在这条路径上结构上不可满足(实测:11 组撞号已逐条让号
   * 清偿完毕,剩 F1 各侧最多 17→归并 27 / F4 11→24 / F3 0→3,三者同因)。
   * 缺的不是判断而是**可追责的出口**:与 `--take-ours/--take-theirs` 同一条纪律 —— 必须逐条声明、
   * 必须带理由、必须把两个读数与理由一起打印并写进合并提交信息,不得默认、不得静默。
   * F5(落账注记变少)/ F6(整块重复)/ F9+F9b(撞号与畸形号,本次已真清)/ 路径零丢失
   * **不接受声明放行**:它们是"本可以不做错"的那一型,而不是并集的天然后果。
   */
  const acceptedDims = new Map()
  for (const a of Array.isArray(accepted) ? accepted : [])
    if (a && typeof a.dim === 'string' && a.dim) acceptedDims.set(a.dim, a.reason)
  const sides = (sideTexts ?? []).filter((t) => typeof t === 'string' && t.trim() !== '')
  /**
   * **禁止声明放行的维**(2026-10-19 补):头注 `:417-418` 明写「F5(落账注记变少)/ F6(整块重复)/
   * F9+F9b(撞号与畸形号)/ 路径零丢失**一律不接受声明放行** —— 它们是"本可以不做错"的那一型,
   * 而不是并集的天然后果」;但旧校验只问"维名在不在 KEYS 里",而 `voidRows`(F2)与 `dupBlocks`(F6)
   * **都在 KEYS 内** ⇒ 实际可被 `--accept-state-growth` 放行,文档与实现分叉。
   *
   * 实测佐证:自检里唯一一条覆盖本校验的用例用的是 `{dim:'F1'}`,而 F1 本来就是**合法可声明**的维,
   * 于是那条用例只证明了"拼错的维名会抛",对"名字合法但被禁的维"零覆盖。
   *
   * 立因:只写在注释里的禁令 = 没有禁令。这里把它变成真闸,被禁维显式硬拒。
   */
  const NON_ACCEPTABLE = new Map([
    ['voidRows', 'F2 带作废声明未落账'],
    ['dupBlocks', 'F6 整块登记重复'],
  ])
  if (typeof mergedText === 'string' && mergedText.trim() !== '' && sides.length > 0)
    for (const d of acceptedDims.keys())
      if (NON_ACCEPTABLE.has(d))
        throw new Error(
          `--accept-state-growth ${d}:该维不接受声明放行(${NON_ACCEPTABLE.get(d)} 属"本可以不做错"的那一型,` +
            '不是并集的天然后果;头注 :417-418 是这句话的出处,本闸让那句话真正成立)',
        )
      else if (!KEYS.some(([k]) => k === d))
        throw new Error(
          `--accept-state-growth 的维名不认识:${d}(可用维 = ${KEYS.map(([k]) => k).join(' / ')};` +
            'F5/F6/F9/F9b 与路径零丢失一律不可声明放行 —— 那三条正是本闸存在的理由)',
        )
  if (typeof mergedText !== 'string' || mergedText.trim() === '' || sides.length === 0) return []
  // 每面只解析一遍(旧写法在每个 KEYS 项里对每侧重解析一次 ⇒ 加维就会把审计成本乘上去)
  const mA = auditPlan(mergedText)
  const sA = sides.map((t) => auditPlan(t))
  const m = mA.counts
  const out = []
  out.accepted = []
  for (const [k, label] of KEYS) {
    const worst = Math.max(...sA.map((a) => a.counts[k]))
    if (m[k] > worst) {
      // 声明式放行只适用于"并集天然放大"那三维(见函数头注的成因)。放行了也必须把两个数
      // 与理由一起交出去 —— 调用方要把它写进合并提交信息;静默跳过就是拆门。
      if (acceptedDims.has(k)) {
        out.accepted.push(`${label} 各侧最多 ${worst} → 归并 ${m[k]}(已声明放行:${acceptedDims.get(k)})`)
        continue
      }
      out.push(`${label} 各侧最多 ${worst},归并结果 ${m[k]}`)
    }
  }
  // F9b:逐字不在任何一侧的畸形行 = 归并自己造的(两侧各自带来的存量都按预存债放过)
  const seenMalformed = new Set(
    sA.flatMap((a) => a.malformedRows.map((r) => String(r.raw).trim().slice(0, 90))),
  )
  const newMal = (mA.malformedRows ?? []).filter(
    (r) => !seenMalformed.has(String(r.raw).trim().slice(0, 90)),
  )
  for (const r of newMal.slice(0, 12)) out.push(`F9b 归并新增畸形登记号 ${malformedLine(r)}`)
  if (newMal.length > 12) out.push(`F9b … 其余 ${newMal.length - 12} 行畸形号见 --json 的 malformedRows`)
  // F9:两侧都不撞、归并结果才撞的键
  const seenColl = new Set(sA.flatMap((a) => (a.collisions ?? []).map((g) => g.key)))
  const newColl = (mA.collisions ?? []).filter((g) => !seenColl.has(g.key))
  for (const g of newColl.slice(0, 12)) out.push(`F9 归并新增撞号组 ${f9GroupLine(g)}`)
  if (newColl.length > 12) out.push(`F9 … 其余 ${newColl.length - 12} 组新增撞号见 --json 的 collisions`)
  /**
   * F5 方向与前四条相反:注记**少**了才坏。这一条正是本会话被咬两次的形状的落地闸 ——
   * 活文档按"每行重数 = max(两侧)"归并时,已落账的行会连同它的注记一起被未落账形态顶掉,
   * 而 F1-F4 与门 71 对此**同时全绿**(退回的是同态行、编号标记也还在)。
   * 合并提交不跑 pre-commit,所以只能在落地闸这里拦。
   */
  /**
   * F5 的比较集只用"合并本可以带的两侧"(G-815913 代裁,票面改法①):基底面不是合并的"一侧",
   * base 上两侧都已没有的历史缩量不得计入"本可以保住却少带了"的差额(实测:base 进比较集把
   * 报告从 13 涨成 36,而部署环调用点本就不含基线 ⇒ 两个调用点对着两套集合判同一维,两把尺子
   * 不同形的另一半)。`noteCredits.f5SideTexts` 由调用点传 [ours, theirs];不传时回退全部面
   * (部署环传的就是 [local, remote],行为逐字不变)。
   */
  const f5Sides =
    noteCredits && Array.isArray(noteCredits.f5SideTexts) && noteCredits.f5SideTexts.length
      ? noteCredits.f5SideTexts.filter((t) => typeof t === 'string' && t.trim() !== '')
      : sides
  const noteMax = Math.max(...f5Sides.map((t) => auditPlan(t).counts.mergeNotes))
  if (m.mergeNotes < noteMax) {
    /**
     * F5 判的是"注记**份数**不得降",而 G-814386 这一票要做的恰恰是"让带副本指针的行少带几份"
     * —— 直接照份数比,本票会让每一枚台账收敛在落地闸上自杀(恒红 ⇒ 唯一出路是各会话绕过收敛,
     * 比原病更响)。所以这里改成**先算合法上限、再判余下差额**:只有"带副本指针且合并结果里仍
     * ≥1 份"的行可以贡献豁免额度,其它任何一条注记行变少都照常判红。
     * 注记的**形状判据与份数判据只有一份实现** = `plan-task-index.lineNoteCount`(G-977960 ① 收口:
     * 本门此前把 MERGE_NOTE_RE 的 source 就地重拼成正则,自己抄了第二份逐行计数,而 F5 的读数住在
     * 另一档量纲上 ⇒ 跨行注记既进不了总额也进不了合法额度,造出"无论怎么合并都差 N 条"的死局。
     * 逐行判必须用**非全局副本**这一点由 lib 内部保证,调用方不得再自带正则。
     */
    const occOf = (l) => lineNoteCount(l)
    const mm = counter(mergedText)
    const sideCounters = f5Sides.map((t) => counter(t))
    /**
     * 遍历域必须是**所有面的并**(2026-09-29 修,原先遍历结果面 `mm`):一条注记行如果在归并结果里
     * 一份都没剩下(`have=0`),它就不在 `mm` 里 ⇒ 结构上永远进不了额度 ⇒ 无论机制如何解释都恒红。
     * 而"结果里一份都没有"恰恰是最需要被解释的那一型 —— 旧写法把"最坏的情形"写成了"不可申诉的情形"。
     */
    const universe = new Set()
    for (const c of [...sideCounters, mm])
      for (const [l, n] of c) if (n > 0 && occOf(l) > 0) universe.add(l)
    const suppress = noteCredits && noteCredits.suppress ? noteCredits.suppress : null
    const baseC = noteCredits && noteCredits.baseText ? counter(noteCredits.baseText) : null
    const oursC = noteCredits && noteCredits.oursText ? counter(noteCredits.oursText) : null
    /**
     * ⑥ 归档整区移出的凭据(2026-10-29 死结):调用点把行级 union 补回判定用的**同一本账**
     * `archiveDropCaps(a, archived)` 喂进来(§0.6 单一真相源)。集合为 null(归档面取不到)⇒ 这一档
     * 一分不给,照旧多报(§0.3/§0.10 失效方向恒为"多要一次说明",绝不静默吞)。
     */
    const archiveDropSet =
      noteCredits && noteCredits.archiveDropSet instanceof Set ? noteCredits.archiveDropSet : null
    let allowed = 0
    let byPlaceholder = 0
    let byOwnShrink = 0
    let byDupPointer = 0
    let byVerbatimCopies = 0
    let byFold = 0
    let byArchiveMoved = 0
    const unexplained = []
    /**
     * 逐行欠账的**机器可读**副本(G-62 恢复,c18ac45d98 那一版):上面 `unexplained` 是给人读的
     * 字符串且只列前 5 条,`out.f5Deficit` 是同一批数据的结构化形态 —— `--json` 问责必须能拿到
     * 全部行、每行欠几份、结果面还剩几份。两者同源(同一 `rest`),不得各算一遍。
     */
    const f5Deficit = []
    const verbatimCredited = []
    const foldCredited = []
    const foldUnattested = []
    const archiveMovedCredited = []
    /**
     * 折叠去向的两条取材路(⑤ 档,见循环内注释):调用点喂来的折叠台账 pairs 优先
     * (foldLedgerOf 的"折叠自己记的去向"—— 并入注记改变保留行指纹时,事后回查会落空);
     * 没有台账(部署环调用点拿不到台账)才按**产物面**回查同指纹/同主键的保留行。
     */
    const foldPairOf = new Map(
      (noteCredits && Array.isArray(noteCredits.foldPairs) ? noteCredits.foldPairs : [])
        .filter((x) => x && typeof x.dropped === 'string')
        .map((x) => [x.dropped, x]),
    )
    // 去向候选 = 整个产物面(折叠的保留行**吸收注记后自己就带注记**,不得按"带注记"排除 ——
    // foldLedgerOf 的回查环同样问的是整个产物面,两处必须同形)。**只按指纹回查**:主键回查会把
    // "同号不同题"(F9 那一族)误配成折叠去向 —— 折叠层本来就只按指纹分组,回查不得比折叠更宽。
    const keptByFp = new Map()
    for (const l of mm.keys()) {
      const fp = extractTaskFingerprint(l)
      if (fp && !keptByFp.has(fp)) keptByFp.set(fp, l)
    }
    for (const l of universe) {
      const occ = occOf(l)
      if (!occ) continue
      const haveOcc = (mm.get(l) || 0) * occ
      const wantOcc = Math.max(...sideCounters.map((c) => (c.get(l) || 0) * occ))
      if (wantOcc <= haveOcc) continue
      let rest = wantOcc - haveOcc
      // ① 搬运感知:这些份数由基准面上的 `已归档` 占位代表(表按行给**份数**,× 每行条数换到同一量纲)。
      if (suppress && rest > 0) {
        const cov = Math.min((suppress.get(l) || 0) * occ, rest)
        byPlaceholder += cov
        rest -= cov
      }
      // ② 本侧相对**共同基底**自己缩了量 ⇒ `liveDocExpectedCounts` 的约定"基底有而本侧清了 ⇒ 处置权
      //    仍在本侧",这一部分本就不该从对侧补回。刻意要求 `o < b`:只有对侧加过的行永不进这一档。
      //    G-62 票面所称第二版"额度基准改用生成器自己的期望值"即本档:`liveDocExpectedCounts` 的
      //    `max(基底, 本侧)` 项在这里以 `b - o` 逐行结算,同一语义只留这一份实现,不得再调期望表。
      if (rest > 0 && oursC && baseC) {
        const o = (oursC.get(l) || 0) * occ
        const b = (baseC.get(l) || 0) * occ
        if (o < b) {
          const cov = Math.min(rest, b - o)
          byOwnShrink += cov
          rest -= cov
        }
      }
      /**
       * ③ 副本指针行的额度**有下限**:只许"从无到有带一份",整族归零不得由这一档解释掉。
       * 旧实现把 rest 全额记账 ⇒ 注释写着"留一份"而代码允许留零份 —— 镜像 R-O 保护的正是这里。
       * 2026-09-29 隔离检出复现:一条带副本指针的注记行在合并结果里一份不剩,仍然报绿。
       * 可记额度 = (wantOcc - occ) 减去 ①② 已记部分 = max(0, rest + haveOcc - occ)。
       */
      if (rest > 0 && DUP_POINTER_RE.test(l)) {
        const cov = Math.min(rest, Math.max(0, rest + haveOcc - occ))
        byDupPointer += cov
        rest -= cov
      }
      /**
       * ④ 同一条注记行的第 2..N 份**逐字副本**折叠成一份 ⇒ 少的是份数,不是信息。
       * 判据与 lostAddedLines 的指针档同形:**只认逐字相同**(本循环以行原文为键 ⇒ 逐字副本天然
       * 折进同一个桶),漂移一个字的两份一行额度都拿不到;且必须 `haveOcc > 0`(结果面仍留
       * ≥1 份)才可记 —— 一份不剩的整族消失 ④ 一分都不给,③ 的下限照旧兜住那一型判红。
       * 可记额度 = 想要的份数 − 结果里保留的第 1 份 = wantOcc − haveOcc(已折进 rest)。
       * 立因(G-815405):2026-09-29 那次真实合并被本维拒收,按行量下来对侧"减少"的 1387 份
       * **全部**是同一条注记行的逐字副本折成一份(同一条 D64 指针行逐字重复 7 次以上),
       * 而当时三档额度都没认这一型 ⇒ 报"已扣除 0 条、仍差 30 条",把一次零信息损失的合并
       * 判成了拒收(§1 禁止无声删除在此**没有**被违反 —— 每条注记仍保留 ≥1 份)。
       * 报数必须报名:这一档与前三档并列打进红句(见下方 `${byVerbatimCopies}`)并逐行点名
       * (`verbatimCredited`)—— 额度若静默生效,下一手就分不清"被折了"和"真丢了"。
       */
      if (rest > 0 && haveOcc > 0) {
        const cov = rest
        byVerbatimCopies += cov
        verbatimCredited.push(`折 ${cov} 份(结果里剩 ${mm.get(l) || 0} 份)← ${l.slice(0, 140)}`)
        rest -= cov
      }
      /**
       * ⑤ 折叠层(G-815913 代裁,票面嫌疑①的落点):同题行按标题指纹折叠、被折行的独有注记/票号
       * 并入保留行 —— 信息守恒、少的只是行份数。verifyUnion 早已认这本账(attestFoldPair 四问销账),
       * 而 F5 此前不接收折叠台账 ⇒ 同一件事自证侧绿、落地闸红("两把尺子不同形"),实测 7 条合法
       * 折叠全被判成"未被任何机制解释的少带",部署环 BLOCKED-DIVERGED 连续 120+ 轮。
       * 额度**不削牙**:仍必须过**同一份** attestFoldPair 四问(去向行真在产物面、同一件事、
       * 独有注记与票号被接住),证不出去向 ⇒ 一分不给,照旧进 unexplained 判红并带失败原因。
       * 有台账时额度封顶在台账申报的份数(与 verifyUnion 的 `short > pair.droppedCopies` 同形);
       * 回查路(部署环无台账)封顶在 rest,但过四问本身就是"信息守恒"的完整证明。
       */
      if (rest > 0) {
        const ledgerPair = foldPairOf.get(l) || null
        let pair = ledgerPair
        if (!pair) {
          const fp = extractTaskFingerprint(l)
          const kept = fp ? keptByFp.get(fp) ?? null : null
          if (kept !== null && kept !== l) pair = { dropped: l, kept }
        }
        /**
         * Q4 防空心守卫:份数尺子 `MERGE_NOTE_RE` **不要求闭合 `〕`**(跨行/残缺注记也计数),
         * 而 uniqueNotes 的段尺子 `NOTE_RE` 要求闭合 —— 一条带未闭合注记的行在 Q4 上"无段可丢"、
         * 空心通过,去向行哪怕一个注记都没接住也算"信息守恒"。所以 ⑤ 只认**被计入的注记全部是
         * 闭合段**的行;有残缺注记 ⇒ 这一档一分不给,照旧交 unexplained(§0.2 宁可多要一次说明)。
         */
        if (pair && noteSegments(l).length >= occ) {
          const att = attestFoldPair(pair, mm)
          if (att.status === 'attested') {
            const cap =
              ledgerPair && Number.isFinite(ledgerPair.droppedCopies)
                ? Math.min(rest, ledgerPair.droppedCopies * occ)
                : rest
            byFold += cap
            foldCredited.push(`折 ${cap} 份 → 去向行 ${String(att.kept).slice(0, 60)} ← ${l.slice(0, 80)}`)
            rest -= cap
          } else {
            foldUnattested.push(`${att.status}(${att.reason}):: ${l.slice(0, 60)}`)
          }
        }
      }
      /**
       * ⑥ 归档整区移出(2026-10-29 立,根治"本侧按 §1 把整区逐字移入 archive、对侧滞后基线把
       *   那批 `<!-- 已归档 -->` 占位原样带回、归并正确排除后 F5 却把它读成未解释少带"的死结):
       *   凭据 = 行级 union 决定"不补回"用的**同一本账** `archiveDropCaps(a, archived)`(§0.6)。
       *   一行落在集合里 ⇔ "逐字存在于同族归档件 ∧ 本侧 0 份" ⇒ 处置权已在本侧行使,归并不该带回,
       *   这份少带即有据。
       *   **不削牙**(§12e 修绿不得顺手削判据):① 集合为 null(归档面取不到)⇒ 一分不给,照旧进
       *   unexplained(失效方向恒为多报);② 对侧**独有的真注记行**(从未进任何归档件)不在集合里
       *   ⇒ 即便本侧 0 份、归并未带,这一档也一分不给,照常判红并点名(反证用例锁此两向)。
       */
      if (rest > 0 && archiveDropSet && archiveDropSet.has(l)) {
        byArchiveMoved += rest
        archiveMovedCredited.push(`移出 ${rest} 份(归档件持有 ∧ 本侧 0 份)← ${l.slice(0, 120)}`)
        rest = 0
      }
      if (rest > 0) {
        unexplained.push(`缺 ${rest} 份 :: ${l.slice(0, 70)}`)
        f5Deficit.push({ line: l.slice(0, 140), short: rest, carried: mm.get(l) || 0 })
      }
      allowed += wantOcc - haveOcc - rest
    }
    f5Deficit.sort((a, b) => b.short - a.short)
    /**
     * `--json` 可问责(G-62 恢复,c18ac45d98 那一版):欠账名单与"被本侧归档抑制"抵掉的份数
     * 必须挂在返回值上,调用方不必再从中文红句里回解数字(那正是"猜"的入口)。
     */
    out.f5Deficit = f5Deficit
    out.f5SuppressedCredit = byPlaceholder
    /**
     * 判红条件:总量下降(`noteMax - allowed`)与**逐行欠账**(`unexplained`)任一成立即红。
     * 逐行这一半是 ④ 档的**反向臂**(G-815405 硬要求):`sum(wantOcc) ≥ noteMax` 只在"同一侧对
     * 每行都取最大"时取等,于是"某行逐字折半(合法)+ 另一行整族消失(非法)"两件事可以在总量上
     * 互相抵消 —— 只比总量就等于让合法额度替真丢失背书(实测可构造:3 份折 1 份 + 1 条独有行
     * 归零 ⇒ 旧条件读数恰好持平)。unexplained 逐条由下方 `named` 点名,不静默。
     */
    if (m.mergeNotes < noteMax - allowed || unexplained.length > 0) {
      const named = unexplained.length
        ? `;未被任何机制解释的 ${unexplained.length} 条(列前 5):${unexplained.slice(0, 5).join(' | ')}`
        : ''
      // 报数必须报名(与 formatPointerCapReport 同规矩):④⑤ 档扣了谁、每行扣了几份,逐行点名(列前 5)。
      const credited = verbatimCredited.length
        ? `;逐字副本折半名单(共 ${verbatimCredited.length} 行,前 5):${verbatimCredited.slice(0, 5).join(' | ')}`
        : ''
      const foldNamed = foldCredited.length
        ? `;折叠去向吸收名单(共 ${foldCredited.length} 行,前 5):${foldCredited.slice(0, 5).join(' | ')}`
        : ''
      const foldFail = foldUnattested.length
        ? `;折叠举证未过(不记额度,列前 3):${foldUnattested.slice(0, 3).join(' | ')}`
        : ''
      const archiveMovedNamed = archiveMovedCredited.length
        ? `;归档整区移出名单(共 ${archiveMovedCredited.length} 行,前 5):${archiveMovedCredited
            .slice(0, 5)
            .join(' | ')}`
        : ''
      out.push(
        `F5 归并落账注记 各侧最多 ${noteMax} 条,归并结果只剩 ${m.mergeNotes} 条` +
          `(已按行扣除六类**有据**额度共 ${allowed} 条:归档占位代表 ${byPlaceholder} / 本侧相对基底自缩 ${byOwnShrink} / 副本指针有意少带 ${byDupPointer} / 逐字副本折半 ${byVerbatimCopies} / 折叠去向举证吸收 ${byFold} / 归档整区移出 ${byArchiveMoved};扣完仍差 ${noteMax - allowed - m.mergeNotes} 条)${named}${credited}${foldNamed}${foldFail}${archiveMovedNamed}`,
      )
    }
  }
  /**
   * F5c:跨行注记换成 `lineAttributable` 量纲之后,必须另外钉住"承载它的那几行物理消失"这一型,
   * 否则"少一道恒红"会变成"少一道判据"(与本仓记过的"修红不得顺手削判据"同一条禁令)。
   * 判据刻意只问**这一行还在不在结果面**(而不是份数):
   *  - 并集按行取 max ⇒ 一侧有的物理行必然还在(少带只发生在副本指针行,且至少留 1 份);
   *  - 行序重排会改变"整面命中数",但不会让任何一行消失 —— 所以行还在而份数变了 = 上面那条 phantom,
   *    由 `mergeNoteCrossLineCaliber` 报名;行不在了 = 真被抹掉,这里判红并点名行原文。
   */
  const mergedLines = counter(mergedText)
  for (const t of f5Sides) {
    const units = mergeNoteUnits(t)
    if (units.crossLine === 0) continue
    const src = t.split('\n')
    const sideCounts = counter(t)
    for (const span of units.crossLineSpans) {
      for (let i = span.startLine; i <= span.endLine; i++) {
        const l = src[i]
        if (!l || l.trim() === '') continue
        if ((sideCounts.get(l) || 0) > 0 && (mergedLines.get(l) || 0) === 0) {
          out.push(
            `F5c 跨行注记的行段被抹掉:该注记横跨 ${span.endLine - span.startLine + 1} 行,` +
              `其中一行在归并结果里一份不剩 ← ${l.slice(0, 70)}` +
              `(注记片段:${span.snippet})`,
          )
        }
      }
    }
  }
  return out
}

/**
 * 跨行注记的**报名行**(只打印,不进判据、不进 violations —— 与 `f3ExitCaliber` 同一套规矩:
 * 那个数组里每一条都判红,把"只报名"塞进去就是造一台拦不住任何事、却处处拦你的门)。
 *
 * 为什么 F5 不比这一档:`MERGE_NOTE_RE` 的字符类 `[^〕]` 含换行 ⇒ 一条注记可以横跨两行,
 * 而三类合法额度(占位代表 / 本侧自缩 / 指针少带)**全部按行结算**。拿"整文件命中数"当份数去比,
 * 跨行那部分既进不了总额也进不了额度 ⇒ 天然不可满足(实测 622 / 530 / 已扣 90+3 / 仍差 2 且名单为空)。
 * 所以 F5 只比 `lineAttributable`,这一维单独报出来,让人看得见它有多少、在哪几条。
 *
 * 口径边界(不得读成"已覆盖"):现读 HEAD 面跨行 = 0 ⇒ 今天不比旧写法少抓任何一条真损失;
 * 若将来出现跨行注记被合并抹掉,这里只点名、不拦。补它要把"份数"的定义扩到行区间,另计一票。
 */
export function mergeNoteCrossLineCaliber(mergedText, sideTexts) {
  const sides = (sideTexts ?? []).filter((t) => typeof t === 'string' && t.trim() !== '')
  if (typeof mergedText !== 'string' || mergedText.trim() === '' || sides.length === 0) return ''
  const cal = auditPlan(mergedText).counts
  const perSide = sides.map((t) => auditPlan(t).counts)
  const worst = Math.max(0, ...perSide.map((c) => c.mergeNotesCrossLine ?? 0))
  const now = cal.mergeNotesCrossLine ?? 0
  if (worst === 0 && now === 0) return ''
  const lost = worst - now
  return (
    `F5 量纲:跨行书写的注记 各侧最多 ${worst} 条 / 归并结果 ${now} 条` +
    ` —— **只报名,不参与判红也不计额度**(三类额度都按行结算,拿它比就会造出不可满足的死局);` +
    (lost > 0
      ? `其中 ${lost} 条在本轮合并后不再成跨行匹配 —— 可能是行序重排后仍被整面匹配到(总额未变),也可能是真被抹掉,` +
        '按逐行额度机器判不出是哪种,故只点名不裁决。'
      : '这一档今天与较好一侧持平或更好。') +
    `同轮的逐行可判档 = 各侧最多 ${Math.max(0, ...perSide.map((c) => c.mergeNotes))} 条 / 结果 ${cal.mergeNotes} 条(那才是 F5 的判据)。`
  )
}

/**
 * F3 三维读数的**口径说明行**(只打印,不进判据、不进 violations)。
 * 刻意不并入 planStateRegressions 的返回值:那个数组的每一条都判红,把"只报名"塞进去
 * 就是造一台拦不住任何事却处处拦你的门。无出口部分必须每次现读现报 —— 它不再是
 * 放行条件,但也不许被读成"这一维没人看"。
 */
export function f3ExitCaliber(mergedText, sideTexts) {
  const sides = (sideTexts ?? []).filter((t) => typeof t === 'string' && t.trim() !== '')
  if (typeof mergedText !== 'string' || mergedText.trim() === '' || sides.length === 0) return ''
  const caliber = auditPlan(mergedText).counts
  return (
    `F3 口径:归并结果全部腐烂指针 ${caliber.rotatedPointers} 处 = 此刻有出口可收 ${caliber.rotatedAuto} 处` +
    ` + **无出口交人工 ${caliber.rotatedNoExit} 处**(不拦合并,但必须人工清;本轮未接归档反查索引,` +
    `auto 只算面内那一族 ⇒ 报 0 不等于"没有出口",归档出口的落地档是 plan-tasks-merge --heal)`
  )
}

export function lostAddedLines(baseText, sideText, otherText, mergedText) {
  const cb = counter(baseText)
  const cs = counter(sideText)
  const co = counter(otherText)
  const cm = counter(mergedText)
  const out = []
  // 有意少带的副本份数**单独一桶并必须被调用方点名** —— 例外若静默生效,下一次就没人能
  // 分清"这条被 cap 了"和"这条真的丢了"(把没判写成判过了,是本仓最高频失效型)。
  const capped = []
  for (const [l, n] of cs) {
    const added = n - (cb.get(l) || 0)
    if (added <= 0) continue
    const removedByOther = Math.max(0, (cb.get(l) || 0) - (co.get(l) || 0))
    const need = Math.max(0, added - removedByOther)
    const have = cm.get(l) || 0
    if (have >= need) continue
    // 只有一种下降算合法:该行带「重复登记副本」指针(判据取自 plan-task-index,不另写一个针),
    // 且合并结果里它仍 ≥1 份 —— 信息在,少的是份数。份数为 0 一律照常判丢。
    if (DUP_POINTER_RE.test(l) && have >= 1) {
      capped.push({ line: l, dropped: need - have })
      continue
    }
    out.push(l)
  }
  // 刻意挂成**不可枚举**:这个返回值同时被 `join()` / `for..of` / `deepStrictEqual` 消费,
  // 而既有判据(镜像"重数下降必须点名"那一条)就是拿 deepStrictEqual 比空数组 —— 挂可枚举属性
  // 会让一个元数据把不相干的断言顶红,那等于用工具自己的形状去制造假红(镜像 R-L2 钉死这条)。
  Object.defineProperty(out, 'pointerCapped', { value: capped, enumerable: false })
  return out
}
/**
 * G-585:并集的**另一半**判据 —— 「丢行」只防"少",这一条防"多"。
 *
 * 为什么必须单独有一条:人工解冲突最省事的出口 `git merge-file --union` 的语义就是"两侧新增都保留",
 * 而两侧各自追加的那一行**常常是同一条被两个会话各归档/登记一次**(台账 F4/F6 防的正是这一型)⇒
 * 并集当场造出多余副本。2026-09-28 实测:一份归档件用 `--union` 手解后比两侧都多 187 行,
 * 其中 **186 行是非空内容行的多余副本**(含 `---` ×1009 这类分隔行与整条登记行的重复),
 * 而当时 `--resolve` 的零损失断言只判"两侧独有行不得减少" ⇒ 这批脏数据无声入库。
 *
 * 判据:**每一行的重数不得超过两侧各自的重数最大值**(`max(本侧, 对侧)`)。超过即"合并凭空造出来的
 * 份数"。自动并集路径**不吃**这条判据(它的产物按定义就是"两侧新增都保留",拿这条去判它等于
 * 给每次正常合并造恒红)—— 只有人工整份回灌的 `--resolve` / `--union-capped` 走这里。
 */
export function excessAddedLines(baseText, oursText, theirsText, mergedText) {
  void baseText // 界取"两侧最大值",与基底无关;留参数是为了与 `lostAddedLines` 同形,禁止两处各写一份取材口径
  const co = counter(oursText)
  const ct = counter(theirsText)
  const cm = counter(mergedText)
  const out = []
  for (const [l, have] of cm) {
    if (l.trim() === '') continue // 空行不参与:与 liveDocExpectedCounts / lostAddedLines 同一条规矩
    const bound = Math.max(co.get(l) || 0, ct.get(l) || 0)
    // 两侧都没有的这一行**不算多余副本**:那是人工新写的一行(合并注记/归并说明)。本判据只管
    // "同一行被造出更多份",不管"凭空多一行" —— 后者要问的是另一条判据,不由本器代裁。
    if (bound === 0) continue
    if (have > bound) out.push({ line: l, have, bound, excess: have - bound })
  }
  return out
}

/**
 * G-585 的修复出口(机械封顶,不是"删行"):把每一行的重数收回到 `max(本侧, 对侧)`,
 * **保留先出现的份**、按原顺序只丢弃多余的那几份。可证零损失:一条行只要任一侧有过它,
 * 封顶后仍 ≥1 份 ⇒ 「两侧独有行不得减少」的断言在封顶之后照样必须过(过不了就是封顶写错了,
 * 不是仓库少了东西 —— 这一条由镜像测试反向钉住)。
 */
export function capAddedDuplicates(baseText, oursText, theirsText, mergedText) {
  void baseText
  const co = counter(oursText)
  const ct = counter(theirsText)
  const limit = new Map()
  for (const [l, have] of counter(mergedText)) {
    const bound = Math.max(co.get(l) || 0, ct.get(l) || 0)
    // 与 `excessAddedLines` 同一条界:两侧都没有的行不封顶、不删;空行同样原样保留 ——
    // 本出口收的是"同一行的多余份数",不是格式。
    limit.set(l, bound === 0 || l.trim() === '' ? have : bound)
  }
  const seen = new Map()
  const removed = []
  const keep = []
  for (const line of String(mergedText ?? '').split('\n')) {
    const cap = limit.get(line) ?? 0
    const n = (seen.get(line) || 0) + 1
    seen.set(line, n)
    if (cap < n) {
      removed.push({ line, dropped: 1 })
      continue
    }
    keep.push(line)
  }
  return { text: keep.join('\n'), removed }
}

/** 严格档路径判定:登记行文本那一族 ⇒ 多余副本判红;其余 ⇒ 放过(见 `excessAddedLines` 头注)。 */
export function isDupCapStrictPath(p) {
  const path = String(p ?? '')
  if (LIVE_DOCS.includes(path)) return true
  return /(^|\/)PROJECT_PLAN[^/]*\.md$/.test(path)
}
/** 把"因副本指针有意少带份数"这一桶排成人读行。入参固定为 **`{line, dropped}` 数组**
 *  (即 `lost.pointerCapped` 或 `liveDocPointerCaps()` 的返回值)—— 不接"带该属性的行数组",
 *  否则调用方会顺手把整个 `lost` 传进来,而那个数组的元素是字符串,两种形状混在一个入口必漂移。 */
export function formatPointerCapReport(capped, { maxEntries = 5 } = {}) {
  const list = capped ?? []
  const out = []
  if (!list.length) return []
  const dropped = list.reduce((s, e) => s + e.dropped, 0)
  const shown = Math.min(list.length, maxEntries)
  out.push(
    `      · 因副本指针有意少带 ${dropped} 份(涉及 ${list.length} 条逐字行,每条仍保留 ≥1 份 ⇒ 判"信息未丢")`,
  )
  for (const e of list.slice(0, shown))
    out.push(`        │ 少带 ${e.dropped} 份 ← ${String(e.line).slice(0, 90)}`)
  if (list.length > shown)
    out.push(`        …其余 ${list.length - shown} 条未逐条打印(份数已计入上一行)`)
  return out
}

/**
 * 折叠的报数出口(2026-10-16 立;入参 = `verifyUnion` 的 `bad.folded`,形状与
 * `formatPointerCapReport` 同族 —— 报数必须报名,少带的份数不许静默折进"0 丢失")。
 * `inherited` 那一档单独报:它才是"保留行被改写(接住了被折行的注记/票号)"的那一型。
 */
export function formatFoldReport(folded, { maxEntries = 5 } = {}) {
  const list = folded ?? []
  if (!list.length) return []
  const copies = list.reduce((s, e) => s + e.copies, 0)
  const rewritten = list.filter((e) => e.inherited).length
  const shown = Math.min(list.length, maxEntries)
  // 报数行在前,报名行逐条跟在后面 —— 与 formatPointerCapReport 同一份排版口径(总数 + 前 N 条)
  const out = []
  out.push(
    `      · 同题折叠少带 ${copies} 份(涉及 ${list.length} 条逐字行;其中 ${rewritten} 条的去向是"改写后的保留行")`,
  )
  out.push(
    `        │ 每一处都已按产物面举证:去向行在场 ∧ 同一枚指纹/主键 ∧ 独有注记与票号被接住(attestFoldPair)`,
  )
  for (const e of list.slice(0, shown))
    out.push(
      `        │ 折 ${e.copies} 份 → 去向 ${e.inherited ? '(改写后的保留行)' : '(同一行仍留着)'} ← ${String(e.dropped).slice(0, 80)}`,
    )
  if (list.length > shown)
    out.push(`        …其余 ${list.length - shown} 条未逐条打印(份数已计入上一行)`)
  return out
}

/**
 * 「空冲突区的标记行该被扣到哪一份」的表 —— `liveDocExpectedCounts` 与镜像测试共用的唯一出口。
 *
 * 返回 `Map<行文本, 本侧应保留的重数>`:命中键 = **对侧只把它写在空冲突区里**的那些标记行
 * (三条一行:开头 / 恰好等于 `=======` 的分隔 / 结尾),值 = 本侧自己的份数(0 ⇒ 一条都不补)。
 * 本函数**不判守门 79 的 P1/P4**(那是门体的事),它只回答"这一行该不该从对侧被 union 补回来";
 * "什么算成套、什么算区域内零正文"一律问 `lib/conflict-marker-triples.mjs` 的那一份实现(§0.6)。
 *
 * 保守向(失效方向恒为多留一份,不是少带一份):
 *  - 同一段文本既出现在对侧的空区、又出现在对侧**有正文**的区 ⇒ 这条**整条不扣**
 *    (按行文本作键,份数分不开;分不开就不猜)。
 *  - 半截标记(未配对)与成对但缺 `=======` 的畸形区:不进 `empty` 桶 ⇒ 不扣,照旧补回,
 *    红由门 79 与落地自证臂去喊。
 */
export function markerTripleRecallCaps(oursText, theirsText) {
  const caps = new Map()
  const t = classifyMarkerTriples(theirsText)
  if (t.empty.size === 0) return caps
  const co = counter(oursText)
  for (const l of t.empty.keys()) {
    if (t.contentBearing.has(l)) continue
    caps.set(l, co.get(l) || 0)
  }
  return caps
}

/**
 * 活文档三方行 union 的**期望重数表**:`结果[l] = 本侧重数 + max(0, 对侧有效重数 − max(基底重数, 本侧重数))`。
 *
 * 为什么必须带基底这一维(2026-09-25 实测逼出来的,不是理论洁癖):
 * 旧写法 `结果 = max(本侧, 对侧)` 在**本侧就地改写某一行**时必然把改写前的旧行复活 ——
 * 本侧旧行 0 份 / 新行 1 份,对侧旧行 1 份未动 ⇒ max 把旧行判成"对侧多出来的",补回末尾。
 * 于是活文档里同时留下新旧两份同体行,而 `- [ ]`/`- [x]` 这种**行首就是状态位**的行被复活,
 * 等于把刚刚翻勾的待办又变回未认领(实测:`check-task-claims` 当场重新报成可派)。
 * 只有"对侧**相对基底新增**的行"才是本工具存在的理由(保住别人的独有行);
 * 对侧相对基底没动、而被本侧改掉/删掉的行,处置权在本侧。
 *
 * `suppress`(2026-09-28 搬运感知)只从**对侧贡献**里扣,永不压本侧自己的重数 ——
 * 少扣一行的后果是"带回已归档的内容",而多扣一行的后果是"丢掉别人新写的行",
 * 后者不可恢复,所以判据拿不准时必须给 suppress 传 null(= 不抑制)。
 *
 * **空行一律不参与补回**(期望表与 `unionLines` 的补回循环同一条规矩,两处必须同形)。
 * 这不是省事,是必要:`show()` 对取回的内容做了 `.trim()`,于是「补在文档末尾的一个空行」在断言侧
 * **根本表示不出来**(字节确实写进了 blob,读回来时尾部空行被剪掉)—— 把它计入期望重数就得到
 * 一道与内容无关的红:`PROJECT_PLAN.md 未存活行:`(冒号后面什么都没有)。这一型是被搬运感知照出来的:
 * 拦掉已归档正文之后,补回的最后一批里第一次出现了空行。
 */
export function liveDocExpectedCounts(oursText, theirsText, baseText = null, suppress = null, report = null, declaredOverride = null, archivedOverride = null) {
  const co = counter(oursText)
  const ct = subtractSuppressed(counter(theirsText), suppress)
  const cb = baseText === null ? new Map() : counter(baseText)
  const want = new Map([...co].filter(([l]) => l.trim() !== ''))
  // ↑ 空行不参与期望重数 —— 这是本函数头注(1173)自己声明的书面口径,与 :1062 及 lostAddedLines
  //   同一条规矩(三处必须同形)。原实现只在下面**对侧累加**那一圈跳空行,而 want 的初值直接
  //   整份复制本侧 counter ⇒ 本侧空行被算进"期望存活",对侧新增内容合法吸收掉一个分隔空行时,
  //   就得到一道与内容无关的红(2026-11-01 实测:README.md 非空行 40622→40624 只增不减,
  //   唯"未存活"的是 1 个空行,冒号后面什么都没有 —— 与 :1176 记的那一型同源,只是这次
  //   漏在补回侧而非抑制侧)。判据对**内容行**的追讨一分未减,反证用例见 union-converge 镜像测试。
  for (const [l, n] of ct) {
    if (l.trim() === '') continue // 空行/纯空白行都不参与:与上面 want 初值及 :1062 同一条规矩(原先只认 l === '',口径比姊妹处窄)
    const own = co.get(l) || 0
    // 副本指针行只许"从无到有带一份",绝不参与份数累加(2026-09-29 G-814386)。
    // 立因:这类行已被尺子的派单口径算作同一条活账的副本,而 max/累加会把**已判过死刑的副本**
    // 按份数复原 —— 实测 21:33 清到 1144 行、22:16 清到 0 组,一枚收敛就把未勾选从 1189 顶回 1819、
    // F1 从 0 顶回 37 组。少带的是**重复份数**,不是信息:本侧有则保持本侧,本侧没有而基底也没有
    // 才带 1 份;基底有而本侧清了 ⇒ 处置权仍在本侧(与不加这一维时同形)。
    const addedByTheirs =
      baseText !== null && DUP_POINTER_RE.test(l)
        ? Math.max(0, Math.min(1, n) - Math.max(cb.get(l) || 0, own))
        : Math.max(0, n - Math.max(cb.get(l) || 0, own))
    if (addedByTheirs > 0) want.set(l, own + addedByTheirs)
  }
  /**
   * 「对侧改写、本侧未动」那一格:把本侧脊柱里那份**来自基底的旧形态**按对侧剩下的份数下调。
   * 与 `unionLines` 的补回循环共用这一张表 ⇒ 产出面与自证面天然同形(两处各写一遍必漂移,
   * 而漂开的表现是"落地闸对着一个产出面根本不存在的数字红")。
   */
  for (const [l, n] of theirsRewriteCaps(oursText, theirsText, baseText, suppress)) {
    const left = (want.get(l) || 0) - n
    if (left <= 0) want.delete(l)
    else want.set(l, left)
  }
  /**
   * 「本侧已让号删除」的旧形态不得从对侧/基底被补回(G-32, 2026-10-22):产出面(`unionLines`)
   * 与自证面(`verifyUnion` 的未存活行/旧行复活两判)共用这一张表 ⇒ union 不补、落地闸也不按
   * "未存活行"追讨,本侧不再被自己已经让掉的号死锁(三条判据与失效方向见 yieldedIdCaps 头注)。
   */
  for (const l of yieldedIdCaps(oursText, theirsText)) want.delete(l)
  /**
   * 「本侧已按摘除台账删掉」的登记行不得从对侧/基底被补回(2026-10-23,完成即删的回潮通道):
   * 产出面(`unionLines`)与自证面(`verifyUnion` 的未存活行/旧行复活两判)共用这一张表 ⇒
   * union 不补、落地闸也不按"未存活行"追讨,摘掉的行不再被自己人带回。
   */
  for (const l of declaredDropCaps(oursText)) want.delete(l)
  /**
   * 「本侧已按 §1 合法出路整区移入 archive」的行不得从对侧/基底被补回(2026-10-25,守门 207 第二刀①):
   * 与上面那一条同形(本侧 0 份 ⇒ 处置权已行使 ⇒ 不补),凭据来源不同 —— 这一族不是登记行台账,
   * 而是"原文逐字在已入库的同族归档件里、且该件不是本文件的整篇复制件"(判据见 lib 头注)。
   * 产出面(`unionLines`)与自证面(`verifyUnion`)共用这一张表 ⇒ 两边不会一个不补、一个追讨。
   */
  for (const l of archiveDropCaps(oursText, archivedOverride)) want.delete(l)
  /**
   * **空冲突区的三条标记行永不补回**(2026-11-01,MARKERS 票;判据单源 = lib `classifyMarkerTriples`)。
   * 立因(现读复核,不是抄台账):手工摘除 AGENTS.md 那三条 `<<<<<<< / ======= / >>>>>>>` 后,
   * 下一枚旁路合流按"对侧在场即补回"的行级口径把它们原样带回 HEAD/索引/工作树/origin 四面 ——
   * 补回脚手架 = 把 git 写给机器看的分节线当正文,而守门 79 对它**必红**,于是红门在每一枚合流上复发。
   * 只扣**空冲突区**(区域内一行正文都没有,摘掉不丢任何一侧内容)的那一族;区域内有正文的
   * **一条都不扣** —— 那一型的正确出路是给出定向说明(两侧内容如何取舍),不是让归并器顺手放行,
   * 所以照旧补回 ⇒ 让门 79 判红喊人(§0.10:失效方向恒为"多要一次定向说明")。
   * 扣的是**补回量**(`want` 收到本侧自身份数),本侧自己带的那几份原样留在脊柱里 ——
   * 与上面几桶"本侧 0 份才扣"同向,绝不做"顺手替本侧删内容"这件事。
   * 产出面(`unionLinesCore`)与自证面(`verifyUnion`)共用这张表 ⇒ 一边不补、另一边也不追讨。
   */
  for (const [l, own] of markerTripleRecallCaps(oursText, theirsText)) {
    const cur = want.get(l) || 0
    if (cur <= own) continue
    if (own === 0) want.delete(l)
    else want.set(l, own)
    if (report)
      report.push({
        line: l,
        via: 'marker-empty-triple',
        why: '对侧该行的全部出现都在**空冲突区**内(区域内零正文)⇒ 补回它等于把合并脚手架当正文',
      })
  }
  /**
   * 同一族的**改写形态**认账(G-34/G-43, 2026-10-25):逐字维只能认"台账里那一串字节",对侧把
   * 被摘行改写过一笔(追加注记/剥装饰)就结构上认不出 ⇒ 照旧 100% 带回(昨夜 24 行 f11 存量即此)。
   * 这里补上"按复合主键/指纹再问一次清偿台账"那一格;命中与未判定都不回补,并随 `report`
   * 逐条交回调用方计数点名(判序与失效方向见 declaredFamilyCaps 头注)。
   * `report`(可选数组)与 `declaredOverride`(仅供镜像测试注入)两处新增参,既有调用方逐字不变。
   */
  const fam = declaredFamilyCaps(oursText, want, declaredOverride)
  for (const [l, via] of fam.withheld) {
    want.delete(l)
    // 凭据随报告交回(哪条台账记录 / 哪个主键·指纹):扣行判据必须能自答"凭哪一条"(§0.10)。
    if (report) report.push({ line: l, via, evidence: fam.evidence?.get(l) ?? null })
  }
  for (const [l, why] of fam.undetermined) {
    want.delete(l)
    if (report) report.push({ line: l, via: 'undetermined', why })
  }
  // 让路桶方向与上一桶**相反**:照旧补回(证据不足/本面活票同题),只点名不删。两桶绝不可合并。
  for (const [l, why] of fam.held || []) {
    if (report) report.push({ line: l, via: 'held', why })
  }
  return want
}

/**
 * 「**对侧**就地改写、而**本侧**对该主键完全未动」的折叠表 —— 已有那一条对称规则的另一半。
 *
 * 现有公式(`liveDocExpectedCounts`)已经处理了"本侧改写、对侧未动 ⇒ 不复活旧行"(靠基底那一维)。
 * 缺的是反方向:本侧未改、对侧把 base 的第 i 行改成新形态时,本侧脊柱里那份 base 行会原样留下,
 * 而对侧的新形态又被当"对侧相对基底新增"补回 ⇒ **同一主键两个形态并存**。
 * 台账上的表现就是 F9「归并新增撞号组」(实测 `G-823` / `G-814425` 两组:一侧是未勾原文、
 * 另一侧是同一件事的「已落地」改写形态 ⇒ 两侧都不撞、合并才撞),而它**不是**任何人的登记错误 ——
 * 是这台归并器把"改写"读成了"新增"。
 *
 * 只在四条同时成立时才折(每一条都在防一个具体的误伤):
 *  ① 有基底(无基底就无从判"谁动了",此时两侧都是独有行 ⇒ 一份都不能少带);
 *  ② 该主键两侧**行数相等**(不等 ⇒ 对侧是增行或整族删,增行必须两边都在,整族删按"删除不传播"放过);
 *  ③ 本侧该主键的行多重集**逐字等于基底**(= 本侧对这一族没有任何独有工作 ⇒ 少带一份不丢任何东西);
 *  ④ 对侧该主键与基底不同(否则无事可做)。
 * 折的数量取 `max(0, 基底重数 − 对侧重数)`,所以"对侧只换掉一族里的某一行"时另一行照留。
 *
 * **失效方向**:判不准 ⇒ 不折(多留一份,F9 照常红并交人工)。绝不反过来少带别人的行 ——
 * 与上面 `suppress` 那条"少扣一行=带回已归档内容 / 多扣一行=丢掉别人新写的行"是同一条禁令。
 * 只认台账主键(`keyOfRow`),AGENTS.md / README.md 那些非登记行因此**结构上不参与折叠**,
 * 行为与改动前逐字相同。
 */
export function theirsRewriteCaps(oursText, theirsText, baseText, suppress = null) {
  const caps = new Map()
  if (typeof baseText !== 'string' || baseText === '') return caps
  const group = (text) => {
    const m = new Map()
    for (const l of text.split('\n')) {
      const k = keyOfRow(l)
      if (!k) continue
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(l)
    }
    return m
  }
  const gB = group(baseText)
  const gO = group(oursText)
  // 搬运感知已代表的那些份**不算对侧持有**:否则同一份会被 suppress 与 caps 各扣一次(少带 = 丢内容)。
  // 代价是这一族会因"行数不等"而落回不折 ⇒ 失效方向是多留一份,不是少带一份。
  const left = new Map(suppress || [])
  const tEff = []
  for (const l of theirsText.split('\n')) {
    const s = left.get(l) || 0
    if (s > 0) {
      left.set(l, s - 1)
      continue
    }
    tEff.push(l)
  }
  const gT = group(tEff.join('\n'))
  const multisetEq = (a, b) => {
    if (a.length !== b.length) return false
    const ca = counter(a.join('\n'))
    const cb = counter(b.join('\n'))
    for (const [l, n] of ca) if ((cb.get(l) || 0) !== n) return false
    return true
  }
  for (const [k, bLines] of gB) {
    const oLines = gO.get(k) || []
    const tLines = gT.get(k) || []
    if (tLines.length === 0) continue
    if (bLines.length !== tLines.length) continue
    if (!multisetEq(bLines, oLines)) continue
    if (multisetEq(bLines, tLines)) continue
    // 同号**两个不同议题**(并发取号撞上的)不是就地改写:两侧各是一件活着的登记,
    // 折掉哪一侧都是替别人删事。判"是不是同一件事"的尺子只许有一份,故复用 merge-live-doc
    // 那把字符二元组 Jaccard 与同源阈值(按词切在 CJK 混排行上会断崖下跌,该层头注已记过)。
    const sim = jaccard(
      tokenize(stripState(bLines.join('\n'))),
      tokenize(stripState(tLines.join('\n'))),
    )
    if (sim < SIM_THRESHOLD) continue
    const ct = counter(tLines.join('\n'))
    for (const [l, n] of counter(bLines.join('\n'))) {
      const dropped = n - (ct.get(l) || 0)
      if (dropped > 0) caps.set(l, (caps.get(l) || 0) + dropped)
    }
  }
  return caps
}

/**
 * 「本侧已让号删除」的旧形态摘除表(2026-10-22,在册票 G-32)。
 *
 * 立因(现读取证):本侧把 7 枚登记行整体让号(枚 `c8cecd2572`,旧号→新号,四条断言含
 * 「旧号引用只允许是【归并】留痕行」)之后,被让出的旧形态只要在对侧被改写过一笔(哪怕只
 * 追加一条取证注记),新字符串在基底面上不存在 ⇒ 被 `liveDocExpectedCounts` 读成"对侧相对
 * 基底新增"并补回;而本面已经没有那个键位行 ⇒ 本侧无法自清 ⇒ 落地闸对本侧死锁。
 *
 * 判据(三条全过才摘,缺一条即不摘 —— 失效方向恒为"多留一份",绝不"少带别人的行"):
 *  ① 本面存在**让号留痕**:带主键的行自己挂着 `〔改号(…):原G-旧〕` / `〔同题原号 G-旧〕` /
 *    `〔…让号:G-旧 → G-新…〕`(票面断言④"旧号引用只允许是留痕行"的三种在册形态;箭头型
 *    还要求箭头右端等于该行主键,散文里转述别人的让号不构成认领);
 *  ② 新号行**在册**(本面真有一行 keyOfRow = 新号 —— 留痕行本身就是那一行,故①已蕴含,
 *    仍按行主键逐一回查,防留痕挂在别的键位行上);
 *  ③ 要补回的旧形态与本面新号行**是同一件事**:复用 theirsRewriteCaps 那把字符二元组
 *    Jaccard 与同源阈值(判"是不是同一件事"的尺子只许有一份,§22c)。③ 正是两半的分界:
 *    对侧同号**异题**的活登记相似度低 ⇒ 照常补回、真冲突照常拦;本侧让号前的旧形态正文
 *    逐字守恒 ⇒ 摘除。
 * 只摘**本面已无逐字同一行**的旧形态 ⇒ 本侧自己还留着的行处置权仍在本侧,一处不碰。
 */
export function yieldedIdCaps(oursText, theirsText) {
  const caps = new Set()
  if (typeof oursText !== 'string' || typeof theirsText !== 'string') return caps
  if (oursText === '' || theirsText === '') return caps
  const co = counter(oursText)
  const oursByKey = new Map()
  const olds = new Map() // 旧号 -> 认领它的那些本面新号行(可多行,逐行过③)
  for (const l of oursText.split('\n')) {
    const k = keyOfRow(l)
    if (!k) continue
    if (!oursByKey.has(k)) oursByKey.set(k, l)
    const claimed = []
    for (const m of l.matchAll(/改号[^〕\n]*[:：]\s*原\s*(G-\d+)/g)) claimed.push(m[1])
    for (const m of l.matchAll(/同题原号\s*(G-\d+)/g)) claimed.push(m[1])
    for (const m of l.matchAll(/让号[:：]\s*(G-\d+)\s*(?:→|->)\s*(G-\d+)/g))
      if (m[2] === k) claimed.push(m[1])
    for (const old of claimed) {
      if (old === k) continue // 留痕里提到自己(自引用)不构成让号
      if (!olds.has(old)) olds.set(old, [])
      olds.get(old).push(l)
    }
  }
  if (olds.size === 0) return caps
  for (const l of new Set(theirsText.split('\n'))) {
    if (l === '') continue // 空行不参与:与 liveDocExpectedCounts 同一条规矩
    const k = keyOfRow(l)
    if (!k) continue
    const newLines = olds.get(k)
    if (!newLines || !newLines.length) continue
    if ((co.get(l) || 0) > 0) continue // 本面还留着逐字同一行 ⇒ 不属"已让号删除"
    let same = false
    for (const nl of newLines) {
      if (!oursByKey.has(keyOfRow(nl))) continue // 新号行不在册 ⇒ 让号不成立,不摘
      if (jaccard(tokenize(stripState(l)), tokenize(stripState(nl))) >= SIM_THRESHOLD) {
        same = true
        break
      }
    }
    if (same) caps.add(l)
  }
  return caps
}

/**
 * 「本侧已按摘除台账正当删掉」的登记行,不得从对侧/基底被补回(2026-10-23 立)。
 *
 * 立因(实测,非推断):`strip-stale-closed-rows`(完成即删兜底轮)把已勾行摘掉并落地后,
 * 对侧(旧基线)那份逐字同一行还在 ⇒ 这张期望表把它读成「对侧相对基底新增的独有行」⇒ 补回。
 * 表现是摘一次、回一次,已勾行存量永远归不了零(2026-10-23 实测 40 条徘徊)。
 * 上面那条 `yieldedIdCaps` 治的是同一族的"让号"形态,这条治的是"完成即删"形态 ——
 * 两族合起来才把"本侧处置权已行使"这一整格堵住。
 *
 * 判据三条(与 `scrub-declared-removals` 的 scrub 逐条同形,只是方向换成"不补回"而不是"剔"):
 *   ① 该行逐字出现在摘除声明台账里(说明有人按台账正当摘过它);
 *   ② **本侧面上 0 份** —— 这一条是硬条件:本侧还留着就说明它仍在册,delete 会连本侧自己那份
 *      一起掉(那是丢行,方向反了);
 *   ③ 该行是登记行(`- [ ]` / `- [x]`)—— 只认台账语义,不碰正文其它部分。
 *
 * **失效方向**:台账读不出 / 模块不可用 ⇒ 返回空集 = 一条不扣 ⇒ 多留一份(回潮),
 * 绝不反过来少带别人的行。与 `suppress` 那条"少扣=带回、多扣=丢内容"是同一条禁令。
 *
 * @param {string} oursText 本侧文本
 * @param {Set<string>|null} [declared] 摘除台账行集(注入用,生产面不传则现读)
 */
export function declaredDropCaps(oursText, declared = null) {
  const caps = new Set()
  if (typeof oursText !== 'string' || oursText === '') return caps
  let set = declared
  if (!(set instanceof Set)) {
    try {
      set = declaredRows(ROOT).set
    } catch {
      return caps // 取不到 ⇒ 一条不扣(多留一份,不是少带一份)
    }
  }
  if (!set || set.size === 0) return caps
  const co = counter(oursText)
  // 候选只能来自台账那一侧:本侧 0 份的行才谈得上"已删"(本侧 count 表根本不含它们)。
  for (const l of set) {
    if ((co.get(l) || 0) > 0) continue // ②本侧还留着 ⇒ 处置权未行使,一律不扣
    if (!/^\s*- \[[ xX]\]/.test(l)) continue // ③只认登记行
    caps.add(l)
  }
  return caps
}

/** 坏行归因用的机械包含判断:编号在原文里必须是**独立出现**的(前后不接字母/数字),
 *  否则 `G-7` 会把 `G-77` 的原文也算命中。这不是判据,只是字符串边界。 */
export function rawMentionsId(raw, id) {
  let i = raw.indexOf(id)
  while (i >= 0) {
    const before = i === 0 ? '' : raw[i - 1]
    const after = raw[i + id.length] || ''
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true
    i = raw.indexOf(id, i + 1)
  }
  return false
}

/**
 * 「本侧已按摘除台账清掉」那一族的**改写形态**,同样不得从对侧/基底被补回(G-34/G-43, 2026-10-25 立)。
 *
 * 立因(实测,不是推断):上面的 `declaredDropCaps` 按**整行逐字**对账。2026-10-25 活体证据:
 * `eb35b31d15` 把 24 行"等人拍板"条目删净而当时没写 `plan-row-drop.jsonl` ⇒ `531adf7e1b` 起
 * 按整行 union 100% 带回;补写留痕(kind=f11-purge)后清干净,但**对侧那份只要被改写过一笔**
 * (追加注记/剥装饰),新字符串不在台账逐字集里 ⇒ 整行比对结构上认不出 ⇒ 照旧带回。
 * AGENTS §1 通道③自认的"归并侧那半格仍未收口"正是这一格。
 *
 * 判序(补回候选 = 期望表里**本侧 0 份**的登记行;分族键**指纹优先**,与门 203 同源):
 *   A. 在册让路:候选的复合主键(`compositeKeyOf`)或题面指纹(`extractTaskFingerprint`)在本面
 *      还有**活票**(未勾)⇒ 同题仍开着、处置权未行使(或别人真在写同题)⇒ 一条不扣(与 scrub
 *      维二②' 同一条让路纪律)。
 *      〔2026-10-26 收窄,治"让路让成永久回潮"〕此前这一档是"本面出现同主键**即**不扣",于是
 *      "本侧已翻勾、清扫器还没摘"的那个窗口里(实测 5 分钟节拍 + 分钟级合并,窗口天天撞上),
 *      对侧的 open 旧形态被判"同题在册"照常补回;等清扫器把 x 形态摘掉,面上只剩回捞回来的
 *      open 旧形态 —— **净效果就是"已结清行被回捞成原形态"**。判据改成看**勾选态**:同主键在本面
 *      **全是已勾**是"这件活已经结清"的证据(不是活票),不构成让路;只要有一枚未勾就照旧让路。
 *      失效方向仍是"多留一份"(拿不准就不扣),但不再把"已结清"误读成"仍在册"。
 *   B. 台账命中⇒扣(不回补),逐条计数点名:指纹 ∈ 台账行指纹族 ∨ 主键 ∈ 台账行主键族 ∨
 *      题面 32 字指纹 ∈ `dropTitleFps`(f11-purge 族,与 scrub 维三同一把尺)。
 *      所有键/指纹一律取自单源(`plan-task-index` / `check-plan-task-duplicates` /
 *      `scrub-declared-removals` 的既有出口),本器零复算(§0.6/§22c)。
 *      **每一处扣减都必须能出示台账凭据**(哪条记录、哪个主键/指纹),随 `evidence` 交回并把
 *      被扣的**整行原文**打进输出留痕(§0.10:删行判据要能回答"凭哪一条")。任一扣减拿不出
 *      凭据 ⇒ **整批不扣**(见 `held` 桶:照旧补回并点名,绝不清空交差)。
 *   C. 未判定⇒不回补并点名原因(§0.3,不得静默当"没删过"):
 *      · 台账两份文件都不在位 / 现读抛 ⇒ 本面对登记行候选**一律**不回补(对侧面上行还在,
 *        台账修好后下一轮照常;而"照旧补回"是已实测的 100% 回潮通道);
 *      · 文件在位但含不可解行 ⇒ 仅当坏行原文**独立含该候选的编号**时不回补(无法排除
 *        这条摘除声明恰是它;不命中的照常补回)。
 *   射程外一律照旧:非登记行、无主键且无指纹的行、台账读得好而族不命中的行 ⇒ 补回。
 *
 * 与 `declaredDropCaps` 的分工:那道只管**逐字**形态(2026-10-23 立,语义一字不动);本维只吃
 * "同一族而字符串不同"的形态。两维共用同一张期望表 ⇒ 产出面与自证面天然同形。
 *
 * @param {string} oursText 本侧文本
 * @param {Map<string,number>} want 期望表(补回候选 = 其中本侧 0 份的行;本函数只读不改)
 * @param {object|Set|null} [declared] 注入用(镜像测试传 `declaredRows(tmp, files)` 的返回值);
 *   生产面不传 ⇒ 现读 `declaredRows(ROOT)`。旧 Set 形兼容:无 `filesSeen` ⇒ 不触发"整台账缺失"档。
 * @returns {{withheld:Map<string,string>, undetermined:Map<string,string>, held:Map<string,string>,
 *   evidence:Map<string,{via:string,key?:string,fingerprint?:string,titleFp?:string,ledgerRows:string[]}>}}
 *   `withheld` = 扣掉(不回补);`undetermined` = 未判定(也不回补,§0.3);`held` = 让路(**照旧补回**,
 *   与 `undetermined` 方向相反,不得合并成一个桶);`evidence` = 每一处扣减的台账凭据。
 */
export function declaredFamilyCaps(oursText, want, declared = null) {
  const withheld = new Map() // 行 -> 认账通道('fingerprint' | 'key' | 'title')
  const undetermined = new Map() // 行 -> 未判定原因(必须逐条打印,§0.3)
  const held = new Map() // 行 -> 让路原因(照旧补回;证据不足/活票在册都在这一桶)
  const evidence = new Map() // 行 -> 台账凭据 {via, key/fingerprint/titleFp, ledgerRows}
  const empty = { withheld, undetermined, held, evidence }
  if (typeof oursText !== 'string' || oursText === '' || !(want instanceof Map)) return empty
  let d = declared
  let readError = null
  if (d === null || d === undefined) {
    try {
      d = declaredRows(ROOT)
    } catch (e) {
      readError = String(e?.message ?? e).split('\n')[0].slice(0, 160)
      d = { set: new Set(), dropTitleFps: new Set(), malformedLines: [], filesSeen: 0 }
    }
  }
  const set = d instanceof Set ? d : d?.set instanceof Set ? d.set : new Set()
  const dropFps = d instanceof Set ? new Set() : d?.dropTitleFps instanceof Set ? d.dropTitleFps : new Set()
  const malformedLines = d instanceof Set ? [] : Array.isArray(d?.malformedLines) ? d.malformedLines : []
  const filesSeen = d instanceof Set ? null : typeof d?.filesSeen === 'number' ? d.filesSeen : null
  // 台账族:指纹优先;解不开主键与指纹的台账行不参与本维(逐字维照常兜它们)。
  // 索引存**原文数组**而不是裸 Set:扣行时要逐条出示凭据(哪条记录),只留一个布尔就答不出。
  const ledFps = new Map()
  const ledKeys = new Map()
  const pushTo = (m, k, l) => {
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(l)
  }
  for (const l of set) {
    const fp = extractTaskFingerprint(l)
    if (fp) pushTo(ledFps, fp, l)
    const ck = compositeKeyOf(l)
    if (ck) pushTo(ledKeys, ck, l)
  }
  // 主键索引优先用台账构造出口带回来的 `keyIndex`(§0.6 单源);旧注入形(裸 Set / 无该字段)
  // 落回上面从 `set` 现算的那一份 —— 两条路产出的都是"主键 → 台账原文",不是第二份判据。
  const ledKeyIndex = d?.keyIndex instanceof Map ? d.keyIndex : ledKeys
  const ledTitleRows = d?.dropTitleRows instanceof Map ? d.dropTitleRows : new Map()
  const co = counter(oursText)
  // A. 本面在册族:**活票**(未勾)才让路。已勾 = 这件活已结清,不构成"处置权未行使"。
  // 同一把尺子问状态:`rowStateOf`(scrub 单源,内部走 `parseTaskRows`),本器不另写勾选态正则。
  const oursFps = new Map() // fp -> {open:boolean, rows:string[]}
  const oursKeys = new Map() // ck -> {open:boolean, rows:string[]}
  const noteOurs = (m, k, l) => {
    const cur = m.get(k) || { open: false, rows: [] }
    if (rowStateOf(l) !== 'done') cur.open = true
    cur.rows.push(l)
    m.set(k, cur)
  }
  for (const l of oursText.split('\n')) {
    if (l === '') continue
    const fp = extractTaskFingerprint(l)
    if (fp) noteOurs(oursFps, fp, l)
    const ck = compositeKeyOf(l)
    if (ck) noteOurs(oursKeys, ck, l)
  }
  // C. 整台账读不到的那一档(缺失/抛):只在这一档里把"未判定"铺到全部登记行候选。
  const blind = readError !== null || filesSeen === 0
  const blindWhy = readError !== null ? `摘除台账现读失败(${readError})` : '摘除台账两份文件都不在位'
  for (const [l] of want) {
    if (l === '') continue // 空行不参与:与 liveDocExpectedCounts 同一条规矩
    if ((co.get(l) || 0) > 0) continue // 本侧逐字持有 ⇒ 不是补回候选
    if (!/^\s*- \[[ xX]\]/.test(l)) continue // 只认登记行(与逐字维同射程)
    const ck = compositeKeyOf(l)
    const fp = extractTaskFingerprint(l)
    // A. 同题**活票**在册 ⇒ 不扣(已勾形态不构成让路,见头注 2026-10-26 那一段)。
    const fpLive = fp && oursFps.get(fp)?.open
    const keyLive = ck && oursKeys.get(ck)?.open
    if (fpLive || keyLive) continue
    if (blind) {
      undetermined.set(l, `${blindWhy} ⇒ 无法核对主键/指纹,未判定不回补`)
      continue
    }
    if (fp && ledFps.has(fp)) {
      withheld.set(l, 'fingerprint')
      evidence.set(l, { via: 'fingerprint', fingerprint: fp, ledgerRows: ledFps.get(fp) })
      continue
    }
    if (ck && ledKeyIndex.has(ck)) {
      withheld.set(l, 'key')
      evidence.set(l, { via: 'key', key: ck, ledgerRows: ledKeyIndex.get(ck) })
      continue
    }
    const tf = titleFpOf(l)
    if (tf && dropFps.has(tf)) {
      withheld.set(l, 'title')
      evidence.set(l, { via: 'title', titleFp: tf, ledgerRows: ledTitleRows.get(tf) || [] })
      continue
    }
    if (malformedLines.length > 0 && ck) {
      const id = keyOfRow(l)
      if (id && malformedLines.some((raw) => rawMentionsId(raw, id))) {
        undetermined.set(l, `台账含 ${malformedLines.length} 行不可解且原文独立含编号 ${id} ⇒ 无法排除该族的摘除声明,未判定不回补`)
      }
    }
  }
  // §0.10 零损失自证:**每一处扣减都要出示台账凭据**。任一扣减拿不出(账本族索引空 / 坏注入形)
  // ⇒ 整批不扣并逐条落 `held`(照旧补回 + 大声点名),绝不"清空 withheld 就当没事"。
  const missing = [...withheld.keys()].filter((l) => {
    const ev = evidence.get(l)
    return !ev || !Array.isArray(ev.ledgerRows) || ev.ledgerRows.length === 0
  })
  if (missing.length > 0) {
    for (const l of withheld.keys()) {
      held.set(
        l,
        `扣减凭据缺台账原文(缺口 ${missing.length} 处:${missing[0].trim().slice(0, 48)})⇒ 整批不扣,照旧补回`,
      )
    }
    withheld.clear()
    evidence.clear()
  }
  return { withheld, undetermined, held, evidence }
}

/**
 * 一处"扣行"的台账凭据人读行(§0.10:删行判据必须能回答"凭哪一条记录、哪个主键")。
 * `evidence` 由 `declaredFamilyCaps` 随每次扣减一并交回,形状:
 * `{via:'key'|'fingerprint'|'title', key?/fingerprint?/titleFp?, ledgerRows:string[]}`。
 * 这里只做排版 —— 不判任何东西;`ledgerRows` 为空是**上游 bug**(那一档已在源头整批回退成
 * `held`),本函数给一个会自己暴露问题的占位串,便于读账的人当场看见。
 */
export function formatLedgerEvidence(evidence) {
  if (!evidence) return '❌ 缺凭据(上游未交回 evidence)'
  const rows = Array.isArray(evidence.ledgerRows) ? evidence.ledgerRows : []
  const id =
    evidence.via === 'key'
      ? `复合主键=${evidence.key}`
      : evidence.via === 'fingerprint'
        ? `题面指纹=${evidence.fingerprint}`
        : evidence.via === 'title'
          ? `题面 32 字指纹=${evidence.titleFp}`
          : evidence.via === 'marker-empty-triple'
            ? '空冲突区形状(区域内零正文,判据单源 lib/conflict-marker-triples 的 classifyMarkerTriples)'
            : `通道=${evidence.via}`
  if (rows.length === 0) return `${id} / ❌ 台账原文 0 条(凭据缺口 ⇒ 上游本应整批不扣)`
  const head = String(rows[0]).trim()
  // 台账原文可能很长(实测单行 6.5KB):凭据行给前 120 字 + 长度,完整原文就在台账文件里。
  return `${id} / 台账 ${rows.length} 条,首条(len=${String(rows[0]).length}):${head.slice(0, 120)}${head.length > 120 ? '…' : ''}`
}

/** union 的行切分出口:产物一律以 `\n` 收尾(与改动前逐字同形,只是把这一步收成一份实现)。 */
export function ensureTrailingNewline(text) {
  return String(text ?? '').endsWith('\n') ? String(text) : `${text}\n`
}

/**
 * 折叠台账:对**同一次** `dedupeByFingerprint` 的输入面与输出面做多重集差。
 *
 * 为什么它不是第二份折叠逻辑:本函数一条行都不自己判"该不该折"、一个字符都不自己并 ——
 * 它只是把"折叠这一步真跑完之后,账面少了哪些行(各几份)、多了哪些行(各几份)"抄下来。
 * 折叠策略(分组、择优选保留行、注记/票号并入)全部住在 `lib/dedupe-ledger.mjs`,只有一个调用点
 * (`foldDedupe`),所以台账与产物不可能不同轮:`folded` 与 `ledger` 出自同一次函数调用。
 *
 * `pairs` 是"哪些行被折进哪个保留行"的那本账,配对只按**身份**问(`extractTaskFingerprint`
 * 与 dedupe-ledger / 门 194 / 门 203 同源),不重做选择:
 *  - 被折掉的行自己在产物面还剩着(同题多份折成更少份)⇒ 去向就是它自己;
 *  - 自己在产物面一份不剩 ⇒ 去向 = 本次折叠产生的、同一枚指纹的那一行;
 *  - 两者都问不出来 ⇒ `kept:null`,由自证侧记「未判定」并点名(§0.3,绝不当成"没丢")。
 *
 * @param {string} beforeText 折叠输入(= 未折叠的行 union 产物)
 * @param {string} afterText  折叠输出(= 真正落地的产物)
 * @param {Map<string,string>|null} [keptOf] 折叠自己记的去向账(被折行 → 产物面那一行)
 */
export function foldLedgerOf(beforeText, afterText, keptOf = null) {
  const cb = counter(beforeText)
  const ca = counter(afterText)
  const foldedAway = new Map()
  const foldedIn = new Map()
  for (const [l, n] of cb) {
    const d = n - (ca.get(l) || 0)
    if (d > 0) foldedAway.set(l, d)
  }
  for (const [l, n] of ca) {
    const d = n - (cb.get(l) || 0)
    if (d > 0) foldedIn.set(l, d)
  }
  /** 产物面里"同一件事还剩哪一行"的索引:折叠的分组键就是 `extractTaskFingerprint`,
   *  所以去向必须按**同一把尺子**问 —— 且必须问**整个产物面**,不是只问"本次新写出来的那些行":
   *  多数折叠是"保留行原文不动、只少带几份",此时产物面没有任何新增行,只问 foldedIn 就问不出去向
   *  (本机实测 77 处「未判定」全是这一型 ⇒ 判据在,方向却错,把合法折叠读成了丢行)。 */
  const keptByFp = new Map()
  for (const l of ca.keys()) {
    const fp = extractTaskFingerprint(l)
    if (fp && !keptByFp.has(fp)) keptByFp.set(fp, l)
  }
  const pairs = []
  for (const [l, n] of foldedAway) {
    // 折叠自己记的去向优先(2026-10-20):事后按指纹回查在"并入注记改变了保留行指纹"时会落空,
    // 把合法折叠记成「未判定」。台账仍由验证侧拿产物面过四问,本项不是自证。
    let kept = keptOf?.get?.(l) ?? null
    if (kept === null) kept = (ca.get(l) || 0) > 0 ? l : null
    if (kept === null) {
      const fp = extractTaskFingerprint(l)
      // 指纹算不出 ⇒ 无从配对。不猜、不回落"就当它活着"(§0.3):登记 kept:null 交自证侧点名。
      if (fp) kept = keptByFp.get(fp) ?? null
    }
    pairs.push({ dropped: l, droppedCopies: n, kept, keptCopies: kept === null ? 0 : ca.get(kept) || 0 })
  }
  return { foldedAway, foldedIn, pairs }
}

/**
 * 折叠去向的**举证**判据(2026-10-16 立,本票的牙住在这里)。
 *
 * 台账是折叠自己写的,所以它不能自证:验证侧必须拿**产物面**把它报的每一次"折掉了"问一遍 ——
 * 少带一份只有在这一行确实被并进了产物面里的另一行、且那一行确实接住了它的信息时才算合法。
 * 四问全过才算 `attested`,任何一问不过就照原判据判红(§0.2 只许"多要一次说明",
 * 绝不允许把这条好判据做成掩体):
 *  Q1 主键算不出 ⇒ `undetermined`(点名,绝不当成"没丢");
 *  Q2 去向行必须**真在产物面**里(份数 ≥1);
 *  Q3 身份必须同一件事(指纹同一把尺子 `extractTaskFingerprint`,或复合主键 `keyOfRow` 相等;
 *     与门 194/203 同源,本器不另写"什么叫同一件事");
 *  Q4 信息守恒:被折行的独有 〔…〕 注记段与自持票号必须由去向行接住
 *     (判据取自 `lib/dedupe-ledger` 那一份 `uniqueNotes`/`selfIdOf` —— 折叠自己承诺的就是这两样)。
 *
 * @param {{dropped:string,kept:string|null}} pair foldLedgerOf 产出来的一条去向
 * @param {Map<string,number>} m 产物面的行重数
 * @returns {{status:'attested'|'undetermined'|'lost',reason:string,kept:string|null}}
 */
export function attestFoldPair(pair, m) {
  const dropped = String(pair?.dropped ?? '')
  const kept = pair?.kept ?? null
  const fpDropped = extractTaskFingerprint(dropped)
  const keyDropped = keyOfRow(dropped)
  if (kept === null || kept === '') {
    return {
      status: 'undetermined',
      kept: null,
      reason: '折叠台账给不出去向行(主键/指纹算不出或产物面没有同指纹的保留行)',
    }
  }
  if ((m.get(kept) || 0) < 1)
    return {
      status: 'lost',
      kept,
      reason: `台账报的去向行在产物面一份都没有(产物面与台账不同形;份数=${m.get(kept) || 0})`,
    }
  if (kept !== dropped) {
    if (!fpDropped && !keyDropped)
      return {
        status: 'undetermined',
        kept,
        reason: '被折行既算不出标题指纹也算不出复合主键 ⇒ 无从证明"折进了同一件事"',
      }
    const sameFp = !!fpDropped && extractTaskFingerprint(kept) === fpDropped
    const sameKey = !!keyDropped && keyOfRow(kept) === keyDropped
    if (!sameFp && !sameKey)
      return { status: 'lost', kept, reason: '去向行与被折行不是同一件事(指纹与主键都不等)⇒ 这是一次真删除,不是折叠' }
    const lostNotes = uniqueNotes(dropped, kept)
    if (lostNotes)
      return {
        status: 'lost',
        kept,
        reason: `去向行没接住被折行的独有注记,信息不守恒:${lostNotes.slice(0, 60)}`,
      }
    const droppedId = selfIdOf(dropped)
    if (droppedId && !kept.includes(droppedId))
      return {
        status: 'lost',
        kept,
        reason: `去向行没接住被折行的票号 ${droppedId},跨引用会断链`,
      }
  }
  return { status: 'attested', kept, reason: '' }
}

/**
 * 「声明式取代」的举证(票 G-310)。
 *
 * 存在的理由:活文档归并的失效方向被定死为"只能多带一行回来",于是**本侧就地改写过**的旧行
 * 会被按字面取回;落地闸随即判它"旧行被复活"。这一型既不是丢失也不是折叠 —— 它是同一件事
 * 换了写法,而"换写法"这件事只有改过它的人知道现在哪一行承载它的语义。所以出口必须由人来声明,
 * 而**不许由工具猜**(猜 = 把语义判定权塞进正则)。
 *
 * 判据不另起一把尺子(G-310 票面要求与守门 83"声明式例外不静默"同规矩):
 *  Q0 声明必须带原因 —— 无原因的放行等于没有判据;
 *  Q0b 声明必须给出去向行,且不得自取代(`kept === dropped` 是空调用,放行了也不证明任何事);
 *  Q1–Q4 其余四问**逐字复用 `attestFoldPair`**(主键/指纹同一件事、去向行真在产物面、
 *      独有注记与票号被接住)。这里再写一份"什么算同一件事"必然与它漂移,而漂移的固定代价
 *      是一边绿灯一边判红。
 *
 * @param {{kept?:string, why?:string}} declared 人给的一条声明
 * @param {string} dropped 判红的那一行字面
 * @param {Map<string,number>} m 产物面的行重数
 * @returns {{status:'attested'|'undetermined'|'lost',kept:string|null,reason:string}}
 */
export function supersedeProof(declared, dropped, m) {
  const why = String(declared?.why ?? '').trim()
  if (why === '') return { status: 'lost', kept: null, reason: '声明没写原因(无原因放行 = 没有判据)' }
  const kept = typeof declared?.kept === 'string' ? declared.kept : ''
  if (kept.trim() === '')
    return { status: 'undetermined', kept: null, reason: '声明没给"该语义现在住在合并稿哪一行"' }
  if (kept === dropped) return { status: 'lost', kept, reason: '自取代(去向行就是被取代行)⇒ 空调用' }
  return attestFoldPair({ dropped, kept }, m)
}

/**
 * `--declare-side-loss` 声明档一条项的**形状判据**(CLI 与自检共用这一份,§0.6 不许有第二把尺子)。
 * 返回 null = 合格;返回字符串 = 拒绝执行的理由。
 * 门槛两条,都不为"少拦"设计:① 要放过的行必须逐字给出(空 line = 放行整条路径的借口);
 * ② 原因 ≥10 字且必须是定向说明(「就这样」「同意」这类空话放行 = 没有判据,§0.10)。
 */
export function sideLossEntryProblem(d) {
  const line = typeof d?.line === 'string' ? d.line : ''
  const why = typeof d?.why === 'string' ? d.why.trim() : ''
  if (line === '') return '没有 line(要放过的行必须逐字给出)'
  if (why.length < 10)
    return `原因不足(${why.length} 字,门槛 10):没写清"为什么信息没损失"的放行 = 替人猜`
  return null
}

/**
 * 折叠的唯一调用点(2026-10-16 收口):`dedupeByFingerprint` 只在这里被调,产物与台账同轮产出。
 * 返回的 `text` 与 `unionLines(..., { dedupeTasks: true })` 逐字等值(该函数体就是这两步)。
 */
export function foldDedupe(text, baseLines = null, oursLines = null, picks = null) {
  const folded = dedupeGroups(String(text ?? ''), baseLines, oursLines, picks)
  return {
    text: folded.text,
    ledger: foldLedgerOf(text, folded.text, folded.keptOf),
    // 两侧各写一版、机器无从裁定的那些组:必须一路带到落地闸点名,不许在这一步被读成"没得折"。
    ambiguous: folded.ambiguous,
    // 声明式保留行里陈旧/串档的那些:同样必须进落地闸,否则"配了清单"会被读成"这轮真放过东西"。
    stalePicks: folded.stalePicks,
  }
}

/**
 * 行级 union 的**本体**(2026-10-16 从 `unionLines` 拆出):除产物文本外,还把**折叠台账**一起交回去。
 *
 * 为什么必须拆:落地闸(`verifyUnion`)此前只能对着"折叠前的重数"判红 —— 折叠这一步住在
 * `unionLines` 体内、产物面比自证面少一份,而自证侧不知道它发生过(实测本机 2026-10-16
 * 复现:关折叠 flagged=0 / 开折叠 flagged=295,真丢失 0)。台账必须**在折叠真发生的那一次调用里**
 * 取,不许验证侧另起一轮折叠、更不许再写一份折叠策略(§0.6/§22c)。
 *
 * 文本形状与拆分前逐字一致:`pre` 就是"未折叠的行 union 产物",`text` 就是"折叠后的产物"。
 */
export function unionLinesCore(oursText, theirsText, baseText, suppress, dedupeTasks, foldPicks = null, report = null, declaredOverride = null, archivedOverride = null) {
  const want = liveDocExpectedCounts(oursText, theirsText, baseText, suppress, report, declaredOverride, archivedOverride)
  // 脊柱裁剪:期望表已按改写折叠下调过的行,这里必须真把多出来的份数从本侧脊柱里去掉,
  // 否则"折叠"只存在于断言侧而产出面仍是双份 —— 那等于 F9 判据看不见、落地闸却对着一个不存在的数红。
  const remove = new Map()
  const coAll = counter(oursText)
  for (const [l, n] of coAll) {
    const over = n - (want.get(l) || 0)
    if (over > 0) remove.set(l, over)
  }
  const spine = []
  for (const l of oursText.split('\n')) {
    const r = remove.get(l) || 0
    if (r > 0) {
      remove.set(l, r - 1)
      continue
    }
    spine.push(l)
  }
  const out = spine
  const need = new Map(want)
  for (const [l, n] of counter(oursText)) need.set(l, (need.get(l) || 0) - n)
  // 逐行消费时也要按同一张抑制表计数,否则"该少带的那一份"会从末尾漏回来。
  const left = new Map(suppress || [])
  const extra = []
  for (const l of theirsText.split('\n')) {
    const suppressed = left.get(l) || 0
    if (suppressed > 0) {
      left.set(l, suppressed - 1)
      continue
    }
    if (l === '') continue // 空行不参与补回:与 liveDocExpectedCounts 同一条规矩(理由见其头注)
    const k = need.get(l) || 0
    if (k > 0) {
      extra.push(l)
      need.set(l, k - 1)
    }
  }
  const res = out.concat(extra).join('\n')
  const cr = counter(res)
  for (const [l, n] of want)
    if ((cr.get(l) || 0) < n) throw new Error(`行 union 丢行:${l.slice(0, 60)}`)
  // 根治(2026-10-15):守恒断言先就"逐行重数"把住零丢失;断言通过后再按标题指纹折叠同题行。
  // 折叠只删"同一件事的多余副本"、并把被删行独有注记/票号并入保留行,不触发上面那道守恒判据
  // (那是就 union 自身量),也不引入任何对侧的"少带" —— 方向只可能是"少留一份冗余",绝不会"丢"。
  // 2026-10-16:折叠的那一步收进唯一调用点 `foldDedupe`,产物与台账出自同一次函数调用。
  const pre = ensureTrailingNewline(res)
  if (!dedupeTasks) return { text: pre, pre, ledger: null, ambiguous: [], stalePicks: [] }
  // 基底交给折叠层做「改写者优先」判据(2026-10-20):没有 baseText 就没有改写信号 ⇒ 逐字走旧判据。
  const folded = foldDedupe(pre, baseText, oursText, foldPicks)
  return {
    text: folded.text,
    pre,
    ledger: folded.ledger,
    ambiguous: folded.ambiguous,
    stalePicks: folded.stalePicks,
  }
}

/**
 * 行级 union:以本侧顺序为脊柱,把对侧**相对基底新增、且未被搬运感知代表**的重数补在末尾。
 * @param {object} [opts] `{ dedupeTasks=false }` —— 仅对 PROJECT_PLAN.md 开启:产出后按标题指纹
 *   折叠同题行(根治重复再生)。默认 false,保证既有调用方(含全部既有测试)逐字不变。
 */
export function unionLines(oursText, theirsText, baseText = null, suppress = null, opts = {}) {
  return unionLinesCore(
    oursText,
    theirsText,
    baseText,
    suppress,
    !!(opts && opts.dedupeTasks),
    null,
    (opts && opts.report) || null,
    opts && Object.prototype.hasOwnProperty.call(opts, 'declared') ? opts.declared : null,
    opts && Object.prototype.hasOwnProperty.call(opts, 'archived') ? opts.archived : null,
  ).text
}


/** 活文档路径的"因指针有意少带"计数(与 `lostAddedLines` 同一个形状,但那里按两侧抵扣;
 *  活文档走 `verifyUnion` 的 LIVE_DOCS 环,不经过那两个分支 —— 少带必须在**这条路径**上也被点名,
 *  否则本票最要紧的那一族(台账)反而无人报(2026-09-29 端到端 cap 第三条当场抓到)。
 *  一份都不剩的行**不进这里** —— 那是真丢失,由"未存活行"那条判据拦。 */
export function liveDocPointerCaps(baseText, sideTexts, mergedText) {
  const cm = counter(mergedText)
  const cb = counter(baseText)
  const caps = []
  for (const sideText of sideTexts ?? []) {
    const cs = counter(sideText)
    for (const [l, n] of cs) {
      if (l === '' || !DUP_POINTER_RE.test(l)) continue
      const added = n - (cb.get(l) || 0)
      if (added <= 0) continue
      const have = cm.get(l) || 0
      if (have < 1) continue
      if (have < added) caps.push({ line: l, dropped: added - have })
    }
  }
  return caps
}
// §22c:镜像测试只 import 本层实现,不得复制第二份判据。
export const __test__ = {
  counter,
  lostAddedLines,
  excessAddedLines,
  capAddedDuplicates,
  isDupCapStrictPath,
  liveDocPointerCaps,
  liveDocExpectedCounts,
  planStateRegressions,
  mergeNoteCrossLineCaliber,
  f3ExitCaliber,
  markerTripleRecallCaps,
  foldLedgerOf,
  attestFoldPair,
  supersedeProof,
  foldDedupe,
  unionLinesCore,
  unionLines,
  ensureTrailingNewline,
  rawMentionsId,
  declaredDropCaps,
  declaredFamilyCaps,
  yieldedIdCaps,
  theirsRewriteCaps,
  formatLedgerEvidence,
  formatPointerCapReport,
  formatFoldReport,
  sideLossEntryProblem,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
