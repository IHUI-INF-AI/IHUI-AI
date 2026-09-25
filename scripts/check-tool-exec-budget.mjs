// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 工具执行预算对账:钉住"单次工具调用的墙钟预算 + 取消下发"这一整条机制**在位且只有一份**。
//
// 立因(实测,不是设想):改前 `apps/cli/src/tools/index.ts` 对 `tool.execute` 的 await 既无上限
// 也无取消通道,而 `tools/subagent.ts` 在里面嵌套跑一整条 agent loop ⇒ provider 一挂,这一枚工具
// 调用永久挂起,Ctrl-C 也到不了。探针读数:同一枚永不 settle 的工具,改前 20s 看门狗内不结算,
// 改后在 观察档 1s + 宽限 5s = 6.05s 结算并回 errorType='timeout'。
//
// 四类红(全部**零容忍**,因为它们判的是"机制在不在",不是"存量债多少"):
//   S1  唯一出口 / 封顶行 / 解绑闭包 / 两条执行分支各自的调用 / 子 loop 的 signal —— 摘任一线即红
//   B1  execBudget 声明非法(ms 非正 / 越封顶 / notInterruptible 缺 reason / 空壳 reason / 形态不认识)
//   X   新造 `budget-exempt` 一类豁免通道(那条通道属守门 108 的到期账,结构性声明不得混过去)
//   S0  判定面取不到被审文件 ⇒ exit 2「无法判定」,既不冒红也绝不记绿
// 一条**棘轮**(与本次改动无关的存量不得钉红,否则逼人 --no-verify 连带废掉全部门):
//   B2  第二份自建墙钟(同文件代码位上 Promise.race + setTimeout)按"该文件在 HEAD 自身的违规数"锚定,
//       只拦"这次把它加回来了"。立门实测存量 1 个文件:tools/lsp.ts 的 withTimeout。
//
// 口径同守门 70/77/83/98/101/103:全量判 **HEAD blob**、--staged 判**索引 blob**、--worktree 仅作
// 人工排查逃生舱(两面旗标同给 ⇒ exit 2)。**判据语义全部在 scripts/lib/tool-exec-budget.mjs**
// (纯函数,可用构造面证明),本文件只负责"从哪个面读哪些文件"。
//
// 已知限制(如实登记,不等于"没有违规"):
//   1. S1 是**结构在位**判据,不是行为判据 —— 行为由 apps/cli/tests/tool-exec-budget.test.ts 钉。
//   2. `ms` 指向另一个文件里的常量时解不出 ⇒ 计 undetermined 并如实报数,不猜也不判红。
//   3. 父级 signal 注入(`commands/agent.ts` 构造 ctx 那一处)本票无权改,故 S2 只做棘轮点名。
//   4. 只扫 `apps/cli/src/tools/**` 的声明面;端内别处若自建工具级墙钟,本门看不见(宁窄不误)。
//
// 接线建议见交付报告(本文件**尚未**接进 guardian-runner / package.json / CI —— 接线由主会话统一做)。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  FACE_LABEL,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import {
  MECHANISM_FILE,
  PARENT_CTX_FILE,
  SUBAGENT_FILE,
  auditFile,
  countMissingParentSignal,
  parseExecBudgetConstants,
} from './lib/tool-exec-budget.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_ENV = 'HUSKY_SKIP_TOOL_EXEC_BUDGET'
/** 三个必须在场文件:少了任何一个 = 机制不成立,而不是"这次没扫到" */
const FIXED_FILES = [MECHANISM_FILE, SUBAGENT_FILE, PARENT_CTX_FILE]

/**
 * 候选清单:固定三文件 + 一次 `git grep` 预筛的声明/自建墙钟候选。
 * 预筛模式(`execBudget` / `Promise.race`)是判据字面量的**严格超集**,筛不掉真违规;
 * git 说"一个都没匹配到"(status 1)是合法结论,而 git 没跑成必须是 Undetermined —— 两者分开。
 */
function listFiles(root, face) {
  const pat = ['-e', 'execBudget', '-e', 'Promise.race']
  const scope = ['--', 'apps/cli/src/tools']
  const args =
    face === 'head'
      ? ['grep', '-I', '-l', ...pat, 'HEAD', ...scope]
      : face === 'staged'
        ? ['grep', '-I', '-l', ...pat, '--cached', ...scope]
        : ['grep', '-I', '-l', ...pat, ...scope]
  let out = ''
  try {
    out = gitRaw(args, root)
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) out = ''
    else throw e
  }
  const found = String(out)
    .split(/\r?\n/)
    .map((s) => (face === 'head' ? s.replace(/^HEAD:/, '') : s).trim())
    .filter((s) => s.length > 0)
  const set = new Set([...FIXED_FILES, ...found])
  return [...set].sort()
}

function readFace(root, face, files) {
  if (face === 'worktree') {
    const m = new Map()
    for (const f of files) m.set(f, readWorktreeFile(root, f))
    return m
  }
  const prefix = face === 'head' ? 'HEAD:' : ':'
  const revs = files.map((f) => `${prefix}${f}`)
  const batch = catBatch(root, revs)
  const m = new Map()
  files.forEach((f, i) => m.set(f, batch.get(revs[i]) ?? null))
  return m
}

/**
 * 反假绿护栏:枚举到 0 个文件 = 判据没跑起来,**不是**"仓库干净"。
 * 抽成纯函数,这样这条分支能被构造出来证明(靠真仓瞬时状态证不了)。
 */
export function assertNonEmptyScan(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Undetermined('扫描面内枚举到 0 个文件 ⇒ 无法判定(不是没有违规)')
  }
  for (const f of FIXED_FILES) {
    if (!files.includes(f)) throw new Undetermined(`必须在场文件缺失:${f}`)
  }
  return files.length
}

export function runAudit(root, face) {
  const files = listFiles(root, face)
  assertNonEmptyScan(files)
  const contents = readFace(root, face, files)

  const missing = []
  const hard = []
  const ratchet = []
  const undetermined = []
  let declarations = 0

  // 封顶档由**机制文件在同面上**供给:声明散落在各工具文件,而常量表只有一份。
  // 取不到 = 机制文件本身已判缺(S1f-max),此处如实传 null 让 B1 的越界判据不参与。
  const mechanismSrc = contents.get(MECHANISM_FILE)
  const capMs = typeof mechanismSrc === 'string' ? parseExecBudgetConstants(mechanismSrc).maxMs : null

  for (const rel of files) {
    const src = contents.get(rel)
    if (typeof src !== 'string') {
      if (FIXED_FILES.includes(rel)) missing.push(rel)
      else undetermined.push(rel)
      continue
    }
    const res = auditFile(rel, src, capMs)
    declarations += res.declarations
    for (const h of res.hard) {
      // PARENT_CTX_FILE 上的 S1*/机制类判据不适用(它不承载机制);它只走下面的 S2 棘轮
      if (rel === PARENT_CTX_FILE) continue
      hard.push({ rel, ...h })
    }
    for (let i = 0; i < res.ratchet; i++) ratchet.push({ rel, n: res.ratchet })
    for (let i = 0; i < res.undetermined; i++) undetermined.push(`${rel}(ms 解不出)`)
  }
  if (missing.length) throw new Undetermined(`${FACE_LABEL[face]} 取不到必须在场文件:${missing.join(', ')}`)

  // S2 棘轮:父级 signal 注入点的缺失数**不得比 HEAD 自身更多**。
  // 为什么不是零容忍:那个文件不在本票文件清单内,当场判红就是一台"谁都修不了"的恒红门。
  let parentNow = null
  let parentHead = null
  const parentSrc = contents.get(PARENT_CTX_FILE)
  if (typeof parentSrc === 'string') {
    parentNow = countMissingParentSignal(parentSrc)
    if (face !== 'head') {
      const headOnly = readFace(root, 'head', [PARENT_CTX_FILE])
      const hs = headOnly.get(PARENT_CTX_FILE)
      parentHead = typeof hs === 'string' ? countMissingParentSignal(hs) : null
    } else {
      parentHead = parentNow
    }
  }
  const parentRegression =
    parentNow !== null && parentHead !== null && parentNow > parentHead
      ? { rel: PARENT_CTX_FILE, now: parentNow, head: parentHead }
      : null

  // 同一文件的 B2 只算一次(ratchet 数组里按 rel 去重后再比 HEAD)
  const ratchetByFile = new Map()
  for (const r of ratchet) ratchetByFile.set(r.rel, r.n)
  const ratchetFindings = []
  if (face !== 'head') {
    for (const [rel, n] of ratchetByFile) {
      const hs = readFace(root, 'head', [rel]).get(rel)
      const headN = typeof hs === 'string' ? auditFile(rel, hs).ratchet : 0
      if (n > headN) ratchetFindings.push({ rel, n, head: headN })
    }
  }

  return {
    face,
    scanned: files.length,
    declarations,
    hard,
    ratchetFiles: [...ratchetByFile.entries()].map(([rel, n]) => ({ rel, n })),
    ratchetFindings,
    undetermined,
    parentNow,
    parentHead,
    parentRegression,
  }
}

function report(res) {
  console.log(
    `工具执行预算对账 · 判定面=${FACE_LABEL[res.face]} · 扫描 ${res.scanned} 个文件 · ` +
      `execBudget 声明 ${res.declarations} 处 · 硬违规 ${res.hard.length} 条 · ` +
      `B2 存量文件 ${res.ratchetFiles.length} 个 · 判不出 ${res.undetermined.length} 处`,
  )
  for (const h of res.hard) {
    console.error(`❌ ${h.rel}${h.line ? `:${h.line}` : ''} [${h.id}] ${h.why}`)
  }
  for (const f of res.ratchetFindings) {
    console.error(`❌ ${f.rel} [B2] 第二份自建墙钟从 ${f.head} 涨到 ${f.n}(唯一出口是 executeWithinExecBudget)`)
  }
  if (res.parentRegression) {
    console.error(
      `❌ ${res.parentRegression.rel} [S2] 构造 ToolContext 时未传 signal 的位置从 ${res.parentRegression.head} 涨到 ${res.parentRegression.now}`,
    )
  } else if (res.parentNow !== null) {
    console.log(
      `ℹ️ S2 取消链上游注入点:未传 signal 的 ctx 构造 ${res.parentNow} 处(HEAD 现值 ${res.parentHead},本票无权改该文件 ⇒ 只点名不判红)`,
    )
  }
  if (res.undetermined.length) {
    console.error(`⚠️  ${res.undetermined.length} 处判不出(不计通过也不计违规):`)
    for (const u of res.undetermined.slice(0, 10)) console.error(`   ${u}`)
  }
}

function main(argv) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭️  ${SKIP_ENV}=1 ⇒ 跳过工具执行预算对账(应急,须在提交说明写明原因)`)
    return 0
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  try {
    assertRepoRoot(ROOT, '工具执行预算对账')
    const res = runAudit(ROOT, picked.face)
    if (argv.includes('--json')) {
      // --json 的 stdout 必须**只有那一行 JSON**(镜像测试与 git-guardian 一类消费者直接 JSON.parse;
      // 追加人话行会让"能 parse"这件事取决于违规与否,而那是两种故障混一格)。
      console.log(JSON.stringify(res))
      const redJson = res.hard.length + res.ratchetFindings.length + (res.parentRegression ? 1 : 0)
      return redJson > 0 ? 1 : 0
    }
    report(res)
    const red = res.hard.length + res.ratchetFindings.length + (res.parentRegression ? 1 : 0)
    if (red > 0) {
      console.error(
        `   出路:机制缺失就把它装回 apps/cli/src/tools/index.ts;声明非法就改 execBudget 本身。` +
          `**不得**新造豁免注释,也不得为过门去抬 TOOL_EXEC_BUDGET_MAX_MS。应急跳过 ${SKIP_ENV}=1。`,
      )
      return 1
    }
    if (res.undetermined.length) {
      console.log('✅ 无硬违规(仍有判不出项,已在上方如实列出 ⇒ 不得读成"全部合规")')
      return 0
    }
    console.log('✅ 墙钟预算与取消下发在位,声明合法,无第二份实现回升')
    return 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❓ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
}

// ==================== 取证:纯构造面自检(不读仓库瞬时状态) ====================

/** 一个"机制齐备"的最小合成 index.ts,所有变异都在它上面做(所以自检与仓库推进解耦)。 */
const FIX_INDEX = `
export const TOOL_EXEC_BUDGET_DEFAULT_MS = 30 * 60_000
export const TOOL_EXEC_BUDGET_MAX_MS = 60 * 60_000
export const TOOL_EXEC_BUDGET_SETTLE_GRACE_MS = 5_000
export interface ToolContext {
  workspacePath: string
  signal?: AbortSignal
}
export function resolveToolExecBudgetMs(tool) {
  const safe = tool.execBudget ? tool.execBudget.ms : TOOL_EXEC_BUDGET_DEFAULT_MS
  return Math.min(safe, TOOL_EXEC_BUDGET_MAX_MS)
}
export function linkAbortSignal(parent, child) {
  const relay = () => child.abort()
  parent.addEventListener('abort', relay)
  return () => parent.removeEventListener('abort', relay)
}
export async function executeWithinExecBudget(tool, ctx, run) {
  return run(ctx.signal)
}
export function executeToolCall(name, args, ctx) {
  if (hubEnabled && hubResolver) {
    return executeWithinExecBudget({ name }, ctx, () => resolver.dispatch(name, args, ctx))
  }
  return executeWithRetry(tool, args, ctx)
}
export async function executeWithRetry(tool, args, ctx) {
  const result = await executeWithinExecBudget(tool, ctx, (signal) => tool.execute(args, ctx))
  return result
}
`
const FIX_SUBAGENT = `
const r = await runToolLoop({
  modelId,
  messages,
  ctx,
  maxIterations: 10,
  signal: outerCtx.signal,
});
`
const FIX_PARENT_OK = `const ctx: ToolContext = { workspacePath: p, signal: opts.signal };\n`
const FIX_PARENT_MISSING = `const ctx: ToolContext = { workspacePath: p };\n`

function selfTest() {
  let pass = 0
  let fail = 0
  const check = (name, ok, extra = '') => {
    if (ok) pass += 1
    else {
      fail += 1
      console.error(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const gaps = (src) => auditFile(MECHANISM_FILE, src).hard.map((h) => h.id)
  /** 自检用的封顶档:与生产路径同源(都从合成机制文件里解析),不抄第二份数字 */
  const cap = parseExecBudgetConstants(FIX_INDEX).maxMs

  check('C1 齐备机制 ⇒ 零缺口', gaps(FIX_INDEX).length === 0, JSON.stringify(gaps(FIX_INDEX)))
  check(
    'C2 删封顶 Math.min ⇒ 必红 S1b-cap(这条删了任何覆盖都能越界)',
    gaps(FIX_INDEX.replace('Math.min(safe, TOOL_EXEC_BUDGET_MAX_MS)', 'safe')).includes('S1b-cap'),
  )
  check('C3 摘掉 ctx.signal ⇒ 必红 S1a', gaps(FIX_INDEX.replace('signal?: AbortSignal', '')).includes('S1a'))
  check(
    'C4 解绑闭包被换成空函数 ⇒ 必红 S1c-unlink',
    gaps(FIX_INDEX.replace('parent.removeEventListener', 'parent.nothing')).includes('S1c-unlink'),
  )
  check(
    'C5 retry 分支摘线 ⇒ 必红 S1d-retry(第一版只数出现次数,这一支是无牙的)',
    gaps(
      FIX_INDEX.replace(
        'const result = await executeWithinExecBudget(tool, ctx, (signal) => tool.execute(args, ctx))',
        'const result = await tool.execute(args, ctx)',
      ),
    ).includes('S1d-retry'),
  )
  check(
    'C6 hub 分支摘线 ⇒ 必红 S1d-hub(特性开关不得成为绕过墙钟的第二条路径)',
    gaps(
      FIX_INDEX.replace(
        'return executeWithinExecBudget({ name }, ctx, () => resolver.dispatch(name, args, ctx))',
        'return resolver.dispatch(name, args, ctx)',
      ),
    ).includes('S1d-hub'),
  )
  check(
    'C7 默认档抬到封顶之上 ⇒ 必红 S1f-default-above-max',
    gaps(FIX_INDEX.replace('TOOL_EXEC_BUDGET_DEFAULT_MS = 30 * 60_000', 'TOOL_EXEC_BUDGET_DEFAULT_MS = 99 * 60_000')).includes(
      'S1f-default-above-max',
    ),
  )
  check(
    'C8 注释里的 execBudget 示例不算声明(判据只看代码面)',
    auditFile('apps/cli/src/tools/x.ts', `// execBudget: { ms: 1 } 叙述\nconst a = 1\n`).declarations === 0,
  )
  const bad = (src) => auditFile('apps/cli/src/tools/x.ts', src, cap).hard.map((h) => h.id)
  check('B1-a ms=0 ⇒ 红', bad('const t = { execBudget: { ms: 0 } };\n').includes('B1-ms-nonpositive'))
  check('B1-b ms 越封顶 ⇒ 红', bad(`const t = { execBudget: { ms: ${cap + 1} } };\n`).includes('B1-ms-over-cap'))
  check('B1-c notInterruptible 缺 reason ⇒ 红', bad('const t = { execBudget: { notInterruptible: true } };\n').includes('B1-reason-missing'))
  check(
    'B1-d reason 由注释残骸冒充 ⇒ 红(守门 102 的实录洞,不得重演)',
    bad('const t = { execBudget: { notInterruptible: true, reason: "*/ " } };\n').includes('B1-reason-hollow'),
  )
  check('B1-e 形态不认识 ⇒ 红(绝不"解析不出就当没有")', bad('const t = { execBudget: true };\n').includes('B1-unknown-form'))
  check('B1-f 合法 ms 声明 ⇒ 不红且计数', auditFile('apps/cli/src/tools/x.ts', 'const t = { execBudget: { ms: 1500 } };\n').hard.length === 0)
  check(
    'B1-g 解不出的具名常量 ⇒ 计判不出、不判红(宁漏不误伤)',
    (() => {
      const r = auditFile('apps/cli/src/tools/x.ts', 'const t = { execBudget: { ms: FROM_OTHER_FILE } };\n')
      return r.hard.length === 0 && r.undetermined === 1
    })(),
  )
  check('X-1 新造 budget-exempt 通道 ⇒ 红(即使在注释里)', bad('const a = 1 // budget-exempt: 开后门\n').includes('X-forbidden-marker'))
  check(
    'B2 第二份自建墙钟 ⇒ 计棘轮不判硬红',
    (() => {
      const r = auditFile('apps/cli/src/tools/y.ts', 'async function f(p){ return Promise.race([p, new Promise((_,j)=>setTimeout(()=>j(1),5))]) }\n')
      return r.ratchet === 1 && r.hard.length === 0
    })(),
  )
  check(
    'B2 反向:唯一出口自身文件不参与 B2(否则门把自己要的东西判成违规)',
    auditFile(MECHANISM_FILE, FIX_INDEX).ratchet === 0,
  )
  check('S1e 子 loop 未传 signal ⇒ 红', auditFile(SUBAGENT_FILE, 'const r = await runToolLoop({ modelId, ctx });\n').hard.some((h) => h.id === 'S1e'))
  check('S1e 已传 ⇒ 绿', auditFile(SUBAGENT_FILE, FIX_SUBAGENT).hard.length === 0)
  check('S2 上游未注入 ⇒ 计数 1(不判红)', countMissingParentSignal(FIX_PARENT_MISSING) === 1)
  check('S2 上游已注入 ⇒ 计数 0', countMissingParentSignal(FIX_PARENT_OK) === 0)
  check('S2 文件不存在 ⇒ null(不冒充结论)', countMissingParentSignal('') === null)
  let threwEmpty = false
  try {
    assertNonEmptyScan([])
  } catch (e) {
    threwEmpty = e instanceof Undetermined
  }
  check('R1 空枚举必须判"无法判定"而非绿', threwEmpty)
  let threwMissing = false
  try {
    assertNonEmptyScan(['apps/cli/src/tools/other.ts'])
  } catch (e) {
    threwMissing = e instanceof Undetermined
  }
  check('R2 三个必在场文件缺一个 ⇒ 无法判定(不得冒绿)', threwMissing)
  check('R3 齐备清单放过', assertNonEmptyScan([...FIXED_FILES, 'apps/cli/src/tools/x.ts']) === FIXED_FILES.length + 1)

  console.log(`工具执行预算对账 --self-test:${pass} 通过 / ${fail} 失败(共 ${pass + fail} 条)`)
  return fail ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  try {
    process.exit(argv.includes('--self-test') ? selfTest() : main(argv))
  } catch (e) {
    console.error(`❌ ${e?.stack ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  FIXED_FILES,
  FIX_INDEX,
  FIX_SUBAGENT,
  FIX_PARENT_OK,
  FIX_PARENT_MISSING,
  assertNonEmptyScan,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
