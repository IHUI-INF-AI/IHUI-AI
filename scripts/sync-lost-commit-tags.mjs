#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
 *   --newest N    配合 --auto-push 用,按提交时间倒序只推最近 N 个远端缺失 tag
 *                 (2026-09-18 新增:大积压场景下唯一可行的离线备份方式,绕过积压闸门)
 *   --json        配合 --check 用,输出 JSON 格式结果(给 CI/上层调用方)
 *   --help        打印帮助并 exit 0
 *
 * 退出码:
 *   0 — 无 commit 丢失风险(「仅远端缺失」「tag 对象不可达」两项均通过;
 *       「仅本地未 push」为**告警**不计失败 —— 依据同 blocking 守门 30a 的判定,
 *       详见 checkMode 内 backlogCount 处注释)
 *   1 — 失败(存在仅远端缺失 或 tag 对象不可达)
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
import { execFileSync, execSync } from 'node:child_process'

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
// --newest N(2026-09-18 新增):有界补推 —— 按提交时间倒序只推最近 N 个远端缺失 tag。
// 用途:历史积压全量推送实测不可行(≥10s/个),但"最近丢失的 commit"必须有远端备份,
// 否则备份机制在大积压下等于失效。带该参数时绕过积压闸门。
const newestIdx = process.argv.indexOf('--newest')
const newestLimit = newestIdx >= 0 ? Number(process.argv[newestIdx + 1]) || 0 : 0
// 2026-09-17 根治:--auto-push 只推"远端缺失"的 tag(增量),不再每次全量推 5000 个。
//   旧行为: 每次 commit 后同步 `git push --atomic`(全部 tag) → 10+ 分钟阻塞 post-commit,
//   表现 = "推送早已完成但终端一直挂着等"。新行为: ls-remote 比对 → 只推缺失项(通常 0~3 个),
//   0 缺失时秒级退出;并加限流标记 + 超时,任何情况都不得长时间阻塞。
const PUSH_CHUNK_SIZE = Number(process.env.IHUI_TAG_PUSH_CHUNK || 20)
const PUSH_TIMEOUT_MS = Number(process.env.IHUI_TAG_PUSH_TIMEOUT_MS || 300_000)
// 2026-09-17 实测: 单个 tag 推送需连带上传其历史对象, 20 个 tag ≈ 10 分钟(网络瓶颈)。
// 因此 auto 模式(钩子内调用)设积压上限: 超过则只记录不推, 交人工/后台慢速收敛,
// 保证 commit 路径永远不受 tag 同步拖累。
const AUTO_PUSH_MAX_BACKLOG = Number(process.env.IHUI_TAG_AUTO_MAX || 50)
// 限流:同一间隔内(默认 60s)重复调用直接跳过,避免连续 commit 反复 ls-remote
const THROTTLE_MS = Number(process.env.IHUI_TAG_SYNC_THROTTLE_MS || 60_000)

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    if (opts.allowFail) return ''
    throw e
  }
}

/**
 * 无 shell 的 git 调用(2026-09-18)。
 * `run()` 经 execSync → Windows 上是 cmd.exe,`for-each-ref --format=%(refname:short)`
 * 这类参数含 `%(`,会被 cmd 当作 `%VAR%` 变量展开处理,且单引号不被剥离
 * → 格式串被破坏。execFileSync 直接传 argv,不经 shell,彻底规避。
 * 同时支持 `input`(cat-file --batch-check 大批量判存在性需要)。
 */
function runGit(args, opts = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    }).trim()
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
  console.log('  --newest N    配合 --auto-push 用,按提交时间倒序只推最近 N 个缺失 tag')
  console.log('                (大积压场景的可行补推方式,绕过积压闸门)')
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

/**
 * 批量可达性检查(2026-09-18 重写)。旧实现有两个缺陷:
 *   1) 语义: `git cat-file -e <hash>` 成功时**无输出**、失败时 execSync 抛错并被
 *      allowFail 吞成空串 → 两种结果都得到 `''`,判定恒为 ok:true,
 *      **对象缺失永远检不出来**(假绿)。
 *   2) 性能: 每个 tag 各起 2 个 git 进程,本地 5000+ tag ≈ 1 万次进程启动。
 * 改为:1 次 for-each-ref 取 hash + 1 次 cat-file --batch-check 批量判存在性。
 */
function checkReachabilityBulk(tags) {
  if (tags.length === 0) return []
  const refOut = runGit(
    [
      'for-each-ref',
      '--format=%(refname:short)|%(objectname)|%(*objectname)',
      'refs/tags/lost-commit',
      'refs/tags/backup',
    ],
    { allowFail: true },
  )
  const hashByTag = new Map()
  for (const line of refOut.split('\n')) {
    if (!line) continue
    const [name, obj, peeled] = line.split('|')
    if (name) hashByTag.set(name, peeled || obj || '')
  }
  const hashes = [...new Set([...hashByTag.values()].filter(Boolean))]
  const checkOut =
    hashes.length === 0
      ? ''
      : runGit(['cat-file', '--batch-check'], {
          allowFail: true,
          input: hashes.map((h) => `${h}\n`).join(''),
          maxBuffer: 64 * 1024 * 1024,
        })
  const missing = new Set()
  for (const line of checkOut.split('\n')) {
    if (!line) continue
    const [hash, type] = line.split(' ')
    if (type === 'missing' || !type) missing.add(hash)
  }
  return tags.map((tag) => {
    const hash = hashByTag.get(tag) ?? ''
    if (!hash) return { tag, ok: false, hash: '', reason: 'tag 解析失败' }
    if (missing.has(hash)) return { tag, ok: false, hash, reason: 'cat-file 失败' }
    return { tag, ok: true, hash, reason: '' }
  })
}

/**
 * 按提交时间倒序排列 tag(2026-09-18)。
 * auto-push 在大积压下改为"始终推最近的一批",必须按新近度排序 —— 否则推的是
 * 字典序靠前的历史 tag,新丢的 commit 反而永远排不上队。
 */
function sortTagsByRecency(tags) {
  if (tags.length === 0) return []
  const ordered = runGit(
    [
      'for-each-ref',
      '--sort=-creatordate',
      '--format=%(refname:short)',
      'refs/tags/lost-commit',
      'refs/tags/backup',
    ],
    { allowFail: true },
  )
    .split('\n')
    .filter(Boolean)
  const rank = new Map(ordered.map((n, i) => [n, i]))
  const unranked = Number.MAX_SAFE_INTEGER
  return [...tags].sort(
    (a, b) => (rank.get(a) ?? unranked) - (rank.get(b) ?? unranked),
  )
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

  // 可达性检查(批量,见 checkReachabilityBulk)
  const allLocalTags = [...localLost, ...localBackup]
  const reachability = checkReachabilityBulk(allLocalTags)
  const unreachableTags = reachability.filter((r) => !r.ok)

  // 2026-09-18:「仅本地(未 push)」降级为**告警**,不再判失败。两条依据:
  //   ① blocking 守门 30a(check-commit-loss-guard.mjs --blocking)对同一不变量也只 warn
  //      (源码注释「仅本地不阻塞,只 warn」)—— 两个脚本判同一件事必须一致,否则
  //      手动 tag:sync 恒红而提交门恒绿,信号互相矛盾;
  //   ② 历史积压全量推送实测不可行(≥10s/个 × 近 5000 个 ≈ 14 小时),把不可完成的
  //      动作当失败项 → 本检查永久变红,反而失去告警价值。
  // 仍判失败的只有「仅远端(本地缺失)」与「tag 对象不可达」—— 那才是真可能丢 commit。
  const backlogCount = lostDiff.onlyLocal.length + backupDiff.onlyLocal.length

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
        unreachable: unreachableTags.length,
        unpushedBacklog: backlogCount,
      },
    }
    const hasIssue =
      lostDiff.onlyRemote.length > 0 ||
      backupDiff.onlyRemote.length > 0 ||
      unreachableTags.length > 0
    result.status = hasIssue ? 'fail' : 'ok'
    console.log(JSON.stringify(result, null, 2))
    process.exit(hasIssue ? 1 : 0)
  }

  // 逐条明细上限:本地 5000+ tag 逐条打印会淹没终端(旧实现输出近 5000 行)
  const DETAIL_LIMIT = 10
  const reachByTag = new Map(reachability.map((r) => [r.tag, r]))
  const printTagDetail = (tags) => {
    for (const tag of tags.slice(0, DETAIL_LIMIT)) {
      const r = reachByTag.get(tag) ?? { ok: true, hash: '', reason: '' }
      const icon = r.ok ? C.green + '✅' : C.red + '❌'
      console.log(`  ${icon} ${C.cyan}${tag}${C.reset} → ${C.dim}${r.hash.slice(0, 12) || '?'}${C.reset}${r.ok ? '' : `  (${r.reason})`}${C.reset}`)
    }
    if (tags.length > DETAIL_LIMIT) {
      console.log(`  ${C.dim}…另有 ${tags.length - DETAIL_LIMIT} 个未逐一列出${C.reset}`)
    }
  }

  // ── 1. 本地 lost-commit tag ──
  console.log(header(`1. 本地 lost-commit/* tag(共 ${localLost.length} 个)`))
  if (localLost.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    printTagDetail(localLost)
  }

  // ── 2. 本地 backup tag ──
  console.log(header(`2. 本地 backup/* tag(共 ${localBackup.length} 个)`))
  if (localBackup.length === 0) {
    console.log(`  ${C.dim}(无)${C.reset}`)
  } else {
    printTagDetail(localBackup)
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
  const warnings = []
  let ok = true
  // 名称列表截断:本地 5000+ tag 时全量 join 会在一行打印近 5000 个名字(旧实现行为)
  const brief = (arr) =>
    arr.length <= 5 ? arr.join(', ') : `${arr.slice(0, 5).join(', ')} … 等 ${arr.length} 个`

  if (lostDiff.onlyRemote.length > 0) {
    issues.push(`${lostDiff.onlyRemote.length} 个 lost-commit tag 仅远端(本地缺失):${brief(lostDiff.onlyRemote)} — 修复:node scripts/sync-lost-commit-tags.mjs --fetch`)
    ok = false
  }
  if (backupDiff.onlyRemote.length > 0) {
    issues.push(`${backupDiff.onlyRemote.length} 个 backup tag 仅远端(本地缺失):${brief(backupDiff.onlyRemote)} — 修复:node scripts/sync-lost-commit-tags.mjs --fetch`)
    ok = false
  }
  if (unreachableTags.length > 0) {
    issues.push(`${unreachableTags.length} 个 tag 对象不可达:${brief(unreachableTags.map((r) => r.tag))} — 修复:node scripts/sync-lost-commit-tags.mjs --fetch`)
    ok = false
  }
  // 「仅本地(未 push)」= 告警,不计失败 —— 依据见上方 backlogCount 处的注释
  if (lostDiff.onlyLocal.length > 0) {
    warnings.push(
      `${lostDiff.onlyLocal.length} 个 lost-commit tag 仅本地(未 push):${brief(lostDiff.onlyLocal)}`,
    )
  }
  if (backupDiff.onlyLocal.length > 0) {
    warnings.push(
      `${backupDiff.onlyLocal.length} 个 backup tag 仅本地(未 push):${brief(backupDiff.onlyLocal)}`,
    )
  }

  if (ok) {
    console.log(`  ${C.green}✅ 无 commit 丢失风险(仅远端缺失 / 对象不可达 两项均通过)${C.reset}`)
    console.log(`  ${C.dim}  本地: ${localLost.length + localBackup.length} 个 | 远端: ${remoteLost.length + remoteBackup.length} 个 | 对象可达: ${reachability.filter((r) => r.ok).length}/${reachability.length}${C.reset}`)
    if (warnings.length > 0) {
      console.log(
        `  ${C.yellow}⚠️  未 push 积压 ${backlogCount} 个(本地 tag 已足以防 git gc 修剪;远端备份仅防本机丢失)${C.reset}`,
      )
      for (const w of warnings) console.log(`  ${C.dim}   ${w}${C.reset}`)
      console.log(
        `  ${C.dim}   有界补推最近 N 个:node scripts/sync-lost-commit-tags.mjs --auto-push --newest 20${C.reset}`,
      )
    }
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

  // ── 限流:间隔内重复调用直接跳过(避免连续 commit 反复 ls-remote)──
  // 注意: linked worktree 下 .git 是文件,须经 git rev-parse --git-dir 解析真实目录
  const gitDir = run('git rev-parse --git-dir', { allowFail: true }) || '.git'
  const marker = `${gitDir}/ihui-last-tag-sync`
  const now = Date.now()
  if (!isForce) {
    try {
      const last = Number(run(`cat ${marker}`, { allowFail: true }) || 0)
      if (last && now - last < THROTTLE_MS) {
        console.log(
          `${C.dim}🏷️  tag 同步限流中(距上次 ${Math.round((now - last) / 1000)}s < ${Math.round(THROTTLE_MS / 1000)}s),跳过${C.reset}`,
        )
        process.exit(0)
      }
    } catch {
      /* 标记缺失/损坏 → 继续执行 */
    }
  }

  const localLost = listLocalLostTags()
  const localBackup = listLocalBackupTags()
  const allLocal = [...localLost, ...localBackup]

  if (allLocal.length === 0) {
    console.log(`${C.dim}🏷️  本地无 lost-commit/backup tag,跳过 push${C.reset}`)
    process.exit(0)
  }

  // ── 增量:只推远端缺失的 tag(2026-09-17 根治全量推 10+ 分钟阻塞)──
  const remoteAll = new Set([...listRemoteLostTags(), ...listRemoteBackupTags()])
  const missingAll = allLocal.filter((t) => !remoteAll.has(t))

  if (missingAll.length === 0) {
    run(`printf %s ${now} > ${marker}`, { allowFail: true })
    console.log(
      `${C.green}✅ 全部 ${allLocal.length} 个 tag 远端已存在,无需 push(增量同步,秒级完成)${C.reset}`,
    )
    process.exit(0)
  }

  // ── 有界补推(2026-09-18,--newest N)──
  // 积压 4964 个属历史沉淀,永远不会自然降到阈值以下;原「超阈值整体跳过」使**新产生的
  // tag 也永远拿不到远端备份** —— 备份机制在大积压下等于失效。--newest 提供唯一可行的
  // 离线备份手段:按提交时间倒序取最近 N 个,单次耗时可控(≈10s/个),并绕过积压闸门。
  const missing =
    newestLimit > 0 ? sortTagsByRecency(missingAll).slice(0, newestLimit) : missingAll
  const skippedBacklog = missingAll.length - missing.length

  console.log(
    `${C.cyan}${C.bold}📤 增量推送 ${missing.length} 个 tag 到 origin${isDryRun ? ' (dry-run)' : ''}(远端缺失共 ${missingAll.length} 个)${C.reset}`,
  )

  // ── 积压闸门(2026-09-17):超阈值只记录不推 ──
  // 实测单 tag 推送需连带上传历史对象(20 个 ≈ 10 分钟),大积压推送在网络上不可行,
  // 且会拖死 commit 路径。auto 模式直接跳过并留待办;人工补推用 --newest / --force 绕过。
  if (!isForce && newestLimit === 0 && missing.length > AUTO_PUSH_MAX_BACKLOG) {
    console.log(
      `${C.yellow}⚠️  待推积压 ${missing.length} 个 > 阈值 ${AUTO_PUSH_MAX_BACKLOG}(实测 ≥10s/个,全量约 ${Math.ceil((missing.length * 10) / 3600)} 小时)${C.reset}`,
    )
    console.log(
      `${C.dim}   已跳过(不阻塞 commit)。有界补推最近 20 个(推荐):${C.reset}`,
    )
    console.log(
      `${C.dim}   node scripts/sync-lost-commit-tags.mjs --auto-push --newest 20${C.reset}`,
    )
    console.log(
      `${C.dim}   全量补推(耗时极长):IHUI_TAG_PUSH_CHUNK=20 node scripts/sync-lost-commit-tags.mjs --auto-push --force${C.reset}`,
    )
    console.log(
      `${C.dim}   注: 本地 tag 已足以防 git gc 修剪(标签即引用, gc 不会删可达对象); 远端备份仅防本机丢失。${C.reset}`,
    )
    // 写限流标记: 积压未变时后续 commit 直接跳过 ls-remote(再省 10s+)
    run(`printf %s ${Date.now()} > ${marker}`, { allowFail: true })
    process.exit(0)
  }
  if (skippedBacklog > 0) {
    console.log(
      `${C.dim}   (本次按新近度只取 ${missing.length} 个,历史积压 ${skippedBacklog} 个未推)${C.reset}`,
    )
  }
  if (missing.length <= 20) {
    for (const tag of missing) console.log(`     ${C.cyan}${tag}${C.reset}`)
  } else {
    for (const tag of missing.slice(0, 10)) console.log(`     ${C.cyan}${tag}${C.reset}`)
    console.log(`     ${C.dim}…另有 ${missing.length - 10} 个${C.reset}`)
  }

  if (isDryRun) {
    console.log(`
${C.green}✅ dry-run 完成(未实际 push)${C.reset}`)
    process.exit(0)
  }

  // 分块 push + 硬超时:任何单块绝不长时间挂起
  let pushed = 0
  const chunks = []
  for (let i = 0; i < missing.length; i += PUSH_CHUNK_SIZE) {
    chunks.push(missing.slice(i, i + PUSH_CHUNK_SIZE))
  }

  for (const [idx, chunk] of chunks.entries()) {
    const refspecs = chunk.map((t) => `refs/tags/${t}`).join(' ')
    const forceFlag = isForce ? '--force ' : ''
    const cmd = `git push ${forceFlag}--atomic origin ${refspecs}`
    console.log(
      `  ${C.dim}[${idx + 1}/${chunks.length}] $ git push --atomic origin <${chunk.length} tags>${forceFlag ? ' (--force)' : ''}${C.reset}`,
    )
    try {
      run(cmd, { timeout: PUSH_TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] })
      pushed += chunk.length
    } catch (e) {
      // 单块失败不阻断:标记未更新,下次提交会重试该块
      const firstLine = String(e?.message ?? e).split(String.fromCharCode(10))[0]
      console.error(
        `${C.yellow}⚠️  第 ${idx + 1} 块 push 失败(${chunk.length} 个),下轮重试:${C.reset} ${firstLine}`,
      )
      break
    }
  }

  if (pushed > 0) {
    run(`printf %s ${Date.now()} > ${marker}`, { allowFail: true })
    console.log(`
${C.green}✅ tag 增量 push 完成:${pushed} 个已同步(本地+远端一致)${C.reset}`)
    process.exit(0)
  }

  console.log(`
${C.yellow}⚠️  无 tag 成功推送(已由限流/超时保护,不阻断 commit)${C.reset}`)
  process.exit(0)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
