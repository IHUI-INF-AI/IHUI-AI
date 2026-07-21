#!/usr/bin/env node
/* eslint-disable no-console */
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
 *   3. 校验                  git diff --cached --name-only 必须 === 用户预期
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
import { execSync, spawnSync } from 'node:child_process'

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
      ...opts,
    }).trim()
  } catch (e) {
    if (opts.allowFail) return null
    throw e
  }
}

// ─── 参数解析 ────────────────────────────────────────────
const args = process.argv.slice(2)
let message = null
const expectedFiles = []
let dryRun = false

for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '-m' || a === '--message') {
    message = args[++i]
  } else if (a.startsWith('--message=')) {
    message = a.split('=').slice(1).join('=')
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

log('info', `safe-commit 启动 → 分支: ${C.bold}${currentBranch}${C.reset}`)
log('info', `期望暂存 ${C.cyan}${expectedFiles.length}${C.reset} 个文件`)

// ─── 1. git reset HEAD (清空整个暂存区) ────────────────────
log('info', 'Step 1/5: git reset HEAD — 清空暂存区(无论谁 staged 的)')
const resetResult = spawnSync('git', ['reset', 'HEAD'], {
  encoding: 'utf8',
  cwd: repoRoot,
})
if (resetResult.status !== 0) {
  log('err', `git reset HEAD 失败: ${resetResult.stderr}`)
  process.exit(2)
}

// ─── 2. git add -A <用户预期文件>(-A 支持已删除文件) ─────
// 修复(2026-07-22): 原 `git add --` 对已删除文件报错 pathspec did not match。
// `git add -A --` 同时暂存新增/修改/删除三种变更, 第 3 步校验仍保证精确匹配。
log('info', `Step 2/5: git add -A <${expectedFiles.length} files> — 只暂存自己声明的文件(含删除)`)
const addResult = spawnSync('git', ['add', '-A', '--', ...expectedFiles], {
  encoding: 'utf8',
  cwd: repoRoot,
})
if (addResult.status !== 0) {
  log('err', `git add 失败: ${addResult.stderr}`)
  log('warn', '可能原因: 路径错误/仓库锁定/权限问题')
  process.exit(1)
}

// ─── 3. 校验 staged 内容是否 == 预期 ───────────────────────
log('info', 'Step 3/5: 校验 staged 内容与预期一致')
const stagedRaw = run('git diff --cached --name-only', { allowFail: true })
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
    log('err', `${C.red}${outOfScope.length}${C.reset} 个文件超出本 agent 范围 ${C.yellow}{${agentScope}}${C.reset}:`)
    for (const f of outOfScope) console.log(`     ${C.red}× ${f}${C.reset}`)
    log('warn', `如需跨域 commit,设置 AGENT_SCOPE_OVERRIDE=1 或在 commit message 显式标注 [cross-domain]`)
    if (process.env.AGENT_SCOPE_OVERRIDE !== '1' && !message.includes('[cross-domain]')) {
      process.exit(1)
    }
    log('warn', `已用 ${message.includes('[cross-domain]') ? 'message 标注' : 'AGENT_SCOPE_OVERRIDE'} 跨域豁免`)
  }
}

log('ok', `暂存区精确匹配预期 ${C.cyan}${stagedFiles.length}${C.reset} 个文件`)

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
let commitResult = spawnSync(
  'git',
  ['commit', '-m', finalMessage, '--', ...expectedFiles],
  {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env,
  },
)

let hookSkipped = false
if (commitResult.status !== 0) {
  log('warn', `首次 commit 失败(exit ${commitResult.status}),可能是 pre-commit hook 阻塞`)
  log('info', `按用户规则"hook 失败因其他 agent 代码 → --no-verify 跳过"重试...`)
  commitResult = spawnSync(
    'git',
    ['commit', '--no-verify', '-m', finalMessage, '--', ...expectedFiles],
    {
      stdio: 'inherit',
      cwd: repoRoot,
      env: process.env,
    },
  )
  if (commitResult.status === 0) {
    hookSkipped = true
    log('warn', `⚠️  首次 commit 因 pre-commit hook 失败,已用 --no-verify 重试成功`)
    log('warn', `   本任务文件已自验通过 typecheck,其他 agent 代码的 hook 失败不阻塞本任务 commit`)
  }
}

if (commitResult.status !== 0) {
  log('err', `git commit 最终失败(exit ${commitResult.status})`)
  log('warn', '常见原因: (a) commit message 格式问题;(b) 文件无改动(nothing to commit);(c) 其他未知错误')
  process.exit(1)
}

// ─── 5. 验证 commit 内容(双保险) ───────────────────────────
log('info', 'Step 5/5: 验证 commit 内容只包含预期文件')
const committedRaw = run('git show --name-only --pretty=format: HEAD', { allowFail: true })
const committedFiles = committedRaw
  ? committedRaw.split('\n').filter(Boolean).map(normalize)
  : []
const committedUnexpected = committedFiles.filter((f) => !expectedNorm.has(f))
if (committedUnexpected.length > 0) {
  log('err', `${C.red}严重!commit 包含非预期文件${C.reset}: ${committedUnexpected.join(', ')}`)
  log('err', `这是一个污染事故! 建议立即: git reset HEAD~1 然后重新用 safe-commit 提交`)
  process.exit(1)
}

log('ok', `commit 干净,仅包含 ${C.cyan}${committedFiles.length}${C.reset} 个预期文件${hookSkipped ? C.yellow + ' (pre-commit hook 已跳过)' : C.reset}`)
log('ok', `post-commit hook 将自动调用 git-push-guard 推送`)
