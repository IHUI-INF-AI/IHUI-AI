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
 *   node scripts/plan-tasks.mjs --gate [--strict] # 判据档(默认存量只报数;--strict 判红)
 *   node scripts/plan-tasks.mjs --next-id G      # 取号出口:下一个空闲的 G- 编号(登记新条目前问一次,别手抄)
 *   node scripts/plan-tasks.mjs --json | --self-test | --staged | --worktree
 *
 * 取材面纪律(同守门 70/77/83/98/101/118):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 只作人工逃生舱;两面旗同给 ⇒ exit 2;任一面取不到 ⇒ **exit 2「无法判定」,不回落**。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import {
  auditPlan,
  compositeKeyOf,
  dispositionOf,
  isDeclarationRow,
  nextTaskIdLabel,
  parseTaskRows,
  usedIdsOfPrefix,
  LEDGER_TTL_DAYS,
} from './lib/plan-task-index.mjs'
import { headAges } from './lib/plan-line-age.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_REL = 'PROJECT_PLAN.md'
/** 真实形态样本钉在"首次归并的前一版"上 —— 清偿之后当前 HEAD 不再含那批行(见 selfTest 注释)。 */
const SAMPLE_REV = '0bc0af653df^'
const LABEL = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }

export function parseArgs(argv) {
  const has = (f) => argv.includes(f)
  const sel = selectFace({ staged: has('--staged'), worktree: has('--worktree'), def: 'head' })
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
  return {
    json: has('--json'),
    nextIdRequested,
    nextId,
    open: has('--open'),
    forks: has('--forks'),
    void: has('--void'),
    pointers: has('--pointers'),
    gate: has('--gate'),
    strict: has('--strict'),
    stale: has('--stale'),
    undisposed: has('--undisposed'),
    dispatchable: has('--dispatchable'),
    selfTest: has('--self-test'),
    updateBaseline: has('--update-baseline'),
    face: sel.face,
    faceError: sel.error,
    root: has('--root') ? path.resolve(argv[argv.indexOf('--root') + 1]) : ROOT,
  }
}

/** 只读一条文档。整面取不到 ⇒ 抛 Undetermined(调用方转 exit 2),绝不静默换面。 */
function readPlan(root, face) {
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

/**
 * 判定面 = 取材 + `auditPlan` + **F9 的编号位收窄**,三件事同面同轮一次做完。
 *
 * 为什么收窄必须住在这里而不是各调用点:差值棘轮拿两把面(a 与 before)比键集,基线档拿 a 的键集
 * 比台账 —— 任何一处漏收窄,那一档就仍在按"全文窗口命中"判撞号,而账面看起来是同一把尺子
 * (两处算同一件事必漂移,本仓记过多次)。取材失败照旧抛 Undetermined ⇒ 调用方 exit 2,不回落。
 */
export function auditFace(root, face) {
  const content = readPlan(root, face)
  const a = auditPlan(content)
  // 宽口径读数必须留在面上(只报数不判红):收窄不是"看不见",报告里必须能说"摘掉了几个标题"
  a.counts.f9WideGroups = (a.collisions ?? []).length
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
  console.log(
    `  F9 组内全已勾选(降为只报数、永不判红): ${c.f9SettledGroups ?? f9Settled.length} 组` +
      (f9Settled.length
        ? ` —— ${f9Settled.slice(0, 6).map(f9GroupLine).join(' / ')}` +
          (f9Settled.length > 6 ? ` (另 ${f9Settled.length - 6} 组见 --json 的 settled)` : '') +
          ` —— 判据按**组**判:只要组内有一行未勾选就仍判红(HEAD 面混合组是这条的反向用例)`
        : ' —— 本面没有"整组都勾选"的撞号组(这一句是"量到了 0",不是"没量")'),
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
    `  └ 同一分层按**派单口径**重算(基数 ${c.claimable} 行,已扣同题副本/作废/分叉):` +
      `现在可做 ${c.dispClaimActionable} / 等人拍板 ${c.dispClaimWaitingHuman} / 等条件 ${c.dispClaimWaitingEnv} / 归他人 ${c.dispClaimOwnedElsewhere}` +
      ` —— 两行不得互相顶结论:上行答"账面有几行挂着",下行答"真有几件事"`,
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

function listRows(rows, face) {
  console.log(`── ${rows.length} 行(判定面:${LABEL[face]})──`)
  for (const r of rows) console.log(`  L${r.line}  ${clip(r.raw)}`)
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
 * F9 **定级**:「组内每一行都已勾选」的撞号组**不进判红,降为只报数**(2026-10-06 立)。
 *
 * ## 为什么是"按组"而不是"按行"或"按号"
 * 这一族必须按**组**判,按行/按号判都会放过真活票:
 *  - **按行剔**(只把已完成行从组里摘出去)⇒ 组一旦还剩 ≥2 个标题就仍判红,而"剩下的行"正是**活票**,
 *    剔了等于没剔,反过来若把 done 行摘到只剩 <2 标题就整组消失 ⇒ 那时消失的是**只剩历史快照的组**,
 *    但按行实现同时会把"done 1 行 + open 1 行"的混合组误判成"无标题组"而一并放过 —— 混合组才是真活票所在;
 *  - **按号剔**(某号下全是 done 就放过该号)⇒ 组是按 (号, 题面) 分的,一个号下**可以同时**有
 *    "全 done 的历史快照组"与"含活票的组";按号判会把后者一起放过。
 *  - 正确形状只有一个:**一个组当且仅当它自己名下每一行都是 `- [x]`,才降为只报数**。
 *    实测该形状下的组正是"这件事当年留下的历史快照",而任何含一行 `- [ ]` 的组必须仍红
 *    (HEAD 面 21 个混合组就是这条的用例,自测里逐个钉住)。
 *
 * ## 为什么这一刀是"定级"而不是"放过"
 * 判据覆盖面变窄,只有一条纪律兜底:**降档的组必须报名**(`counts.f9SettledGroups` +
 * `f9Settled` 名单 + 逐组文案),否则"从红路挪走"与"没人看过"同形 —— 本仓"报数不报名"记过多次
 * (守门 70/76/81/128 同族)。人读摘要与 `--json` 都给出这一档。
 *
 * ## 削覆盖面这件事本身的红线
 * 这一族**只把"组内全 done"剔出红路**,不做任何"看起来像已完成"的推断(不认行内日期、不认
 * `【已完成】`装饰、不认"无未勾选行"这类近似)。放宽窗口/加近似条件是本族唯一禁止的改法:
 * 豁免一旦变成放过真活票,差值棘轮就再也拦不住新增撞号(§12e/§12f)。
 *
 * ## fail-closed:读不到组内行 ⇒ 仍判红
 * 组明细里出现**取不到的行号**(面被换过、裁剪过)时**不得**当成"全 done":`every()` 遇缺行即 false,
 * 整组仍进红路。判据失效方向按票面:宁可多判。
 *
 * @param content 被审面全文(必须与 groups 同一面同轮)
 * @param groups 已收窄到编号位的组集(`narrowCollisionsToIdPosition` 或 `f9Declared` 的产物)
 * @returns {{groups:Array, settled:Array}} `groups` = 仍判红的组;`settled` = 降为只报数的组(原样保留)
 */
export function splitF9SettledGroups(content, groups) {
  const list = groups ?? []
  if (!list.length) return { groups: list, settled: [] }
  const stateByLine = new Map()
  for (const r of parseTaskRows(content)) stateByLine.set(r.line, r.state)
  const kept = []
  const settled = []
  for (const g of list) {
    const lines = (g.titles ?? []).flatMap((t) => t.lines ?? [])
    // ⚠ 空组不得当成"全 done"(那是"没量到"而不是"量到全 done"):仍判红。
    if (lines.length && lines.every((ln) => stateByLine.get(ln) === 'done')) settled.push(g)
    else kept.push(g)
  }
  return { groups: kept, settled }
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
  // F9 定级(2026-10-06):"组内每一行都已勾选"的撞号组降为只报数。**按组判**,不按行也不按号
  // (头注有三种形状的失效推演)。降档名单必须与判红组集**同批**落到面上,否则"组数"与"名单"分叉。
  const split = splitF9SettledGroups(content, narrowed.groups)
  a.counts.f9WideGroups = wide
  a.counts.f9NonIdTitles = narrowed.droppedTitles
  a.collisions = split.groups
  a.counts.collisionGroups = split.groups.length
  a.f9Settled = split.settled
  a.counts.f9SettledGroups = split.settled.length
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
    '      归档件的占用面由 `scripts/live-doc-edit.mjs` 那一路并入(台账 ⊕ .ihui-agent/archive/PROJECT_PLAN*)。',
    '   ② 登记新条目一律经 `node scripts/live-doc-edit.mjs` 的 `{{NEXT_ID:<族>}}` 令牌:它在**每次 CAS 尝试**里',
    '      按当下底稿重算,所以"查号"与"写行"之间的竞态窗口被消掉 —— 手工 max+1 抄进正文必撞。',
    '   ③ 令牌展开值本身已含族名,正文不得再手写字面值(`G-` + `{{NEXT_ID:G}}` 产出 `G-G-334` 这一型,',
    '      本仓实测两次)—— 畸形号还会被 F9 的窗口口径读成撞号,虽已不计判据,但它是台账里的脏号。',
  ].join('\n')
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

/** 差值棘轮纯函数:两把同形读数(候选面 vs 基准面)只比"变多"。 */
export function grewViolations(now, before) {
  const items = probe(now)
  const prev = new Map(probe(before).map(([k, label, n]) => [k, { label, n }]))
  const out = items
    .filter(([k, , n]) => typeof prev.get(k)?.n === 'number' && n > prev.get(k).n)
    .map(([k, label, n]) => `${k} ${label} 由 ${prev.get(k).n} 涨到 ${n}(+$ ${n - prev.get(k).n})`)
  // F5 方向相反(只许增不许减),**不塞进上面那个"比变多"的循环** —— 一把尺子对同一维
  // 既判涨又判跌,读的人就无法知道哪个方向是坏。
  const b5 = before?.counts?.mergeNotes
  if (typeof b5 === 'number' && now.counts.mergeNotes < b5)
    out.push(
      `F5 归并落账注记由 ${b5} 条掉到 ${now.counts.mergeNotes} 条(被一次旧计划文档整文件提交抹掉了)`,
    )
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
export function gate(a, strict, root, before, beforeErr) {
  const items = probe(a)
  const nonZero = items.filter(([, , n]) => n > 0)
  // F9 存量只报数、**--strict 也不判红**(定级理由见 lib findIdCollisions 头注:存量绝大多数是
  // 子项命名惯例,判红=与任何提交无关的恒红门,§12e)。它唯一的红路是差值/基线棘轮(只拦新增撞号组)。
  const strictNonZero = nonZero.filter(([k]) => k !== 'F9')
  let base = null
  try {
    base = readBaseline(root)
  } catch (e) {
    console.log(`⚠️ 无法判定 —— ${e.message}`)
    return 2
  }
  // F9 基线锚点必须是键集合(G-312)。旧形状 = 这一维关着 —— 静默放行等于把它写成"判过了且没问题",
  // 而它恰恰是那层"别人跳门把增长塞进 HEAD"唯一的看守者,所以这里按**无法判定**处理(exit 2)。
  const f9b = f9Ratchet(base, a)
  if (before) {
    const grew = grewViolations(a, before)
    if (grew.length) {
      console.log(`❌ 差值棘轮:本次改动让状态分叉变多 —— ${grew.join(';')}`)
      // F9 上涨 ⇒ 逐组点名"编号 G-x 被 N 个不同标题共用"(票面要求的报名形态;只报数不点名
      // 等于让改的人自己再去跑一遍全量档找差异)。
      for (const g of newCollisionGroups(a, before))
        console.log(`   F9 新增撞号:${f9GroupLine(g)}`)
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
  if (f9b.kind === 'unmigrated' || f9b.kind === 'blind') {
    console.log(`⚠️ 无法判定 —— F9 基线层:${f9b.message}`)
    console.log(
      f9b.kind === 'unmigrated'
        ? `   出路:人工把 ${BASELINE_REL} 的 F9 写成当次 HEAD 面现读的撞号**键数组**(排序、去重),或跑 \`--update-baseline\`(它只认键集形状)。**禁止**改回整数蒙过去 —— 那等于把这一维关掉而账面看不出来。`
        : `   出路:判定面必须带 collisions 明细(auditPlan 的产物本来就有 ⇒ 这一格只会是调用方自己拼了半个面)。`,
    )
    return 2
  }
  const vsBase = ratchetViolations(base, items, a)
  if (vsBase.length) {
    console.log(`❌ 基线棘轮:${vsBase.join(';')}`)
    console.log(`   差值判据看不见"别人跳门把增长塞进 HEAD"那一型,这一层就是为它留的。`)
    // F9 红必须**逐组点名**(键 / 两侧标题 / 行号)—— "只报数不报名"等于让改的人再跑一遍全量档,
    // 而这一维的存量按设计不判红,所以红只可能是新键:名单就是可执行出口本身。
    const addedKeys = f9b.kind === 'red' ? new Set(f9b.added) : new Set()
    for (const g of a?.collisions ?? [])
      if (addedKeys.has(g.key)) console.log(`   F9 基线新增撞号:${f9GroupLine(g)}`)
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
    console.log(`❌ 存续性棘轮:归并落账注记由基线 ${base.F5} 条掉到 ${a.counts.mergeNotes} 条`)
    console.log(
      '   成因只会是"按内存里那份旧计划文档整文件提交"或跳门回写;出路是重放那批注记,不是下调基线。',
    )
    if (absoluteLayerBlocks({ strict, before })) return 1
    console.log('   ↑ 同上:绝对层在提交链只报数,问责档 --strict 判红。')
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
      '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见带 v3wave3 租约的那条(该条写明 ChatSearchBar 前提被推翻与 use-chat-search 投影现场)。',
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
  // ── F9 定级(2026-10-06):「组内全已勾选」降为只报数,**按组判** ──────────────────
  // 成对写:一条"必须降档"(正向)+ 一条"必须仍红"(反向锁)+ 一条"读不到行仍红"(fail-closed)。
  // ⚠ 反向锁这一条最要紧:把判据改成"按行剔"或"按号剔"时,它**是唯一会变红的那条** ——
  //   HEAD 面 21 个混合组正是它的真实样本,按行/按号实现会放过真活票(§12e:豁免变成放过即失效)。
  const f9AllDone =
    '- [x] **G-610 历史快照甲**:当年的一件事。\n' +
    '- [x] **G-610 历史快照乙**:同一件事的另一份措辞(措辞随时间演进,不是逐字重复)。'
  const f9Mixed =
    '- [x] **G-611 历史快照甲**:当年的一件事。\n' +
    '- [ ] **G-611 历史快照乙**:同一件事的另一份措辞。'
  const f9SettledFace = narrowF9Face(auditPlan(f9AllDone), f9AllDone)
  ok(
    f9SettledFace.counts.collisionGroups === 0 &&
      f9SettledFace.collisions.length === 0 &&
      f9SettledFace.counts.f9SettledGroups === 1 &&
      f9SettledFace.f9Settled[0]?.key === 'G-610',
    `组内每一行都已勾选的撞号组必须降为只报数(且降档名单可定位),实测 ${JSON.stringify([f9SettledFace.counts.collisionGroups, f9SettledFace.counts.f9SettledGroups, f9SettledFace.f9Settled.map((g) => g.key)])}`,
  )
  const f9MixedFace = narrowF9Face(auditPlan(f9Mixed), f9Mixed)
  ok(
    f9MixedFace.counts.collisionGroups === 1 &&
      f9MixedFace.collisions[0]?.key === 'G-611' &&
      f9MixedFace.counts.f9SettledGroups === 0,
    `反向锁:组内只要有一行未勾选就必须仍判红(按行剔/按号剔都会放过这一组真活票),实测 ${JSON.stringify([f9MixedFace.counts.collisionGroups, f9MixedFace.counts.f9SettledGroups, f9MixedFace.collisions.map((g) => g.key)])}`,
  )
  ok(
    narrowCollisionsToIdPosition(f9Mixed, auditPlan(f9Mixed).collisions).groups.length === 1,
    '变异自证:定级这一刀不得顺带改掉"收窄到编号位"那一层(两笔改动互相掩盖时,一条坏了另一条会顶着看不出来)',
  )
  ok(
    splitF9SettledGroups(f9Mixed, [{ key: 'X-1', titleCount: 2, titles: [] }]).groups.length === 1,
    'fail-closed:组明细里取不到任何行 ⇒ 那是"没量到"不是"量到全 done",必须仍判红',
  )
  ok(
    splitF9SettledGroups(f9Mixed, [
      { key: 'Y-1', titleCount: 2, titles: [{ title: '甲', lines: [999] }, { title: '乙', lines: [998] }] },
    ]).groups.length === 1,
    'fail-closed:行号取不到对应行(面被换过/裁剪过)时必须仍判红,不得当成全 done 放过',
  )
  ok(
    splitF9SettledGroups(f9AllDone, [
      { key: 'Z-1', titleCount: 2, titles: [{ title: '甲', lines: [1] }, { title: '乙', lines: [2] }] },
    ]).settled.length === 1,
    '纯函数自证:两条 `- [x]` 的组必须被认成全 done(否则上面那条正向用例是碰巧过的)',
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
  console.log(`\n自检:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  const o = parseArgs(argv)
  if (o.selfTest) return selfTest()
  if (o.faceError) {
    console.log(`⚠️ 无法判定 —— ${o.faceError}`)
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
  if (preBefore) a.counts.newUndisposed = countNewUndisposed(a, preBefore)
  // ⚠ 基线取的是**当次当面的实测数**,换一次提交就会变。所以它只能由人工在清偿之后刷,
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
    const rows = o.dispatchable
      ? a.claimableRows.filter((r) => dispositionOf(r.raw) === 'actionable')
      : a.claimableRows
    if (o.dispatchable) {
      console.log(
        `── 派单口径中"现在可做" ${rows.length} / ${a.claimableRows.length} 行` +
          `(剔除:待人拍板 ${a.counts.dispWaitingHuman} / 等条件 ${a.counts.dispWaitingEnv} / 归他人 ${a.counts.dispOwnedElsewhere};` +
          `剔除按正文推导,拿不准的**留在清单里**而不是踢掉)──`,
      )
    }
    listRows(rows, o.face)
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
        `  L${r.line}  锚点 ${r.anchor}(距今 ${r.age} 天) ${dispositionOf(r.raw)}  ${clip(r.raw)}`,
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
