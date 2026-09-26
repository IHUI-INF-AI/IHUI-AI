#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
 *   3. 读取 origin/<branch> HEAD —— **以 `git ls-remote`(网络真值)为准**,
 *      ls-remote 不可用时才回退本地 remote-tracking ref(2026-09-12 修:
 *      本机宿主清理层会删除嵌套 ref,本地 ref 可能残旧,曾致"已推送却被判未推送"而阻塞 commit)
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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, ...opts }).trim()
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

// 远端 tip 必须以 ls-remote(网络真值)为准(2026-09-12 修,与 git-push-guard.mjs 同源问题)。
// 背景:本机「宿主清理 gitdir 嵌套目录」病理会把 `refs/remotes/<remote>/<branch>` 静默删除,
//   而 packed-refs 残留旧值 → `git rev-parse origin/<branch>` 返回**过期 sha**。
//   旧逻辑只读本地 tracking ref,于是会把"其实已经推送成功"的 commit 判成"未 push"并
//   **阻塞下一次 commit**(实测:本地=远端=bc3b29c1f,却报「远端 HEAD: 81a5869」)。
//   现改为 ls-remote 优先,失败才回退本地 ref(离线场景仍可用)。
async function resolveRemoteHead() {
  const viaLs = run(`git ls-remote origin refs/heads/${currentBranch}`, { allowFail: true })
  if (viaLs) {
    const sha = viaLs.split('\t')[0].trim()
    if (sha) return sha
  }
  console.log(`ℹ️  ls-remote 不可用,回退本地 origin/${currentBranch} 引用(本机可能过期)`)
  return run(`git rev-parse origin/${currentBranch}`, { allowFail: true })
}
const remoteHead = await resolveRemoteHead()
if (!remoteHead) {
  // ls-remote 与本地 ref 都取不到(无网络且从未 fetch 过),跳过
  console.log(`⏭  无法确定 origin/${currentBranch} HEAD(未 fetch 且 ls-remote 不可用),跳过 push 同步检查`)
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

// ─── 5. 有未 push 的 commit → 检查后台推送状态 ──────────────
// 2026-09-18 晚(异步推送适配):推送已后台化(全量门约 270s),"本地有未 push commit"
// 在每次 commit 后数分钟内是**常态**。此检查若照旧阻塞,会导致 pre-commit 首跑必败
// → --no-verify 重试 → 80 项守门全跳过(实测今日每次 commit 都如此)。
// 故:后台推送在途(running 且未过期)→ 放行;仅"无在途推送且 ahead>0"(真忘记 push)才阻塞。
const PUSH_STATE_STALE_MS = 5 * 60 * 1000

/** 读 `.workbuddy/push-state.json`;缺文件/坏 JSON ⇒ null(回到原判据,不猜)。 */
function readPushState() {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, '.workbuddy/push-state.json'), 'utf8'))
  } catch {
    return null
  }
}

/** pid 存活探测(signal 0)。`isPidAlive` 与 worker 侧同一语义:EPERM = 活着但不属于我。 */
function isPidAlive(pid) {
  if (!pid || Number(pid) === process.pid) return true
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/** `headSha` 是否是本地 HEAD 的祖先(含自身)。取不到/不认识一律判"不是"——
 *  本函数只在"要不要放行"这一格被用,判不出时选择继续拦,不猜通过。
 *  刻意不用 `git cat-file -e <sha>^{commit}`:`execSync` 在 Windows 走 cmd.exe,
 *  而 `^` 是 cmd 的转义符,该形态会被吃掉后报"未知对象"(实测踩过一次,表现为
 *  done+祖先这一格永远判红)。 */
function isAncestorOfHead(sha, head) {
  if (!sha || !head || !/^[0-9a-f]{7,40}$/i.test(sha)) return false
  return run(`git merge-base --is-ancestor ${sha} ${head}`, { allowFail: true }) !== null
}

/** 放行结论的合法形态,以及"回到原判据(阻塞)"的一种。
 *  刻意保持窄口径:`failed` 一律阻塞(真推送不出去才是本门存在的理由);
 *  `running` 但未新鲜/持有者已死 也回到阻塞,那正是 2026-09-19 记录的"猝死残留"型。
 *  `diverged`(2026-09-26 由 git-push-guard 新增的终态)**新鲜时放行、过期时阻塞**。
 *  它和 failed 的差别不是轻重,而是下一步动作不同:failed 是"通道坏了,查凭据/网络/门禁",
 *  diverged 是"远端已推进,唯一出路是 git-sync-converge(§5b「🔄 主动收敛」)"。
 *  为什么新鲜那一档必须放行(主会话在 subagent 交付后补的判据,理由要留在案上):
 *  guard 自己**不能**收敛 —— 收敛要在有锁、有判据的入口做,所以 diverged 落下之后
 *  没有人会自动清掉它。若照 failed 那样一律拦,并发期(本机常态)每一次提交都被拦,
 *  唯一结局就是各会话 `--no-verify`,那正是今天 13:1x 修掉的那型(见下面 done 档的注释)。
 *  拦的仍是"没人管":状态一过期就回到阻塞,出路照旧点名收敛器。
 *  向后兼容:老状态文件里没有这个值,该分支对它们完全不生效。 */
function pushVerdict(st, { now, localHead }) {
  if (!st || typeof st.ts !== 'number') return { pass: false, why: '无 push-state(或形状不对)' }
  const fresh = now - st.ts < PUSH_STATE_STALE_MS
  const alive = isPidAlive(st.pid)
  if (st.status === 'failed') {
    return { pass: false, why: `最近一次后台推送判 failed(${ageText(now, st.ts)}前),本门必须继续拦` }
  }
  if (st.status === 'diverged') {
    const remedy = st.nextCommand ? `出路:${st.nextCommand}` : '出路:node scripts/git-sync-converge.mjs'
    if (fresh) {
      return {
        pass: true,
        why: `上一轮推送被远端拒收 non-fast-forward(diverged,${ageText(now, st.ts)}前)⇒ ${remedy};本门不拦,但这条必须由人或会话跑一次`,
      }
    }
    return {
      pass: false,
      why: `diverged 已 ${ageText(now, st.ts)}无人收敛(超过 ${Math.round(PUSH_STATE_STALE_MS / 60000)}min 窗口)⇒ 先跑 ${remedy} 再提交`,
    }
  }
  if (st.status === 'running' && fresh && alive) {
    return { pass: true, why: `后台推送在途(running,${ageText(now, st.ts)}前,pid ${st.pid} 存活)` }
  }
  if (st.status === 'running' && fresh && !alive) {
    return { pass: false, why: `running 但持有者 pid ${st.pid} 已死 ⇒ 猝死残留,不算在途` }
  }
  // 2026-09-26 新增的一格:上一轮推送**已成功落终态(done)**,而本次 ahead 来自其后
  // 的新提交。实测成因:本机 12:53 / 12:57 两枚提交都因这一格被判红,而红之后
  // safe-commit 走 --no-verify ⇒ 当天多数提交实际上没跑那 163 道门。
  // 这不算放宽:`done` 只说明"推送通道是通的、guard 在位",post-commit 必然为新提交
  // 再起一个 worker(§5b「异步推送」条);真推不出去会写 failed,仍由上一条拦下。
  if (st.status === 'done' && fresh && isAncestorOfHead(String(st.headSha), localHead)) {
    return {
      pass: true,
      why: `上一轮推送已成功(done ${String(st.headSha).slice(0, 7)},${ageText(now, st.ts)}前),本次 ahead 来自其后的新提交,post-commit 会再起 worker 重推`,
    }
  }
  if (st.status === 'done' && fresh) {
    return {
      pass: false,
      why: `push-state 是 done,但那一枚 headSha 不在本次 HEAD 的祖先线上 ⇒ 不得拿别的历史的成功当本分支的合格证`,
    }
  }
  return { pass: false, why: `push-state status=${st.status} 且已过期(${ageText(now, st.ts)}前)` }
}

function ageText(now, ts) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}min`
}

const pushState = readPushState()
const verdict = pushVerdict(pushState, { now: Date.now(), localHead })
if (verdict.pass) {
  console.log(`⏭  ${verdict.why};新提交将由 post-commit 随新 worker 重推,不阻塞本次 commit`)
  process.exit(0)
}
// 判红时把"读到了什么"一起打出来:这道门判的是**远端态**,与提交内容无关,
// 没有这一行,每一次红都要有人从头猜一遍(今天就是这样)。
console.log(`ℹ️  push-state 读数:${pushState ? `status=${pushState.status} headSha=${String(pushState.headSha).slice(0, 7)} pid=${pushState.pid}` : '无文件'} ⇒ ${verdict.why}`)

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
