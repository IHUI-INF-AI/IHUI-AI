#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具需 console 输出 */
/**
 * git-push-converge.mjs — 多仓幂等推送收敛(2026-09-18 立,#58 收尾事故根治)
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
 *   3. 远端是本地祖先(本地领先) → push
 *   4. 本地是远端祖先(本地落后) → SKIP(远端有并发新提交,由 ff 流程处理,不强推)
 *   5. 分叉 → DIVERGED(不强推,交人工/合并流程;除非 --force-with-lease)
 *   每仓独立超时(默认 180s),单仓网络卡死不拖垮其他仓。
 *
 * 退出码:
 *   0 — 全部仓收敛(推送成功或本已同步或远端领先待 ff)
 *   1 — 存在推送失败或分叉(需人工)
 *
 * 用法:
 *   node scripts/git-push-converge.mjs                         # 默认 origin,gitee,gitcode
 *   node scripts/git-push-converge.mjs --remotes=origin,gitee  # 指定仓
 *   node scripts/git-push-converge.mjs --branch=dev            # 指定分支(默认 main)
 *   node scripts/git-push-converge.mjs --force-with-lease      # 分叉时允许 lease 强推(慎用)
 */
import { execFileSync } from 'node:child_process'

// ─── 参数 ───
const args = process.argv.slice(2)
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : def
}
const hasFlag = (name) => args.includes(`--${name}`)
const remotes = getArg('remotes', 'origin,gitee,gitcode').split(',').map((s) => s.trim()).filter(Boolean)
const branch = getArg('branch', 'main')
const allowLease = hasFlag('force-with-lease')
const TIMEOUT_MS = Number(getArg('timeout', '180000'))

// ─── git 执行(带超时,失败返回 null) ───
function git(argsArr, { timeout = TIMEOUT_MS } = {}) {
  try {
    return execFileSync('git', argsArr, { encoding: 'utf8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
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
    // 本地领先 → 推
    const pushArgs = ['push', remote, `HEAD:refs/heads/${branch}`]
    const out = git(pushArgs)
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
  hasFailure = true
}

// ─── 汇总 ───
const summary = results.map((r) => `${r.remote}=${r.status}`).join(' ')
console.log(`\n收敛结果: ${summary}`)
process.exit(hasFailure ? 1 : 0)
