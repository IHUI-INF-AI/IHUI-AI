#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * push 门全量 typecheck 包装(staged-scope 降级)。
 *
 * 2026-08-31 新增原因:.husky/pre-push 直跑 `pnpm typecheck:full`(→ scripts/typecheck-full.mjs
 * → pnpm -r run typecheck 串行各包 tsc --noEmit),多会话并行开发时工作区充满其他会话的
 * 未完成/损坏文件,上千个 TS1005 等错误全部来自非暂存文件,却把本次 push 阻塞
 * (输出"❌ 全量 typecheck 失败,推送已阻止")。typecheck 由 package.json script 经
 * .husky/pre-push 直接触发,难以内嵌降级逻辑,故用本包装做 staged-scope 降级判定。
 *
 * 行为:
 *   1. 运行同一命令(node scripts/typecheck-full.mjs,等价 pnpm typecheck:full),实时透传输出并捕获;
 *   2. 解析报错文件路径(tsc `path(line,col): error TSxxxx` / mypy `path:line: error:` 两种格式);
 *   3. 若「本次改动范围」非空且所有报错文件均不在该范围内
 *      → 打印"ℹ️ 全部报错文件均不在本次改动范围(并行会话工作区噪音),降级为警告"并以 0 退出;
 *   4. 否则(改动范围为空 / 存在范围内文件报错 / 退出码非 0 但解析不到任何错误文件)维持原失败行为,
 *      以原退出码退出 —— 遵循 §22b "tsc 未能真正运行按失败处理,禁止静默通过"。
 *
 * 「本次改动范围」的取值(2026-09-03 修复,见 getScopeFiles):
 *   优先 PUSH_SCOPE_FILES —— 由 .husky/pre-push 依据 git 传入的 remote_sha..local_sha 计算导出。
 *   原实现只用暂存区推断范围,而 `git push <sha>:<ref>` 这类 refspec 推送不产生暂存区,
 *   若此刻他人也没 staged 文件,降级直接失效 → 他人并行会话的半编辑态报错会硬拦本次 push。
 *   暂存区保留为兜底判据。
 *
 * G-406 ②(2026-10-04):降级判据的 scope 沿**反向依赖闭包**加宽(见 widenScopeOverDependents)。
 *   改一份被下游 import 的契约时,importer 自身不在路径清单里 → 它的类型报错被当噪音
 *   降级放行 ⇒ 改契约不红 importer。闭包把「直接或间接 import 了本次改动」的文件纳入判据。
 *   加宽只作用于**降级判据**,定向快通道仍只看原始改动清单(见该函数边界 1)。
 *
 * 用法:
 *   node scripts/check-typecheck.mjs             # 完整运行(数分钟,实时透传输出)
 *   node scripts/check-typecheck.mjs --dry-run   # 干跑:只打印暂存区快照与降级判定计划,不跑 typecheck
 *   node scripts/check-typecheck.mjs --self-test # 自测:内置样例验证解析/匹配/降级分支,不跑 typecheck
 *
 * 接入:node scripts/guardian-runner.mjs --push-gate(--push-gate 显式启用本检查,
 *       .husky/pre-push 本体不在本改动允许范围内,改由编排/手动走本包装)。
 */
import { spawn, spawnSync } from 'node:child_process' // spawnSync:2026-09-20 超时杀进程树/定向快通道用
import { dirname, join, resolve } from 'node:path'
// 硬超时上限(2026-09-20 根治推送挂起;定义前置是因为定向快通道也要用同一上限):
// 事故实证:某次 push 挂起 62 分钟零产出 —— 本脚本原先对 typecheck 子进程既无 timeout
// 也无 timer kill,只要 typecheck-full 内部卡住(pnpm -r 依赖解析失败 / worktree 各包
// 缺 node_modules 导致 tsc 静默长耗时 / typecheck.lock 持锁者僵而不退),push 就永远等待。
// 可调大:IHUI_TYPECHECK_TIMEOUT_MIN=40 git push ...(大仓全量 tsc 慢于默认值时)。
const TYPECHECK_TIMEOUT_MIN = Number(process.env.IHUI_TYPECHECK_TIMEOUT_MIN || 20)
const TYPECHECK_TIMEOUT_MS = TYPECHECK_TIMEOUT_MIN * 60 * 1000
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
// G-611:128+N 族码的集合/分类/产出侧全部住 scripts/lib/signal-exit.mjs —— 本文件的消费侧
// 与两个被派生方的产出侧用**同一把尺子**,字面量集合在本文件不得再出现(镜像测试形状锁)。
import { classifySpawnOutcome, installSignalExit, TEMPFAIL_EXIT_CODE } from './lib/signal-exit.mjs'
// 未判定判据的唯一实现住 gate-failure-kind(exit 2 + 未判定标记),本文件只消费。
// 机器级锁等不到时 typecheck-full 以 exit 2 交付「未判定(并发占用)」,必须原样透传:
// 下方的 staged-scope 降级与「退出码非 0 但没解析到报错文件 ⇒ 按失败处理」都会把它折成红。
import { detectUndetermined, UNDETERMINED_EXIT_CODE } from './lib/gate-failure-kind.mjs'
import {
  formatDuration,
  formatSummaryLine,
  readTimings,
  summarizeTimings,
} from './lib/typecheck-timing.mjs'
// G-406 ②:反向依赖闭包的门 103 已有那份文件级图(边解析只有这一份实现),
// 本门只**消费** lib 的反向依赖闭包判据,不自己再实现一遍边判定(2026-10-18 L14546 后,
// 通用判据 widenFilesOverDependents 已提升到 lib,本门固定 face='worktree' 薄封装)。
import { buildFileGraph, widenFilesOverDependents } from './lib/import-graph.mjs'
import { gitRaw } from './lib/face-reader.mjs'
// T1 长期票(2026-11-10 落地):全量结论按 tree-sha 落盘为回执,推送门只读近期结论。
// 判据本体不变 —— 回执只替代「重新 spawn tsc」,降级/未判定/超时口径全部沿用现有实现重算。
import {
  RECEIPT_REL,
  RECEIPT_SCHEMA_V,
  RECEIPT_WRITER,
  readReceipt,
  receiptDisabled,
  receiptTtlMs,
  receiptUsable,
  writeReceipt,
} from './lib/typecheck-receipt.mjs'
// T1 超时预算**不设第二本账**(2026-11-08 裁决):唯一取数处 = land-gate-budgets.json
// (DG-06,执行器看门狗与落地复跑共用)。本门只校验 T1 那一行的证据链,见下方 enforceT1BudgetEntry。

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DRY_RUN = process.argv.includes('--dry-run')
const SELF_TEST = process.argv.includes('--self-test')

// ─── T1 超时预算自检(2026-11-08 裁决:唯一账本 land-gate-budgets.json) ────────
// 不再有 base+margin 第二本账:预算的唯一取数处是 scripts/data/land-gate-budgets.json
// (DG-06,执行器看门狗与落地复跑共用同一处)。本门只校验 T1 那一行的证据链:
// 缺行 / measuredMs·measuredAt·note 缺一 / timeoutMs 低于实测(误杀) / timeoutMs > 3×实测(放水)
// 一律 exit 非 0,禁止回落默认 300s —— 「数据坏了 = 阈值消失」是同一族 fail-open。
// 位置约束沿用(2026-11-07):必须在**任何可能 exit 0 的分支之前**(--self-test /
// --dry-run / 定向快通道)执行,否则畸形预算能被任一早退分支绕过。
const BUDGET_REL = 'scripts/data/land-gate-budgets.json'
const T1_GATE_SCRIPT = 'check-typecheck.mjs'

function enforceT1BudgetEntry() {
  const abs = join(ROOT, BUDGET_REL)
  let raw
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    console.error(
      `[check-typecheck] ❌ 读不到/解析不了 ${BUDGET_REL} —— 拒绝回落默认阈值: ${e.message}`,
    )
    process.exit(1)
  }
  const row = (Array.isArray(raw?.gates) ? raw.gates : []).find((g) => g?.script === T1_GATE_SCRIPT)
  const problems = []
  if (!row) {
    problems.push(`表中没有 ${T1_GATE_SCRIPT} 的登记行`)
  } else {
    for (const k of ['timeoutMs', 'measuredMs']) {
      if (!Number.isFinite(Number(row[k])) || Number(row[k]) <= 0)
        problems.push(`${k} 缺失或非正数`)
    }
    if (typeof row.measuredAt !== 'string' || !row.measuredAt) problems.push('measuredAt 缺失')
    if (typeof row.note !== 'string' || !row.note) problems.push('note(凭什么给这个阈值)缺失')
    if (problems.length === 0) {
      const measured = Number(row.measuredMs)
      const timeout = Number(row.timeoutMs)
      if (timeout < measured) problems.push(`timeoutMs ${timeout} 低于实测 ${measured}(门会误杀)`)
      if (timeout > 3 * measured)
        problems.push(`timeoutMs ${timeout} 超过 3×实测 ${measured}(放水超上限)`)
    }
  }
  if (problems.length === 0) return
  console.error('[check-typecheck] ❌ T1 超时预算自检未通过 —— 拒绝回落默认阈值:')
  for (const p of problems) console.error(`  · ${p}`)
  console.error(`  修法:只修 ${BUDGET_REL} 里 ${T1_GATE_SCRIPT} 那一行(本门不提供跳过开关)。`)
  process.exit(1)
}

enforceT1BudgetEntry()

/**
 * 无文件面档判据(2026-11-04 立)。env 契约的唯一产出方是 `.husky/pre-push`:
 * 本次推送零 blob 变更(纯删除远端分支 / 分支推进到同一棵树)时它逐条 ref 复核后导出
 * `PUSH_NO_FILE_FACE=1` + `PUSH_NO_FILE_FACE_BASIS`。
 *
 * 改前病理:空 scope 被当成「取不到面」⇒ 退回暂存区/head-diff 兜底并跑全量 tsc,
 * 于是一次不携带任何文件的 `git push origin --delete` 被他人的暂存面 + 另一枚在飞的
 * 全量 typecheck 串行锁拦死(2026-11-04 实测:串行等待 20min 超时判红)。
 * 只认带依据的那一对值:值不是 1 或缺依据 ⇒ 不启用,原路径(全量 tsc + scope 降级)一字不变。
 * @returns {{ok:boolean, basis:string, reason?:string} | null} null = 本档未启用(走原路径)
 */
function noFileFaceVerdict(env = process.env) {
  if (env.PUSH_NO_FILE_FACE !== '1') return null
  const basis = String(env.PUSH_NO_FILE_FACE_BASIS || '').trim()
  if (!basis) return { ok: false, basis: '', reason: 'PUSH_NO_FILE_FACE=1 但缺判定依据' }
  return { ok: true, basis }
}

/** 取暂存文件列表(仓库根相对路径,统一为 /);git 不可用返回 null(降级路径不可用,维持原失败行为) */
function getStagedFiles() {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(层内已拼 -C ROOT,剥掉显式 -C;stderr ignore→pipe 两态成功路径均丢弃,等价)
    const out = gitRaw(['diff', '--cached', '--name-only'], ROOT)
    return out
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

/**
 * 取降级判据的「改动范围文件列表」,返回 { files, source }。
 *
 * 优先级:
 *   1. push-scope —— 环境变量 PUSH_SCOPE_FILES(由 .husky/pre-push 依据 git 传入的
 *      remote_sha..local_sha 计算导出)。覆盖 `git push <sha>:<ref>` 这类 refspec 推送
 *      (不产生暂存区,原逻辑会因暂存区为空而直接放弃降级)。
 *   2. staged —— 暂存区快照(原行为,兜底)。
 *
 * files 为 null 表示范围不可用(git 故障)→ 维持原失败行为,禁止静默通过。
 */
function getScopeFiles() {
  const fromPush = (process.env.PUSH_SCOPE_FILES || '')
    .split(/\r?\n/)
    .map((l) => l.trim().replaceAll('\\', '/'))
    .filter(Boolean)
  if (fromPush.length > 0) return { files: fromPush, source: 'push-scope' }

  const staged = getStagedFiles()
  // 第三兜底(2026-09-18):push-scope 为空 + 暂存区为空/不可用时,用 origin/main..HEAD
  // 差集推断本次推送范围。场景:后台 refspec 推送不产生暂存区,且 pre-push 侧
  // PUSH_SCOPE_FILES 因异常算出空集(实测日志 4 例"无可判定改动范围,无降级"),
  // 此时他人工作区噪音会硬拦推送。安全性:head-diff 只含已提交文件;合并收敛场景
  // 可能比真实推送范围宽(含他人已提交文件),方向是"更易降级"而非"漏拦"——
  // 本会话自身提交必在 HEAD 祖先链里,落在其上的报错仍会维持阻塞。
  if (staged === null || staged.length === 0) {
    const headDiff = getHeadDiffFiles()
    if (headDiff && headDiff.length > 0) return { files: headDiff, source: 'head-diff' }
  }
  if (staged === null) return { files: null, source: 'unavailable' }
  return { files: staged, source: 'staged' }
}

/** origin/main..HEAD 已提交差集(仓库根相对路径,统一 /);git 失败返回 null */
function getHeadDiffFiles() {
  try {
    // 2026-10-26 G-54:git 派生收口到 face-reader(同上,剥掉显式 -C ROOT)
    const out = gitRaw(['diff', '--name-only', 'origin/main', 'HEAD'], ROOT)
    return out
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

// ─── G-406 ②:scope 沿反向依赖闭包加宽(改契约要红 importer)───────────────────
// 病根(票面原话):scope 判据是**路径前缀/路径清单**,所以「改一份被下游 import 的契约」
// 时,那些 importer 自身不在 scope 里 → 它们的类型报错被当成本次改动范围外的噪音
// 降级放行(见下方 shouldDegrade)⇒ 改契约不红 importer,净零逃逸。
// 修法:scope 取到之后,沿 scripts/lib/import-graph.mjs 的反向边做传递闭包,把
// 「直接或间接 import 了本次改动」的消费者一并纳入。边解析只有那一份实现(门 103),
// 本门不重复实现 —— 两处实现必漂移。
//
// 三条边界(都是踩过的坑,不是风格选择):
//  1. **只加宽降级判据,绝不加宽定向快通道的输入**。resolveFastScopeApp 要求 scope
//     全部落在同一个 apps/<app>/,闭包一跨端/一碰 packages/** 就会把快通道关掉,
//     一次单文件 push 从定向几分钟变成全量 25 分钟 —— 那是拿另一类恒红换本票的绿。
//     快通道仍只看**原始**改动清单(它判的是"该跑哪个包的 tsc",与"谁该为报错负责"无关)。
//  2. **取材面 = worktree**,与 tsc 实际读盘的面一致。门 103 的头注写过"取哪个面判错是
//     本仓最高频的假绿源";本门判据面必须与被 typecheck 的面同面,否则闭包按磁盘建图却
//     按索引判责,两套面互相对不上。
//  3. **建图失败不静默、也不崩**:纯函数仍退回未加宽的 scope(= 改前的逐字行为)
//     并给出可见 reason;但 RP-67 起这只是**数据** —— lib 同时产出 `ok:false`,消费侧
//     必须消费它(见下方 scopeDegradeAllowed)。窄面比加宽面更容易把 importer 的报错
//     判成「范围外」而 exit 0 放行,那是把「判据增强失败」冒充成「类型结论」
//     (fail-open)。§22b 的"按失败处理"针对类型结论;这里维持的正是 typecheck 的
//     原始结论,不是把环境故障凭空升级成一条新的硬拦。
//  4. `buildGraph` 是**唯一的测试缝**(默认就是 import-graph 的 buildFileGraph):
//     建图要 4~25 秒且只认真仓,不许单元测试里真建一次图。生产调用不传该参,
//     走默认值 —— 缝只开在"怎么建图"这一层,判据本身(闭包/退回/可见理由)无可绕。
function widenScopeOverDependents(files, { buildGraph = buildFileGraph } = {}) {
  // 通用判据在 lib/import-graph.mjs::widenFilesOverDependents(2026-10-18 L14546 守门触发
  // 全量铺开反向依赖闭包时同源提升);本门判工作树**要编译**的范围 ⇒ 固定 face='worktree',
  // 经此薄封装保持原返回形状(files/added/widened/reason)与失败语义不变。
  return widenFilesOverDependents(files, { face: 'worktree', root: ROOT, buildGraph })
}

/** 从 tsc/mypy 错误输出中提取报错文件路径(tsc 为 package 相对路径,mypy 可能为绝对路径),去重 */
function extractErrorFiles(output) {
  // 统一斜杠便于匹配(Windows tsc 可能输出反斜杠绝对路径)
  const norm = output.split('\\').join('/')
  const files = new Set()
  // tsc: path(line,col): error TSxxxx: ...(pnpm -r 前缀如 "apps/web: " 含空格仍会被 \s 正确切开;
  //      字符类允许冒号,使 Windows 绝对路径 G:/xxx/... 可被完整捕获)
  // 2026-09-03 修正:字符类不再排除括号。Next.js 路由组 `app/(main)/xxx.tsx` 是合法路径,
  // 原 [^\s(),] 会把它截断成 "/publish/accounts/ScanLoginDialog.tsx",使该文件即便落在本次
  // 改动范围内也匹配不上 → 本该阻塞的错误被误判为他人噪音而放行(不安全方向,必须修)。
  // 「扩展名 + (\d+,\d+):」双锚定已足以界定路径边界,无需靠排除括号。
  const tscRe = /([^\s]+?\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs))\(\d+,\d+\):\s*error\s+TS\d+/g
  // mypy: path:line: error: ...(字符类允许冒号,同理支持绝对路径捕获)
  const pyRe = /([^\s()]+?\.py):\d+:\s*error:/g
  for (const re of [tscRe, pyRe]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(norm)) !== null) {
      files.add(m[1])
    }
  }
  return [...files]
}

/**
 * 报错文件是否命中暂存区:双向后缀匹配。
 *   - 正向:tsc 输出 package 相对路径(如 src/components/Foo.tsx)比暂存的 repo 相对路径
 *     (如 apps/web/src/components/Foo.tsx)短 → staged.endsWith('/' + errFile);
 *   - 反向:mypy/tsc 在 Windows 下输出绝对路径(G:/IHUI-AI/apps/...)比暂存条目长
 *     → errFile.endsWith('/' + staged)。
 * 误判方向安全:误判"在暂存区"只会放弃降级、维持失败,不会放过真实错误。
 */
function isPathInStaged(errFile, stagedList) {
  return stagedList.some(
    (s) => s === errFile || s.endsWith('/' + errFile) || errFile.endsWith('/' + s),
  )
}

/** 降级判定核心:暂存区非空 && 解析到报错文件 && 全部报错文件均不在暂存区 → 降级为警告 */
function shouldDegrade(errorFiles, stagedList) {
  if (!Array.isArray(stagedList) || stagedList.length === 0) return false
  if (!errorFiles || errorFiles.length === 0) return false
  return errorFiles.every((f) => !isPathInStaged(f, stagedList))
}

/**
 * RP-67:消费 import-graph 的 `ok` 信号 —— 「范围外降级放行」的总开关。
 * `widenFilesOverDependents` 建图/闭包失败时返回 `{ok:false, files: 退回的窄面}`;
 * 窄面只含原始改动,拿它去 shouldDegrade 反而更容易把 importer 的报错判成
 * 「范围外」而 exit 0 放行 —— 这是 fail-open(判据增强失败被冒充成类型结论)。
 * ⇒ 只有 ok===true 才允许放行;ok===false(或拿不到 ok)一律 fail-closed:
 *   关闭放行方向、显式记为未判定、维持原 typecheck 结论。
 * 本函数是消费侧唯一开关;正反两态由 --self-test 与镜像测试钉住。
 */
function scopeDegradeAllowed(widen) {
  return !!widen && widen.ok === true
}

// ─── --self-test:内置样例验证解析/匹配/降级分支(不跑 typecheck);断言失败以 exit 1 硬失败 ───
if (SELF_TEST) {
  let failedCount = 0
  function assert(cond, msg) {
    if (cond) console.log(`[self-test]   ✅ ${msg}`)
    else {
      failedCount++
      console.error(`[self-test]   ❌ ${msg}`)
    }
  }

  const stagedWeb = [
    'apps/web/app/sitemap.ts',
    'apps/web/src/components/sidebar/SidebarActions.tsx',
  ]
  const sampleNoise = [
    "apps/web: src/components/OtherBroken.tsx(12,5): error TS1005: ';' expected.",
    "packages/ui/src/Unfinished.tsx(3,1): error TS1005: ',' expected.",
    'apps/api: src/routes/x.ts(1,1): error TS1128: Declaration or statement expected.',
  ].join('\n')
  const sampleStagedErr =
    "apps/web: src/components/sidebar/SidebarActions.tsx(8,3): error TS2322: Type 'string' is not assignable to type 'number'."
  const sampleAbs = "G:/IHUI-AI/apps/api/src/routes/other.ts(1,1): error TS1005: ';' expected."
  const sampleMypy =
    'apps/ai-service/app/routers/broken.py:12: error: Name "x" is not defined  [name-defined]'

  const efNoise = extractErrorFiles(sampleNoise)
  console.log(
    `[self-test] 样例1(全噪音,pnpm 包前缀) 解析到 ${efNoise.length} 个报错文件: ${efNoise.join(', ')}`,
  )
  assert(efNoise.length === 3, '样例1 解析数量应为 3')
  assert(efNoise[0] === 'src/components/OtherBroken.tsx', '样例1 包前缀 "apps/web: " 不应混入捕获')

  const efStaged = extractErrorFiles(sampleStagedErr)
  assert(
    isPathInStaged(efStaged[0], stagedWeb),
    '样例2 staged 文件报错(package 相对路径)应命中暂存区(正向后缀匹配)',
  )
  assert(!shouldDegrade(efStaged, stagedWeb), '样例2 存在暂存文件报错 → 不应降级')

  const efAbs = extractErrorFiles(sampleAbs)
  console.log(`[self-test] 样例3(Windows 绝对路径) 解析到: ${efAbs[0]}`)
  assert(
    efAbs[0] === 'G:/IHUI-AI/apps/api/src/routes/other.ts',
    '样例3 绝对路径应被完整捕获(冒号不被截断)',
  )
  assert(
    isPathInStaged(efAbs[0], ['apps/api/src/routes/other.ts']),
    '样例3 绝对路径应可反向匹配 repo 相对暂存路径',
  )

  const efMypy = extractErrorFiles(sampleMypy)
  console.log(`[self-test] 样例4(mypy 格式) 解析到: ${efMypy[0]}`)
  assert(
    efMypy.length === 1 && efMypy[0] === 'apps/ai-service/app/routers/broken.py',
    '样例4 mypy 格式应可解析',
  )

  assert(shouldDegrade(efNoise, stagedWeb), '样例5 全部报错不在暂存区 → 应降级')
  assert(!shouldDegrade(efNoise, []), '样例6 暂存区为空 → 不应降级')
  assert(!shouldDegrade([], stagedWeb), '样例7 未解析到报错文件(tsc 未能运行) → 不应降级(维持失败)')

  // 样例 8-11(2026-09-03 push-scope):`git push <sha>:<ref>` 类 refspec 推送不产生暂存区,
  // 此时降级判据必须来自 PUSH_SCOPE_FILES,否则他人并行会话噪音会硬拦本次 push。
  const prevEnv = process.env.PUSH_SCOPE_FILES
  process.env.PUSH_SCOPE_FILES =
    'apps/mobile-rn/src/components/BottomActionBar.tsx\napps/mobile-rn/src/screens/ChatScreen.tsx'
  const scopePush = getScopeFiles()
  assert(
    scopePush.source === 'push-scope' && scopePush.files.length === 2,
    '样例8 PUSH_SCOPE_FILES 非空 → 判据来源应为 push-scope,且优先于暂存区',
  )
  assert(
    shouldDegrade(efNoise, scopePush.files),
    '样例9 暂存区为空但 push-scope 有值 → 他人噪音应降级(refspec push 场景)',
  )
  const efInScope = extractErrorFiles(
    'apps/mobile-rn: src/components/BottomActionBar.tsx(12,5): error TS2322: Type X is not assignable.',
  )
  assert(
    !shouldDegrade(efInScope, scopePush.files),
    '样例10 报错文件落在 push-scope 内 → 不应降级(维持阻塞,宁可误拦)',
  )
  process.env.PUSH_SCOPE_FILES = ''
  assert(
    getScopeFiles().source !== 'push-scope',
    '样例11 PUSH_SCOPE_FILES 为空 → 应回退暂存区/不可用判据',
  )
  // 样例12(2026-09-03):Next.js 路由组 (main) 路径 —— 原正则排除括号会截断路径,
  // 使范围内文件匹配不上而误放行(不安全方向),现应完整捕获。
  const efParen = extractErrorFiles(
    'apps/web: app/(main)/publish/accounts/ScanLoginDialog.tsx(275,50): error TS2345: Argument of type X.',
  )
  console.log(`[self-test] 样例12(Next.js 路由组含括号) 解析到: ${efParen[0]}`)
  assert(
    efParen[0] === 'app/(main)/publish/accounts/ScanLoginDialog.tsx',
    '样例12 含括号路径应被完整捕获(括号不再截断路径)',
  )
  assert(
    isPathInStaged(efParen[0], ['apps/web/app/(main)/publish/accounts/ScanLoginDialog.tsx']),
    '样例12 含括号报错路径应能命中暂存区/推送范围条目(否则会误放行)',
  )

  // 样例13(2026-09-29 G-611):close 结局四态分类与产出侧同一把尺子 ——
  // 票面验收的"父侧读到 143 判临时失败"在这里以纯函数臂成立,进程臂见
  // scripts/tests/signal-exit.test.mjs(真派生子进程产出 143 再由父侧分类)。
  const cls13 = (over) => classifySpawnOutcome({ status: null, signal: null, ...over })
  assert(
    cls13({ status: 143 }).kind === 'interrupt',
    '样例13a exit 143 ⇒ interrupt(父侧读到产出码,被杀 ≠ 结论)',
  )
  assert(
    cls13({ status: 143 }).exitCode === TEMPFAIL_EXIT_CODE,
    '样例13b interrupt ⇒ exit 75(临时失败,可带 hook 重试)',
  )
  assert(cls13({ status: 2 }).kind === 'verdict', '样例13c exit 2 是有结论的失败 ⇒ 不得被洗成中断')
  assert(
    cls13({ status: null, signal: 'SIGTERM' }).kind === 'interrupt',
    '样例13d 无码只有 signal(子进程没装产出侧)⇒ 同样判"被杀"—— 旧集合判据对这一格失明,正是本票的病',
  )
  assert(
    cls13({ status: 143, timedOut: true }).kind === 'timeout',
    '样例13e 超时优先于族码判定(2026-09-20 语义逐字保留:重试=两次挂死)',
  )

  // 样例14-17(2026-10-04 G-406 ②):scope 沿反向依赖闭包加宽 —— 改契约要红 importer。
  // 用**构造的图**做纯函数臂(真仓臂见 scripts/tests/typecheck-scope.test.mjs,
  // 那里面对真仓 spawn 验;这里不建图,故 --self-test 仍是秒级)。
  // 夹具:A(被 B 导入)、B(被 C 导入)、C(叶子)、SOLO(无人导入)。
  // 路径按真仓形态给全(apps/<app>/src/...):isPathInStaged 是**双向后缀**匹配,
  // tsc 报的是 package 相对路径(src/b.ts)而 scope 是 repo 相对路径(apps/x/src/b.ts),
  // 少写一层 src 的话这对夹具就测不到"命中"那一格(第一版就这样假绿过一次)。
  const fakeGraph = {
    reverse: new Map([
      ['apps/x/src/a.ts', new Set(['apps/x/src/b.ts'])],
      ['apps/x/src/b.ts', new Set(['apps/x/src/c.ts'])],
    ]),
  }
  // 测试缝:不真建图(那要 4~25 秒且只认真仓),闭包语义由这张构造图承担。
  const viaFake = (files) => widenScopeOverDependents(files, { buildGraph: () => fakeGraph })
  // 正例:改 A(有下游)⇒ scope 必须含 B 与 C(传递闭包,不是只含直接下游)。
  const wA = viaFake(['apps/x/src/a.ts'])
  assert(wA.widened, '样例14 改有下游的 A ⇒ 应加宽')
  assert(
    wA.files.includes('apps/x/src/b.ts') && wA.files.includes('apps/x/src/c.ts'),
    '样例14 加宽后 scope 必须含下游 B 与传递下游 C',
  )
  assert(
    wA.files.includes('apps/x/src/a.ts'),
    '样例14 闭包必须含种子自身(不变量:闭包 ⊇ 改动集,否则判据退化成按清单判)',
  )
  // 反例①:改 SOLO(无下游)⇒ scope 逐字不变,**不得**把全仓塞进来。
  const wSolo = viaFake(['apps/x/src/solo.ts'])
  assert(!wSolo.widened, '样例15 改无下游的 SOLO ⇒ 不应加宽')
  assert(
    wSolo.files.length === 1 && wSolo.files[0] === 'apps/x/src/solo.ts',
    '样例15 无下游时 scope 必须逐字不变(只有那一个文件,不得夹带任何多余项)',
  )
  // 反例②:空 scope / null scope ⇒ 不崩、不静默扩大。
  const wEmpty = viaFake([])
  assert(
    !wEmpty.widened && wEmpty.files.length === 0,
    '样例16 空 scope ⇒ 不加宽且不崩(不得回退去取全仓)',
  )
  const wNull = viaFake(null)
  assert(
    !wNull.widened && wNull.files === null,
    '样例16b scope=null(git 不可用)⇒ 仍为 null,降级路径不可用状态不得被加宽改写',
  )
  // 样例17:建图抛错 ⇒ 退回未加宽 scope 并给出可见理由,不得崩、不得静默假装成功。
  const wNoGraph = widenScopeOverDependents(['apps/x/src/a.ts'], {
    buildGraph: () => {
      throw new Error('模拟 git 故障')
    },
  })
  assert(
    !wNoGraph.widened && wNoGraph.files.length === 1 && wNoGraph.files[0] === 'apps/x/src/a.ts',
    '样例17 建图失败 ⇒ 退回未加宽 scope(=改前逐字行为),不崩',
  )
  assert(
    /建图失败/.test(wNoGraph.reason),
    '样例17 建图失败必须给出可见失败理由(禁止静默跳过一道判据)',
  )
  // 样例18:加宽后的 scope 必须真的改变降级判定 —— 这才是本票的病根那一格。
  // 改契约 A、importer B 自身报错:改前 B 不在 scope ⇒ 降级放行(净零逃逸);
  // 加宽后 B 在 scope ⇒ 维持阻塞。
  const errOnImporter = extractErrorFiles(
    'apps/x: src/b.ts(3,1): error TS2322: Type X is not assignable.',
  )
  assert(
    shouldDegrade(errOnImporter, ['apps/x/src/a.ts']),
    '样例18a 改前语义基准:只改 A 时 B 的报错不在 scope ⇒ 降级放行(这正是票面说的逃逸)',
  )
  assert(
    !shouldDegrade(errOnImporter, wA.files),
    '样例18b 加宽后:B 的报错命中 scope ⇒ 不降级(改契约会红 importer,病根闭合)',
  )

  // 样例19(2026-11-04):无文件面档 —— 只认「flag=1 + 依据」这一对值,缺依据不得启用。
  assert(
    noFileFaceVerdict({ PUSH_NO_FILE_FACE: '1', PUSH_NO_FILE_FACE_BASIS: 'push refs=1 条全部删除' })
      ?.ok === true,
    '样例19a flag=1 且带依据 ⇒ 启用无文件面档',
  )
  assert(
    noFileFaceVerdict({ PUSH_NO_FILE_FACE: '1' })?.ok === false,
    '样例19b flag=1 但缺依据 ⇒ 不启用(防残留 env 变成静默 skip)',
  )
  assert(noFileFaceVerdict({}) === null, '样例19c flag 未置位 ⇒ 原路径(全量门不被跳过)')

  // 样例20-23(RP-67):消费 import-graph 的 ok:false —— 建图失败不得判「范围外」。
  // 真信号走 widenScopeOverDependents 的测试缝(注入抛错的 buildGraph),不真建图。
  const wGraphFail = widenScopeOverDependents(['apps/x/src/a.ts'], {
    buildGraph: () => {
      throw new Error('RP-67 模拟建图失败')
    },
  })
  assert(wGraphFail.ok === false, '样例20a 建图失败 ⇒ lib 必须产出 ok:false(fail-closed 信号)')
  assert(
    !scopeDegradeAllowed(wGraphFail),
    '样例20b 建图失败(ok:false) ⇒ 关闭「范围外降级放行」,不得把报错判成范围外',
  )
  assert(scopeDegradeAllowed(wA), '样例21 建图成功(ok:true) ⇒ 允许范围外降级放行(原语义不变)')
  // 病根复现 + 闭合:窄面把 importer 报错判成范围外(改前 fail-open),消费侧必须堵住。
  const narrowWouldDegrade = shouldDegrade(errOnImporter, wGraphFail.files)
  assert(narrowWouldDegrade, '样例22a 病根复现:建图失败退窄面 ⇒ importer 报错被判成范围外')
  assert(
    !(scopeDegradeAllowed(wGraphFail) && narrowWouldDegrade),
    '样例22b 但 ok:false 关闭放行 ⇒ 组合判据不得放行(病根被消费侧堵住)',
  )
  assert(
    !scopeDegradeAllowed(null) && !scopeDegradeAllowed({}),
    '样例23 拿不到 ok(未判定/异常形状)⇒ 同样不放行(fail-closed 偏好)',
  )

  process.env.PUSH_SCOPE_FILES = prevEnv

  if (failedCount > 0) {
    console.error(`[self-test] ❌ ${failedCount} 个断言失败`)
    process.exit(1)
  }
  console.log('[self-test] ✅ 全部断言通过(解析/匹配/降级判定逻辑正常)')
  process.exit(0)
}

// ─── 无文件面档(2026-11-04):本次推送零 blob 变更 ⇒ 没有可判的文件面 ─────────
// 判据在门层再校验一次(不信裸 env):必须 flag=1 且带 hook 的推导依据,缺一则走原路径。
// 这不是"skip":判据本身是"零文件 ⇒ 无对象可检查",依据会打印出来;有文件变更时
// PUSH_SCOPE_FILES 非空,走下面的 push-scope 逐级推导 + 全量门,行为一字未改。
const _noFileFace = noFileFaceVerdict()
if (_noFileFace) {
  if (_noFileFace.ok) {
    console.log(`[check-typecheck] ✅ 无文件面,按通过 —— 判定依据: ${_noFileFace.basis}`)
    console.log(
      '[check-typecheck] 本次推送不携带任何 blob ⇒ 无文件面可 typecheck;有文件变更时仍走 push-scope / 全量门(判据未放宽)。',
    )
    process.exit(0)
  }
  console.error(`[check-typecheck] ⚠️ ${_noFileFace.reason} ⇒ 不启用无文件面档,按原路径判定`)
}

// ─── 主流程 ───
const scope = getScopeFiles()
const scopeFilesRaw = scope.files
// G-406 ②:降级判据用**加宽后**的 scope(改契约要红 importer);
// 定向快通道仍用 scopeFilesRaw(见 widenScopeOverDependents 边界 1)。
const _widen = widenScopeOverDependents(scopeFilesRaw)
const scopeFiles = _widen.files
// RP-67:消费 import-graph 的 ok 信号 —— 建图/闭包失败(ok:false)时 files 退回窄面,
// 拿窄面判「范围外」并放行是 fail-open;此时关闭放行方向、维持原失败结论。
const scopeDegradeOk = scopeDegradeAllowed(_widen)
if (!scopeDegradeOk) {
  console.error(
    `[check-typecheck] ⚠️ RP-67:依赖图建图/闭包失败(${_widen.reason}) ⇒ 关闭「范围外降级放行」(fail-closed / 显式未判定),本次报错一律维持原 typecheck 结论`,
  )
}
const scopeEnabled = scopeFiles !== null && scopeFiles.length > 0
const scopeLabel =
  scope.source === 'push-scope'
    ? 'push-scope(本次推送改动范围)'
    : scope.source === 'staged'
      ? 'staged-scope(暂存区)'
      : scope.source === 'head-diff'
        ? 'head-diff(origin/main..HEAD 推断兜底)'
        : '不可用(git 故障)'

// ─── 无 TS 输入面档(2026-11-07 立)───────────────────────────────────────
// 为什么必须单独立档,而不是靠下面的 scope 降级:
// scope 降级是「全量跑完、拿到报错之后,发现报错文件都在本次改动范围外 ⇒ 降级放行」——
// 它**必须先有结论**。而当前全量门在本机已经跑不进单门 300s 看门狗(实测单 apps/api 冷跑
// >8m54s、apps/web 5m14s,且每一趟进门前都被清光 .tsbuildinfo),于是任何推送都在拿到那个
// 结论之前就被杀了。这道档让「改动与 TS 无关」这一大类提交拿到**可自证**的结论,而不是靠超时。
//
// 判据(三条全为真才命中,任何一条不满足即回退原路径,宁慢勿漏):
//   a) 改动清单非空(git 拿得到面);
//   b) 清单里没有任何 TS 输入 —— 见 TS_INPUT_BASENAMES 与 TS_INPUT_EXT_RE;
//   c) 全仓没有任何 tsconfig 开 `allowJs: true`。这是 (b) 的前提:只有 allowJs 才会把
//      .js/.mjs/.cjs 拉进 program。(c) **每次现扫** git 索引里的全部 tsconfig,不沿用
//      "此刻的仓态"这个快照 —— 快照会漂移,而漂移是安静的。
// 出口:命中 ⇒ 打印逐条清单与 (c) 的扫描依据,exit 0。这是「射程之外的通过」,不是 skip:
//       tsc 的输入集合没变,结论就必然不变(§0.3 的出题前提)。
const TS_INPUT_EXT_RE = /\.(ts|tsx|mts|cts)$/i
const TS_INPUT_BASENAMES = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])

/** 列出 git 索引里的全部 tsconfig(含 packages/tsconfig/*.json 这类基座)。取不到返回 null ⇒ 判据不可用。 */
function listTsconfigPaths() {
  let out
  try {
    out = gitRaw(['ls-files', '*tsconfig*.json'], ROOT, { timeout: 60_000 })
  } catch {
    return null
  }
  if (typeof out !== 'string') return null
  const list = out.split(/\r?\n/).filter(Boolean)
  return list.length > 0 ? list : null
}

/** 返回命中的非 TS 面清单,或 null(不命中/判据不可用)。 */
function resolveNoTsInputFace(files) {
  if (!Array.isArray(files) || files.length === 0) return null
  for (const raw of files) {
    const f = String(raw).replace(/\\/g, '/')
    const base = f.slice(f.lastIndexOf('/') + 1)
    const isTsInput =
      TS_INPUT_EXT_RE.test(f) ||
      TS_INPUT_BASENAMES.has(base) ||
      /^tsconfig.*\.json$/i.test(base) ||
      // 根级/任一级的 workspace 拓扑与 npm 配置:改它们会改变 program 的组成
      base === '.npmrc'
    if (isTsInput) return null
  }
  const cfgs = listTsconfigPaths()
  if (!cfgs) return null
  const allowJsOn = []
  for (const p of cfgs) {
    let text = null
    try {
      text = readFileSync(resolve(ROOT, p), 'utf8')
    } catch {
      // 读不到就不能断言"没有 allowJs" ⇒ 保守回落全量
      return null
    }
    // 故意不去注释:注释里出现 `allowJs: true` 会让我们**多**回落一次全量,
    // 那是安全方向;反过来漏判会让 .mjs 改动被误判成"与 TS 无关",那是假绿方向。
    if (/allowJs\s*:\s*true/i.test(text)) allowJsOn.push(p)
  }
  if (allowJsOn.length > 0) return null
  return { files: files.slice(), tsconfigCount: cfgs.length }
}

// 新档判定提前到 --dry-run 之前:只读勘察(scout)必须能看见"这一趟会走哪条路",
// 否则勘察报的是"将运行 typecheck-full",实际却走了无 TS 输入面档 —— 勘察结论与真跑不一致。
// 注意:提前的只是**判定**,exit 0 的动作仍在主流程里(dry-run 不许改变任何退出语义)。
const _noTsInput = scopeEnabled ? resolveNoTsInputFace(scopeFilesRaw) : null

if (DRY_RUN) {
  console.log('[check-typecheck] --dry-run 干跑:不实际运行 typecheck')
  console.log(`[check-typecheck] 降级判据来源: ${scopeLabel}`)
  console.log(
    `[check-typecheck] 判据文件数: ${scopeFiles === null ? '(git 不可用 → 降级路径不可用,将维持原失败行为)' : scopeFiles.length}`,
  )
  if (scopeEnabled) {
    for (const f of scopeFiles.slice(0, 50)) console.log(`  - ${f}`)
    if (scopeFiles.length > 50) console.log(`  ... 共 ${scopeFiles.length} 个`)
  }
  // G-406 ②:加宽结果必须可见 —— 判据面被扩大是"报数"级别的变化,不能只靠推断。
  console.log(
    `[check-typecheck] 反向依赖加宽(G-406 ②): ${_widen.widened ? '已加宽' : '未加宽'} —— ${_widen.reason}`,
  )
  if (_widen.added.length > 0) {
    for (const f of _widen.added.slice(0, 20)) console.log(`  + ${f}(经反向依赖闭包纳入)`)
    if (_widen.added.length > 20) console.log(`  ... 共 ${_widen.added.length} 个新增消费者`)
  }
  console.log(
    `[check-typecheck] scope 降级: ${scopeEnabled ? '启用(全部报错文件均不在本次改动范围时 → 降级为警告 exit 0)' : '不启用(改动范围为空或 git 不可用)——报错将维持原失败行为'}`,
  )
  // 快通道只看**原始**改动清单(边界 1):闭包跨端会把快通道关掉,单文件 push 从定向
  // 几分钟变成全量 25 分钟 —— 那是拿另一类恒红换本票的绿。
  const _dryFast = scopeEnabled ? resolveFastScopeApp(scopeFilesRaw) : null
  console.log(
    `[check-typecheck] 将运行路线: ${
      _noTsInput
        ? `无 TS 输入面档(exit 0,不改动任何 tsc program 的输入集合)`
        : _dryFast
          ? `定向快速通道(改动全部位于 apps/${_dryFast.app})`
          : '全量门'
    }`,
  )
  console.log(
    `[check-typecheck] 将运行命令: ${_dryFast ? `pnpm --filter ${_dryFast.name} run typecheck(定向快速通道:改动全部位于 apps/${_dryFast.app})` : 'node scripts/typecheck-full.mjs (等价 pnpm typecheck:full)'}`,
  )
  process.exit(0)
}

// ─── 产出侧(G-611)──────────────────────────────────────────────────
// 本脚本自己也是**被派生方**(guardian-runner 用 execSync 跑它)。改前被信号杀死时
// 走 Node 默认动作 —— POSIX 上"死于信号、不产出码",父侧 execSync 只拿到
// {status:null, signal},信号族集合对它结构上失明,于是一次 CTRL_C 被计成
// "检查结论失败"→ 按"他人代码失败" --no-verify 绕门。装产出侧后:凡可捕获的信号,
// 本脚本必产出 128+N(SIGINT→130 / SIGTERM→143),父侧按同一把尺子归"临时失败"。
// streamChild:全量分支在飞的 typecheck-full 句柄,信号到来时先清场再退出,
// 不把子进程树留成孤儿(与改前默认死法相比,这是净改善而非新语义)。
let streamChild = null

/** 终止我方派生的子进程(树)。win32 走 taskkill /T /F,其余 SIGKILL —— 与原超时分支逐字同语义(等价重构,两处实现不得再分开)。 */
function killChildTree(child) {
  if (!child || !child.pid) return
  try {
    if (process.platform === 'win32') {
      // 连带子进程树:pnpm -r 会拉出 tsc/cmd.exe 子孙,单 kill 主进程会留下孤儿继续吃 CPU
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } else {
      child.kill('SIGKILL')
    }
  } catch {
    try {
      child.kill('SIGKILL')
    } catch {
      /* 忽略 */
    }
  }
}

// 分包读数:typecheck-full 每跑完一个包就 append 一条,超时/被杀时这里仍能读出进度。
const TIMINGS_FILE =
  process.env.IHUI_TYPECHECK_TIMINGS_FILE ||
  resolve(ROOT, 'node_modules', '.cache', 'ihui', 'typecheck-timings.jsonl')

/** 超时现场把读数打出来:哪些包 Done、哪个包在飞(卡住候选)。超时仍是 undetermined,不折成 pass。 */
function dumpTypecheckTimings() {
  const records = readTimings(TIMINGS_FILE)
  if (records.length === 0) {
    console.error(`[check-typecheck] 📊 分包读数不可用(文件不存在或为空): ${TIMINGS_FILE}`)
    return
  }
  const summary = summarizeTimings(records, Date.now())
  console.error(`[check-typecheck] 📊 分包读数(超时现场): ${TIMINGS_FILE}`)
  console.error(
    `[check-typecheck]    ${formatSummaryLine(summary)};墙钟 ${formatDuration(summary.wallMs)}`,
  )
  for (const p of summary.packages) {
    console.error(
      `[check-typecheck]    ${p.done ? '✅' : '❌'} ${p.name}: ${formatDuration(p.elapsedMs)} ${p.done ? 'Done' : 'FAIL'}`,
    )
  }
  if (summary.inFlight.length > 0) {
    for (const p of summary.inFlight) {
      console.error(
        `[check-typecheck]    ⏳ ${p.name}: 已运行 ${formatDuration(p.elapsedMs)} 未完成(卡住候选)`,
      )
    }
  } else {
    console.error('[check-typecheck]    ⏳ 无在飞包(超时发生在包边界或读数未落盘)')
  }
  for (const ph of summary.phases) {
    console.error(
      `[check-typecheck]    ⏱ phase:${ph.phase}: ${formatDuration(ph.elapsedMs)} ${ph.done ? 'Done' : 'FAIL'}`,
    )
  }
}

installSignalExit({
  label: 'check-typecheck',
  onSignal: () => killChildTree(streamChild),
})

// ─── 定向快速通道(2026-09-20 根治推送慢) ───────────────────────────────
// 痛点:全量门 = pnpm -r 全 workspace + 每次清 .tsbuildinfo,实测 25+ 分钟;而绝大多数
// push 的改动只落在单一 app 内(如 apps/web),全量跑完才发现「报错都在别人文件里 → 降级放行」,
// 白等 25 分钟。现增加前置裁剪:改动**全部**落在同一个 apps/<app> 目录内时才走快通道,
// 对该 app 本身仍是 100% 全量 tsc(不降强度),只是不连带全仓。
// 保守边界(任一不满足即回退全量,宁慢勿漏):
//   1. 必须有 scope 判据且非空;2. 不能含根层 scripts/**(守门自身改动必须全量回归);
//   3. 不能含 packages/**(被依赖层改动会影响下游所有 app,必须全仓);
//   4. 所有文件前缀必须是同一个 apps/<app>/;5. 该 app 的 package.json 必须有 typecheck 脚本。
function resolveFastScopeApp(files) {
  if (!Array.isArray(files) || files.length === 0) return null
  let app = null
  for (const raw of files) {
    const f = String(raw).replace(/\\/g, '/')
    if (f.startsWith('scripts/') || f.startsWith('.husky/')) return null
    if (f.startsWith('packages/')) return null
    const m = f.match(/^apps\/([^/]+)\//)
    if (!m) return null
    if (app === null) app = m[1]
    else if (app !== m[1]) return null
  }
  if (!app) return null
  const pkgPath = resolve(ROOT, 'apps', app, 'package.json')
  let pkg = null
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
  if (!pkg?.scripts?.typecheck) return null
  return { app, name: pkg.name || app }
}

// ─── 主流程第一档:无 TS 输入面 ──────────────────────────────────────
// 判定在 --dry-run 之前(见上方),这里只负责出口。顺序必须在快通道之前:
// 快通道是「整 app 全量 tsc」,对本档这种"一个 TS 文件都没碰"的面同样是白跑。
if (_noTsInput) {
  console.log(
    `[check-typecheck] ✅ 无 TS 输入面,按通过 —— 本次改动 ${_noTsInput.files.length} 个文件全部不在任何 tsc program 的输入集合里`,
  )
  console.log(
    '[check-typecheck] 判定依据①:清单里无 .ts/.tsx/.mts/.cts、无 tsconfig*.json、无 package.json / pnpm-lock.yaml / pnpm-workspace.yaml / .npmrc',
  )
  console.log(
    `[check-typecheck] 判定依据②:全仓 ${_noTsInput.tsconfigCount} 个 tsconfig 现扫,无一开 allowJs:true ⇒ .js/.mjs/.cjs 不进任何 program`,
  )
  for (const f of _noTsInput.files.slice(0, 40)) console.log(`  - ${f}`)
  if (_noTsInput.files.length > 40) console.log(`  ... 共 ${_noTsInput.files.length} 个`)
  console.log(
    '[check-typecheck] 这不是 skip:tsc 的输入集合未变 ⇒ 类型结论必然不变。改动命中任何一个 TS 输入时,仍按原路径走快通道/全量门(判据未放宽)。',
  )
  process.exit(0)
}

const _fast = scopeEnabled ? resolveFastScopeApp(scopeFilesRaw) : null
if (_fast) {
  console.log(
    `[check-typecheck] 🚀 定向快速通道:改动全部位于 apps/${_fast.app} → 仅对该 app 全量 tsc(其余包不参与)`,
  )
  console.log(`[check-typecheck] 命令: pnpm --filter ${_fast.name} run typecheck`)
  // ─── 陈旧 dist 前置(2026-11-06 补) ──────────────────────────────────────────
  // 全量通道在跑 tsc 之前有一段 staleDistPreflight()(见 typecheck-full.mjs 文件头「陈旧 dist 前置重建」),
  // 而定向快速通道原先**直接 spawn** app 自己的 typecheck,把这一段绕开了。消费方按包清单的
  // `exports.types` 读 `packages/*/dist` ⇒ "包源码已入库、dist 还是旧构建"会让 tsc 在**干净的 HEAD
  // 文件**上报错,归因判成已入库红。实测(2026-11-06):api-client 三值 budget 类型随 11945bd4f5 入库后,
  // 仍有工作树的 dist 停在二值态 ⇒ ChatScreen / budget-note / chat-ledger / sse-parse 共 17 处假红,
  // 本档 exit 1。这里复用**同一份实现**(typecheck-full --preflight-only):不新增判据、不放宽降级、
  // 不抑制任何报错 —— 只是把"类型结论该拿哪一面的产物"补回与全量通道一致。
  // 失败出口(2026-11-06 裁决):前置只负责"把输入面准备好",拿不到就**未判定 exit 2** ——
  // 不许 exit 0(旧产物下结论),也不许沿用 build 的 1(把 build 失败冒充成"类型红";上层会当已入库红追责)。
  console.log(
    '[check-typecheck] 陈旧 dist 前置:node typecheck-full.mjs --preflight-only(与全量通道同一份实现)',
  )
  const _pf = spawnSync(
    process.execPath,
    [resolve(__dirname, 'typecheck-full.mjs'), '--preflight-only'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: TYPECHECK_TIMEOUT_MS,
    },
  )
  const _pfOut = String(_pf.stdout || '')
  const _pfErr = String(_pf.stderr || '')
  if (_pfOut) process.stdout.write(_pfOut)
  if (_pfErr) process.stderr.write(_pfErr)
  if (_pf.error && _pf.error.code === 'ETIMEDOUT') {
    console.error(
      `[check-typecheck] ❓ 未判定(exit 2):陈旧 dist 前置重建超过 ${TYPECHECK_TIMEOUT_MIN} 分钟,产物面取不到 ⇒ 不给类型结论`,
    )
    process.exit(2)
  }
  const _pfOutcome = classifySpawnOutcome({
    status: _pf.status ?? null,
    signal: _pf.signal ?? null,
  })
  if (_pfOutcome.kind === 'interrupt') {
    console.error(
      `[check-typecheck] ⚠️ 陈旧 dist 前置重建被中断(${_pfOutcome.reason}),非类型检查结论`,
    )
    console.error(
      `[check-typecheck] ⏭️ 按临时失败处理(exit ${TEMPFAIL_EXIT_CODE})—— push 侧将带 hook 重试以获取真实结论`,
    )
    process.exit(TEMPFAIL_EXIT_CODE)
  }
  if (_pf.status !== 0) {
    console.error(
      `[check-typecheck] ❓ 未判定(exit 2):陈旧 dist 前置重建失败(child exit ${_pf.status ?? '?'})—— 产物面取不到,不给类型结论`,
    )
    console.error(
      '[check-typecheck]    未判定 ≠ 通过:本档不产出结论;复现:node scripts/typecheck-full.mjs --preflight-only',
    )
    process.exit(2)
  }
  // stdio 必须 pipe:inherit 拿不到输出,就无法沿用下述 scope 降级判定。
  // 降级必要性(不做 = 行为退化):原先全量路径会「报错文件不在本次改动范围内 → 降级放行」,
  // 若快通道改成直接失败,则他人未提交的类型噪音会阻塞只改单文件的会话推送。
  const r = spawnSync('pnpm', ['--filter', String(_fast.name), 'run', 'typecheck'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    windowsHide: true,
    env: { ...process.env, IHUI_TYPECHECK_FULL_CHILD: '1' }, // 防该 app 脚本再套全量门
    timeout: TYPECHECK_TIMEOUT_MS,
  })
  const _fout = String(r.stdout || '')
  const _ferr = String(r.stderr || '')
  if (_fout) process.stdout.write(_fout)
  if (_ferr) process.stderr.write(_ferr)
  if (r.error && r.error.code === 'ETIMEDOUT') {
    console.error(
      `[check-typecheck] ⏰ apps/${_fast.app} 定向 typecheck 超过 ${TYPECHECK_TIMEOUT_MIN} 分钟,终止(非类型结论)`,
    )
    process.exit(1)
  }
  if (r.status === 0) {
    console.log(`[check-typecheck] ✅ apps/${_fast.app} 定向 typecheck 通过(exit 0)`)
    process.exit(0)
  }
  // G-611:快通道与全量通道同一把尺子 —— 定向 typecheck 被信号杀死(exit 130/143/
  // 3221225786,或阻塞派生返回时只剩 signal 无码)不是"该包类型检查失败",
  // 归 75 让 push 侧带 hook 重试;有结论的失败(如 exit 2)照旧落到下面的降级判定。
  const fastOutcome = classifySpawnOutcome({ status: r.status ?? null, signal: r.signal ?? null })
  if (fastOutcome.kind === 'interrupt') {
    console.error(
      `[check-typecheck] ⚠️ apps/${_fast.app} 定向 typecheck 被中断(${fastOutcome.reason}),非类型检查结论`,
    )
    console.error(
      `[check-typecheck] ⏭️ 按临时失败处理(exit ${TEMPFAIL_EXIT_CODE})—— push 侧将带 hook 重试以获取真实结论`,
    )
    process.exit(TEMPFAIL_EXIT_CODE)
  }
  // 与全量路径同源的 scope 降级判定(EXTRACT_ERROR_FILES/shouldDegrade 见下方全量分支)
  const fastErrorFiles = extractErrorFiles(`${_fout}\n${_ferr}`)
  if (
    scopeDegradeOk &&
    scopeEnabled &&
    fastErrorFiles.length > 0 &&
    shouldDegrade(fastErrorFiles, scopeFiles)
  ) {
    console.log('')
    console.log(
      `ℹ️ apps/${_fast.app} 定向 typecheck 的 ${fastErrorFiles.length} 个报错文件均不在本次改动范围(${scopeLabel},属并行会话噪音),降级为警告`,
    )
    for (const f of fastErrorFiles.slice(0, 20)) console.log(`   - ${f}`)
    console.log('ℹ️ 判定:本次 push 放行(exit 0);报错由其所属会话负责修复')
    // RP-67:降级块末尾的机器签名行(SCOPE_DEGRADE_EVIDENCE_RE 第二半的生产者);
    // 放末尾保证 .husky/pre-push 的 tail -40 不把它截掉。
    console.log('[IHUI-SCOPE-DEGRADE] 全部报错文件均不在本次推送范围,降级为警告(exit 0)')
    process.exit(0)
  }
  console.error(
    `[check-typecheck] ❌ apps/${_fast.app} 定向 typecheck 失败(exit ${r.status})——报错命中本次改动范围或不满足降级条件,按失败处理`,
  )
  process.exit(r.status ?? 1)
}

// ─── 全量档前置:近期结论回执命中即不再 spawn tsc(T1 长期票) ────────────────
// 键 = `git write-tree`(索引面树 sha)。树没变 ⇒ tsc 的输入集合没变 ⇒ 结论必然不变;
// 降级判据依赖的「本次范围」每次照常重算,回执只缓存原始结论面(exitCode + 报错文件清单)。
// 失效方向安全:tree sha 取不到 / 回执缺失或结构非法 / 超 TTL / 显式关闭 ⇒ 一律回落实跑。
const _receiptAbs = join(ROOT, RECEIPT_REL)
let _treeSha = null
try {
  _treeSha = String(gitRaw(['write-tree'], ROOT) || '').trim() || null
} catch {
  _treeSha = null
}
const _receiptOn = !_treeSha ? false : !receiptDisabled()
if (_receiptOn) {
  const _rc = readReceipt(_receiptAbs)
  const _usable = receiptUsable(_rc, {
    treeSha: _treeSha,
    nowMs: Date.now(),
    ttlMs: receiptTtlMs(),
  })
  if (_usable.ok) {
    console.log(
      `[check-typecheck] ♻️ 命中近期全量结论(${_usable.reason},exit ${_rc.exitCode})⇒ 不再 spawn tsc`,
    )
    console.log('[check-typecheck] 判据未放宽:报错文件清单按本次改动范围重新走同一条降级判定。')
    if (_rc.exitCode === 0) {
      console.log('[check-typecheck] ✅ 全量 typecheck 验证通过(近期结论回放)')
      process.exit(0)
    }
    const _rf = _rc.errorFiles
    if (scopeDegradeOk && scopeEnabled && _rf.length > 0 && shouldDegrade(_rf, scopeFiles)) {
      console.log('')
      console.log(
        `ℹ️ 全部报错文件均不在本次改动范围(${scopeLabel},属并行会话工作区噪音),降级为警告`,
      )
      console.log(`ℹ️ 解析到报错文件共 ${_rf.length} 个(样例前 20 个):`)
      for (const f of _rf.slice(0, 20)) console.log(`   - ${f}`)
      console.log('ℹ️ 判定:本次 push 放行(exit 0);报错文件的类型修复由其所属会话负责')
      console.log('[IHUI-SCOPE-DEGRADE] 全部报错文件均不在本次推送范围,降级为警告(exit 0)')
      process.exit(0)
    }
    if (scopeEnabled && _rf.length > 0) {
      const _in = _rf.filter((f) => isPathInStaged(f, scopeFiles))
      if (_in.length > 0) {
        console.log(
          `ℹ️ ${_in.length}/${_rf.length} 个报错文件在本次改动范围内,维持失败(样例前 20 个):`,
        )
        for (const f of _in.slice(0, 20)) console.log(`   - ${f}`)
      }
    }
    console.error(`❌ 全量 typecheck 失败(近期结论回放,exit ${_rc.exitCode}),推送已阻止`)
    process.exit(_rc.exitCode)
  }
  console.log(`[check-typecheck] ℹ️ 回执未命中:${_usable.reason} ⇒ 现跑全量`)
}

console.log(
  `[check-typecheck] 运行全量 typecheck(node scripts/typecheck-full.mjs,实时透传输出)${scopeEnabled ? ` [${scopeLabel} 降级启用,${scopeFiles.length} 文件(原始 ${scopeFilesRaw.length} + 反向依赖新增 ${_widen.added.length})]` : ' [无可判定改动范围,无降级]'}...`,
)
if (_widen.widened) {
  console.log(
    `[check-typecheck] ℹ️ G-406 ②:改动的下游 importer 已纳入降级判据(${_widen.added.length} 个)——改契约时 importer 自身的类型报错不再被当噪音放行`,
  )
}

let out = ''
let err = ''
const _fullT0 = Date.now()
const _writeReceipt = (exitCode, errorFiles) => {
  if (!_treeSha) return
  writeReceipt(_receiptAbs, {
    v: RECEIPT_SCHEMA_V,
    treeSha: _treeSha,
    finishedAt: Date.now(),
    exitCode,
    errorFiles,
    writer: RECEIPT_WRITER,
    measuredMs: Date.now() - _fullT0,
  })
}
const child = spawn(process.execPath, [resolve(__dirname, 'typecheck-full.mjs')], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
streamChild = child // G-611:信号处理器的清场句柄(见上方 installSignalExit)

// ─── 硬超时上限(2026-09-20 根治,必须保留) ─────────────────────────────
// 事故实证:某次 push 挂起 62 分钟无任何产出 —— check-typecheck 的 spawn 无 timeout、
// 无 timer kill,只要 typecheck-full 内部卡住(pnpm -r 依赖解析失败 / worktree 各包
// 缺 node_modules 导致 tsc 静默长耗时 / typecheck.lock 持锁者僵而不退),push 就永远
// 等待,用户侧表现为"推送一小时没动静"。现加硬上限:超时杀进程树并按临时失败退出。
// 可调大:IHUI_TYPECHECK_TIMEOUT_MIN=40 git push ...(大仓全量 tsc 慢于默认值时)。
// 常量 TYPECHECK_TIMEOUT_MIN/MS 见文件 import 区(定向快通道共用同一上限)
let timedOut = false
const timeoutTimer = setTimeout(() => {
  timedOut = true
  console.error('')
  console.error(
    `[check-typecheck] ⏰ 全量 typecheck 超过 ${TYPECHECK_TIMEOUT_MIN} 分钟未完成,已终止(非类型检查结论)`,
  )
  console.error('[check-typecheck] 常见挂死根因(按概率排序):')
  console.error('   1. worktree 各包缺 node_modules —— tsc 解析不到 workspace 依赖而静默长耗时')
  console.error('      修法(见 skills/ihui-worktree-parallel-dev §2):给 apps/*、packages/* 各包')
  console.error('      逐个建 node_modules junction 指向主仓同名目录')
  console.error(
    '   2. .ihui-agent/state/typecheck.lock 被僵死进程持有 —— rm -rf .ihui-agent/state/typecheck.lock',
  )
  console.error(
    '   3. pnpm -r 进程树递归 —— 复核 scripts/typecheck-full.mjs 的再入守卫 env 是否生效',
  )
  console.error(
    '[check-typecheck] ⏭️ 按「环境挂起」处理(exit 1):不等第二次带 hook 重试,push guard 将直接降级重推',
  )
  console.error('   如需放宽上限:IHUI_TYPECHECK_TIMEOUT_MIN=40 git push ...')
  // 先把已完成包/在飞包读出来,再杀;否则读数只剩文件,日志里看不出谁卡住
  dumpTypecheckTimings()
  // G-611:内联 taskkill 块提成 killChildTree —— 与信号处理器的清场共用一份实现
  // (两处实现必漂移;语义与原逐字路径等值:win32 连树 taskkill /T /F,其余 SIGKILL)
  killChildTree(child)
}, TYPECHECK_TIMEOUT_MS)
timeoutTimer.unref?.()
child.stdout.on('data', (d) => {
  const s = d.toString()
  out += s
  process.stdout.write(s)
})
child.stderr.on('data', (d) => {
  const s = d.toString()
  err += s
  process.stderr.write(s)
})

child.on('close', (code, signal) => {
  clearTimeout(timeoutTimer)
  // G-611:四态分类的唯一出口住 scripts/lib/signal-exit.mjs(与产出侧同一把尺子)。
  // 优先级 timedOut > pass > interrupt > verdict 由该函数保证:
  //   - 超时分支优先于任何退出码判定 —— 超时杀出的 code 无类型语义,不得当真实结论用;
  //     且刻意不归 75:git-push-guard 见 75 会「带 hook 重试」再跑一遍全量 typecheck,
  //     等于把一次挂死变成两次挂死(20min→40min)。走普通失败(1):guard 直接降级
  //     到 --no-verify 重推,用户侧一次超时即出结论。(2026-09-20 语义,逐字保留)
  //   - interrupt 含两格:族码(130/137/141/143/3221225786,2026-09-18 中断分类的原格)
  //     与"无码只有 signal"(G-611 新增 —— 子进程没装产出侧时旧集合判它失明,
  //     一次 kill 被计成"结论失败"再被 --no-verify 绕门,正是本票的病)。
  const outcome = classifySpawnOutcome({
    status: code === null || code === undefined ? null : code,
    signal: signal ?? null,
    timedOut,
  })
  if (outcome.kind === 'timeout') {
    process.exit(1)
  }
  if (outcome.kind === 'pass') {
    _writeReceipt(0, [])
    console.log('[check-typecheck] ✅ 全量 typecheck 验证通过')
    process.exit(0)
  }
  if (outcome.kind === 'interrupt') {
    console.error(`[check-typecheck] ⚠️ typecheck 进程被中断(${outcome.reason}),非类型检查结论`)
    console.error(
      `[check-typecheck] ⏭️ 按临时失败处理(exit ${TEMPFAIL_EXIT_CODE})—— push 侧将带 hook 重试以获取真实结论`,
    )
    process.exit(TEMPFAIL_EXIT_CODE)
  }
  // 机器级 typecheck 锁等不到 ⇒ 子进程 exit 2 + stderr「未判定(并发占用)」。
  // 这一格**不是结论**:不许洗成 pass,也不许被下方降级/「未解析到报错文件 ⇒ 按失败处理」
  // 折成红。按门体系同码透传 undetermined(guardian 逐道点名,不记绿也不判红)。
  const undetermined = detectUndetermined({
    status: code === null || code === undefined ? null : code,
    signal: signal ?? null,
    stderr: err,
  })
  if (undetermined) {
    console.error(`[check-typecheck] ⏸️ ${undetermined}(并发占用)—— 这不是类型检查结论`)
    console.error('[check-typecheck]    机器级 typecheck 锁被另一场全量检查持有,且等待已超上限;')
    console.error('[check-typecheck]    并发占用下的耗时读数不可解释,等对方结束后重跑即可。')
    process.exit(UNDETERMINED_EXIT_CODE)
  }

  // 2026-08-31:staged-scope 降级判定(改动原因见文件头注释)
  const errorFiles = extractErrorFiles(`${out}\n${err}`)
  // 有结论的失败(解析到报错文件)也落回执:下次同树推送直接回放失败清单,不再白跑 20 分钟。
  // 「非 0 但零报错文件」= 环境故障,不是类型结论,不落盘。
  if (errorFiles.length > 0) _writeReceipt(code ?? 1, errorFiles)
  if (scopeDegradeOk && scopeEnabled && shouldDegrade(errorFiles, scopeFiles)) {
    console.log('')
    console.log(`ℹ️ 全部报错文件均不在本次改动范围(${scopeLabel},属并行会话工作区噪音),降级为警告`)
    console.log(`ℹ️ 解析到报错文件共 ${errorFiles.length} 个(样例前 20 个):`)
    for (const f of errorFiles.slice(0, 20)) console.log(`   - ${f}`)
    console.log('ℹ️ 判定:本次 push 放行(exit 0);报错文件的类型修复由其所属会话负责')
    // RP-67:降级块末尾的机器签名行(SCOPE_DEGRADE_EVIDENCE_RE 第二半的生产者);
    // 放末尾保证 .husky/pre-push 的 tail -40 不把它截掉。
    console.log('[IHUI-SCOPE-DEGRADE] 全部报错文件均不在本次推送范围,降级为警告(exit 0)')
    process.exit(0)
  }

  if (scopeEnabled && errorFiles.length > 0) {
    const inScope = errorFiles.filter((f) => isPathInStaged(f, scopeFiles))
    if (inScope.length > 0) {
      console.log(
        `ℹ️ ${inScope.length}/${errorFiles.length} 个报错文件在本次改动范围内,维持失败(样例前 20 个):`,
      )
      for (const f of inScope.slice(0, 20)) console.log(`   - ${f}`)
    }
  }
  if (scopeEnabled && errorFiles.length === 0) {
    console.log(
      'ℹ️ 退出码非 0 但未解析到任何报错文件路径(tsc 未能真正运行/环境故障),按失败处理(§22b)',
    )
  }
  console.error(`❌ 全量 typecheck 失败,推送已阻止(exit ${code ?? 1})`)
  process.exit(code ?? 1)
})

child.on('error', (e) => {
  console.error(
    `[check-typecheck] ❌ 无法启动 typecheck 进程: ${e.message}(按失败处理,禁止静默通过)`,
  )
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
