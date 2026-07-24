#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-push-sync.mjs — Push 同步兜底守门(防"commit 后忘记 push"复发)
 *
 * 背景:
 *   AGENTS.md §21 任务完成硬定义要求 local HEAD == remote HEAD。
 *   post-commit 钩子(git-push-guard.mjs)是主防线,但可能因各种原因失败:
 *     - HUSKY_SKIP_PUSH=1 跳过
 *     - push 网络失败 / 凭据失效
 *     - agent 用 --no-verify 跳过所有钩子
 *     - pre-push typecheck 阻塞
 *     - RunCommand 工具失联导致无法执行 push 命令
 *   本脚本作为"第二道防线",在 pre-commit 阶段检查:
 *     如果本地有未 push 的 commit → 阻塞本次 commit,要求先 push。
 *
 * 检查逻辑:
 *   1. 读取当前分支
 *   2. 读取本地 HEAD
 *   3. 读取 origin/<branch> HEAD(本地 remote-tracking ref)
 *   4. git rev-list --count origin/<branch>..HEAD
 *   5. 如果 > 0 → 有未 push 的 commit → 阻塞
 *
 * 退出码:
 *   0 — 本地与 origin 同步(无未 push commit,或非 git 环境/无 origin 跳过)
 *   1 — 有未 push commit,阻塞本次 commit
 *
 * 豁免:
 *   - HUSKY_SKIP_PUSH_SYNC=1: 跳过本检查(紧急场景,不推荐)
 *   - IHUI_ARCHIVE_COMMIT=1: 归档 commit 跳过(归档 commit 由 post-commit 自动 push)
 *   - --staged 模式: pre-commit 调用,正常执行检查
 *
 * 用法:
 *   node scripts/check-push-sync.mjs [--staged]
 *   HUSKY_SKIP_PUSH_SYNC=1 node scripts/check-push-sync.mjs
 *
 * 调用方:
 *   - .husky/pre-commit → guardian-runner.mjs 第 29 项 blocking 检查
 *   - 手动收尾验证
 */
import { execSync } from 'node:child_process'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    if (opts.allowFail) return null
    throw e
  }
}

// ─── 豁免检查 ───────────────────────────────────────────────
if (process.env.HUSKY_SKIP_PUSH_SYNC === '1') {
  console.log('⏭  HUSKY_SKIP_PUSH_SYNC=1 — 跳过 push 同步兜底检查(紧急场景,不推荐)')
  process.exit(0)
}

// 归档 commit 跳过(归档 commit 由 post-commit 自动 push,不阻塞)
if (process.env.IHUI_ARCHIVE_COMMIT === '1') {
  console.log('⏭  IHUI_ARCHIVE_COMMIT=1 — 归档 commit,跳过 push 同步兜底检查')
  process.exit(0)
}

// ─── 1. 基础环境检查 ───────────────────────────────────────
const repoRoot = run('git rev-parse --show-toplevel', { allowFail: true })
if (!repoRoot) {
  // 非 git 环境,跳过(不阻塞)
  console.log('⏭  非 git 仓库,跳过 push 同步检查')
  process.exit(0)
}
process.chdir(repoRoot)

const currentBranch = run('git symbolic-ref --short HEAD', { allowFail: true })
if (!currentBranch) {
  // detached HEAD,跳过(无法自动 push)
  console.log('⏭  detached HEAD 状态,跳过 push 同步检查(请先 git checkout 切回分支)')
  process.exit(0)
}

// ─── 2. 检查 origin remote ─────────────────────────────────
const remotes = run('git remote', { allowFail: true })
if (!remotes || !remotes.split('\n').includes('origin')) {
  // 无 origin remote,跳过(无法 push)
  console.log('⏭  未配置 origin remote,跳过 push 同步检查')
  process.exit(0)
}

// ─── 3. 读取本地 + 远端 HEAD ───────────────────────────────
const localHead = run('git rev-parse HEAD', { allowFail: true })
if (!localHead) {
  console.log('⏭  无法读取本地 HEAD(空仓库?),跳过 push 同步检查')
  process.exit(0)
}

// 读取本地 remote-tracking ref(不联网,速度快)
const remoteHead = run(`git rev-parse origin/${currentBranch}`, { allowFail: true })
if (!remoteHead) {
  // 本地无 origin/<branch> 引用(可能未 fetch 过),跳过
  console.log(`⏭  本地无 origin/${currentBranch} 引用(未 fetch 过?),跳过 push 同步检查`)
  process.exit(0)
}

// ─── 4. 对比 + 计算 ahead ──────────────────────────────────
if (localHead === remoteHead) {
  // 完全同步,通过
  console.log(`✅ 本地与 origin/${currentBranch} 已同步(HEAD: ${localHead.substring(0, 7)})`)
  process.exit(0)
}

// 计算本地领先多少个 commit
const revList = run(`git rev-list --count ${remoteHead}..${localHead}`, { allowFail: true })
const ahead = revList ? parseInt(revList, 10) : 0

if (ahead === 0) {
  // HEAD 不同但无 ahead commit(可能是 behind 或 分叉),不阻塞(让 post-commit 处理)
  console.log(`⏭  本地与 origin/${currentBranch} HEAD 不同但无 ahead commit(可能 behind,跳过)`)
  process.exit(0)
}

// ─── 5. 有未 push 的 commit → 阻塞 ─────────────────────────
const localShort = localHead.substring(0, 7)
const remoteShort = remoteHead.substring(0, 7)

// 读取未 push 的 commit 列表(最多 5 条)
const aheadCommits = run(
  `git log --oneline -5 ${remoteHead}..${localHead}`,
  { allowFail: true },
)

console.error('')
console.error(`${C.red}❌ Push 同步兜底检查失败:本地有 ${C.bold}${ahead}${C.reset}${C.red} 个未 push 的 commit${C.reset}`)
console.error('')
console.error(`  ${C.dim}本地 HEAD  :${C.reset} ${C.cyan}${localShort}${C.reset}`)
console.error(`  ${C.dim}远端 HEAD  :${C.reset} ${C.cyan}${remoteShort}${C.reset}`)
console.error(`  ${C.dim}当前分支  :${C.reset} ${C.cyan}${currentBranch}${C.reset}`)
console.error('')
console.error(`${C.yellow}未 push 的 commit:${C.reset}`)
if (aheadCommits) {
  aheadCommits.split('\n').forEach((line) => {
    console.error(`  ${C.yellow}  ${line}${C.reset}`)
  })
}
if (ahead > 5) {
  console.error(`  ${C.dim}  ... 还有 ${ahead - 5} 个${C.reset}`)
}
console.error('')
console.error(`${C.bold}🛡️  这是 push 兜底守门(AGENTS.md §21 第三道防线)${C.reset}`)
console.error(`${C.dim}post-commit 钩子(git-push-guard.mjs)本应自动 push,但可能因以下原因失败:${C.reset}`)
console.error(`${C.dim}  - HUSKY_SKIP_PUSH=1 跳过 / push 网络失败 / 凭据失效${C.reset}`)
console.error(`${C.dim}  - agent 用 --no-verify 跳过所有钩子${C.reset}`)
console.error(`${C.dim}  - pre-push typecheck 阻塞 / RunCommand 工具失联${C.reset}`)
console.error('')
console.error(`${C.green}修复方法(任选其一):${C.reset}`)
console.error(`  ${C.green}① 自动 push:${C.reset} ${C.cyan}node scripts/git-push-guard.mjs${C.reset}`)
console.error(`  ${C.green}② 手动 push:${C.reset} ${C.cyan}git push origin ${currentBranch}${C.reset}`)
console.error(`  ${C.green}③ 紧急跳过(不推荐):${C.reset} ${C.cyan}HUSKY_SKIP_PUSH_SYNC=1 git commit ...${C.reset}`)
console.error('')
console.error(`${C.red}本次 commit 已阻止。请先 push 未同步的 commit,再重新 commit。${C.reset}`)
console.error('')
process.exit(1)
