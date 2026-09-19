#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-sync-converge.mjs — 主动推送收敛器(2026-09-18 晚立,根治"推不动→手工循环"卡点)。
 *
 * 背景:多会话并发推送,远端在 push 门 typecheck 的 4-5 分钟窗口内持续前移,
 * 单次 push 极易 non-FF。此前 agent 手工循环(fetch→merge→push)每轮 5-13 分钟,
 * 2026-09-18 实战收敛 3 轮耗时 25 分钟,且手工循环易漏步骤/误操作。
 *
 * 机制(worktree-preserving,零触碰他人未提交文件):
 *   1. fetch origin main
 *   2. origin/main 已是 HEAD 祖先 → 已收敛,结束
 *   3. HEAD 已被远端包含 → 无需推送,结束
 *   4. 分叉 → `git merge-tree --write-tree HEAD origin/main` 索引层建合并树
 *      (不触碰工作区,不影响其他会话的未提交文件;冲突则报错退出)
 *   5. `git commit-tree` 造合并提交 → `git update-ref refs/heads/main` 推进本地
 *   6. `node scripts/git-push-guard.mjs` 官方通道推送(含 push 门+降级重试)
 *   7. 重复至多 --rounds 轮(默认 3)
 *
 * 用法:
 *   node scripts/git-sync-converge.mjs [--branch main] [--rounds 3] [--dry-run]
 *
 * 只读核验(不写任何东西)仍用 git-push-converge.mjs。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const C = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' }
const log = (color, msg) => console.log(`${color}${msg}${C.reset}`)

/** 轮询 push-state.json 至 done/failed(guard 异步推送是后台跑的,须等落定再决策) */
function waitForPushState(headSha, timeoutMs = 8 * 60 * 1000) {
  const stateFile = resolve(process.cwd(), '.workbuddy/push-state.json')
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const s = JSON.parse(readFileSync(stateFile, 'utf8'))
      if (s.headSha === headSha && (s.status === 'done' || s.status === 'failed')) return s.status
      // state 已被更新 HEAD 的其他推送覆盖 → 视为本 HEAD 推送已无意义
      if (s.headSha !== headSha) return 'superseded'
    } catch {
      /* 无状态文件 */
    }
    if (Date.now() > deadline) return 'timeout'
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},3000)'], { stdio: 'ignore', windowsHide: true })
  }
}

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** a 是否为 b 的祖先(merge-base --is-ancestor 靠 exit code 判定) */
function isAncestor(a, b) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore', windowsHide: true })
    return true
  } catch {
    return false
  }
}

// ─── 参数 ───────────────────────────────────────────────
const argv = process.argv.slice(2)
const getOpt = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const branch = getOpt('--branch', 'main')
const maxRounds = Number(getOpt('--rounds', 3))
const dryRun = argv.includes('--dry-run')

const repoRoot = git(['rev-parse', '--show-toplevel'], { allowFail: true })
if (!repoRoot) {
  log(C.red, '❌ 不在 git 仓库中')
  process.exit(2)
}

// 2026-09-19:收敛前清理 stale 锁(根治 index.lock 卡死)。
// 收敛器做 fetch/merge-tree/commit-tree/update-ref 等写操作,stale index.lock 会全挂。
try {
  execFileSync('node', ['scripts/git-lock.mjs', 'clean'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: repoRoot,
  })
} catch {
  /* 清理失败不阻塞收敛 */
}

for (let round = 1; round <= maxRounds; round++) {
  log(C.dim, `── 第 ${round}/${maxRounds} 轮 ──`)
  git(['fetch', 'origin', branch])
  const remoteHead = git(['rev-parse', `origin/${branch}`])
  const localHead = git(['rev-parse', 'HEAD'])

  if (remoteHead === localHead) {
    log(C.green, `✅ 已收敛:本地 === 远端(${remoteHead.slice(0, 11)})`)
    process.exit(0)
  }
  if (isAncestor(localHead, remoteHead)) {
    // 远端已包含本地 → 并发期"被远端包含即为完成"
    log(C.green, `✅ 本地提交已被远端包含(${localHead.slice(0, 11)}),按并发纪律视为完成,不推送`)
    process.exit(0)
  }
  if (isAncestor(remoteHead, localHead)) {
    // 本地纯领先(可 fast-forward):直接 guard 推送,禁止 merge-tree——
    // 否则会造出冗余合并提交(历史噪音 + 新 headSha 使 push-gate 内容缓存失效)。
    log(C.yellow, `本地领先远端(FF 可达),跳过合并直接推送(${localHead.slice(0, 11)})`)
    if (dryRun) {
      log(C.dim, '  --dry-run:到此为止,不推送')
      process.exit(0)
    }
  } else {
    log(C.yellow, `分叉:本地 ${localHead.slice(0, 11)} / 远端 ${remoteHead.slice(0, 11)} → 索引层合并(不触碰工作区)`)
    if (dryRun) {
      log(C.dim, '  --dry-run:到此为止,不合并不推送')
      process.exit(0)
    }
    // 索引层合并树(worktree-preserving):冲突时 merge-tree 输出含冲突信息,tree 为 null 段
    let tree
    try {
      const out = execFileSync('git', ['merge-tree', '--write-tree', 'HEAD', `origin/${branch}`], {
        encoding: 'utf8',
        windowsHide: true,
      })
      tree = out.trim().split('\n')[0].trim()
      if (!/^[0-9a-f]{40}$/.test(tree)) throw new Error(out)
    } catch (e) {
      log(C.red, `❌ 合并冲突或 merge-tree 失败,需人工介入:\n${e.stdout ?? e.message}`)
      process.exit(1)
    }
    log(C.dim, `  合并树 ${tree.slice(0, 11)}(无冲突)`)

    const mergeMsg = `Merge origin/${branch} (worktree-preserving sync via git-sync-converge) round${round}`
    const mergeSha = git(['commit-tree', tree, '-p', 'HEAD', '-p', `origin/${branch}`, '-m', mergeMsg])
    git(['update-ref', `refs/heads/${branch}`, mergeSha])
    log(C.dim, `  合并提交 ${mergeSha.slice(0, 11)} 已推进本地 ${branch}`)
  }

  // 官方通道推送(guard 异步化:命令秒回,推送在后台 worker 执行)
  execFileSync('node', ['scripts/git-push-guard.mjs'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: repoRoot,
  })

  // 等待后台推送落定再决策(2026-09-18 晚修复:此前立即查远端,推送还在 270s 门里
  // 未完成即误判"远端又前移",3 轮全空转)
  const myHead = git(['rev-parse', 'HEAD'])
  const result = waitForPushState(myHead)
  log(C.dim, `  后台推送结果: ${result}`)
  if (result === 'done') {
    log(C.green, `✅ 推送收敛成功:${myHead.slice(0, 11)}`)
    process.exit(0)
  }
  if (result === 'superseded') {
    log(C.yellow, '  推送状态已被更新的 HEAD 覆盖(并发会话推进了本地),继续下一轮')
  }

  const nowRemote = git(['rev-parse', `origin/${branch}`])
  if (nowRemote === git(['rev-parse', 'HEAD'])) {
    log(C.green, `✅ 推送收敛成功:${nowRemote.slice(0, 11)}`)
    process.exit(0)
  }
  log(C.yellow, `  第 ${round} 轮未落地(远端 ${nowRemote.slice(0, 11)}),继续下一轮`)
}

log(C.red, `❌ ${maxRounds} 轮未收敛(并发推力过大),稍后重跑: node scripts/git-sync-converge.mjs`)
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
