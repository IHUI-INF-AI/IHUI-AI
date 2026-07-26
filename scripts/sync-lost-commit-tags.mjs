#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * sync-lost-commit-tags.mjs — Lost commit tag 自动同步脚本(AGENTS.md §22 配套)
 *
 * 背景(2026-07-26 立,真实事故):
 *   本地 lost-commit/* 和 backup/* tag 被 git gc 清理,但 git log 看不到这些 commit
 *   (因为已不在任何 branch ref 上),所以用户以为丢失了。
 *   实际上远端有,但本地 fetch 失败(因为 fetch 不知道要 fetch 这些 tag,
 *   默认 fetch 不包含 tag)。这暴露了一个机制缺陷:tag 备份必须主动 push + 主动 fetch。
 *
 * 脚本职责(3 件事):
 *   1. 自动 push: commit 后自动把本地 lost-commit/backup tag 推到 origin,防止 gc 后无远端备份
 *   2. 手动 fetch: 一键从 origin 拉回所有 lost-commit/backup tag,修复 gc 清理后本地 tag 缺失
 *   3. 手动 check: 校验本地 + 远端 tag 一致性 + tag 对象可达性
 *
 * 为什么需要(2026-07-26 事故复盘):
 *   - tag 是 commit 的"指向引用",git gc 默认 14 天清理无引用对象
 *   - 丢失 commit 唯一可访问方式 = tag → tag 必须 push 到远端 + 本地 fetch 必须知道要 fetch
 *   - 机制:fatal: refusing to fetch into current branch refs/tags/* 报错是 fetch 语法问题
 *     → 用 refspec `refs/tags/lost-commit/*:refs/tags/lost-commit/*` 显式映射
 *
 * CLI 模式(必须全部支持):
 *   --check       仅校验,不动 git 状态。比较本地 vs 远端 tag 集合,检查 tag 对象可达性。
 *                 失败 exit 1,成功 exit 0。这是默认模式(无参数时)
 *   --fetch       从 origin 拉回所有 lost-commit/backup tag
 *   --auto-push   把本地 lost-commit/backup tag 推到 origin(用 --atomic 防止半失败)
 *   --dry-run     配合 --auto-push 用,只打印将要 push 的 tag 不实际 push
 *   --force       强制 push(覆盖远端),默认不允许
 *   --json        配合 --check 用,输出 JSON 格式结果(给 CI/上层调用方)
 *   --help        打印帮助并 exit 0
 *
 * 退出码:
 *   0 — 成功(所有 tag 本地+远端一致 + tag 对象可达)
 *   1 — 失败(任何不一致或不可达)
 *   2 — 异常(脚本执行错误,例如 git 命令找不到)
 *
 * 豁免:
 *   HUSKY_SKIP_TAG_SYNC=1 — 跳过 --auto-push 模式(给 post-commit 钩子用,紧急场景)
 *
 * 用法:
 *   node scripts/sync-lost-commit-tags.mjs              # 默认 check
 *   node scripts/sync-lost-commit-tags.mjs --check      # 校验
 *   node scripts/sync-lost-commit-tags.mjs --check --json
 *   node scripts/sync-lost-commit-tags.mjs --fetch      # 拉回
 *   node scripts/sync-lost-commit-tags.mjs --auto-push  # 推送
 *   node scripts/sync-lost-commit-tags.mjs --auto-push --dry-run
 *   HUSKY_SKIP_TAG_SYNC=1 git commit ...                # 紧急跳过
 *
 * 调用方:
 *   - .husky/post-commit 第 5 段(commit 后自动 push tag)
 *   - 手动验证: git gc 后跑 --fetch 拉回 + --check 确认一致
 *   - 定时任务: 每周一检查 tag 完整性(见 docs/lost-commit-archive.md 防护机制)
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

const SKIP_ENV = 'HUSKY_SKIP_TAG_SYNC'
const skip = process.env[SKIP_ENV] === '1'
const args = new Set(process.argv.slice(2))
const isHelp = args.has('--help') || args.has('-h')
const isCheck = args.has('--check') || (!args.has('--fetch') && !args.has('--auto-push'))
const isFetch = args.has('--fetch')
const isAutoPush = args.has('--auto-push')
const isDryRun = args.has('--dry-run')
const isForce = args.has('--force')
const isJson = args.has('--json')

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

function printHelp() {
  console.log(`${C.cyan}${C.bold}sync-lost-commit-tags.mjs${C.reset} — Lost commit tag 同步(AGENTS.md §22)`)
  console.log('')
  console.log('用法:')
  console.log('  node scripts/sync-lost-commit-tags.mjs [mode] [flags]')
  console.log('')
  console.log('模式:')
  console.log('  --check       校验本地+远端 lost-commit/backup tag 一致性(默认)')
  console.log('  --fetch       从 origin 拉回所有 lost-commit/backup tag')
  console.log('  --auto-push   把本地 lost-commit/backup tag 推到 origin(post-commit 钩子调用)')
  console.log('')
  console.log('标志:')
  console.log('  --dry-run     配合 --auto-push 用,只打印不实际 push')
  console.log('  --force       强制 push(覆盖远端),默认不允许')
  console.log('  --json        配合 --check 用,输出 JSON 格式')
  console.log('  --help        打印本帮助')
  console.log('')
  console.log('环境变量:')
  console.log(`  ${SKIP_ENV}=1   跳过 --auto-push 模式(紧急场景)`)
  console.log('')
  console.log('退出码:')
  console.log('  0  成功')
  console.log('  1  失败(不一致/不可达)')
  console.log('  2  异常(git 命令找不到等)')
}

function listLocalLostTags() {
  const out = run('git tag -l "lost-commit/*"', { allowFail: true })
  if (!out) return []
  return out.split('\n').filter(Boolean).sort()
}

function listLocalBackupTags() {
  const out = run('git tag -l "backup/*"', { allowFail: true })
  if (!out) return []
  return out.split('\n').filter(Boolean).sort()
}

function listRemoteLostTags() {
  const out = run('git ls-remote origin "refs/tags/lost-commit/*"', { allowFail: true })
  return parseRemoteTagOutput(out)
}

function listRemoteBackupTags() {
  const out = run('git ls-remote origin "refs/tags/backup/*"', { allowFail: true })
  return parseRemoteTagOutput(out)
}

function parseRemoteTagOutput(stdout) {
  if (!stdout) return []
  return stdout
    .split('\n')
    .filter((l) => l && !l.endsWith('^{}'))
    .map((l) => l.split('\t')[1] || '')
    .filter(Boolean)
    .map((ref) => ref.replace(/^refs\/tags\//, ''))
    .sort()
}

function diffTagSets(local, remote) {
  const localSet = new Set(local)
  const remoteSet = new Set(remote)
  const onlyLocal = local.filter((t) => !remoteSet.has(t))
  const onlyRemote = remote.filter((t) => !localSet.has(t))
  const both = local.filter((t) => remoteSet.has(t))
  return { onlyLocal, onlyRemote, both }
}

function getTagCommitHash(tag) {
  // 优先 peel ^{} 处理 annotated tag;lightweight tag 直接返回
  const peeled = run(`git rev-parse --verify ${tag}^{} 2>/dev/null`, { allowFail: true })
  if (peeled) return peeled
  return run(`git rev-parse --verify ${tag}`, { allowFail: true })
}

function isTagReachable(tag) {
  const hash = getTagCommitHash(tag)
  if (!hash) return { ok: false, hash: '', reason: 'tag 解析失败' }
  const exists = run(`git cat-file -e ${hash} 2>&1`, { allowFail: true })
  if (exists) {
    return { ok: false, hash, reason: 'cat-file 失败' }
  }
  return { ok: true, hash, reason: '' }
}

function checkMode() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 tag 同步(不推荐)${C.reset}`)
  }

  if (!isJson) {
    console.log(`${C.cyan}${C.bold}🏷️  Lost commit tag 一致性校验(AGENTS.md §22 配套)${C.reset}`)
  }

  const localLost = listLocalLostTags()
  const localBackup = listLocalBackupTags()
  const remoteLost = listRemoteLostTags()
  const remoteBackup = listRemoteBackupTags()

  const lostDiff = diffTagSets(localLost, remoteLost)
  const backupDiff = diffTagSets(localBackup, remoteBackup)

  // 可达性检查
  const allLocalTags = [...localLost, ...localBackup]
  const reachability = allLocalTags.map((tag) => ({ tag, ...isTagReachable(tag) }))

  if (isJson) {
    const result = {
      status: 'ok',
      local: { lostCommit: localLost, backup: localBackup },
      remote: { lostCommit: remoteLost, backup: remoteBackup },
      diff: {
        lostCommit: lostDiff,
        backup: backupDiff,
      },
      reachability,
      summary: {
        total: allLocalTags.length,
        reachable: reachability.filter((r) => r.ok).length,
        unreachable: reachability.filter((r) => !r.ok).length,
      },
    }
    const hasIssue =
      lostDiff.onlyLocal.length > 0 ||
      lostDiff.onlyRemote.length > 0 ||
      backupDiff.onlyLocal.length > 0 ||
      backupDiff.onlyRemote.length > 0 ||
      reachability.some((r) => !r.ok)
    result.status = hasIssue ? 'fail' : 'ok'
    console.log(JSON.stringify(result, null, 2))
    process.exit(hasIssue ? 1 : 0)
  }

  // ── 1. 本地 lost-commit tag ──
  console.log(header('1. 本地 lost-commit/* tag'))
  if (localLost.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    for (const tag of localLost) {
      const r = isTagReachable(tag)
      const icon = r.ok ? C.green + '✅' : C.red + '❌'
      console.log(`  ${icon} ${C.cyan}${tag}${C.reset} → ${C.dim}${r.hash.slice(0, 12) || '?'}${C.reset}${r.ok ? '' : `  (${r.reason})`}${C.reset}`)
    }
  }

  // ── 2. 本地 backup tag ──
  console.log(header('2. 本地 backup/* tag'))
  if (localBackup.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    for (const tag of localBackup) {
      const r = isTagReachable(tag)
      const icon = r.ok ? C.green + '✅' : C.red + '❌'
      console.log(`  ${icon} ${C.cyan}${tag}${C.reset} → ${C.dim}${r.hash.slice(0, 12) || '?'}${C.reset}${r.ok ? '' : `  (${r.reason})`}${C.reset}`)
    }
  }

  // ── 3. 远端 lost-commit tag ──
  console.log(header('3. 远端 lost-commit/* tag(origin)'))
  if (remoteLost.length === 0) {
    console.log(`  ${C.yellow}⚠️  远端无 lost-commit tag(本地 tag 未 push 风险)${C.reset}`)
  } else {
    for (const tag of remoteLost) {
      const localMark = lostDiff.both.includes(tag) ? C.green + '✓本地' : C.yellow + '⚠ 仅远端'
      console.log(`  ${C.cyan}${tag}${C.reset}  ${localMark}${C.reset}`)
    }
  }

  // ── 4. 远端 backup tag ──
  console.log(header('4. 远端 backup/* tag(origin)'))
  if (remoteBackup.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    for (const tag of remoteBackup) {
      const localMark = backupDiff.both.includes(tag) ? C.green + '✓本地' : C.yellow + '⚠ 仅远端'
      console.log(`  ${C.cyan}${tag}${C.reset}  ${localMark}${C.reset}`)
    }
  }

  // ── 5. 完整性判定 ──
  console.log(header('5. 完整性判定'))
  const issues = []
  let ok = true

  if (lostDiff.onlyLocal.length > 0) {
    issues.push(`${lostDiff.onlyLocal.length} 个 lost-commit tag 仅本地(未 push):${lostDiff.onlyLocal.join(', ')}`)
    ok = false
  }
  if (lostDiff.onlyRemote.length > 0) {
    issues.push(`${lostDiff.onlyRemote.length} 个 lost-commit tag 仅远端(本地缺失):${lostDiff.onlyRemote.join(', ')} — 修复:node scripts/sync-lost-commit-tags.mjs --fetch`)
    ok = false
  }
  if (backupDiff.onlyLocal.length > 0) {
    issues.push(`${backupDiff.onlyLocal.length} 个 backup tag 仅本地(未 push):${backupDiff.onlyLocal.join(', ')}`)
    ok = false
  }
  if (backupDiff.onlyRemote.length > 0) {
    issues.push(`${backupDiff.onlyRemote.length} 个 backup tag 仅远端(本地缺失):${backupDiff.onlyRemote.join(', ')} — 修复:node scripts/sync-lost-commit-tags.mjs --fetch`)
    ok = false
  }
  const unreachable = reachability.filter((r) => !r.ok)
  if (unreachable.length > 0) {
    issues.push(`${unreachable.length} 个 tag 对象不可达:${unreachable.map((r) => r.tag).join(', ')} — 修复:node scripts/sync-lost-commit-tags.mjs --fetch`)
    ok = false
  }

  if (ok) {
    console.log(`  ${C.green}✅ 所有 lost-commit/backup tag 本地+远端一致,对象全部可达${C.reset}`)
    console.log(`  ${C.dim}  本地: ${localLost.length + localBackup.length} 个 | 远端: ${remoteLost.length + remoteBackup.length} 个 | 可达: ${reachability.filter((r) => r.ok).length}/${reachability.length}${C.reset}`)
    process.exit(0)
  }

  for (const i of issues) {
    console.log(`  ${C.yellow}⚠  ${i}${C.reset}`)
  }
  console.log(`\n${C.red}${C.bold}❌ tag 一致性校验失败${C.reset}`)
  console.log(`  修复方法:${C.cyan}node scripts/sync-lost-commit-tags.mjs --fetch${C.reset}`)
  process.exit(1)
}

function fetchMode() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 — 但 --fetch 模式不受 SKIP 影响(手动恢复必须执行)${C.reset}`)
  }
  console.log(`${C.cyan}${C.bold}📥 从 origin 拉回所有 lost-commit/backup tag${C.reset}`)

  const cmd = 'git fetch origin "refs/tags/lost-commit/*:refs/tags/lost-commit/*" "refs/tags/backup/*:refs/tags/backup/*"'
  console.log(`  ${C.dim}$ ${cmd}${C.reset}`)
  try {
    const stdout = run(cmd)
    if (stdout) console.log(stdout)
    console.log(`\n${C.green}✅ fetch 完成,正在校验一致性...${C.reset}`)
    // fetch 后自动 check
    if (isCheck) args.delete('--check') // 防止递归
    checkMode()
  } catch (e) {
    console.error(`${C.red}❌ fetch 失败:${C.reset}`, e?.message ?? e)
    process.exit(1)
  }
}

function autoPushMode() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 auto-push(不推荐)${C.reset}`)
    process.exit(0)
  }

  const localLost = listLocalLostTags()
  const localBackup = listLocalBackupTags()
  const allLocal = [...localLost, ...localBackup]

  if (allLocal.length === 0) {
    console.log(`${C.dim}🏷️  本地无 lost-commit/backup tag,跳过 push${C.reset}`)
    process.exit(0)
  }

  console.log(`${C.cyan}${C.bold}📤 推送 ${allLocal.length} 个 lost-commit/backup tag 到 origin${isDryRun ? ' (dry-run)' : ''}${C.reset}`)
  for (const tag of allLocal) {
    console.log(`     ${C.cyan}${tag}${C.reset}`)
  }

  let cmd
  if (isDryRun) {
    cmd = 'git push origin --dry-run --atomic refs/tags/lost-commit/* refs/tags/backup/*'
  } else if (isForce) {
    cmd = 'git push origin --force --atomic refs/tags/lost-commit/* refs/tags/backup/*'
    console.log(`  ${C.yellow}⚠️  --force 模式,会覆盖远端同名 tag${C.reset}`)
  } else {
    cmd = 'git push origin --atomic refs/tags/lost-commit/* refs/tags/backup/*'
  }

  console.log(`  ${C.dim}$ ${cmd}${C.reset}`)
  try {
    const stdout = run(cmd)
    if (stdout) console.log(stdout)
    if (isDryRun) {
      console.log(`\n${C.green}✅ dry-run 完成(未实际 push)${C.reset}`)
    } else {
      console.log(`\n${C.green}✅ push 完成,本地+远端 tag 已同步${C.reset}`)
    }
    process.exit(0)
  } catch (e) {
    console.error(`${C.red}❌ push 失败:${C.reset}`, e?.message ?? e)
    process.exit(1)
  }
}

function main() {
  if (isHelp) {
    printHelp()
    process.exit(0)
  }

  if (isFetch) {
    fetchMode()
    return
  }

  if (isAutoPush) {
    autoPushMode()
    return
  }

  // 默认 check 模式
  checkMode()
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
