#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-commit-loss-guard.mjs — Commit 丢失防护守门(AGENTS.md §22 配套)
 *
 * 背景(2026-07-25 立,真实事故):
 *   reflog 记录 18:12-18:20 期间发生 6 次 `reset: moving to HEAD~` 操作,
 *   导致 3 个本地 commit(15b984f90 / 5ef36e59d / b120c6e20)在 main 历史中消失。
 *   工作内容通过后续 commit 重新整合,但原始 commit hash 永久不可追溯。
 *
 * 防护目标:
 *   1. 检测 reflog 近期 reset 操作 → 告警 + 提示 reset 风险
 *   2. 检测 fsck 悬空 commit → 过滤 stash-like 对象后核对 tag 备份
 *   3. 列出所有 lost-commit/* tag(防止 git gc 清理)
 *
 * --filter-stash 模式(guardian-runner 30a 注册):
 *   过滤掉 stash-like 悬空 commit(WIP / On main / index on main / untracked files on main),
 *   这些是 git stash / reset / merge 中间状态,不是真 commit 丢失。
 *   对未备份的 stash-like 悬空 commit,会从 subject 提取"原 commit hash"
 *   与 lostTag 集合比对,避免误报。
 *
 * 当前模式: blocking 模式(isBlocking=true)下,reset 操作或未备份悬空 commit → exit 1。
 *
 * 检查逻辑:
 *   1. git reflog --all --date=iso 最近 20 步
 *      → 含 'reset: moving to HEAD~' 或 'reset: moving to HEAD@{' → 告警
 *   2. git fsck --unreachable --no-reflogs
 *      → 含 'unreachable commit' 行 → 列出悬空 commit hash
 *   3. git tag -l "lost-commit/*"
 *      → 列出已 tag 备份的丢失 commit
 *   4. 若有悬空 commit 但无对应 lost-commit tag → 告警(可能未备份)
 *
 * 退出码:
 *   0 — 通过(warn 告警可被忽略,但 stdout 仍打印提示)
 *   1 — 有悬空 commit 且无 tag 备份(blocking 模式下阻塞 commit)
 *
 * 豁免:
 *   - HUSKY_SKIP_COMMIT_LOSS_CHECK=1: 跳过本检查(紧急场景,不推荐)
 *   - --strict: 升级为 blocking,任一告警都阻塞 commit
 *
 * 用法:
 *   node scripts/check-commit-loss-guard.mjs
 *   node scripts/check-commit-loss-guard.mjs --strict
 *   HUSKY_SKIP_COMMIT_LOSS_CHECK=1 node scripts/check-commit-loss-guard.mjs
 *
 * 调用方:
 *   - scripts/guardian-runner.mjs 第 30 项(warn-only → 后续 blocking)
 *   - 手动验证: git 异常操作后跑一次确认无丢失
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

const SKIP_ENV = 'HUSKY_SKIP_COMMIT_LOSS_CHECK'
const isStrict = process.argv.includes('--strict')
const isBlocking = process.argv.includes('--blocking')
const isFilterStash = process.argv.includes('--filter-stash')
const skip = process.env[SKIP_ENV] === '1'

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    if (opts.allowFail) return ''
    throw e
  }
}

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

function detectResets() {
  // reflog 最近 20 步(每行包含: hash | ref@{} | action: subject)
  const out = run('git reflog --all --date=iso -n 20', { allowFail: true })
  if (!out) return []
  const lines = out.split('\n')
  const resets = []
  for (const line of lines) {
    // 匹配 "reset: moving to HEAD~" / "reset: moving to HEAD@{1}" 等
    if (/reset:\s*moving to HEAD[~@]/.test(line)) {
      resets.push(line)
    }
  }
  return resets
}

function isStashSubject(subject) {
  if (!subject) return false
  return (
    /^WIP on /.test(subject) ||
    /^On main: /.test(subject) ||
    /^index on main: /.test(subject) ||
    /^untracked files on main: /.test(subject) ||
    /^untracked files on /.test(subject)
  )
}

function extractOriginalHashFromStash(subject) {
  // stash subject 形如:
  //   "WIP on main: 5ef36e59d <msg>"
  //   "On main: 5ef36e59d <msg>"
  //   "index on main: 5ef36e59d <msg>"
  //   "untracked files on main: 5ef36e59d <msg>"
  // 提取第二个冒号后的原 commit hash
  if (!subject) return ''
  const m = subject.match(/^[A-Za-z ]+on\s+\S+:\s+([0-9a-f]{7,40})\b/)
  return m ? m[1] : ''
}

function listUnreachableHashes() {
  // --no-reflogs: 不遍历 reflog(只检查悬空 commit 对象)
  const out = run('git fsck --unreachable --no-reflogs 2>&1', { allowFail: true })
  if (!out) return []
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('unreachable commit'))
    .map((l) => l.replace(/^unreachable commit\s+/, ''))
    .filter(Boolean)
}

function detectUnreachable() {
  // --no-reflogs: 不遍历 reflog(只检查悬空 commit 对象)
  // 原始 hash 列表(用于后续丢失 commit 备份核对)
  return listUnreachableHashes()
}

function filterStashLike(hashes) {
  // 对每个 hash 取 subject,若是 stash-like 形态(WIP / On main / index on main)则过滤
  return hashes.filter((c) => {
    const subject = run(`git log -1 --format=%s ${c}`, { allowFail: true })
    return !isStashSubject(subject)
  })
}

function listLostCommitTags() {
  const out = run('git tag -l "lost-commit/*"', { allowFail: true })
  if (!out) return []
  return out.split('\n').filter(Boolean)
}

function listBackups() {
  const out = run('git tag -l "backup/*"', { allowFail: true })
  if (!out) return []
  return out.split('\n').filter(Boolean)
}

function main() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 commit 丢失防护守门(不推荐)${C.reset}`)
    process.exit(0)
  }

  console.log(`${C.cyan}${C.bold}🛡️  Commit 丢失防护守门(AGENTS.md §22 配套)${C.reset}`)

  const resets = detectResets()
  const rawUnreachable = detectUnreachable()
  // --filter-stash: 过滤掉 stash-like 对象(WIP / On main / index on main)
  const unreachable = isFilterStash ? filterStashLike(rawUnreachable) : rawUnreachable
  const stashCount = isFilterStash ? rawUnreachable.length - unreachable.length : 0
  const lostTags = listLostCommitTags()
  const backups = listBackups()

  // ── 1. reflog reset 检测 ──
  console.log(header('1. reflog 最近 20 步 reset 操作检测'))
  if (resets.length === 0) {
    console.log(`  ${C.green}✅ 未检测到 reset 操作${C.reset}`)
  } else {
    console.log(`  ${C.yellow}⚠️  检测到 ${resets.length} 次 reset 操作(reflog):${C.reset}`)
    for (const r of resets) {
      console.log(`     ${C.dim}${r}${C.reset}`)
    }
    console.log(
      `\n  ${C.yellow}💡 reset 可能导致 commit 丢失(参见 AGENTS.md §22)。${C.reset}`,
    )
    console.log(`     验证步骤:`)
    console.log(`       1. ${C.cyan}git fsck --unreachable --no-reflogs${C.reset} 看悬空 commit`)
    console.log(
      `       2. ${C.cyan}git show <commit-hash>${C.reset} 确认内容`,
    )
    console.log(
      `       3. 若需保留:${C.cyan}git tag lost-commit/<name> <hash> -m "lost via reset"${C.reset}`,
    )
  }

  // ── 2. fsck 悬空 commit 检测 ──
  console.log(header('2. fsck 悬空 commit 检测(可能丢失的 commit)'))
  if (unreachable.length === 0) {
    console.log(`  ${C.green}✅ 未检测到悬空 commit${C.reset}`)
    if (isFilterStash && stashCount > 0) {
      console.log(
        `     ${C.dim}(已过滤 ${stashCount} 个 stash-like 对象:WIP / On main / index on main / untracked files on main)${C.reset}`,
      )
    }
  } else {
    console.log(
      `  ${C.yellow}⚠️  检测到 ${unreachable.length} 个悬空 commit:${C.reset}`,
    )
    for (const c of unreachable.slice(0, 10)) {
      const short = c.slice(0, 12)
      const subject = run(`git log -1 --format=%s ${c}`, { allowFail: true })
      console.log(`     ${C.cyan}${short}${C.reset}  ${C.dim}${subject || '(空)'}${C.reset}`)
    }
    if (unreachable.length > 10) {
      console.log(`     ${C.dim}... 还有 ${unreachable.length - 10} 个,详见 git fsck 输出${C.reset}`)
    }
    if (isFilterStash && stashCount > 0) {
      console.log(
        `     ${C.dim}(已过滤 ${stashCount} 个 stash-like 对象,详见 git fsck)${C.reset}`,
      )
    }
  }

  // ── 3. 已 tag 备份的丢失 commit 列表 ──
  console.log(header('3. 已 tag 备份的丢失 commit(防止 git gc 清理)'))
  if (lostTags.length === 0) {
    console.log(`  ${C.dim}(无 lost-commit/* tag)${C.reset}`)
  } else {
    for (const tag of lostTags) {
      const hash = run(`git rev-list -1 ${tag}`, { allowFail: true })
      const subject = run(`git log -1 --format=%s ${hash}`, { allowFail: true })
      console.log(`     ${C.cyan}${tag}${C.reset} → ${C.dim}${hash?.slice(0, 12) || '?'}${C.reset}  ${subject || ''}`)
    }
  }

  if (backups.length > 0) {
    console.log(`\n  ${C.dim}backup/* tag:${C.reset}`)
    for (const tag of backups) {
      const hash = run(`git rev-list -1 ${tag}`, { allowFail: true })
      console.log(`     ${C.cyan}${tag}${C.reset} → ${C.dim}${hash?.slice(0, 12) || '?'}${C.reset}`)
    }
  }

  // ── 4. 综合判定 ──
  console.log(header('4. 综合判定'))

  let blocking = false
  const issues = []

  if (resets.length > 0) {
    issues.push(`reflog 检测到 ${resets.length} 次 reset 操作`)
    blocking = true // 2026-07-25 升级:reset 操作直接进 blocking(防 commit 丢失)
  }
  if (unreachable.length > 0) {
    // 检查每个悬空 commit 是否有 lost-commit tag 备份
    // 注意:stash-like 悬空 commit 的 subject 包含原 commit hash(如 "index on main: 5ef36e59d ...")
    // 需从 subject 提取原 hash 与 lostTag 比对
    const backedUp = new Set(
      lostTags.map((t) => run(`git rev-list -1 ${t}`, { allowFail: true })),
    )
    const unbacked = unreachable.filter((c) => {
      if (backedUp.has(c)) return false
      // 对 stash-like 悬空 commit,提取 subject 里的原 commit hash 再匹配
      const subject = run(`git log -1 --format=%s ${c}`, { allowFail: true })
      const origHash = extractOriginalHashFromStash(subject)
      if (origHash && backedUp.has(origHash)) return false
      return true
    })
    if (unbacked.length > 0) {
      issues.push(
        `${unbacked.length} 个悬空 commit 未 tag 备份(运行 git tag lost-commit/<name> <hash> 备份)`,
      )
      blocking = true
    } else {
      issues.push(
        `${unreachable.length} 个悬空 commit 已全部 tag 备份(防止 git gc 清理)`,
      )
    }
  }

  if (issues.length === 0) {
    console.log(`  ${C.green}✅ 无 commit 丢失风险${C.reset}`)
    process.exit(0)
  }

  for (const i of issues) {
    console.log(`  ${C.yellow}⚠  ${i}${C.reset}`)
  }

  // 2026-07-25 升级:isBlocking 模式(guardian-runner 30a 注册)直接 exit 1
  if (blocking && (isStrict || isBlocking)) {
    console.log(
      `\n${C.red}${C.bold}❌ commit 丢失风险,阻塞 commit${C.reset} (请先处理:备份 / 确认 reset 安全)`,
    )
    console.log(
      `   1. 若 reset 是有意的,先备份:${C.cyan}git tag lost-commit/<name> <hash>${C.reset}`,
    )
    console.log(
      `   2. 紧急跳过(不推荐):${C.cyan}HUSKY_SKIP_COMMIT_LOSS_CHECK=1 git commit ...${C.reset}`,
    )
    process.exit(1)
  }

  console.log(
    `\n${C.yellow}💡 建议:${C.reset}`,
  )
  console.log(`   - 备份悬空 commit:${C.cyan}git tag lost-commit/<name> <hash>${C.reset}`)
  console.log(
    `   - 查看丢失历史:${C.cyan}git tag -l "lost-commit/*" && git show <tag>${C.reset}`,
  )
  console.log(`   - 详细规则见 AGENTS.md §22`)
  process.exit(0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
