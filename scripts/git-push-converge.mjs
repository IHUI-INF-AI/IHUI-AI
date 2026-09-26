#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具需 console 输出 */
/**
 * git-push-converge.mjs — 多仓推送状态判定/收敛(2026-09-18 立,#58 收尾事故根治)
 *
 * 定位(AGENTS.md「提交/推送」节 2026-09-18 规则):**只读核验工具 + 应急通道**。
 * 常规推送链完全自动,agent 不得手写 git push:
 *   - origin:post-commit 钩子 git-push-guard.mjs(ahead 检测+推送+回读验证,幂等)
 *   - Gitee/GitCode:mirror-to-cn.yml CI(push 触发+每日 2 次兜底)
 * agent 收尾核验同步状态 = 跑本脚本(默认零推送:ALREADY/SKIP/BEHIND/DIVERGED
 * 均不产生写网络动作);仅在 guard/CI 双失效的应急场景人工推。
 *
 * 背景(两次实锤事故):
 *   post-commit 已由 git-push-guard 自动推 origin,agent 收尾时再手动
 *   `git push origin main` 必然撞上 already-pushed → 非快进报错 → 误判"还没好"
 *   → 后台任务反复盲推+长时间干等(单次 8-13 分钟)。根治原则:**先判定再推,
 *   已同步=跳过;一条命令收敛全部仓,退出码明确**。
 *
 * 行为(对每个 remote 幂等):
 *   1. ls-remote 取远端 main SHA(一次网络往返,不做全量 fetch)
 *   2. 远端 === 本地 HEAD → ALREADY(跳过推送,零网络写)
 *   3. 远端是本地祖先(本地领先) → push(origin 走 guard 同步通道自愈,
 *      2026-09-19;镜像仓直推 600s 上限)
 *   4. 本地是远端祖先(本地落后) → SKIP(远端有并发新提交,由 ff 流程处理,不强推)
 *   5. 分叉 → DIVERGED(不强推,交人工/合并流程;除非 --force-with-lease)
 *   每仓独立超时(默认 180s),单仓网络卡死不拖垮其他仓。
 *
 * 退出码:
 *   0 — 全部仓收敛(推送成功或本已同步或远端领先待 ff)
 *   1 — 存在推送失败或分叉(需人工)
 *
 * 用法:
 *   node scripts/git-push-converge.mjs                         # 默认仅核验 origin(镜像归 CI,见下)
 *   node scripts/git-push-converge.mjs --remotes=origin,gitee  # 显式指定仓(镜像仓仅在应急时使用)
 *   node scripts/git-push-converge.mjs --branch=dev            # 指定分支(默认 main)
 *   node scripts/git-push-converge.mjs --force-with-lease      # 分叉时允许 lease 强推(慎用)
 *
 * ⚠️ 默认 remotes=origin(2026-09-18 收紧):Gitee/GitCode 的同步归 mirror-to-cn.yml CI
 *    (push 触发+每日兜底),本地手推镜像仓违反架构且每次 push 触发仓库级 pre-push
 *    全量 typecheck(数分钟)。核验镜像仓请显式 --remotes=origin,gitee,gitcode。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── 参数 ───
const args = process.argv.slice(2)
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : def
}
const hasFlag = (name) => args.includes(`--${name}`)
const remotes = getArg('remotes', 'origin').split(',').map((s) => s.trim()).filter(Boolean)
const branch = getArg('branch', 'main')
const allowLease = hasFlag('force-with-lease')
const TIMEOUT_MS = Number(getArg('timeout', '180000'))

// ─── git 执行(带超时,失败返回 null) ───
function git(argsArr, { timeout = TIMEOUT_MS } = {}) {
  try {
    return execFileSync('git', argsArr, { encoding: 'utf8', timeout, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }).trim()
  } catch {
    return null
  }
}

const localHead = git(['rev-parse', 'HEAD'])
if (!localHead) {
  console.error('❌ 无法读取本地 HEAD(非 git 仓库?)')
  process.exit(1)
}
console.log(`本地 HEAD: ${localHead.slice(0, 11)} (branch=${branch})`)

// 后台推送状态识别(guard 异步化配套,#58 收尾根治):
// push-state=running 且 headSha=本地 HEAD → 显示 PUSHING,不算失败(后台 worker 正在推)
// push-state 的终态集(2026-09-26 起)是 running | done | failed | diverged:
//   · 本脚本是**只读核验**工具,任何不认识的值都只会被读成"不在途",绝不会被读成"已推成功"
//     (老状态文件里没有 diverged,行为与今天逐字一致 ⇒ 向后兼容);
//   · diverged 必须被点名出来:它是"远端拒收 non-fast-forward"的结论,若只打 DIVERGED
//     而不说 guard 已经判过,读的人还会再去试一趟推送(那正是本次修复要断掉的循环)。
function readPushState() {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), '.workbuddy/push-state.json'), 'utf8'))
  } catch {
    return null
  }
}
const pushState = readPushState()
const pushDiverged = pushState && pushState.status === 'diverged'
// 在途判定 = running + 未过期 + 持有者存活(worker 被强杀时残留 running,死 pid 不算在途)
function isPushStatePidAlive() {
  if (!pushState?.pid) return false
  try {
    process.kill(Number(pushState.pid), 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
const pushInProgress =
  pushState &&
  pushState.status === 'running' &&
  pushState.headSha === localHead &&
  Date.now() - pushState.ts < 5 * 60 * 1000 &&
  isPushStatePidAlive()

// 2026-09-19 根治(猝死第三刀):origin 推送统一委托 guard 同步通道。
// GUARD_ASYNC=0 强制 guard 走同步推送(门禁不降级,75 中断重试 + no-verify
// 兜底齐全),600s 上限远超 270s 全量门。返回 true=成功。
function healViaGuard() {
  try {
    execFileSync(
      process.execPath,
      ['scripts/git-push-guard.mjs', `--branch=${branch}`],
      {
        encoding: 'utf8',
        timeout: 600_000,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, GUARD_ASYNC: '0', GUARD_WORKER: '' },
      },
    )
    return true
  } catch {
    return false
  }
}

let hasFailure = false
const results = []

for (const remote of remotes) {
  const label = remote.padEnd(8)
  // 1. 远端 tip(单次 ls-remote,比 fetch 轻得多)
  const remoteTip = git(['ls-remote', remote, `refs/heads/${branch}`])
  if (remoteTip === null) {
    results.push({ remote, status: 'UNREACHABLE' })
    console.log(`${label} ❌ UNREACHABLE(网络/权限)`)
    hasFailure = true
    continue
  }
  const remoteSha = remoteTip.split('\t')[0]
  if (remoteSha === localHead) {
    results.push({ remote, status: 'ALREADY' })
    console.log(`${label} ✅ ALREADY(远端=本地,跳过推送)`)
    continue
  }
  // 2. 判定领先关系(无需网络:本地已有该对象即可判定,否则按需 fetch)
  if (!git(['cat-file', '-e', remoteSha])) {
    git(['fetch', remote, branch], { timeout: TIMEOUT_MS })
  }
  const remoteIsAncestor = git(['merge-base', '--is-ancestor', remoteSha, localHead]) !== null
    && git(['cat-file', '-e', remoteSha]) !== null
  const localIsAncestor = git(['merge-base', '--is-ancestor', localHead, remoteSha]) !== null
    && git(['cat-file', '-e', remoteSha]) !== null

  if (localIsAncestor && !remoteIsAncestor) {
    results.push({ remote, status: 'BEHIND' })
    console.log(`${label} ⏭️  SKIP(远端领先 ${remoteSha.slice(0, 11)},本地待 ff;不强推)`)
    continue
  }
  if (remoteIsAncestor && !localIsAncestor) {
    // 本地领先:若后台推送正在进行(guard 异步化),显示 PUSHING 而非重复触发
    if (pushInProgress) {
      results.push({ remote, status: 'PUSHING' })
      console.log(`${label} ⏳ PUSHING(后台推送进行中,HEAD ${localHead.slice(0, 11)})`)
      continue
    }
    if (remote === 'origin') {
      // 2026-09-19 根治:origin 推送委托 guard 同步通道(此前直推必败——
      // push 会跑 pre-push 全量门 ~270s,而本脚本 git() 超时只有 180s,一推
      // 就被自己 kill 成 PUSH_FAILED)。guard 通道自带:75 中断重试/门失败
      // no-verify 兜底/终态兜底/心跳,委托即获得全部根治能力(--heal 同路径)。
      const healRes = healViaGuard()
      if (healRes) {
        results.push({ remote, status: 'PUSHED' })
        console.log(`${label} 🚀 PUSHED(${localHead.slice(0, 11)},经 guard 同步通道)`)
      } else {
        results.push({ remote, status: 'PUSH_FAILED' })
        console.log(`${label} ❌ PUSH_FAILED(本地领先但 guard 通道推送失败,需人工)`)
        hasFailure = true
      }
      continue
    }
    // 本地领先 → 推(镜像仓:直推但放宽超时,门禁由 CI 承担)
    const pushArgs = ['push', remote, `HEAD:refs/heads/${branch}`]
    const out = git(pushArgs, { timeout: 600_000 })
    if (out === null) {
      results.push({ remote, status: 'PUSH_FAILED' })
      console.log(`${label} ❌ PUSH_FAILED(本地领先但推送失败,需人工)`)
      hasFailure = true
    } else {
      results.push({ remote, status: 'PUSHED' })
      console.log(`${label} 🚀 PUSHED(${localHead.slice(0, 11)})`)
    }
    continue
  }
  // 既非祖先关系 → 分叉
  if (allowLease) {
    const out = git(['push', '--force-with-lease', remote, `HEAD:refs/heads/${branch}`])
    if (out !== null) {
      results.push({ remote, status: 'FORCE_PUSHED' })
      console.log(`${label} ⚠️  FORCE_PUSHED(lease,分叉 ${remoteSha.slice(0, 11)})`)
      continue
    }
  }
  results.push({ remote, status: 'DIVERGED' })
  console.log(`${label} ⚠️  DIVERGED(远端 ${remoteSha.slice(0, 11)} 与本地分叉;先 ff/merge 再收敛)`)
  if (pushDiverged) {
    console.log(
      `${label}    └ guard 上一轮已判 diverged${
        pushState.reason ? `(${String(pushState.reason).slice(0, 90)})` : ''
      }⇒ 别再重试推送,唯一入口:node scripts/git-sync-converge.mjs`,
    )
  }
  hasFailure = true
}

// ─── 汇总 ───
const summary = results.map((r) => `${r.remote}=${r.status}`).join(' ')
console.log(`\n收敛结果: ${summary}`)
process.exit(hasFailure ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
