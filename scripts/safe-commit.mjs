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
 *                             各自成行列出,删除类提交不再恒误报。Step 5 的 git show 同理。)
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
      stdio: ['pipe', 'pipe', 'pipe'],
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
    last = spawnSync('git', args, { encoding: 'utf8', cwd: repoRoot, windowsHide: true })
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
log('info', 'Step 1/5: git reset HEAD — 清空暂存区(无论谁 staged 的)')
const resetResult = gitStep(['reset', 'HEAD'], 'git reset HEAD')
if (resetResult.status !== 0) {
  log('err', `git reset HEAD 失败: ${resetResult.stderr}`)
  process.exit(2)
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
const stagedRaw = run('git diff --cached --name-only --no-renames', { allowFail: true })
const stagedFiles = stagedRaw ? stagedRaw.split('\n').filter(Boolean) : []

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
      { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
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
    env: process.env,
    windowsHide: true,
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
  let hookLogTail = ''
  try {
    const logPath = join(repoRoot, '.workbuddy', 'hook-logs', 'pre-commit.log')
    const size = statSync(logPath).size
    const len = Math.min(size, 256 * 1024)
    const fd = openSync(logPath, 'r')
    try {
      const buf = Buffer.alloc(len)
      readSync(fd, buf, 0, len, size - len)
      hookLogTail = buf.toString('utf8')
    } finally {
      closeSync(fd)
    }
  } catch {
    hookLogTail = ''
  }
  const runGate = (script) => {
    const g = spawnSync(process.execPath, [join(repoRoot, 'scripts', script), '--staged'], {
      encoding: 'utf8',
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 32 << 20,
    })
    return { status: g.status ?? 1, output: `${g.stdout || ''}${g.stderr || ''}` }
  }
  const verdict0 = classifyHookFailure({
    text: hookOutput,
    fallbackText: hookLogTail,
    stagedFiles: expectedFiles,
    runGate,
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
    hookText: hookOutput,
  })
  log('warn', `首次 commit 失败(exit ${commitResult.status})—— 开始逐道复跑失败门以计算归因`)
  for (const line of verdict.detail) log('info', `  · ${line}`)
  log(verdict.kind === 'mine' ? 'err' : 'info', verdictLine(verdict))

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
    })}\n`,
  )

  if (verdict.kind === 'mine') {
    log(
      'err',
      '拒绝 --no-verify:上表已点名本次声明的文件,这是本任务自己的红。修完再提;' +
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
    const reRaw = run('git diff --cached --name-only --no-renames', { allowFail: true })
    const reStaged = new Set((reRaw ? reRaw.split('\n') : []).filter(Boolean).map(normalize))
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

/** 取指定提交的文件清单(已归一化)。 */
const filesOfCommit = (sha) => {
  const raw = run(`git show --name-only --no-renames --pretty=format: ${sha}`, { allowFail: true })
  return raw ? raw.split('\n').filter(Boolean).map(normalize) : []
}

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
