#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * safe-commit.mjs — 多 agent 并行 commit 边界守门
 *
 * 根因:
 *   git 的 index 暂存区是共享的,多 agent 并行时,Agent A 的 git add
 *   暂存的文件可能在 Agent B 触发 git commit 时被打包进去,造成污染事故
 *   (a0f753c7 教训:我自己的 12 个 git rm 被混入其他 agent 的 commit)。
 *
 * 5 步法(零信任):
 *   1. git reset HEAD        主动清空暂存区(无论谁 staged 的)
 *   2. git add <用户路径>     只暂存自己声明的文件
 *   3. 校验                  git diff --cached --name-only --no-renames 必须 === 用户预期
 *                            (--no-renames 根治:默认 rename 探测会把"删 A + 加 B"折叠成一条
 *                             R 记录且不列旧路径 A,校验恒报"A 未暂存";显式禁用后删除/新增
 *                             各自成行列出,删除类提交不再恒误报。Step 5 的 git show 同理。
 *                             D171 起取路径走 lib/git-paths 的 -z 形态:中文名不被
 *                             core.quotePath 八进制转写,声明侧与 git 侧判同值。)
 *   4. git commit -- <path>   git 原生 -- pathspec 终极兜底
 *   5. 不触发 push(让 post-commit hook 处理)
 *
 * 用法:
 *   node scripts/safe-commit.mjs -m "feat: ..." -- apps/web/foo.tsx apps/api/bar.ts
 *   AGENT_SCOPE="apps/web/" node scripts/safe-commit.mjs -m "..." -- apps/web/foo.tsx
 *
 * 退出码:
 *   0  成功(commit 已落地,post-commit hook 会自动 push)
 *   1  校验失败(意外文件/缺文件/agent scope 越界)
 *   2  环境错误(非 git 仓库/无 origin 等)
 */
import { execSync, spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyHookFailure,
  decideWithSelfRunBatch,
  needsBatchSelfRun,
  verdictLine,
} from './lib/commit-gate-attribution.mjs'
// D171(2026-09-30):取路径一律走 lib/git-paths 的 -z 出口 —— git 默认按 core.quotePath
// 把非 ASCII 路径八进制转写并加引号,按换行 split 的旧写法把 5 个中文名文件判成
// 「暂存区出现非预期文件 ⇒ 中止提交」(Step 3)与污染事故(Step 5)。
import { gitCommitPaths, gitStagedPaths, gitUntrackedPaths, gitWorktreePaths } from './lib/git-paths.mjs'
// G-1018292(2026-10-04):`git reset HEAD` 清空共享索引时会摘掉他人暂存删除的保护标记,
// 而 reflog/index 结构上不留痕 ⇒ 只能在清空前那一瞬取样。判据与留底面在此。
import {
  judgeStagedDeleteIntent,
  readCachedNameStatus,
  snapshotStagedDeleteIntent,
} from './lib/staged-delete-intent.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// G-1079146 剩余半格(2026-10-08):活文档 intake 取值。判据**只有 live-doc-edit 那一份** ——
// 本器 import 它已导出的六个出口,不在这里抄第二条 hex 正则、也不自己 split 做行差集(§22c:
// 两处算同一件事必漂移,而漂了的那一份会替腐烂发合格证)。该模块顶层有 §22d `isDirectRun` 守卫,
// import 零副作用(实测 `import()` 154ms,不跑 main、不写盘、不派生 git)。
import {
  judgeNewLineShas,
  makeShaProber,
  parseShaAllow,
  rewriteEntryOf,
  shaGateReport,
} from './live-doc-edit.mjs'
// 行差集与行多重集同样只有一份:门 84 / object-space-land 用的就是这两个出口,本器不得再算一遍。
import { lineDeltaMaps, tallyLines } from './lib/stale-content-analysis.mjs'
// git 派生走层的唯一 transport(绝对路径 + 显式 stdio + windowsHide + 数字 timeout + maxBuffer);
// 在本器里自拼 execFileSync 就是守门 118 定性的"半接线"—— 管子没共用,面也就没共用。
import { gitRaw } from './lib/face-reader.mjs'

// 本脚本所在仓的根(AGENTS §15:由自身位置推导,不得写死盘符)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

function log(level, msg) {
  const colorMap = { info: 'cyan', ok: 'green', warn: 'yellow', err: 'red' }
  const iconMap = { info: '🔒', ok: '✅', warn: '⚠️ ', err: '❌' }
  const color = C[colorMap[level]]
  const icon = iconMap[level]
  console.log(`${color}${icon} ${msg}${C.reset}`)
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // (三通道 pipe 会让 stdin 也建管道,与"不写 stdio"同病;返回值被 .trim() 消费故不能给裸 ignore)
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      ...opts,
    }).trim()
  } catch (e) {
    if (opts.allowFail) return null
    throw e
  }
}

// ─── 参数解析 ────────────────────────────────────────────
const args = process.argv.slice(2)
// 多个 `-m` 按 git 自己的语义拼成同一条消息(段间空行),不再"后者覆盖前者"。
// 实测两次因此丢主题(2026-09-23 的 22d87f1b6 / 920d655dd,以及 2026-09-27 的 440675aa87 / 025a0a982a):
// 旧写法 `message = args[++i]` 让最后一段正文变成唯一消息,主题行就此消失,而提交照样"成功"。
const messageParts = []
const expectedFiles = []
let dryRun = false

for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '-m' || a === '--message') {
    messageParts.push(args[++i])
  } else if (a.startsWith('--message=')) {
    messageParts.push(a.split('=').slice(1).join('='))
  } else if (a === '--dry-run' || a === '-n') {
    dryRun = true
  } else if (a === '--' || a === '--help' || a === '-h') {
    if (a === '--help' || a === '-h') {
      console.log('用法: node scripts/safe-commit.mjs -m "<msg>" -- <file1> [file2 ...]')
      console.log('  --dry-run       只校验不 commit')
      console.log('  --scope <dir>   限定本 agent 范围(可用环境变量 AGENT_SCOPE)')
      console.log('  环境变量: AGENT_SCOPE="apps/web/ apps/api/" 限定范围')
      process.exit(0)
    }
    // `--` 后是文件路径
    expectedFiles.push(...args.slice(i + 1))
    break
  } else if (!a.startsWith('-')) {
    expectedFiles.push(a)
  } else {
    console.error(`${C.red}未知参数: ${a}${C.reset}`)
    process.exit(2)
  }
}

const message = messageParts.filter((m) => typeof m === 'string' && m.length > 0).join('\n\n')

if (!message) {
  console.error(`${C.red}❌ 必须提供 -m <commit message>${C.reset}`)
  process.exit(2)
}
if (expectedFiles.length === 0) {
  console.error(`${C.red}❌ 必须提供至少一个文件路径(-- file1 file2 ...)${C.reset}`)
  process.exit(2)
}

// ─── 0. 环境检查 ────────────────────────────────────────────
const repoRoot = run('git rev-parse --show-toplevel', { allowFail: true })
if (!repoRoot) {
  log('err', '不在 git 仓库中')
  process.exit(2)
}
process.chdir(repoRoot)

const currentBranch = run('git symbolic-ref --short HEAD', { allowFail: true })
if (!currentBranch) {
  log('err', '处于 detached HEAD,无法安全 commit')
  process.exit(2)
}

// ─── 0.5 git 写操作全局锁(2026-08-06 立,根治多 agent 并发写损坏) ──
// 整个 commit 流程(含 post-commit 自动脚本)串行化;exit 事件保证任意退出路径都释放锁。
// 锁 unitId 通过环境变量 IHUI_GIT_LOCK_UNIT 传递给子进程(post-commit 检测到则不再加锁)。
const LOCK_UNIT = `safe-commit-${process.pid}-${Date.now()}`
process.env.IHUI_GIT_LOCK_UNIT = LOCK_UNIT
log('info', `Step 0/5: 获取 git 写锁(unit=${LOCK_UNIT})`)
// 2026-09-18 根治锁竞争三件套:
//   ① acquire 超时提到 15 分钟 —— 覆盖最长 pre-commit 守门流程,等待方不再因 120s 超时报错;
//   ② acquire 后 spawn detached 心跳子进程(每 5s 续期 meta.ts)—— 长流程持锁永不误判悬挂;
//   ③ 心跳以 parent-pid = 本进程 存活探测,本进程任意路径退出后心跳自动消亡(无残留)。
//   事故背景:此前 meta.ts 只在 acquire 时写一次,pre-commit 跑超 300s 即被并发会话按
//   "悬挂锁"强制抢占 → 两进程同时写 .git(锁反而制造损坏)。
try {
  run(`node ${repoRoot}/scripts/git-lock.mjs acquire --unit ${LOCK_UNIT} --timeout 900000`)
} catch (e) {
  log('err', `获取 git 写锁失败: ${e.message}`)
  process.exit(2)
}
try {
  spawn(
    process.execPath,
    [
      `${repoRoot}/scripts/git-lock.mjs`,
      'heartbeat',
      '--unit',
      LOCK_UNIT,
      '--parent-pid',
      String(process.pid),
    ],
    // windowsHide 必须带:Windows 下 detached+控制台程序会弹新 cmd 窗口(用户实测"莫名弹窗"根因)
    { detached: true, windowsHide: true, stdio: 'ignore' },
  ).unref()
} catch {
  /* 心跳失败不阻塞 commit(stale 判定仍按"pid 存活"兜底) */
}
process.on('exit', () => {
  try {
    run(`node ${repoRoot}/scripts/git-lock.mjs release --unit ${LOCK_UNIT}`, { allowFail: true })
  } catch {
    /* 忽略释放失败 */
  }
})

log('info', `safe-commit 启动 → 分支: ${C.bold}${currentBranch}${C.reset}`)
log('info', `期望暂存 ${C.cyan}${expectedFiles.length}${C.reset} 个文件`)

/**
 * 把"本次清空了他人的 N 项暂存删除"落成一份可追责的账(票 G-1018292)。
 *
 * 落点选`.workbuddy/` 而非仓根:① `.gitignore:377` 已忽略整个目录(实测 `check-ignore` rc=0),
 * 不会留没人收的 `??`;② 本脚本既有的归因账 `safe-commit-attestation.jsonl` 也在同一目录,
 * 两份留痕同族同生命周期;③ 落盘**失败不得阻断提交** —— 喊人已经在stdout 里发生了,
 * 账写不进去是次级问题,不该把提交变成一次环境故障(与 Step 1 那个 warn 同取向)。
 */
function recordClearedStagedDeletions({ root, lost, selfStaged, kept, branch, headBefore, declaredFiles }) {
  try {
    mkdirSync(join(root, '.workbuddy'), { recursive: true })
    appendFileSync(
      join(root, '.workbuddy', 'staged-delete-intent-ledger.jsonl'),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        event: 'index-purge-cleared-staged-deletions',
        branch,
        headBefore,
        // 三份清单都要留:lost=被摘掉标记的他人删除(归属会话要按它喊人),
        // selfStaged=本票声明面(Step 2 会重新暂存,标记不丢),kept=清空后仍是暂存态的。
        clearedIntentLost: lost,
        selfStagedReadded: selfStaged,
        stillStaged: kept,
        declaredFiles,
        // 明写"本脚本没有代裁":读账的人不该误以为这些删除已被恢复或已提交。
        actionTaken: 'report-only',
        note: '删除意图丢失;reflog/index 不留痕,归属会话需重新 git rm --cached 恢复标记。本脚本不恢复、不删除、不提交。',
      })}\n`,
    )
    return true
  } catch (e) {
    log('warn', `删除意图账写入失败(不阻断提交):${String(e && e.message ? e.message : e).slice(0, 120)}`)
    return false
  }
}

/**
 * git 索引锁争用分诊(2026-09-24 立)。共享工作区里 `.git/index.lock` 常常**瞬时**存在又消失
 * (实测本会话 12:0x 一次:safe-commit 死在 Step 1 的 `git reset HEAD`,再看锁已没了)——
 * 这类失败一次钩子都没跑过,绝不能当成"钩子判红",更不能拿 --no-verify 去"修"它。
 */
const GIT_LOCK_MISS =
  /Unable to create .*index\.lock|Another git process|index\.lock'?: ?File exists|cannot lock ref/i
const isGitLockFailure = (status, out) => status === 128 || GIT_LOCK_MISS.test(out)
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const LOCK_RETRIES = Number(process.env.IHUI_SAFE_COMMIT_LOCK_RETRIES || 10)
function gitStep(args, label) {
  let last = null
  for (let attempt = 1; attempt <= LOCK_RETRIES + 1; attempt++) {
    last = spawnSync('git', args, {
      encoding: 'utf8',
      cwd: repoRoot,
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (last.status === 0) return last
    const out = `${last.stdout || ''}${last.stderr || ''}`
    if (isGitLockFailure(last.status, out) && attempt <= LOCK_RETRIES) {
      log(
        'warn',
        `…${label} 撞 git 索引锁(exit ${last.status},钩子还没轮到),第 ${attempt}/${LOCK_RETRIES} 次重试`,
      )
      sleep(3000)
      continue
    }
    return last
  }
  return last
}

// ─── 1. git reset HEAD (清空整个暂存区) ────────────────────
// G-1018292(2026-10-04):本 Step 的 `git reset HEAD` 会把**整个共享索引**清空,
// 于是"他人已暂存的删除"(`git status --porcelain` 的 `D ` 形态)那枚保护标记
// 一起被摘掉 —— 退化成 ` D` 之后存续自愈那三条判据(工作树缺 ∧ 索引 blob==HEAD blob
// ∧ HEAD 有)全部成立,会把一枚**可能有意的删除**当成外部删除恢复回盘上,而两边账面都绿。
//
// **为什么只能在这里取样**:实测(2026-10-04 临时仓逐条试)`git reflog --all` /
// `git reflog show --name-status HEAD` / `git fsck` 三条路都答不了"这批删除曾否是暂存态"
// —— 索引不是对象库的一部分,`reset HEAD` 不产生任何 reflog 条目,`fsck` 无输出。
// 清空之后**没有任何事后痕迹**可查,所以判据的唯一合法取样窗就是 reset 之前这一瞬。
// 取样面与判据本体都在 scripts/lib/staged-delete-intent.mjs(纯函数,可构造面证明)。
//
// ⚠️ 本段只做**留底 + 判定 + 点名**,绝不代裁:不恢复、不删除、不改工作树,
// 也不动别人那枚删除本身(票面明写"既不支持也不阻止")。判不出时按"未判定"报,
// 不折进"没问题"(见三条不许漂第 1条)。
const intentSnapshot = snapshotStagedDeleteIntent({ root: repoRoot })
if (!intentSnapshot.ok) {
  // 取不到就是取不到。此处**不阻断提交**(那会把一次环境抖动变成全仓提交停摆),
  // 但必须留一行"未判定",不许让"读不到索引面"在账面上读成"没有删除"。
  log(
    'warn',
    '删除意图判据:未判定 —— 清空前索引面取不到,无法判断本次清空是否摘掉了他人暂存删除的标记' +
      '(不阻断本次提交;若确有他人暂存删除,请归属会话重新 stage 后再提交)',
  )
}

log('info', 'Step 1/5: git reset HEAD — 清空暂存区(无论谁 staged 的)')
const resetResult = gitStep(['reset', 'HEAD'], 'git reset HEAD')
if (resetResult.status !== 0) {
  log('err', `git reset HEAD 失败: ${resetResult.stderr}`)
  process.exit(2)
}

// 清空之后**再取一次**索引面:判据必须是"清面前后两次观测"的差,不是单面推断。
// (只用清空前那一次面会恒真 —— 那正是"放宽判据换绿"的同型。)
if (intentSnapshot.ok) {
  const afterFace = readCachedNameStatus({ root: repoRoot })
  const intentVerdict = judgeStagedDeleteIntent({
    before: intentSnapshot.before,
    after: afterFace,
    ownPaths: expectedFiles,
  })
  if (intentVerdict.kind === 'intent-lost') {
    // 只喊人 + 留痕。恢复/删除都不做(恢复别人的删除比留下它更危险)。
    log(
      'err',
      `本次清空了他人的 ${C.red}${intentVerdict.lost.length}${C.reset} 项暂存删除 —— ` +
        `删除意图丢失,已无法从 git 侧复原(reflog/index 均不留痕):`,
    )
    for (const p of intentVerdict.lost) console.log(`     ${C.red}! ${p}${C.reset}(清空前是暂存删除)`)
    log(
      'warn',
      '这些删除**不是本脚本删的**,本脚本也**不会替你恢复或提交**它们(票 G-1018292:只标记与喊人)。' +
        '归属会话请重新 `git rm --cached -- <路径>` 恢复标记,或明确撤销该删除意图。',
    )
    recordClearedStagedDeletions({
      root: repoRoot,
      lost: intentVerdict.lost,
      selfStaged: intentVerdict.selfStaged,
      kept: intentVerdict.kept,
      branch: currentBranch,
      headBefore: run('git rev-parse HEAD', { allowFail: true }) || '',
      declaredFiles: expectedFiles,
    })
  } else if (intentVerdict.kind === 'undetermined') {
    log('warn', `删除意图判据:未判定 —— ${intentVerdict.reason}`)
  } else if (intentVerdict.selfStaged.length > 0) {
    // 反例②那一档:本会话自己声明的删除,清空后由 Step 2 的 add -A 重新暂存,标记会回来。
    // 行为与改前逐字一致,故只在info 行里说明,不红。
    log(
      'info',
      `其中 ${intentVerdict.selfStaged.length} 项暂存删除属本票声明面(将由 Step 2 重新暂存,标记不丢):` +
        `${intentVerdict.selfStaged.slice(0, 5).join(', ')}${intentVerdict.selfStaged.length > 5 ? ' …' : ''}`,
    )
  }
}

// ─── 2. git add -A <用户预期文件>(-A 支持已删除文件) ─────
// 修复(2026-07-22): 原 `git add --` 对已删除文件报错 pathspec did not match。
// `git add -A --` 同时暂存新增/修改/删除三种变更, 第 3 步校验仍保证精确匹配。
log('info', `Step 2/5: git add -A <${expectedFiles.length} files> — 只暂存自己声明的文件(含删除)`)
const addResult = gitStep(['add', '-A', '--', ...expectedFiles], 'git add')
if (addResult.status !== 0) {
  log('err', `git add 失败: ${addResult.stderr}`)
  log('warn', '可能原因: 路径错误/仓库锁定/权限问题')
  process.exit(1)
}

// ─── 3. 校验 staged 内容是否 == 预期 ───────────────────────
log('info', 'Step 3/5: 校验 staged 内容与预期一致')
// D171:清单走 lib 的 -z 形态(NUL 分帧、不经 core.quotePath 转写),声明侧与 git 侧
// 比的都是真路径;比对严格度不变 —— 意外文件照旧中止,缺失文件照旧中止。
const stagedFiles = gitStagedPaths({ root: repoRoot })

// 规范化:统一正斜杠(Windows 路径兼容)
const normalize = (f) => f.replace(/\\/g, '/').replace(/^\.\//, '')
const stagedNorm = new Set(stagedFiles.map(normalize))
const expectedNorm = new Set(expectedFiles.map(normalize))

// 3a. 意外文件(其他 agent 留下的)
const unexpected = [...stagedNorm].filter((f) => !expectedNorm.has(f))
if (unexpected.length > 0) {
  log('err', `暂存区出现 ${C.red}${unexpected.length}${C.reset} 个非预期文件(其他 agent 残留?):`)
  for (const f of unexpected) console.log(`     ${C.red}+ ${f}${C.reset}`)
  log('err', `为安全起见,中止 commit(不悄悄剥离意外文件,人工确认后再操作)`)
  log('warn', `修复建议: git reset HEAD 然后 git add <你自己的文件>`)
  process.exit(1)
}

// 3b. 缺失文件(用户预期但未 staged)
const missing = [...expectedNorm].filter((f) => !stagedNorm.has(f))
if (missing.length > 0) {
  log('err', `${C.red}${missing.length}${C.reset} 个预期文件未暂存(可能路径错误或文件不存在):`)
  for (const f of missing) console.log(`     ${C.red}- ${f}${C.reset}`)
  log('warn', `检查: git status ${missing[0]} 确认文件状态`)
  process.exit(1)
}

// 3c. Agent scope 校验(可选,环境变量 AGENT_SCOPE 限定)
const agentScope = process.env.AGENT_SCOPE
if (agentScope) {
  const scopeDirs = agentScope
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/\\/g, '/').replace(/\/$/, ''))
    .filter(Boolean)
  const outOfScope = stagedFiles.filter((f) => {
    const fn = normalize(f)
    return !scopeDirs.some((scope) => fn.startsWith(scope + '/') || fn === scope)
  })
  if (outOfScope.length > 0) {
    log(
      'err',
      `${C.red}${outOfScope.length}${C.reset} 个文件超出本 agent 范围 ${C.yellow}{${agentScope}}${C.reset}:`,
    )
    for (const f of outOfScope) console.log(`     ${C.red}× ${f}${C.reset}`)
    log(
      'warn',
      `如需跨域 commit,设置 AGENT_SCOPE_OVERRIDE=1 或在 commit message 显式标注 [cross-domain]`,
    )
    if (process.env.AGENT_SCOPE_OVERRIDE !== '1' && !message.includes('[cross-domain]')) {
      process.exit(1)
    }
    log(
      'warn',
      `已用 ${message.includes('[cross-domain]') ? 'message 标注' : 'AGENT_SCOPE_OVERRIDE'} 跨域豁免`,
    )
  }
}

log('ok', `暂存区精确匹配预期 ${C.cyan}${stagedFiles.length}${C.reset} 个文件`)

// 3e. 活文档"工作树 ⊇ HEAD"行级对账 —— 把 AGENTS §12 从"人肉记得跑"变成机制
// (2026-09-24 立)。背景:`README.md` / `AGENTS.md` / `PROJECT_PLAN.md` 是多会话共写的文档,
// 工作树副本**常年滞后于 HEAD**(实测一日三次自伤,分别少 57 / 48 / 54 行)。而本脚本 Step 4
// 用的是 `git commit -- <pathspec>` —— 按**路径**取工作树版本,所以"只 add 本任务文件"的
// 规范提交照样会把别人已入库的行整批写回旧态,且 `git status`、diff 行数、typecheck 全看不出来。
// 规则本来就写着"提交前先跑 merge-live-doc",但它只存在于文档里 ⇒ 谁忘了都成立,
// 而忘了的代价是**别人的内容消失**。这里改成:声明了活文档就必须先过对账,不过即拒提交。
const LIVE_DOCS = ['README.md', 'AGENTS.md', 'PROJECT_PLAN.md']
const liveDocsStaged = expectedFiles
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => LIVE_DOCS.includes(f))
if (liveDocsStaged.length && process.env.IHUI_SKIP_LIVE_DOC_CHECK !== '1') {
  for (const f of liveDocsStaged) {
    const r = spawnSync(
      process.execPath,
      [join(ROOT, 'scripts', 'merge-live-doc.mjs'), '--file', f],
      { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'] },
    )
    if (r.status === 0) {
      log('info', `活文档对账通过:${C.cyan}${f}${C.reset} 工作树 ⊇ HEAD`)
      continue
    }
    if (r.status === 2) {
      log(
        'warn',
        `活文档对账取不到版本(不阻断):${f} — ${String(r.stderr || r.stdout)
          .trim()
          .slice(0, 120)}`,
      )
      continue
    }
    log(
      'err',
      `活文档对账判红:${C.cyan}${f}${C.reset} 的工作树副本**吃掉 HEAD 已入库的行**。\n` +
        `   若照此提交,会把别人已入库的内容整批写回旧态(git status 与 diff 都看不出来)。\n` +
        `   修法:${C.cyan}node scripts/merge-live-doc.mjs --file ${f} --apply${C.reset} 后重新提交;\n` +
        `   归并后必须看到"lost = 0 且长行重复新增 = 0"。确属有意重写整份文档时:${C.cyan}IHUI_SKIP_LIVE_DOC_CHECK=1${C.reset}(会在报告里留痕)。`,
    )
    process.exit(1)
  }
} else if (liveDocsStaged.length) {
  log('warn', `已跳过活文档对账(IHUI_SKIP_LIVE_DOC_CHECK=1)—— 本枚提交可能把别人的行写回旧态`)
}

// ─── 3f. 活文档新增行的 sha 取值(G-1079146 剩余半格,2026-10-08)─────────────
// 票面原话:「优先做的不是新门,是掐住成因 —— 给 live-doc-edit.mjs / **safe-commit.mjs** 的活文档
// 写入路径加一步"现读取值":新行含 sha 形态串且 `git rev-parse --verify <tok>^{commit}` 不通过
// ⇒ 打印该提交的全量 40 位并**拒绝落该行**;不需要存量清单、也不造恒红面。」
// live-doc-edit 那一半已在 `a1764c9c5` 落地;本步是 safe-commit 这一半。
//
// **为什么 safe-commit 有落点(它不重写内容,只是把磁盘副本交上去)**:
//   实测(2026-10-08 临时 git 仓,先 stage `lineINDEX` 再把磁盘改成 `lineWORKTREE`,然后
//   `git commit -- PROJECT_PLAN.md`):落库的是 `lineWORKTREE` ⇒ `git commit -- <pathspec>` 取的是
//   **工作树**版本,而 Step 2 的 `git add -A -- <声明文件>` 刚把工作树字节灌进索引 ⇒ 在 Step 3
//   这一刻"暂存内容 == 磁盘副本"。所以本器确实不产出行,但它是**整条"按 pathspec 交磁盘副本"
//   通道的入口** —— AGENTS §12 记的一夜三次自伤走的正是这条路,而 live-doc-edit 那一步只管得住
//   "经它落地"的写入。不接这一格,结论就是"绕过 live-doc-edit 直接改磁盘 + safe-commit 提交 =
//   零看守",那正好把票面要掐的成因留在原处。可判对象 = 暂存内容与 HEAD 的行差集里、
//   **HEAD 侧原本没有的那批新增行**(所以存量 sha 不会被回判,默认档不产生恒红面)。
//
// 三条与 live-doc-edit 侧同形的语义(不得漂):
//  ① 判据**只有那一份**:抽取/形状/三条放过/探测三态/报告措辞全部 import `./live-doc-edit.mjs`
//     已导出的出口;行差集与行多重集 import `./lib/stale-content-analysis.mjs` 的
//     `lineDeltaMaps / tallyLines`(门 84 与 object-space-land 用的就是这两个)。本器内不出现
//     第二条 hex 正则、不自己 split 做差 —— 由镜像测试的源码锁钉住(§22c)。
//  ② **git 问不到 ⇒ 未判定 ⇒ 放行**并点名原因。把"没判成"折成"这就是坏",产出的是一台恒挡的
//     尺子,而它挡的是**全队提交**(§12e:恒挡的唯一出路是绕回裸 `git commit` 跳门,连带
//     该枚提交上全部守门作废)。未判定的成因四种:两面正文任一取不到 / 行差集算不出 /
//     探测器 pre-flight 不过 / 本次行差集大到"整档扫描会挂死"那一级(见下面的实测)。
//  ③ 应急出口只有 `LIVE_SHA_ALLOW=<token>=<原因>` —— 与 live-doc-edit **同一个 env、同一个
//     `parseShaAllow`**:无原因不收录,每条收录都打印留痕。本步不新增开关,也**不**被
//     `IHUI_SKIP_LIVE_DOC_CHECK` 放行 —— 那是 3e 那条"整份文档有意重写"的出路,与"新行里的
//     出处指针兑现不了"是两笔不同形态的债,一道闸不该替另一道闸作主。
//
// 一条刻意与 live-doc-edit 不同的口径(如实登记,别读成"两处漏了一处"):
//   本步的"携带存量"只认 ①同一行文本在 HEAD 里已存在(重复登记副本)②本次**消失行**里已有的
//   token(改写携带),**不扫全文**。原因不是省事而是实测:把 4,134,660 B 的整份 HEAD 当"一行"
//   喂进抽取式,一次调用 **284,198ms**(权威门 `extractFromLine` 的 `lineText` 字段按
//   `[...line.trim()]` 展开整行,每命中一次全展开一遍 ⇒ 代价 = 命中数 × 行长,平方级)。
//   扫全文会把一次提交变成 5 分钟挂死;按行喂则同一函数是 0–1ms 量级(200KB 单行 1ms 实测)。
//   因此"整档行数超闸"这一格也一律落**未判定 ⇒ 放行**,不冒红也不静默通过。
//   闸值是常量,**不是开关** —— 本步不给"关掉这一步"留任何 env 出口(git 问不到时它自己就放行,
//   而那已经是唯一需要的那一档;能调小的旋钮等于能关掉的旋钮)。
const SHA_INTAKE_LINE_CAP = 5000

/**
 * 从"暂存面 ⊖ HEAD 面"的行差集里挑出**本次真的新写的行**,并给每行带上"存量 token 携带集"。
 * 纯取材 + 纯差集,不派生 git 探测(探测归调用方),这样每一条 unjudged 的成因都能被点名。
 * @returns {Array<{file:string, entries:Array, undetermined:string[], carried:number}>}
 */
function liveDocIntakePlan({ root, files }) {
  const out = []
  for (const f of files) {
    const rec = { file: f, entries: [], undetermined: [], carried: 0 }
    out.push(rec)
    let staged = null
    let head = null
    try {
      staged = gitRaw(['show', `:${f}`], root)
    } catch (e) {
      rec.undetermined.push(
        `${f}:暂存面正文取不到(该路径未入索引 / 已暂存删除 / git 不可问)⇒ 本步不判(${String(
          e?.message ?? e,
        ).slice(0, 160)})`,
      )
      continue
    }
    try {
      head = gitRaw(['show', `HEAD:${f}`], root)
    } catch (e) {
      // 首次入库(HEAD 里没有这份文档)与"仓库不可问"在文本上同形,而按形状判据去分辨就是
      // 把结论建立在错误消息字符串上(本仓明令禁止)⇒ 两种都落未判定,不许折成"全是新增"。
      rec.undetermined.push(
        `${f}:HEAD 面正文取不到(文档首次入库,或仓库/git 不可问)⇒ 本步不判(${String(
          e?.message ?? e,
        ).slice(0, 160)})`,
      )
      continue
    }
    const delta = lineDeltaMaps(head, staged)
    if (!delta) {
      rec.undetermined.push(`${f}:行差集算不出(两侧正文有一侧不是字符串)⇒ 本步不判`)
      continue
    }
    const lines = delta.added.size + delta.removed.size
    if (lines > SHA_INTAKE_LINE_CAP) {
      rec.undetermined.push(
        `${f}:本次行差集 ${lines} 行 > 闸 ${SHA_INTAKE_LINE_CAP} ⇒ 本步不判(整档逐行扫描会把一次提交拖成分钟级挂死;` +
          `这一格是未判定,不是"确认没有坏指针")`,
      )
      continue
    }
    // ① 改写携带:before 侧消失的行里本来就有这些 token ⇒ 本次只是把整行改写法,不是新写指针。
    //    走 live-doc-edit 导出的那一份 `rewriteEntryOf`(不在此重抄"什么算候选")。
    const skip = new Set()
    for (const gone of delta.removed.keys())
      for (const tok of rewriteEntryOf(gone, '').skip) skip.add(tok)
    // ② 重复副本:同一行文本在 HEAD 里本来就存在 ⇒ 与 live-doc-edit 的 carriedOver 同义,不回判。
    const headTally = tallyLines(head)
    for (const [line, count] of delta.added) {
      if ((headTally.get(line) ?? 0) > 0) {
        rec.carried += count
        continue
      }
      // 逐行判 ⇒ 每次 `extractFromLine` 只吃一行(实测短行 0–1ms);entries 与文件一一对应,
      // 报告才能点名是哪个文档。
      for (let i = 0; i < count; i++) rec.entries.push({ text: line, skip })
    }
  }
  return out
}

if (liveDocsStaged.length) {
  const shaProbe = makeShaProber({ root: repoRoot })
  const shaAllow = parseShaAllow(process.env.LIVE_SHA_ALLOW)
  for (const rec of liveDocIntakePlan({ root: repoRoot, files: liveDocsStaged })) {
    for (const w of rec.undetermined)
      log('warn', `取值未判定 ⇒ **放行**:${w}(判不出 ≠ 坏;这一步挡的是全队提交)`)
    if (rec.carried > 0)
      log(
        'info',
        `取值:${rec.file} 有 ${rec.carried} 行是 HEAD 里已存在的同一行文本 ⇒ 按重复副本处理,不回判`,
      )
    if (rec.entries.length === 0) continue
    const v = judgeNewLineShas(rec.entries, { probe: shaProbe, allow: shaAllow })
    for (const l of shaGateReport(v))
      log(l.kind === 'error' ? 'err' : l.kind === 'warn' ? 'warn' : 'info', l.text)
    if (v.blocked.length === 0) continue
    log(
      'err',
      `活文档取值判红来自:${C.cyan}${rec.file}${C.reset}(本步只吃"暂存面 ⊖ HEAD 面"的新增行,存量不回判)。`,
    )
    log(
      'err',
      `拒绝提交本票声明的 ${C.cyan}${expectedFiles.length}${C.reset} 个文件(G-1079146:登记这一刻问才不会留腐烂)。\n` +
        `   出口只有三条:① 该对象在本机确能解析 ⇒ 写**全量 40 位**;② 换内容锚点(编号 + 标题原文);` +
        `③ 确非 commit(设备号 / contenthash / ref 名片段 / 外部仓 revision)⇒ ` +
        `${C.cyan}LIVE_SHA_ALLOW=<token>=<一句话原因>${C.reset} 重跑(逐 token、必须带原因、会打留痕)。`,
    )
    log(
      'err',
      `   **禁止**从同段挑一枚"看起来对的 sha"自动补进去(§1 / G-191:那是编造,不是找回);` +
        `也**禁止**用 ${C.cyan}IHUI_SKIP_LIVE_DOC_CHECK=1${C.reset} 绕本步 —— 那一道闸管的是 3e 的整文档对账,不是这一型。`,
    )
    process.exit(1)
  }
}

// 3d. commit message 加 agent 标识前缀(若未指定)
let finalMessage = message
if (process.env.AGENT_NAME && !message.match(/^\[[\w-]+\]/)) {
  finalMessage = `[${process.env.AGENT_NAME}] ${message}`
  log('info', `自动加 agent 标识前缀 → ${C.cyan}${finalMessage.split('\n')[0]}${C.reset}`)
}

if (dryRun) {
  log('ok', `dry-run 通过,实际不会 commit`)
  process.exit(0)
}

// ─── 4. git commit -- <pathspec>(两阶段重试,与 git-push-guard 逻辑一致) ──
// 设计: 首次**不跳过** pre-commit hook, 让 22 项质量守门(API key/i18n/schema
// drift/lint-staged/check-staged-files 等)正常运行; 失败后再用 --no-verify 重试,
// 保证多 agent 并行时其他 agent 的 typecheck/lint 错误不阻塞本任务 commit。
// 修复前: 一律 --no-verify 跳过, 等于把质量守门全关(与"多层防线"设计矛盾)。
log('info', 'Step 4/5: git commit -- <pathspec> — 首次尝试(含 pre-commit hook)')
// 并发基线(2026-09-16 修):记录 commit 前的 HEAD,供 Step 5 精确定位"本次创建的提交"。
// 原 Step 5 直接校验 `git show HEAD`,多 agent 并行时若其他 agent 在本脚本 commit 落地后、
// Step 5 执行前抢先提交,HEAD 即前移 → 误判"污染事故"并误导 agent 执行 git reset HEAD~1
// (会破坏他人提交)。改为基于 beforeSha..HEAD 区间定位本次提交后再校验。
const beforeSha = (run('git rev-parse HEAD', { allowFail: true }) || '').trim()

/**
 * 首次失败**必须分诊**,否则一次环境抖动就会被升级成"109 道门全跳"。
 * 实测事故(2026-09-24):`git commit` 因并发 `.git/index.lock` 争用直接 exit 128 —— 钩子一次没跑,
 * 而旧流程把它与"pre-commit 判红"同形对待,立刻 `--no-verify` 重试并成功,交付看起来干净,
 * 实际所有质量门都被跳过且无人知晓。判据:lock 类失败重试;真·钩子失败才允许应急跳过。
 */
const commitArgs = (skipHooks) => [
  'commit',
  ...(skipHooks ? ['--no-verify'] : []),
  '-m',
  finalMessage,
  '--',
  ...expectedFiles,
]
const pump = (r) => {
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return `${r.stdout || ''}${r.stderr || ''}`
}

let commitResult = null
let hookFailed = false
let hookOutput = ''
for (let attempt = 1; attempt <= LOCK_RETRIES + 1; attempt++) {
  const r = spawnSync('git', commitArgs(false), {
    encoding: 'utf8',
    cwd: repoRoot,
    // G-978004 ②:把本枚声明的提交面传给钩子链(整链继承)。pre-commit-hook 写进
    // rounds.jsonl 的 declaredFiles,让统计器能按"声明集 == 落地面"发强证;
    // 普通直 git commit 不带此 env ⇒ 维持 ⊆ 弱证,失效方向是少发强证不是发假证。
    env: { ...process.env, IHUI_DECLARED_FILES: expectedFiles.join('\n') },
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = pump(r)
  hookOutput += out
  commitResult = r
  if (r.status === 0) break
  if (isGitLockFailure(r.status, out)) {
    if (attempt > LOCK_RETRIES) {
      log(
        'err',
        `git 索引锁连续 ${LOCK_RETRIES} 次争用未释放 —— 这**不是**钩子判红,拒绝用 --no-verify 兜底` +
          '(那等于把全部守门一起跳掉,且事后无人能察觉)。等并发 git 写操作结束后重跑本命令;' +
          '先看是谁持锁:node scripts/git-lock.mjs check',
      )
      process.exit(1)
    }
    log(
      'warn',
      `…exit ${r.status} 像是 git 锁争用(钩子未跑完),第 ${attempt}/${LOCK_RETRIES} 次重试`,
    )
    sleep(3000)
    continue
  }
  hookFailed = true
  if (r.status === 129) {
    // exit 129 = git 用法错误 ⇒ 是**我们拼出的命令**坏了,不是别人代码没过门。
    // 绝不能走 --no-verify 兜底:那会把工具自身的 bug 洗成"门跳过了但提交成功了"。
    log(
      'err',
      `git exit 129(用法错误)= safe-commit 自身参数拼错,拒绝 --no-verify 兜底;请修命令构造`,
    )
    process.exit(1)
  }
  break
}

let hookSkipped = false
if (hookFailed && commitResult.status !== 0) {
  // ── 归因(2026-09-25 立,替代旧的一句"按用户规则…因其他 agent 代码")────────────────
  // 旧流程把三种不相干成因压成同一条措辞并一律 --no-verify:①我的内容真红 ②他人内容红
  // ③门判的是机器/远端态。实测 134 道门跑完只有 check-push-sync(远端态)红,输出仍写
  // "因其他 agent 代码" —— 归因从未被计算过。现在:把红的门逐道**复跑**,用它们自己这次的
  // 输出比对本次声明的文件集。点名我 ⇒ 拒绝跳门;一个都没点名 ⇒ 才允许跳,且只说量到的话。
  // 实测(2026-09-25):pre-commit 常把守门汇总**只**写进 .workbuddy/hook-logs/pre-commit.log,
  // stdout 停在半路 —— 没有这第二输入源,归因在真仓里的命中率是 0(每次都说"未归因")。
  // 只喂尾部 256KB:整份日志是多轮追加的,全量读既慢又会把别人的轮子卷进来。
  // 归档也要读:日志现在由 git-guardian 按保留期回收(`.log` → `.log.1`),上一轮可能正好落在
  // 归档里 ⇒ 只看活动文件会把"量到的归因"退化成"未归因"。按时间序拼(.1 在前),两份都只取尾部。
  let hookLogTail = ''
  for (const suffix of ['.1', '']) {
    try {
      const logPath = join(repoRoot, '.workbuddy', 'hook-logs', `pre-commit.log${suffix}`)
      const size = statSync(logPath).size
      const len = Math.min(size, 256 * 1024)
      const fd = openSync(logPath, 'r')
      let chunk = ''
      try {
        const buf = Buffer.alloc(len)
        readSync(fd, buf, 0, len, size - len)
        chunk = buf.toString('utf8')
      } finally {
        closeSync(fd)
      }
      hookLogTail = chunk + hookLogTail
    } catch {
      // 缺哪一份都不算失败(活动文件在、归档不在是常态),但也**不静默说成读到了**。
    }
  }
  const runGate = (script) => {
    const g = spawnSync(process.execPath, [join(repoRoot, 'scripts', script), '--staged'], {
      encoding: 'utf8',
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 32 << 20,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: g.status ?? 1, output: `${g.stdout || ''}${g.stderr || ''}` }
  }
  /**
   * **基线面(本次提交之前的 HEAD)**的同一道门读数 —— 差分四态的取证出口(2026-09-27 立)。
   *
   * 为什么必须有它:很多门的失败行**只点名符号、不点名文件**(实测门 55 打
   * `[tool-name-coverage] ❌ 覆盖率 86/87` + `未映射工具名(1):generate_report`),
   * 于是"因本次改动而红"与"HEAD 上早就红"在归因层手里长得一模一样,而旧措辞写的是
   * 「红不在本次提交内容里」—— 把"我没看见路径"写成了"它不是我的"。
   * 留痕 ts=2026-09-27T09:05:40Z 那枚自引入的红就是这样放行的(27 分钟后由 fa9e4e64d 补)。
   *
   * 载体取 `git worktree add --detach <scratch>/head <beforeSha>`:
   * ① 文件内容 = 提交前的 HEAD ⇒ 磁盘型门读到的也是 HEAD(私有索引 GIT_INDEX_FILE 那一路做不到,
   *    它只改索引面、磁盘仍是我的在途内容,会把"按磁盘判"的门喂成假存量档);
   * ② 自带 `.git` 与自己的索引 ⇒ `--staged` 档天然等于 HEAD 面;
   * ③ 全程不 checkout、不动共享工作树与主索引(§12d)。
   * 代价与边界如实登记:隔离树**没有 node_modules**,故凡 spawn pnpm/tsc/eslint 的门在这里跑不通
   * —— 那正是第④态(未差分)该管的情形,`baselineUsable()` 会按退出码 2 / Cannot find module /
   * 超时把它判成"跑不出去",**绝不**伪装成"HEAD 面亦红"。
   * 惰性创建、整轮至多一次、用完立刻 remove + prune(挂在这台机的 `.git` 存续治理上,不能留)。
   */
  let baselineTree = null
  let baselineWhy = null
  const disposeBaselineTree = () => {
    if (!baselineTree) return
    const { dir, scratch } = baselineTree
    gitStep(['worktree', 'remove', '--force', dir], 'git worktree remove(基线面)')
    gitStep(['worktree', 'prune'], 'git worktree prune(基线面)')
    try {
      rmScratch(scratch)
    } catch {
      /* 残留由 §26 的每日 Temp 体检兜;不因此改判据 */
    }
    baselineTree = null
  }
  const ensureBaselineTree = () => {
    if (baselineTree) return baselineTree
    if (baselineWhy) return null
    const timeoutMs = Number(process.env.IHUI_SAFE_COMMIT_BASELINE_TIMEOUT_MS || 600000)
    let scratch = null
    try {
      scratch = mkScratch('gate-baseline-')
    } catch (e) {
      baselineWhy = `临时落点不可用:${e?.message ?? e}`
      return null
    }
    const dir = join(scratch, 'head')
    // 三条硬约束:绝对路径 node 不需要(这是 git 写操作)、windowsHide(守门 52)、数字 timeout(守门 80)
    const a = spawnSync('git', ['worktree', 'add', '--detach', dir, beforeSha], {
      encoding: 'utf8',
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
      timeout: timeoutMs,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (a.error || a.status !== 0) {
      baselineWhy = `建基线工作树失败:${a.error?.code || a.error?.message || (a.stderr || a.stdout || '').slice(0, 200) || `exit ${a.status}`}`
      try {
        if (scratch) rmScratch(scratch)
      } catch {
        /* 建都建不起来,清理再失败只是噪音 */
      }
      return null
    }
    baselineTree = { dir, scratch }
    process.on('exit', disposeBaselineTree)
    return baselineTree
  }
  const runGateBaseline = (script) => {
    const tree = ensureBaselineTree()
    if (!tree)
      return { ran: false, status: null, output: '', why: baselineWhy || '基线面工作树不可用' }
    const gatePath = join(tree.dir, 'scripts', script)
    if (!existsSync(gatePath))
      return { ran: false, status: null, output: '', why: `基线面里没有该门脚本:${script}` }
    const timeoutMs = Number(process.env.IHUI_SAFE_COMMIT_BASELINE_TIMEOUT_MS || 600000)
    const g = spawnSync(process.execPath, [gatePath, '--staged'], {
      encoding: 'utf8',
      cwd: tree.dir,
      // 必须剥掉 GIT_INDEX_FILE:§12d 的旁路提交会把它指到临时索引上,继承进子进程就等于
      // "基线面"读的其实是本票的暂存内容 —— 那会把自引入的红读成"HEAD 也红",差分整个失效。
      env: (() => {
        const e = { ...process.env }
        delete e.GIT_INDEX_FILE
        return e
      })(),
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 32 << 20,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (g.error)
      return {
        ran: false,
        status: null,
        output: '',
        why: `基线面派生失败 ${g.error.code || g.error.message}`,
      }
    if (g.status === null)
      return { ran: false, status: null, output: '', why: `基线面被中断或超时(${timeoutMs}ms)` }
    return { ran: true, status: g.status ?? 1, output: `${g.stdout || ''}${g.stderr || ''}`, why: null }
  }
  /**
   * 共享索引 / 工作树里"别人挂着的东西"(2026-09-27,G-268 的两面翻版)。
   * 判"红是不是本枚引入"时,这一步是必须的:本仓的提交一律带 pathspec(只交 expectedFiles),
   * 而 71/84 这类门按**索引**判、49/85/26 这类门按**工作树**判 —— 索引里常年挂着并发会话 staged
   * 的活文档,根目录与目录树里也常年躺着别人未跟踪的在飞文件。它们结构上都进不了本枚提交,
   * 却会让"我的面"红、基线面(HEAD 的隔离检出)绿,差分于是把别人的现场定责给提交者。
   * 唯一"修法"是去改/删别人的东西,那是 §12 明令的事故,所以这里把它显式交给归因层判"未判定"。
   * ⚠ 未跟踪清单**必须**排除 .gitignore 命中的项(`--exclude-standard`):否则 node_modules、
   *   构建产物、别人刻意留在忽略路径里的东西会被当成"现场",把这一档撑成常态 —— 那等于
   *   给"任何未跟踪文件引发的红"开了免责通道,是与"多放一次跳门"同罪的放宽。
   *
   * ── 第三路:工作树面(2026-10-03,票 G-1018220)────────────────────────────────
   * 改前只有上面两路,而门 47(`check-watermark-coverage.mjs`)判红的恰是**第三路**:
   * 它的分母 = `git ls-files`(跟踪面全集)∩ 工作树**磁盘字节**(横幅在不在文件里),
   * **它不读 `git diff --cached`** —— 暂存与否对它判红毫无影响。
   * 于是"别人已跟踪、已改、**还没 staged**"(并发会话最常见的中途态)两路都看不见,
   * 态①c 的"他人现场"永不触发 ⇒ 落进差分档 ⇒ 基线面读 HEAD 旧字节必然绿
   * ⇒ 差分把别人那半截判成本枚引入 ⇒ `mine` ⇒ 拒绝 `--no-verify`。
   * 实测死锁:私有索引下只提交一个零风险常量探针,门 47 却因
   * `packages/types/src/agent-control.ts`(别人的未暂存重写冲掉了水印)exit 1,
   * 归因层判 `mine` 且措辞写"差分证明这枚提交引入了红"。本仓提交带 pathspec,
   * 那个路径进不了本次内容 —— 出口只剩"去改别人的文件",那是 §12 事故。
   * ⚠ 这一路**不是**把门 47 的判据放宽成"只看本次声明的文件":门 47 照旧按整张
   *   跟踪面判红、照旧自愈并 `git add`(它的价值就在那儿)。这里补的是**归因层
   *   自己那份"这一格归谁"清单的取材面**,让两者的判据面终于对得上。
   */
  // D171:三份清单同样走 -z 出口(各面上的中文路径不得被 quotePath 转写变形)。
  const stagedNow = gitStagedPaths({ root: repoRoot })
  const untrackedNow = gitUntrackedPaths({ root: repoRoot })
  // 索引已含本票声明的文件,而工作树面是"索引 vs 盘上",故这一路天然可能含本票自己的路径
  // (门 47 自愈会往盘上写横幅再 git add,时序上工作树面可能先于索引面被读到)——
  // 扣减一律按 expectedFiles,与另两路同一条判据。
  const worktreeNow = gitWorktreePaths({ root: repoRoot })
  const foreignStaged = [...new Set([...stagedNow, ...untrackedNow, ...worktreeNow])].filter(
    (p) => !expectedFiles.includes(p),
  )
  if (foreignStaged.length > 0)
    log(
      'info',
      `索引/工作树里另有 ${foreignStaged.length} 个非本票项(其中索引 ${stagedNow.filter((p) => !expectedFiles.includes(p)).length}、未跟踪 ${untrackedNow.filter((p) => !expectedFiles.includes(p)).length}、已跟踪未暂存 ${worktreeNow.filter((p) => !expectedFiles.includes(p)).length};例:${foreignStaged.slice(0, 6).join(', ')}${foreignStaged.length > 6 ? ' …' : ''}) —— 不随本枚提交走:commit 带 pathspec,只交上面声明的清单,故不中止(第一版在此中止反而自锁:并发会话随时可能 staged 东西,而它本来也进不来)`,
    )
  const verdict0 = classifyHookFailure({
    text: hookOutput,
    fallbackText: hookLogTail,
    stagedFiles: expectedFiles,
    runGate,
    runGateBaseline,
    foreignStaged,
    // G-815912:判「远端态」的门(check-push-sync 等)在门源里自声明 [judges-remote-state],
    // 归因层读这份源码把它们的失败判「未差分」—— 红是同步态读数,不归责提交内容。
    // 读的是本仓 scripts/ 面(标记跟着门源走);读不到 = 无标记 = 旧口径,不造第二份清单。
    readGateSource: (script) => {
      try {
        return readFileSync(join(repoRoot, 'scripts', script), 'utf8')
      } catch {
        return ''
      }
    },
  })
  /**
   * 批没跑完 ⇒ 由本脚本自己把守门批跑一遍取证(2026-09-26 立)。
   * 实测缺陷:`scripts/lib/pre-commit-hook.js` 里 lint-staged 跑在 `guardian-runner --staged`
   * **之前**,于是一次 lint/prettier 失败 = 整批门一道都没跑 = 归因永远 unattributed =
   * 照样 --no-verify 落地,而账面读起来像"跑过了、只是与本次无关"。
   * 判"该不该跑"由 needsBatchSelfRun 决定(纯函数,镜像测试用构造输入钉死);
   * 本闭包只是**非纯的那一半**,被 decideWithSelfRunBatch 在判真后才调用。
   * ⚠️ 点名"红在批之前的哪一步"只喂 **hookOutput**(本轮 git commit 自己的 stdout+stderr),
   * 不喂 hookLogTail —— 那份日志是多轮追加的,拿它找到的 ❌ 行可能是**别人那一轮**的,
   * 而"借别人那轮的证据"正是本模块立项时要杀掉的形态(见 pickLastSummaryRun 的轮次绑定)。
   * 需要应急提速就调小 IHUI_SAFE_COMMIT_BATCH_TIMEOUT_MS(极小值 ⇒ 自跑判"未成功",
   * 结论照旧落 unattributed 并**带着原因**入库),而不是加一个静默开关。
   */
  const runBatchSelf = () => {
    const runnerPath = join(repoRoot, 'scripts', 'guardian-runner.mjs')
    if (!existsSync(runnerPath))
      return { ran: false, status: null, output: '', why: `runner 不在位:${runnerPath}` }
    const timeoutMs = Number(process.env.IHUI_SAFE_COMMIT_BATCH_TIMEOUT_MS || 900000)
    // 三条硬约束:绝对路径 node(process.execPath)+ windowsHide(守门 52)+ 数字 timeout(守门 80);
    // 不用 shell:true —— 一旦走 shell,cmd.exe 会为每条子命令拉起可见窗口(§5b 弹窗事故同型)。
    const b = spawnSync(process.execPath, [runnerPath, '--staged'], {
      encoding: 'utf8',
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = `${b.stdout || ''}${b.stderr || ''}`
    if (b.error)
      return {
        ran: false,
        status: b.status ?? null,
        output: out,
        why: `派生失败 ${b.error.code || b.error.message}`,
      }
    if (b.status === null)
      return { ran: false, status: null, output: out, why: `被中断或超时(${timeoutMs}ms)` }
    return { ran: true, status: b.status, output: out, why: null }
  }
  if (needsBatchSelfRun(verdict0))
    log(
      'warn',
      '归因层手里没有门级结论 ⇒ safe-commit 自跑 `node scripts/guardian-runner.mjs --staged` 取证(可能数分钟)',
    )
  const verdict = decideWithSelfRunBatch({
    verdict: verdict0,
    stagedFiles: expectedFiles,
    runBatch: runBatchSelf,
    runGate,
    runGateBaseline,
    hookText: hookOutput,
    foreignStaged,
  })
  // 差分取证已经结束 ⇒ 立刻回收隔离工作树(它挂在 `.git/worktrees` 下,这台机的 .git 存续
  // 治理等不起一个长期挂着的 worktree 登记);mine 分支随后 process.exit 也有 process.on('exit') 兜底。
  disposeBaselineTree()
  log('warn', `首次 commit 失败(exit ${commitResult.status})—— 开始逐道复跑失败门以计算归因`)
  for (const line of verdict.detail) log('info', `  · ${line}`)
  log(verdict.kind === 'mine' ? 'err' : 'info', verdictLine(verdict))
  /**
   * 态⑤ env-blocked 必须**响亮地单独喊一次**(G-1058649):它是"这一步自己没跑完"的环境性失败,
   * 既不是提交人的红、也不得写成"因他人代码"(本仓禁止未量到的归因)。
   * 之所以不能只靠上面那一行:上一版把这种环境失败判成 mine 并禁止跳门,而"禁止跳门"关掉的
   * 正是唯一合法出口 —— 那才是逼人绕过全部守门人的成因。这里给可执行的下一步,并在下面留痕。
   */
  if (verdict.kind === 'env-blocked') {
    log(
      'err',
      `🚧 阻塞提交的那一步「${verdict.envStep}」自己没跑完 —— **环境性失败,不是你的红,也不是别人的红**`,
    )
    log(
      'err',
      `   指纹:${(verdict.envFingerprint ?? []).join(' ⏎ ')|| '(未取到指纹行)'}`,
    )
    log(
      'err',
      '   下一步:① tasklist | findstr /i "git node" 看并发 git/node 进程后重跑本命令;' +
        '② 原样手工复跑那一步(EBUSY 是间歇病);③ 仍红则加 --debug 看那一步自己的 git 调用。' +
        '本枚按应急路径落地并留痕(kind=env-blocked),不得读成"通过了守门"。',
    )
    if (verdict.downgradedFromMine)
      log(
        'err',
        '   ⚠️ 判据纠偏说明:这一格**原先会被判 mine**(阻塞步骤的报错正文里出现过本任务文件路径),' +
          '现按 env-blocked 处理 —— 依据是命中行**未带内容错形状**(旧判据把 lint-staged 那句 git 步骤失败' +
          '自带的裸 failed/✖ 当成了"有内容错")。这不是拆防线:若真有 eslint/tsc/prettier 的内容错点名本任务文件,mine 照旧判死。',
      )
  }

  mkdirSync(join(repoRoot, '.workbuddy'), { recursive: true })
  appendFileSync(
    join(repoRoot, '.workbuddy', 'safe-commit-attestation.jsonl'),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      kind: verdict.kind,
      ranFullBatch: verdict.ranFullBatch,
      reason: verdict.reason,
      failedGates: verdict.failed.map((f) => f.id),
      declaredFiles: expectedFiles,
      headBefore: beforeSha,
      // 三条新字段并入**既有记录**(不另立落盘文件,避免第二份真相):
      // batchSelfRun=是否走了自跑取证支,selfRunOk=自跑有没有拿到门级结论,
      // blockerBeforeBatch=量出来的"红在批之前的哪一步"(判不出则为 null,不编)。
      batchSelfRun: verdict.batchSelfRun === true,
      selfRunOk: verdict.selfRunOk === true,
      blockerBeforeBatch: verdict.blockerBeforeBatch ?? null,
      // 态⑤(G-1058649):kind=env-blocked 的那份"这一步自己没跑完"指纹必须可机读 ——
      // 否则事后读账的人分不出"环境性失败"与"未归因",而这两者的修法完全不同。
      envStep: verdict.envStep ?? null,
      envFingerprint: verdict.envFingerprint ?? null,
      downgradedFromMine: verdict.downgradedFromMine === true,
    })}\n`,
  )

  if (verdict.kind === 'mine') {
    log(
      'err',
      '拒绝 --no-verify:上表已把这道红**定责到本任务** —— 要么是门的结论行点名了本次声明的文件,' +
        '要么是差分证明"基线面(HEAD)不红、我的面红"。两种都该修完再提;' +
        '确属误判时请改判据或按 AGENTS §16 显式说明后手工提交',
    )
    process.exit(1)
  }
  // **重试前必须重新暂存**(2026-09-25 实测缺陷根治):首次 `git commit` 失败时 lint-staged 会
  // 回滚它自己动过的暂存区 —— 本票**新加的文件**因此从索引里掉回未跟踪,而 `git commit -- <pathspec>`
  // 对"git 不认识的路径"直接 `error: pathspec ... did not match any file(s) known to git` 退出。
  // 后果不是"重试失败"而是**这一整类提交落不了地**:凡是"带新文件 + 归因判定允许跳门"的提交
  // 都会在这里死掉(本次实测:10 个文件里 4 个新文件全被判 unknown,exit 1,零提交)。
  // 所以:重跑 Step 2 的 add,并**再跑一次 Step 3 的精确性校验** —— 不校验就重试等于放弃
  // "只提交自己声明的文件"这条根约束(窗口期里别人可能刚 staged 了东西)。
  log('info', '跳门重试前重新暂存本票文件(首次失败时 lint-staged 已回滚新增文件的索引态)')
  const reAdd = gitStep(['add', '-A', '--', ...expectedFiles], 'git add (retry)')
  if (reAdd.status !== 0) {
    // **删除型提交的 pathspec 语义与 add 不同**(2026-09-25 临时仓三态实测,不是推测):
    //   A 索引有 + 盘上无 ⇒ `add -A` 成功;
    //   B 索引无 + HEAD 有 + 盘上无 ⇒ `add -A` 报 pathspec 不匹配,**而 `git diff --cached`
    //     在这一态已经把该路径报成 D** ⇒ 旧写法在此 exit 1 纯属误伤;
    //   C 索引无 + HEAD 无 ⇒ 同样报错,且 diff 为空 ⇒ 只有这一态真的没东西可交。
    // lint-staged 在提交失败时回滚索引,留下的正是 B,于是"带删除的提交"永远走不到跳门兜底
    // (实测:一条已入库并推送的删除被并发合流带回后,复删三轮全死在这一行)。
    // 出口:盘上不在的声明路径改走 `git rm --cached --ignore-unmatch`(幂等;B 态本就成立,
    // C 态空操作),随后**照旧交给下面的精确性校验** —— 判"该不该中止"的是 diff,不是 add 的退出码。
    const onDisk = []
    const deleted = []
    for (const f of expectedFiles)
      (existsSync(join(repoRoot, normalize(f))) ? onDisk : deleted).push(f)
    let recovered = true
    if (onDisk.length)
      recovered = gitStep(['add', '-A', '--', ...onDisk], 'git add (retry: 在场文件)').status === 0
    if (deleted.length && recovered)
      recovered =
        gitStep(['rm', '--cached', '--ignore-unmatch', '--', ...deleted], 'git add (retry: 删除态)')
          .status === 0
    if (!recovered) {
      log('err', `重新暂存失败: ${reAdd.stderr}`)
      process.exit(1)
    }
    log(
      'info',
      `兜底重暂存改走 rm --cached 分支(${deleted.length} 个磁盘上不存在的路径 / ${onDisk.length} 个在场路径)—— ` +
        'add 只看索引与磁盘,抓不住"已被并发 reset 抹掉且盘上没有"的删除态',
    )
  }
  {
    // D171:重暂存后的精确性校验同样走 -z 出口(与本步骤第一次校验同一把尺)。
    const reStaged = new Set(gitStagedPaths({ root: repoRoot }).map(normalize))
    const reUnexpected = [...reStaged].filter((f) => !expectedNorm.has(f))
    const reMissing = [...expectedNorm].filter((f) => !reStaged.has(f))
    // **只拒"缺失",不拒"多余"** —— 第一版这里对多余也 exit 1,实测判得过严且把自己卡死:
    // `git commit -- <pathspec>` 按定义只提交声明过的那几个路径,别人在窗口期 staged 的文件
    // **结构上进不了本枚提交**;而缺失才是真危险(缺了就等于那一类"提交没发生")。
    if (reMissing.length) {
      log(
        'err',
        `重新暂存后本票文件仍缺 ${reMissing.length} 个(${reMissing.join(',')}) —— 说明 add 被并发窗口或锁挡住了,` +
          '此时提交会少交内容,拒绝继续;请人工核对索引后重跑',
      )
      process.exit(1)
    }
    if (reUnexpected.length) {
      log(
        'info',
        `索引里另有 ${reUnexpected.length} 个非本票文件(${reUnexpected.slice(0, 5).join(',')}…) —— ` +
          '不随本枚提交走:commit 带 pathspec,只交上面声明的清单,故不中止(第一版在此中止反而自锁:' +
          '并发会话随时可能 staged 东西,而它本来也进不来)',
      )
    }
  }
  const r = spawnSync('git', commitArgs(true), {
    encoding: 'utf8',
    cwd: repoRoot,
    env: process.env,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  pump(r)
  commitResult = r
  if (r.status === 0) {
    hookSkipped = true
    log(
      'warn',
      `⚠️  已用 --no-verify 落地(归因=${verdict.kind};守门未在本次提交链上重跑,` +
        `逐道复跑记录见上,留痕于 .workbuddy/safe-commit-attestation.jsonl)`,
    )
  }
}

if (commitResult.status !== 0) {
  log('err', `git commit 最终失败(exit ${commitResult.status})`)
  log(
    'warn',
    '常见原因: (a) commit message 格式问题;(b) 文件无改动(nothing to commit);(c) 其他未知错误',
  )
  process.exit(1)
}

// ─── 5. 验证 commit 内容(双保险) ───────────────────────────
// 2026-09-16 修(并发假警报):原实现校验 `git show HEAD`,但多 agent 并行时
// HEAD 可能已被其他 agent 的提交前移,导致把**别人的文件**误报成本次 commit 的污染,
// 并给出 `git reset HEAD~1` 这一会破坏他人提交的危险建议。
// 现改为:在 beforeSha..HEAD 区间内按「文件集 ⊆ 预期集」定位本次提交,再校验其内容。
log('info', 'Step 5/5: 验证 commit 内容只包含预期文件')

/** 取指定提交的文件清单(D171:走 lib 的 diff-tree -z 出口,中文名不被八进制转写)。 */
const filesOfCommit = (sha) => gitCommitPaths({ root: repoRoot, sha }).map(normalize)

// 本次提交候选:beforeSha 之后的全部新提交(正常情况下恰好 1 个)
const newShas = (run(`git rev-list ${beforeSha}..HEAD`, { allowFail: true }) || '')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)

let committedFiles = []
let committedSha = ''
if (newShas.length === 0) {
  // commit 命令返回成功但历史无变化(理论不可达:可能被 hook 撤销)
  log('err', `${C.red}commit 成功但未见新提交${C.reset}(beforeSha=${beforeSha.slice(0, 9)})`)
  process.exit(1)
} else if (newShas.length === 1) {
  committedSha = newShas[0]
  committedFiles = filesOfCommit(committedSha)
} else {
  // 并发:其他 agent 也在本次 commit 前后提交。找出「文件集全部落在预期内」的那一个,
  // 它就是本次提交(其他 agent 的提交必然含本脚本未声明的文件,除非文件集恰好相同)。
  const mine = newShas.find((sha) => {
    const files = filesOfCommit(sha)
    return files.length > 0 && files.every((f) => expectedNorm.has(f))
  })
  if (!mine) {
    log('err', `${C.red}并发场景下未能定位本次提交${C.reset}(beforeSha=${beforeSha.slice(0, 9)})`)
    log('warn', `区间内 ${newShas.length} 个新提交均含非预期文件,请人工核对:`)
    for (const sha of newShas) {
      console.log(`     ${C.dim}${sha.slice(0, 9)}${C.reset} ${filesOfCommit(sha).join(', ')}`)
    }
    process.exit(1)
  }
  committedSha = mine
  committedFiles = filesOfCommit(mine)
  log(
    'warn',
    `检测到 ${newShas.length - 1} 个并发提交,已定位本次提交 ${C.cyan}${committedSha.slice(0, 9)}${C.reset}`,
  )
}

const committedUnexpected = committedFiles.filter((f) => !expectedNorm.has(f))
if (committedUnexpected.length > 0) {
  log('err', `${C.red}严重!commit 包含非预期文件${C.reset}: ${committedUnexpected.join(', ')}`)
  log('err', `这是一个污染事故! 建议立即: git reset HEAD~1 然后重新用 safe-commit 提交`)
  process.exit(1)
}

log(
  'ok',
  `commit 干净,仅包含 ${C.cyan}${committedFiles.length}${C.reset} 个预期文件${hookSkipped ? C.yellow + ' (pre-commit hook 已跳过)' : C.reset}`,
)
log('ok', `post-commit hook 将自动调用 git-push-guard 推送`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
