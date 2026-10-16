// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门批执行器(2026-10-16 自 guardian-runner.mjs 外置,C1 6000 行上限收口的正路)。
 *
 * 为什么拆这一段而不是注册表:`const checks` 注册表被 50+ 镜像测试逐字钉死
 *(每门一条 id 块断言),check-gate-wiring [89] 也只认 runner 一个注册面 —— 注册表动了
 * 就是全仓红;而执行段(缓存/计数/attest/汇总/PAR 池/applyGateResult/主循环)与注册表的
 * 耦合只有 ctx 一层,整体搬出后 runner 只剩「注册表 + CLI 解析 + help + 一次调用」。
 *
 * 搬运纪律:执行逻辑**逐字搬入 runGuardianBatch**,不改任何判定/打印/退出码语义;
 * 行为不变量:help 早退在调用前、push-gate 缓存命中早退在函数内(顺序不变)、
 * substrate 探针先于 PAR 池、中断 75 传播与崩溃分流逐字保留。
 * 镜像测试同步:6 个测试(check-gate-wiring/safe-commit-gate-attribution/gate-failure-kind/
 * substrate-probe/installer-gates-wiring/guardian-triggers)同票改取材面到本文件。
 * 打印出口:本文件一律 console.info/warn/error(eslint-config no-console 白名单),不留行内抑制
 * —— [103] DC 对新增裸 lint 抑制零容忍;console.info 与 console.log 同写 stdout,输出逐字节等价。
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { normalizeTriggers, triggersTouch } from './guardian-triggers.mjs'
import { resolveGitBin } from './gitdir.mjs'
// 2026-10-16 取材层收口(face-reader 棘轮型 A):只读 git 派生(rev-parse HEAD 子树 /
// status / diff --cached)走共用层 gitRaw —— 绝对路径 git + safe.directory + quotepath +
// 显式 stdio + EBUSY 兜底 + GIT_OPTIONAL_LOCKS=0(只读派生不抢 index.lock)。
// 失败语义不变:取不到即折 null / 按「未触及」处置,不冒充结论。
import { gitRaw } from './face-reader.mjs'
import { probeSubstrate } from './substrate-probe.mjs'
// G-1059139:守门批的结构化留痕(批次跑了 / 逐道 env 自跳 / 暂存区未触及 / 当次索引的树指纹)。
// 归一函数与读写出口只住这一处 lib,runner 不自己拼台账路径、也不自己算 digest(两份实现必漂移)。
import {
  appendGateBatchRecord,
  indexTreeDigest,
  indexVsHeadPaths,
  stepLevelSkipHits,
} from './attestation-tree-digest.mjs'
// G-611:子门"被信号杀死"与"检查结论失败"的分界用共享尺子判(集合/分类唯一实现在该 lib;
// 75 传播语义见执行段 catch)。此前本 runner 只认 status===75,子门被可捕获信号杀掉而
// 产出 128+N、或没装产出侧只留下 signal 时,都被计成"结论失败"—— 归因分叉的 runner 层。
import {
  interruptReason,
  shouldPropagateAsInterrupt,
  TEMPFAIL_EXIT_CODE,
} from './signal-exit.mjs'
// 2026-09-29:把"跑不起来(崩溃)"与"判据判红"分流的纯函数(构造面四条分支各有正反例)。
import { crashAdvisory, decideGateOutcome } from './gate-failure-kind.mjs'

export async function runGuardianBatch({ checks, pushGateChecks, effectiveChecks, passStaged, pushGate, showTiming, cliArgs }) {

// === 颜色 ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ── --timing 的机读旁路(2026-10-12 立) ─────────────────────────────────────
// 为什么需要:并行档把所有门头一次性打印在前、各门的 ⏱ 行随后按完成序回放,
// 于是「日志里第 N 个 ⏱ 对应哪道门」不可解析(实测 235 个门头只有 16 个能靠
// 邻接配对)⇒ 只能拿汇总总耗时,做不了逐门针对性提速。
// 出路:applyGateResult 收口处按 check.id 落一份 JSON(仅 --timing 时写),
// 与控制台输出互不干扰,分析脚本读它,不再靠正则配对日志。
const timingRows = []
if (showTiming) {
  process.on('exit', () => {
    try {
      const out = resolve(process.cwd(), '.ihui-agent/tmp/guardian-timing.json')
      writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), rows: timingRows }, null, 2) + '\n')
      process.stderr.write(`⏱  逐门耗时已落盘: ${out}(${timingRows.length} 行)\n`)
    } catch {
      /* 落盘失败不得影响守门结论 —— 只是少一份分析材料 */
    }
  })
}

// === 执行 ===

// ─── push-gate 结果缓存(2026-09-18 立,"已推完还在等"根治第二刀) ───
// 背景:pre-push 钩子是仓库级——同一批 commit 推 N 个仓就清缓存全量 tsc+mypy N 遍,
//      单遍数分钟,多会话收尾动辄干等 8-13 分钟。而同一 HEAD 的代码内容完全相同,
//      短窗口内重复跑门是纯浪费。
// 策略(2026-09-18 晚二次根治):**内容指纹**为键,不再按 HEAD sha——
//      typecheck 实际消费的是工作区(apps/+packages/ 的 HEAD 子树 + 脏改动),
//      合并提交/文档提交虽推进 HEAD 但类型相关内容不变,按 sha 键控必 miss,
//      导致每轮收敛都重跑 270s 全量门(实测收敛 3 轮 = 13 分钟)。
//      指纹 = HEAD:apps 树 hash + HEAD:packages 树 hash + 脏文件清单及内容 hash。
//      只缓存"全部通过"结果;指纹一变立即失效。
// 跳过:HUSKY_SKIP_PUSHGATE_CACHE=1(需要强制重跑全量门时使用)。
const PUSHGATE_CACHE_TTL_MS = 10 * 60 * 1000
const pushGateCacheFile = resolve(process.cwd(), '.workbuddy/push-gate-cache.json')

function readPushGateCache() {
  try {
    return JSON.parse(readFileSync(pushGateCacheFile, 'utf8'))
  } catch {
    return null
  }
}

/** 计算门检查输入的内容指纹:HEAD 类型相关子树 + 工作区脏状态(含脏文件内容) */
function computeGateFingerprint() {
  try {
    // root = process.cwd():与原裸派生的 cwd 继承面同面(本函数全链都用 process.cwd() 取根)。
    // gitRaw 额外带 safe.directory + quotepath=false:指纹对中文路径不再因 locale 引号形态漂移。
    const trees = gitRaw(['rev-parse', 'HEAD:apps', 'HEAD:packages'], process.cwd(), {
      // 只读查询,可安全封顶:同日 check-port-registry 因无 timeout 挂住 80 分钟,
      // 把整条 pre-commit 拖成"看起来像卡死"。5 分钟远高于任何正常耗时,只截病态挂起。
      timeout: 300_000,
    }).trim()
    // -z:NUL 分隔,路径无转义歧义;rename 条目 "R  new\0old\0" 需跳过 old 段
    const statusRaw = gitRaw(
      ['status', '--porcelain', '-z', '--', 'apps', 'packages'],
      process.cwd(),
      {
        timeout: 300_000,
      },
    )
    const h = createHash('sha1')
    h.update(trees)
    h.update(statusRaw)
    const tokens = statusRaw.split('\0').filter(Boolean)
    for (let i = 0; i < tokens.length && i < 400; i++) {
      const tok = tokens[i]
      if (tok.length <= 3 || tok[2] !== ' ') continue
      const xy = tok.slice(0, 2)
      try {
        h.update(readFileSync(resolve(process.cwd(), tok.slice(3))))
      } catch {
        /* 删除态/瞬时不可读文件跳过,不影响指纹整体有效性 */
      }
      if (xy.includes('R') || xy.includes('C')) i++ // 跳过 rename 的 old path 段
    }
    return h.digest('hex')
  } catch {
    return null
  }
}

if (pushGate && !cliArgs.includes('--no-cache') && process.env.HUSKY_SKIP_PUSHGATE_CACHE !== '1') {
  const cache = readPushGateCache()
  const fp = computeGateFingerprint()
  if (
    cache &&
    cache.passed === true &&
    cache.fp &&
    cache.fp === fp &&
    Date.now() - cache.ts < PUSHGATE_CACHE_TTL_MS
  ) {
    const ageMin = ((Date.now() - cache.ts) / 60000).toFixed(1)
    console.info(
      `${C.green}⚡ [push-gate] 命中缓存:类型相关内容指纹 ${String(fp).slice(0, 11)} 于 ${ageMin} 分钟前已通过全量门,跳过重复 typecheck${C.reset}`,
    )
    console.info(`${C.dim}   (内容一致复用结果;强制重跑:HUSKY_SKIP_PUSHGATE_CACHE=1)${C.reset}`)
    process.exit(0)
  }
}

let passed = 0
let warned = 0
let failed = 0
let skipped = 0
const startTime = Date.now()
// 跑完再汇总(2026-09-22 改版):原先任一 blocking 门失败即 exit(1),会遮蔽其后所有门的结论
// —— 既让人误判"刚注册的门没生效"(实测两次被 id 6 / id 30c 的在途失败截断),也会把
// 本可一次看全的多处故障拆成多轮。改为一轮跑完、末尾列清单一次性退出。
// 两条不变量:① 中断(75 或信号族/无码信号死,G-611 同一把尺子)仍**立即**向上传播,
//    不收敛成 1(push guard 靠它决定重试);
// ② GUARDIAN_STOP_ON_FIRST=1 完整恢复旧的快速失败行为(逃生舱)。
const stopOnFirst = process.env.GUARDIAN_STOP_ON_FIRST === '1'
/** blocking 失败门清单(末尾汇总用)。 */
const failedGates = []
/** 跑不起来的门(崩溃指纹 ⇒ 未判定)。仍计入 failed(不放行),但**不进** failedGates,免得被当"判据判红"。 */
const crashedGates = []

// ─── 批次留痕(G-1059139)───
// 两类"没跑"必须分开记:`selfSkipped` 只收 **env 自跳**(条目声明了 skipEnv 且当次该变量为 1),
// `notTriggered` 收"暂存区未触及声明路径所以没跑"—— 后者不是跳门,混进去就是把"没跑到"写成"跳过了",
// 而这两件事要的处理动作完全不同(前者要读谁按了开关,后者本来就是设计)。
/** env 自跳逐道点名。 */
const selfSkippedGates = []
/** 条件触发未命中所以没跑。 */
const notTriggeredGates = []

/**
 * 往台账落一行 kind=gate-batch-run。**永不抛、永不改退出码** —— 一次正常的守门批不得因为记账写失败而变红,
 * 但写失败必须响亮(stderr 一行),因为台账静默失踪是本仓最高频失效型。
 * ranFullBatch:早退路径(逃生舱 stopOnFirst)为 false,跑完为 true。
 */
function attestGateBatchRun(ranFullBatch) {
  try {
    const dg = indexTreeDigest()
    const df = indexVsHeadPaths()
    const declaredEnvs = [
      ...new Set([...checks, ...pushGateChecks].map((c) => c.skipEnv).filter(Boolean)),
    ]
    const step = stepLevelSkipHits({ declared: declaredEnvs })
    const w = appendGateBatchRecord({
      mode: passStaged ? 'staged' : 'full',
      totalChecks: effectiveChecks.length,
      executed: passed + warned + failed + skipped,
      blockingFailed: failedGates.length,
      selfSkipped: selfSkippedGates,
      notTriggered: notTriggeredGates.map((g) => ({ ...g, reason: 'stagedTriggers 未触及' })),
      undeclaredSkipHits: step.count,
      undeclaredSkipHitsUndetermined: step.undetermined,
      declaredFiles: df.ok ? df.files : [],
      declaredFilesTruncated: df.truncated === true,
      declaredFilesTotalSeen: df.ok ? df.totalSeen : 0,
      ranFullBatch,
      treeDigest: dg.digest,
      treeDigestWhy: dg.ok ? null : dg.why,
    })
    if (!w.ok) {
      console.error(`⚠️  [attest] 本轮守门批**未落批次留痕**:${w.why}`)
    } else if (!dg.ok) {
      console.error(
        `⚠️  [attest] 批次留痕已落,但 treeDigest 取不到 ⇒ 统计器把这一枚绑不回本轮(${dg.why})`,
      )
    } else {
      console.info(
        `${C.dim}🧾 [attest] 批次留痕 kind=gate-batch-run(treeDigest=${dg.digest.slice(0, 12)}…,selfSkipped=${selfSkippedGates.length},undeclaredSkipHits=${step.count})${C.reset}`,
      )
    }
    if (step.undetermined.length > 0) {
      console.error(
        `ℹ️  [attest] 步骤级门有 ${step.undetermined.length} 个面读不到(${step.undetermined
          .map((u) => u.file)
          .join(', ')})⇒ undeclaredSkipHits 只覆盖扫得动的面,**不得读成"该面已覆盖"**,也不得折成 0`,
      )
    }
    if (!df.ok) console.error(`ℹ️  [attest] declaredFiles 取不到:${df.why}(落空数组并点名,不伪造)`)
  } catch (e) {
    console.error(
      `⚠️  [attest] 批次留痕流程异常:${String(e?.message ?? e).slice(0, 200)} —— 不影响门禁结论与退出码`,
    )
  }
}

/** 打印批量检查汇总。早退与跑完两条路径共用,避免两份实现漂移。 */
function printSummary(useStderr) {
  const out = useStderr ? console.error : console.info
  const executed = passed + warned + failed + skipped
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  out('')
  out(`${C.bold}🛡️ 守门脚本批量检查汇总${C.reset}`)
  out(
    `  总检查数: ${effectiveChecks.length}(已执行 ${executed}${executed < effectiveChecks.length ? ' ← 提前中止' : ''})`,
  )
  out(`  ${C.green}通过: ${passed}${C.reset}`)
  out(`  ${C.yellow}警告: ${warned}${C.reset}`)
  out(`  ${C.red}失败: ${failed}${C.reset}`)
  out(`  ${C.dim}跳过: ${skipped}${C.reset}`)
  out(`  总耗时: ${totalTime}s`)
}

// ─── 条件触发(2026-09-22 立)───
// 条目声明 stagedTriggers(路径前缀数组)时,--staged 模式下只在**暂存区触及这些前缀**才执行,
// 口径与 .husky/pre-commit 的 16b/16c/16e 条件守门完全一致(git diff --cached --name-only)。
// 为什么需要:领域守门(桌面安装器等)与绝大多数提交无关,无条件挂上既拖慢每次 commit,
//   又会因他人未完成的工作树改动误伤;但判据本身必须 blocking —— 静默失败类事故
//   (NSIS 少一行 File 编译零报错、--write 抹掉未登记定制)只有真拦住才有意义。
// 全量模式(不带 --staged,手动 / CI)一律执行;拿不到暂存区(非 git 环境)按「触及」处理,
//   宁误跑不误漏。结果缓存一次,多个条件项共用。
// 边界:--staged 而暂存区为空(手动误跑该模式)按「未触及」跳过 —— 需要全量审计请不带 --staged。
let stagedFilesCache = null
function stagedFilesOrNull() {
  if (stagedFilesCache) return stagedFilesCache
  try {
    stagedFilesCache = gitRaw(['diff', '--cached', '--name-only'], process.cwd(), {
      timeout: 120_000,
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return null
  }
  return stagedFilesCache
}

function stagedPathsTouch(prefixes) {
  // 归一交给 lib/guardian-triggers.mjs:裸字符串注册(HEAD 实测 3 道)曾在此处
  // TypeError 崩掉整条守门链;空清单则抛错,不允许"永不运行"的隐形失踪。
  return triggersTouch(stagedFilesOrNull(), prefixes)
}

/**
 * 地基探针:开跑整批门之前,先问一句"这个仓库此刻**答不答得上话**"。
 * 判据与"为什么不住在 runner 里"写在 `scripts/lib/substrate-probe.mjs` 头注(本仓 2026-09-29
 * 实测:五道门在 .git 抖动的 90 秒里各报"无法判定",而分发循环把任何非零码一律计成
 * "blocking 失败,提交已阻止" ⇒ 全队要么被挡、要么 `--no-verify`,一次绕过 = 该枚提交上
 * 全部守门作废)。结论走 `TEMPFAIL_EXIT_CODE`(75):它在本仓已经是"非检查结论、稍后重试"
 * 的既有通道(push guard 的带 hook 重试链依赖它),归因层也把它读成"批没跑完"而不是"你的红"。
 */
function assertSubstrateUsable() {
  let gitBin = null
  try {
    gitBin = resolveGitBin()
  } catch (e) {
    console.error(
      `🚫 [substrate] 连 git 二进制都解析不到(${String((e && e.message) || e).slice(0, 100)})` +
        ` —— 整批守门无法出具结论,以 ${TEMPFAIL_EXIT_CODE} 向上传播(非检查结论,等仓库恢复后重试)。`,
    )
    process.exit(TEMPFAIL_EXIT_CODE)
  }
  const v = probeSubstrate({
    // 只读动词 + 显式 timeout(守门 80 的口径:热路径的只读 git 调用必须封顶)
    run: () =>
      execFileSync(gitBin, ['rev-parse', '--is-inside-work-tree'], {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 15000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
  })
  if (v.usable) return
  console.error(
    `🚫 [substrate] 仓库此刻答不上话:${v.reason}\n` +
      `   ⇒ 本轮**不跑** ${effectiveChecks.length} 道门,也不把这场瞬时故障记成 ${effectiveChecks.length} 条"结论失败"` +
      '(那正是逼全队 `--no-verify` 的形态)。等 gitdir 恢复(守护 ≤2 分钟自愈一轮)后重跑提交即可。',
  )
  process.exit(TEMPFAIL_EXIT_CODE)
}

assertSubstrateUsable()

// === 只读门并行白名单(方案A 外置层)===
// 只有收录于此的门进并行池;未收录的门(含未来新增门)默认串行 = 安全向;写者门永列不入。
// 为什么不写成 checks 条目字段:守门 192(注册表工作树超集,--staged 问责)按「条目行逐字等值」
// 比对 HEAD↔索引 —— 给既有条目插一行 `par: true` 会被判 228 条 P2 改写(2026-10-12 实测即红,
// 提交被拦);白名单住顶层常量 ⇒ checks 条目字节与 HEAD 逐字一致,192 零命中,并行语义不变。
// 新增只读门提速:在此加一行 id 即可(现有 228 门)。
const PAR_GATE_IDS = new Set([
  '1', '2', '2b', '2c', '2e', '2e-dupns', '2g-web', '3',
  '4', '4b', '4c', '6', '7', '8', '11', '11b',
  '11c', '11d', '11h', '11e', '11f', '11g', '12', '13c',
  '17', '18', '20', '24a', '25', '26', '27', '28',
  '29', '30', '30a', '30c', '30b', '16c', '45', '35',
  '36', '37', '38', '39', '40', '41', '2d', '2o-shared',
  '2o-miniapp-taro', '2o-mobile-rn', '2f-ext', '2f-shared', '2g-ext', '2h-ext', '2i-ext', '2j-shared',
  '2p-api', '2q-cli', '2r-miniapp-taro', '2s-mobile-rn', '2t-api', '2u-cli', '2v-miniapp-taro', '2w-mobile-rn',
  '2k-shared', '2m-shared', '2n-web', '2f-mobile-rn', '2f-cli', '9', '13b', '19',
  '21', '22', '24b', '34', '33', '42', '44', '46',
  '48', '49', '50', '51', '52', '53', '54', '55',
  '59', '57', '58', '60', '56', '61', '62', '63',
  '68', '64', '66', '67', '69', '70', '71', '72',
  '73', '74', '75', '76', '77', '93', '91', '10',
  '65', '83', '84', '78', '80', '79', '81', '85',
  '86', '87', '88', '89', '92', '90', '94', '95',
  '96', '97', '98', '99', '101', '102', '103', '104',
  '105', '106', '107', '108', '109', '110', '111', '112',
  '113', '114', '115', '116', '117', '118', '119', '120',
  '121', '122', '123', '124', '125', '126', '127', '128',
  '129', '130', '131', '132', '133', '134', '135', '136',
  '137', '138', '139', '140', '141', '142', '143', '144',
  '145', '146', '147', '148', '149', '151', '152', '153',
  '154', '155', '156', '157', '158', '159', '160', '161',
  '163', '164', '165', '166', '167', '171', '173', '174',
  '175', '176', '177', '178', '179', '180', '181', '182',
  '183', '184', '185', '189', '190', '191', '192', '194',
  '195', '199', '200', '23', '150', '172', '186', '187',
  '188', '196', '197', '198',
])
// === 只读门并行池(方案A;逃生舱:GUARDIAN_SERIAL=1 退回全串行,GUARDIAN_PAR=<n> 调并发度) ===
// 契约(与串行版逐字对齐的三条):
//   ① 只有 PAR_GATE_IDS 白名单收录的门进池(新门默认串行 = 安全向);写者门(git 索引/共享文件)照旧串行,
//      且执行前先 flushParBuffer() 全屏障 —— 池内零在飞子进程时才跑写者 ⇒ 与只读门零交叠。
//   ② 子进程 stdout/stderr 全部缓冲,flush 时按 checks **原序**回放(表头在派发时按序打印,
//      结论/输出在 flush 按序吐)⇒ 结论顺序与串行版一致(表头可能先于前段结论,属观感差异)。
//   ③ 退出码语义不变:flush 走同一份 applyGateResult(75/128+N 中断传播、stopOnFirst 早退、
//      崩溃/判红分流原样);任何 process.exit 路径由 exit 钩子杀掉在飞子进程,不留孤儿。
// 2026-10-12 parMax A/B(全量档 + --timing,五档九轮,同机连续测量):
//   par=4  wall 491.8s / 池内合计 1114.8s(并发不足,单门最省但墙钟被卡)
//   par=6  wall 422.5 / 563.7 / 494.9s(中位 494.9,最快单次) 池内 1155/1671/1266s
//   par=8  wall 467.1 / 460.0 / 496.8s(中位 467.1,三轮最稳) 池内 1575/1525/1592s
//   par=10 wall 574.0s(池内 1586.7s) / par=14 wall 583.4s(池内 2030.1s)
// 结论:① ≥10 单调劣化 —— 并行度上去后单门均值从 5067ms 涨到 8904ms(+76%),
//        CPU 竞争反噬盖过并发收益;② 4~8 是同一个谷底平台,6 与 8 的中位差(6%)
//        远小于同档轮间波动(par=6 三轮跨 422~564s = 33%),**判不出显著差异**;
//        ③ 池内合计(= 真实 CPU 成本)par=8 比 par=6 高 15%。故默认保持 6 不动 ——
//        没有统计显著的收益就不改默认;真要试,逃生档 GUARDIAN_PAR=8 仍在。
//        反面教材:单跑一轮就改默认会被 par=6 首轮 422.5s 或次轮 563.7s 带偏(同参 33% 噪声)。
const guardianSerial = process.env.GUARDIAN_SERIAL === '1'
const parMaxRaw = Number.parseInt(process.env.GUARDIAN_PAR || '', 10)
const parMax = Number.isFinite(parMaxRaw) && parMaxRaw >= 1 ? parMaxRaw : 6
const parPending = [] // 按派发序(checks 原序)排队的在途任务;flush 只消费队头
const parLive = new Set() // 在飞子进程句柄;exit 钩子统一收割,防孤儿门进程
let parSlots = parMax // 并发信号量:限制同时在飞的子进程数
const parSlotWaiters = []

function acquireParSlot() {
  if (parSlots > 0) {
    parSlots -= 1
    return Promise.resolve()
  }
  return new Promise((ok) => {
    parSlotWaiters.push(ok)
  })
}

function releaseParSlot() {
  const next = parSlotWaiters.shift()
  if (next) next() // 槽位直接交接给等待者(不回加计数)
  else parSlots += 1
}

// 中断传播 / stopOnFirst / 正常收口都走 process.exit:统一在此收割在飞子进程。
process.on('exit', () => {
  for (const child of parLive) {
    try {
      child.kill()
    } catch {
      /* 子进程已退出 */
    }
  }
})

/** 派发一道只读门:先按 checks 原序入队(保回放序),再等槽;完成后 job.done 置位。 */
async function dispatchPar(check, cmdArgs) {
  const job = { check, runtime: 0, error: null, status: null, signal: null, stdout: '', stderr: '' }
  let markDone
  job.done = new Promise((ok) => {
    markDone = ok
  })
  parPending.push(job)
  await acquireParSlot()
  const spawnedAt = Date.now()
  const child = spawn(process.execPath, [`scripts/${check.script}`, ...cmdArgs], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
  parLive.add(child)
  // 输出上限与 spawnSync maxBuffer 同档(≈20MB):超限合成 ENOBUFS error,与 spawnSync
  // 超限同走 applyGateResult 的 crash 分流 —— 绝不把"输出被截断"静默洗成通过。
  const CAP = 20 * 1024 * 1024
  const outChunks = []
  const errChunks = []
  let outBytes = 0
  let errBytes = 0
  let overCap = false
  child.stdout.on('data', (d) => {
    outBytes += d.length
    if (outBytes <= CAP) outChunks.push(d)
    else overCap = true
  })
  child.stderr.on('data', (d) => {
    errBytes += d.length
    if (errBytes <= CAP) errChunks.push(d)
    else overCap = true
  })
  let finished = false
  let gateTimer = null
  const finish = (apply) => {
    if (finished) return
    finished = true
    if (gateTimer) {
      clearTimeout(gateTimer)
      gateTimer = null
    }
    job.runtime = Date.now() - spawnedAt
    parLive.delete(child)
    releaseParSlot()
    apply()
    markDone()
  }
  child.on('error', (e) => {
    finish(() => {
      job.error = e
    })
  })
  child.on('close', (code, signal) => {
    finish(() => {
      job.status = code
      job.signal = signal
      job.stdout = Buffer.concat(outChunks).toString('utf8')
      job.stderr = Buffer.concat(errChunks).toString('utf8')
      if (overCap && !job.error) {
        const capErr = new Error(`gate stdout/stderr exceeded 20MB cap (${check.id})`)
        capErr.code = 'ENOBUFS'
        job.error = capErr
      }
    })
  })
  // ─── 单门超时兜底(2026-10-12 立,守门无界的第二道闸) ──────────────────
  // 成因实测:desktop-nsis-template.mjs --check 走「console.log 后立刻 process.exit(0)」,
  // 在 **stdout 是 pipe** 时(并行派发 stdio: ['ignore','pipe','pipe'])于本机 Node v24 上
  // 以 3/6、5/6 的概率打完 OK 文案后永不退出 —— 串行档 stdio inherit 无此病,故并行档首曝。
  // 子进程不死 ⇒ parPending 队头永远等不到 job.done ⇒ 整条提交链无界挂起(比判红更难查)。
  // 处置与门 80(热路径 git 只读调用必须带 timeout)同一口径:**任何子检查都不得无界**。
  // 超时 → kill 子进程 + job.error.code = 'ETIMEDOUT',走 applyGateResult 的 r.error 分支
  // (与 ENOBUFS 同路)⇒ 崩溃分流、点名、非零退出,绝不静默洗成通过。
  // 旋钮:GUARDIAN_GATE_TIMEOUT_MS=0 关闭(仅排障用),默认 300s(正常门实测均在秒级)。
  const gateTimeoutMs = Number(process.env.GUARDIAN_GATE_TIMEOUT_MS ?? 300_000)
  if (Number.isFinite(gateTimeoutMs) && gateTimeoutMs > 0) {
    gateTimer = setTimeout(() => {
      if (finished) return
      const te = new Error(`守门脚本超时未退出(${gateTimeoutMs}ms)—— ${check.id} ${check.script}`)
      te.code = 'ETIMEDOUT'
      try {
        child.kill('SIGKILL')
      } catch {
        /* kill 失败也要 finish,不能把兜底本身变成新的挂起点 */
      }
      finish(() => {
        job.error = te
        job.stdout = Buffer.concat(outChunks).toString('utf8')
        job.stderr = Buffer.concat(errChunks).toString('utf8')
      })
    }, gateTimeoutMs)
  }
}

/**
 * 全屏障:队头起逐个等完并按 checks 原序回放(先 stdout,再 stderr+结论)。
 * 串行门(写者/跳过/汇总)执行前各调一次 ⇒ 共享状态只在池内零在飞时被触碰。
 */
async function flushParBuffer() {
  while (parPending.length > 0) {
    const job = parPending[0]
    await job.done
    parPending.shift()
    if (job.stdout) process.stdout.write(job.stdout)
    // checkStart 回推:⏱ 显示子进程真实运行时长,而非"等到 flush 才开始计时"
    applyGateResult(job.check, job, Date.now() - job.runtime)
  }
}

// 串行 spawnSync 的结果判定体原样抽出(par 与 serial 共用同一份,退出码语义不分叉)。
function applyGateResult(check, r, checkStart) {
  const gateStderr = typeof r.stderr === 'string' ? r.stderr : ''
  if (showTiming) {
    // 三条出口(pass / blocking失败 / warn·info)统一在此记账,含被判红的门 ——
    // 慢门往往正是被判红或做过重活的那几道,漏掉它们等于只统计了"好消息"。
    timingRows.push({
      id: check.id,
      label: check.label,
      script: check.script,
      mode: check.mode,
      ms: Date.now() - checkStart,
      ok: !r.error && r.status === 0 && r.signal === null,
    })
  }
  try {
    if (gateStderr.length > 0) process.stderr.write(gateStderr)
    if (r.error) throw r.error
    if (r.status !== 0 || r.signal !== null) {
      const err = new Error(`守门脚本以 exit ${String(r.status)} 退出`)
      err.status = r.status ?? null
      err.signal = r.signal ?? null
      throw err
    }
    passed++
    if (showTiming) {
      console.info(`  ${C.dim}⏱  ${Date.now() - checkStart}ms${C.reset}`)
    }
  } catch (e) {
    const elapsed = Date.now() - checkStart
    // 2026-09-18 中断传播:子检查以 exit 75(临时失败/被中断)退出 ≠ 检查结论失败,
    // 必须原样向上传播(hook → push guard 据此带 hook 重试),不得收敛成 1。
    // 2026-09-29 G-611 扩两格(同一把尺子 scripts/lib/signal-exit.mjs):
    //   ② 子进程装了产出侧、被可捕获信号杀死 ⇒ 退出码是 128+N 族(130/137/141/143/3221225786)
    //      —— 旧判据只认 75,族码在这里会被计成"结论失败";
    //   ③ 没装产出侧/不可捕获 ⇒ execSync 抛错只剩 {status:null, signal} —— 同样不是结论。
    // 有结论的失败(非族非零码)不在此列,照旧计入 failedGates(不得反向把失败洗成中断)。
    if (check.mode === 'blocking' && shouldPropagateAsInterrupt(e)) {
      console.error(
        `⏭️ [${check.id}] ${check.label} 被中断(${interruptReason(e)})—— 非检查结论,以 ${TEMPFAIL_EXIT_CODE} 向上传播`,
      )
      process.exit(TEMPFAIL_EXIT_CODE)
    }
    // 2026-08-19 立的这条注释已过时(原写"stdio:inherit 已把 stderr 透传,无需 silent-skip 检测"):
    // 现在 stderr 是**管道进来的**,由上方 `process.stderr.write(gateStderr)` 负责原样吐回上游 ——
    // 也就是说"子进程的话一定被打印"这件事仍然成立,但**保障它的是这段代码,不是 stdio 模式**。
    // 谁再改 stdio 配置,必须同时回头看那一句 write,否则判据的输出会被静默吞掉(比误报更难查)。
    if (check.mode === 'blocking') {
      failed++
      // 崩溃 ≠ 判红(纯函数与四条分支的构造面证明在 scripts/lib/gate-failure-kind.mjs)。
      // 分流只改**说法与归类**,不改后果:仍然 failed、批量仍然非零退出 —— 把"跑不起来"洗成
      // 通过,等于给一台瞎掉的尺子发合格证(本仓对"未判定"的一贯要求:大声、点名、不清偿不放行)。
      const kind = decideGateOutcome({
        status: e?.status ?? null,
        signal: e?.signal ?? null,
        stderr: gateStderr,
      })
      if (kind.kind === 'crash') {
        crashedGates.push({ id: check.id, label: check.label, script: check.script, reason: kind.reason })
        console.error(
          `${C.yellow}⚠️ [${check.id}] ${check.label} ${kind.reason}${C.reset} —— 跑不起来(未判定),不是检查结论;` +
            `提交仍被阻止,但**请勿把它读成"这道门发现了缺陷"**。先跑全量 pnpm install 再复跑本批。`,
        )
      } else {
        failedGates.push({ id: check.id, label: check.label, script: check.script })
        if (check.onFailHint) {
          console.info(check.onFailHint)
        }
        console.error(`${C.red}❌ [${check.id}] ${check.label} 失败,提交已阻止${C.reset}`)
      }
      // 默认继续跑完(见 failedGates 声明处注释);逃生舱才早退。
      if (stopOnFirst) {
        printSummary(true)
        // 早退也是一轮"跑过一部分门"的批次:留痕照落,但 ranFullBatch:false(它没跑完全部)。
        attestGateBatchRun(false)
        process.exit(1)
      }
    } else if (check.mode === 'warn') {
      warned++
      console.warn(
        `${C.yellow}⚠️ [${check.id}] ${check.label} 失败 (warn-only,不阻塞 commit)${C.reset}`,
      )
      if (showTiming) {
        console.info(`  ${C.dim}⏱  ${elapsed}ms${C.reset}`)
      }
    } else {
      // info 模式:失败不计数,视为通过
      passed++
      if (showTiming) {
        console.info(`  ${C.dim}⏱  ${elapsed}ms${C.reset}`)
      }
    }
  }
}

for (const check of effectiveChecks) {
  // 逐项应急放行(2026-09-21 立):与各门脚本内部 HUSKY_SKIP_* 惯例一致,由 item 的
  // skipEnv 字段声明变量名。适用场景 = 并发会话未提交 WIP 造成"工作区级"漂移,
  // 阻塞与本任务无关的提交(本次改动不含该目录时,门的结论是假阳性)。
  // 纪律:commit message 必须写明责任归属;默认行为不变(不设变量照常阻塞)。
  if (check.skipEnv && process.env[check.skipEnv] === '1') {
    await flushParBuffer()
    skipped++
    selfSkippedGates.push({ id: String(check.id), label: check.label, skipEnv: check.skipEnv })
    console.info(`⏭  [${check.id}] ${check.label}(跳过:${check.skipEnv}=1)`)
    continue
  }
  // 条件触发(2026-09-22 立,见上方 stagedPathsTouch):暂存区未触及声明路径 → 不执行。
  // 与 skipEnv 同计入"跳过",并打印触发清单,避免"静默没跑"。
  if (check.stagedTriggers && passStaged && !stagedPathsTouch(check.stagedTriggers)) {
    await flushParBuffer()
    skipped++
    notTriggeredGates.push({
      id: String(check.id),
      label: check.label,
      triggers: normalizeTriggers(check.stagedTriggers),
    })
    console.info(
      `⏭  [${check.id}] ${check.label}(暂存区未触及:${normalizeTriggers(check.stagedTriggers).join(' / ')},跳过)`,
    )
    continue
  }
  const cmdArgs = [...check.args]
  if (passStaged) cmdArgs.push('--staged')
  // (旧版这里拼一条 shell 字符串给 execSync;改 spawnSync 用 argv 数组后不再需要,
  //  顺带去掉 shell 一层。复现命令由汇总段按 `node scripts/<script>` 现拼,不在此处留变量。)

  if (PAR_GATE_IDS.has(check.id) && !guardianSerial) {
    console.info(`[${check.id}] ${check.label}...`)
    await dispatchPar(check, cmdArgs)
    continue
  }
  await flushParBuffer()
  console.info(`[${check.id}] ${check.label}...`)
  const checkStart = Date.now()

  // 2026-09-29:执行改走 spawnSync —— 唯一理由是**要读到子进程 stderr**(崩溃指纹只在那里)。
  // execSync 在 stdio:'pipe' 下只回 stdout,成功门的 stderr 会被**吞掉**,那是比"分不清崩溃与判红"
  // 更糟的回归(判据失效的表现永远是安静)。stdout 仍 'inherit' 实时输出,观感与逐门进度一字不变;
  // 失败路径合成一个带 status/signal 的 Error,使下方 shouldPropagateAsInterrupt(G-611 的中断传播)
  // 与所有旧分支的读法保持同形 —— 退出码语义不因这次改动而变化:崩溃仍然计失败,不静默放行。
  const r = spawnSync(process.execPath, [`scripts/${check.script}`, ...cmdArgs], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'inherit', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    encoding: 'utf8',
  })
  applyGateResult(check, r, checkStart)
}

// 汇总前收口:把剩余在飞/缓冲的并行结果按原序全部回放(全屏障)。
await flushParBuffer()

// === 汇总 ===

printSummary(false)
// 跑完的批次(不论有无 blocking 失败)都落一行 kind=gate-batch-run:统计器靠它的 treeDigest
// 把"门确实跑过、但有 N 道按名字自跳"这一枚与"整批根本没跑"分开(§12f 的 unknown 拆格)。
attestGateBatchRun(true)
if (crashedGates.length > 0) {
  console.error('')
  console.error(
    `${C.bold}${C.yellow}⚠️ ${crashedGates.length} 道门**跑不起来(未判定)**—— 与"判据判红"分开列,别按缺陷派单:${C.reset}`,
  )
  for (const g of crashedGates)
    console.error(`   · [${g.id}] ${g.label} —— ${g.reason}(复现:node scripts/${g.script})`)
  console.error(`   ${crashAdvisory(crashedGates.length)}`)
}
if (failedGates.length > 0) {
  console.error('')
  console.error(
    `${C.bold}${C.red}🚫 ${failedGates.length} 道 blocking 门失败 —— 本轮已跑完全部 ${effectiveChecks.length} 项,未提前中止:${C.reset}`,
  )
  for (const g of failedGates) {
    console.error(`   · [${g.id}] ${g.label}`)
    console.error(`     单独复现:node scripts/${g.script}${passStaged ? ' --staged' : ''}`)
  }
  console.error(`  ${C.dim}(紧急只跑首个即停:GUARDIAN_STOP_ON_FIRST=1)${C.reset}`)
  process.exit(1)
}

// push-gate 全部通过 → 写缓存(内容指纹键控,同内容短窗口内重复 push 复用,见执行段注释)
if (pushGate && failed === 0) {
  try {
    mkdirSync(resolve(process.cwd(), '.workbuddy'), { recursive: true })
    writeFileSync(
      pushGateCacheFile,
      JSON.stringify({ fp: computeGateFingerprint(), passed: true, ts: Date.now() }),
    )
    console.info(
      `${C.dim}⚡ [push-gate] 结果已缓存(类型相关内容一致时 10 分钟内重复推送免重跑)${C.reset}`,
    )
  } catch {
    /* 缓存写失败不影响放行 */
  }
}

process.exit(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
