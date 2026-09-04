#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
 *   4. 校验远程 lost-commit/backup tag 完整性 + tag 对象可达性
 *      (本地 tag 可能被 git gc 清理;远端 tag 缺失会导致 commit 永久丢失)
 *
 * --filter-stash 模式(guardian-runner 30a 注册):
 *   过滤掉 stash-like 悬空 commit(WIP / On main / index on main / untracked files on main),
 *   这些是 git stash / reset / merge 中间状态,不是真 commit 丢失。
 *   对未备份的 stash-like 悬空 commit,会从 subject 提取"原 commit hash"
 *   与 lostTag 集合比对,避免误报。
 *
 * 当前模式: blocking 模式(isBlocking=true)下,reset 操作或未备份悬空 commit → exit 1。
 * 远程 tag 完整性:仅远端 tag 缺失或 tag 对象不可达时 → exit 1(必须先 fetch 拉回);
 * 多余的本地 tag(远端没有)→ warn,不阻塞。
 *
 * 检查逻辑:
 *   1. git reflog --all --date=iso 最近 50 步
 *      → 含 'reset: moving to HEAD~' 或 'reset: moving to HEAD@{' → 告警
 *   2. git fsck --unreachable --no-reflogs
 *      → 含 'unreachable commit' 行 → 列出悬空 commit hash
 *   3. git tag -l "lost-commit/*" "backup/*"
 *      → 列出已 tag 备份的丢失 commit / 备份快照
 *   4. 远程 tag 完整性: git ls-remote origin 'refs/tags/lost-commit/*' 'refs/tags/backup/*'
 *      → 本地/远端 tag 集对比(仅远端缺失 → blocking;仅本地 → warn)
 *      → git cat-file -e <tag> / <tag>^{} 验证 tag 对象 + commit 对象可达性
 *   5. 综合判定(reflog reset / 未备份悬空 commit / 远端 tag 缺失 / tag 对象不可达)
 *
 * 退出码:
 *   0 — 通过(warn 告警可被忽略,但 stdout 仍打印提示)
 *   1 — blocking/strict 模式下有阻塞项(reflog reset / 未备份悬空 commit /
 *        远端 tag 缺失需 fetch / tag 对象不可达)
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

const SKIP_ENV = 'HUSKY_SKIP_COMMIT_LOSS_CHECK'
const isStrict = process.argv.includes('--strict')
const isBlocking = process.argv.includes('--blocking')
const isFilterStash = process.argv.includes('--filter-stash')
const skip = process.env[SKIP_ENV] === '1'

// 本地命令可放宽;网络命令(ls-remote)必须限时,防境外 GitHub 访问挂起阻塞 pre-commit
// (2026-08-17 实测:execSync 无 timeout 时 git ls-remote origin 可无限阻塞 → [30a] 守门卡死,
//  commit 永远无法完成;超时后按 allowFail 返回空,远程校验安全降级为跳过)
const REMOTE_TIMEOUT_MS = 15_000
// 本地 git 命令(批量 subject 获取)限时,防单次调用异常挂起
const LOCAL_GIT_TIMEOUT_MS = 10_000

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    if (opts.allowFail) return ''
    throw e
  }
}

// 2026-09-04 加固:不经 shell 的 git argv 直调(spawnSync).
// 实测本环境双重陷阱:
//  ① execSync/execFileSync 传 argv 数组时默认仍走 shell:true,node 会丢弃
//     args 数组(git 落到 usage 分支非零退出);
//  ② PATH 首位是 MSYS `git`(bash shim),直接 spawn 参数同样被吞.
// 解法:spawnSync(天然无 shell)+ where git 解析到 Git for Windows 真实二进制
// cmd\git.exe.自测见 scripts/tmp-verify-gitbin.mjs(2026-09-04 验证通过).
const GIT_BIN = (() => {
  if (process.platform !== 'win32') return 'git'
  try {
    const whereOut = execSync('where git', { encoding: 'utf8' })
    for (const raw of whereOut.split('\n')) {
      const p = raw.trim()
      if (/\\cmd\\git\.exe$/i.test(p)) return p
    }
    // 无 cmd\git.exe 时取第一个 .exe(排除 MSYS usr\bin 版)
    for (const raw of whereOut.split('\n')) {
      const p = raw.trim()
      if (/git\.exe$/i.test(p) && !/\\usr\\bin\\/i.test(p)) return p
    }
  } catch {
    /* where 失败时回退裸 git */
  }
  return 'git'
})()

function runGit(args, opts = {}) {
  const r = spawnSync(GIT_BIN, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  })
  if (r.status !== 0) {
    if (opts.allowFail) return ''
    throw new Error(
      `git ${args[0]} 失败(exit=${r.status}): ${(r.stderr || '').trim().slice(0, 200)}`,
    )
  }
  return (r.stdout || '').trim()
}

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

function detectResets() {
  // reflog 最近 50 步(每行包含: hash | ref@{} | action: subject)
  // 2026-07-26 升级:从 20 步扩到 50 步,覆盖更长期的 reset 历史
  const out = run('git reflog --all --date=iso -n 50', { allowFail: true })
  if (!out) return []
  const lines = out.split('\n')
  const resets = []
  for (const line of lines) {
    // 匹配 "reset: moving to HEAD~" / "reset: moving to HEAD@{1}" 等
    if (/reset:\s*moving to HEAD[~@]/.test(line)) {
      resets.push(line)
    }
  }
  // 2026-09-04 修复:若 reset 的源 commit(hash 即行首字段)已被 lost-commit/* tag
  // 备份,则该次 reset 不构成丢失风险,放行(与悬空 commit 的 tag 备份判定对齐)。
  // 否则历史 reset 会永久滞留 reflog 最近 50 步窗口内,无解阻塞所有后续 commit。
  const backedHashes = new Set(
    verifyAllTagReachability(listLostCommitTags())
      .map((r) => r.hash)
      .filter(Boolean),
  )
  return resets.filter((line) => {
    const srcHash = line.trim().split(/\s+/)[0] || ''
    if (!srcHash) return true
    // 前缀匹配(git 对唯一对象输出短 hash)
    for (const h of backedHashes) if (h.startsWith(srcHash) || srcHash.startsWith(h)) return false
    return true
  })
}

function isStashSubject(subject) {
  if (!subject) return false
  // stash-like subject 形如 "WIP on <branch>: <hash> <msg>" / "On <branch>: <hash> <msg>"
  // / "index on <branch>: <hash> <msg>" / "untracked files on <branch>: <hash> <msg>"
  // 2026-08-17 修复:原正则只匹配 "index on main:"/"On main:",漏掉其他分支(如
  // fix/* 分支)产生的 stash 索引快照,导致误报"未备份悬空 commit"阻塞 commit。
  // 改为匹配任意分支名(冒号前为非空非空白串),与 HASH_EXTRACT_REGEX 保持一致。
  return (
    /^WIP on /.test(subject) ||
    /^On \S+: /.test(subject) ||
    /^index on \S+: /.test(subject) ||
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
  // 2026-08-17 性能修复:原实现对每个 hash 单独 execSync(git log -1),仓库悬空 commit
  // 数百个时累积 10+ 分钟,阻塞 pre-commit。改为 git log --no-walk 分批批量获取 subject。
  // 注意:--no-walk 输出顺序与参数顺序不一致(实测 058d/1630/2b3f vs 传参 058d/ecc5/...),
  // 必须用 %H 完整 hash 建 map 关联,严禁按行索引对应(曾致 stash-like 过滤错位误报)。
  const BATCH = 50
  const subjectByHash = new Map()
  for (let i = 0; i < hashes.length; i += BATCH) {
    const batch = hashes.slice(i, i + BATCH)
    const out = run(
      `git log --no-walk --format=%H%x09%s ${batch.join(' ')}`,
      { allowFail: true, timeout: LOCAL_GIT_TIMEOUT_MS },
    )
    if (!out) continue
    for (const line of out.split('\n')) {
      const [hash, ...rest] = line.split('\t')
      if (hash) subjectByHash.set(hash, rest.join('\t'))
    }
  }
  return hashes.filter((c) => !isStashSubject(subjectByHash.get(c) || ''))
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

// 2026-07-26 升级:远程 tag 完整性校验(防"本地 tag 被 git gc + 远端 fetch 失败"事故复发)
// 解析 git ls-remote 输出,过滤掉 ^{} peel 行(只保留 tag 引用本身)
// 注意:不能依赖 cmd 的引号剥离行为——run(shell:true)下 node 把双引号原样传给 cmd,
// cmd 内 git 收到带字面引号的 pathspec 会匹配不到任何 ref(与手动 PowerShell 调用行为不同).
// 用 [^ ] 字符类显式排除空格 glob,无需引号.
function parseRemoteTagOutput(stdout) {
  if (!stdout) return []
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith('^{}'))
    .map((l) => l.split(/\s+/))
    .filter((cols) => cols.length >= 2)
    .map((cols) => cols[1].replace(/^refs\/tags\//, ''))
    .filter(Boolean)
}

function listRemoteLostCommitTags() {
  // ls-remote 可能因网络/凭据失败,失败时返回空数组(不抛错)
  // Windows 上 git.exe 在 pipe stdio 模式下 schannel SSL handshake 不稳定,
  // 必须用 shell:true 走 cmd 包装器(参考 PowerShell 调用 git 的成功行为)
  // 2026-08-17 加 timeout:境外 GitHub 访问慢时 execSync 无限阻塞(实测 >12min),
  // 导致 pre-commit [30a] 卡死、commit 无法完成。15s 超时按失败处理(安全降级跳过远程校验)。
  const out = run('git ls-remote origin "refs/tags/lost-commit/[^ ]*"', {
    allowFail: true,
    shell: true,
    timeout: REMOTE_TIMEOUT_MS,
  })
  return parseRemoteTagOutput(out)
}

function listRemoteBackups() {
  // 同上:加 timeout 防境外网络无限阻塞(2026-08-17)
  const out = run('git ls-remote origin "refs/tags/backup/[^ ]*"', {
    allowFail: true,
    shell: true,
    timeout: REMOTE_TIMEOUT_MS,
  })
  return parseRemoteTagOutput(out)
}

// 对所有本地 lost-commit/* + backup/* tag 做可达性校验
// 2026-08-17 性能修复:原实现对每个 tag 单独 execSync(git rev-parse + cat-file -e),
// lost-commit tag 数千个时累积 10-30 分钟阻塞 pre-commit。改为一次 git for-each-ref
// 批量获取全部 tag 的 objectname + peeled objectname,内存组装结果(实测 <2s)。
function verifyAllTagReachability(tags) {
  if (tags.length === 0) return []
  const out = run(
    'git for-each-ref --format=%(refname:short)%09%(objectname)%09%(*objectname) refs/tags/lost-commit refs/tags/backup',
    { allowFail: true, timeout: LOCAL_GIT_TIMEOUT_MS },
  )
  if (!out) return []
  // shortName → { obj, peeled }
  const infoByTag = new Map()
  for (const line of out.split('\n')) {
    const [shortName, obj, peeled] = line.split('\t')
    if (shortName) infoByTag.set(shortName, { obj: obj || '', peeled: peeled || '' })
  }
  return tags.map((tag) => {
    const info = infoByTag.get(tag)
    const result = { tag, hash: '', tagReachable: false, commitReachable: false, reason: '' }
    if (!info) {
      result.reason = 'for-each-ref 未列出该 tag(ref 缺失)'
      return result
    }
    // for-each-ref 能列出即对象可达;annotated tag 用 peeled commit,lightweight 直接用 obj
    result.hash = info.peeled || info.obj
    result.tagReachable = true
    result.commitReachable = true
    result.ok = true
    return result
  })
}

// 对比两个 tag 集合,返回 { onlyLocal, onlyRemote, both }
function compareTagSets(local, remote) {
  const localSet = new Set(local)
  const remoteSet = new Set(remote)
  return {
    onlyLocal: local.filter((t) => !remoteSet.has(t)),
    onlyRemote: remote.filter((t) => !localSet.has(t)),
    both: local.filter((t) => remoteSet.has(t)),
  }
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
  // 2026-07-26 升级:远程 tag 完整性校验
  const remoteLostTags = listRemoteLostCommitTags()
  const remoteBackups = listRemoteBackups()
  const allLocalBackupTags = [...lostTags, ...backups]
  const reachability = verifyAllTagReachability(allLocalBackupTags)
  const lostTagDiff = compareTagSets(lostTags, remoteLostTags)
  const backupTagDiff = compareTagSets(backups, remoteBackups)

  // ── 1. reflog reset 检测 ──
  console.log(header('1. reflog 最近 50 步 reset 操作检测'))
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
    // 2026-08-17 性能修复:原实现对每个 tag 单独 git rev-list + git log(数千个 tag
    // 时 20+ 分钟)。改为一次 for-each-ref 拿全部 tag 的 commit hash + 一次
    // git log --no-walk 批量拿 subject(复用 verifyAllTagReachability 的批量思路)。
    const subjByHash = new Map()
    const refs = lostTags.map((t) => `refs/tags/${t}`).join(' ')
    const refOut = run(
      `git for-each-ref --format=%(refname:short)%09%(*objectname)%09%(objectname) ${refs}`,
      { allowFail: true, timeout: LOCAL_GIT_TIMEOUT_MS },
    )
    const tagToHash = new Map()
    for (const line of (refOut || '').split('\n')) {
      const [shortName, peeled, obj] = line.split('\t')
      if (shortName) tagToHash.set(shortName, (peeled || obj || '').trim())
    }
    const uniqueHashes = [...new Set(tagToHash.values()).values()].filter(Boolean)
    const HASH_BATCH = 50
    for (let i = 0; i < uniqueHashes.length; i += HASH_BATCH) {
      const batch = uniqueHashes.slice(i, i + HASH_BATCH)
      const subjOut = run(
        `git log --no-walk --format=%H%x09%s ${batch.join(' ')}`,
        { allowFail: true, timeout: LOCAL_GIT_TIMEOUT_MS },
      )
      // --no-walk 输出顺序与参数不一致,按 %H 完整 hash 建 map(勿按行索引对应)
      for (const line of (subjOut || '').split('\n')) {
        const [hash, ...rest] = line.split('\t')
        if (hash) subjByHash.set(hash, rest.join('\t'))
      }
    }
    for (const tag of lostTags) {
      const hash = tagToHash.get(tag) || ''
      const short = hash.slice(0, 12) || '?'
      console.log(`     ${C.cyan}${tag}${C.reset} → ${C.dim}${short}${C.reset}  ${subjByHash.get(hash) || ''}`)
    }
  }

  if (backups.length > 0) {
    console.log(`\n  ${C.dim}backup/* tag:${C.reset}`)
    for (const tag of backups) {
      const hash = run(`git rev-list -1 ${tag}`, { allowFail: true })
      console.log(`     ${C.cyan}${tag}${C.reset} → ${C.dim}${hash?.slice(0, 12) || '?'}${C.reset}`)
    }
  }

  // ── 5. 远程 tag 完整性(2026-07-26 升级,放在综合判定之前) ──
  console.log(header('5. 远程 tag 完整性(本地 vs origin)'))
  console.log(`  ${C.dim}本地 lost-commit/*: ${lostTags.length} 个 | 本地 backup/*: ${backups.length} 个${C.reset}`)
  console.log(`  ${C.dim}远端 lost-commit/*: ${remoteLostTags.length} 个 | 远端 backup/*: ${remoteBackups.length} 个${C.reset}`)

  // 5.1 lost-commit 差异
  console.log(`\n  ${C.bold}lost-commit/* 差异:${C.reset}`)
  if (lostTagDiff.onlyLocal.length === 0 && lostTagDiff.onlyRemote.length === 0) {
    console.log(`    ${C.green}✅ 本地+远端完全一致${C.reset}`)
  } else {
    if (lostTagDiff.onlyLocal.length > 0) {
      console.log(
        `    ${C.yellow}⚠️  仅本地(${lostTagDiff.onlyLocal.length} 个,未 push):${C.reset} ${lostTagDiff.onlyLocal.map((t) => C.cyan + t + C.reset).join(', ')}`,
      )
    }
    if (lostTagDiff.onlyRemote.length > 0) {
      console.log(
        `    ${C.red}❌ 仅远端(${lostTagDiff.onlyRemote.length} 个,本地缺失 — 必须 fetch):${C.reset} ${lostTagDiff.onlyRemote.map((t) => C.cyan + t + C.reset).join(', ')}`,
      )
    }
  }

  // 5.2 backup 差异
  console.log(`\n  ${C.bold}backup/* 差异:${C.reset}`)
  if (backupTagDiff.onlyLocal.length === 0 && backupTagDiff.onlyRemote.length === 0) {
    console.log(`    ${C.green}✅ 本地+远端完全一致${C.reset}`)
  } else {
    if (backupTagDiff.onlyLocal.length > 0) {
      console.log(
        `    ${C.yellow}⚠️  仅本地(${backupTagDiff.onlyLocal.length} 个,未 push):${C.reset} ${backupTagDiff.onlyLocal.map((t) => C.cyan + t + C.reset).join(', ')}`,
      )
    }
    if (backupTagDiff.onlyRemote.length > 0) {
      console.log(
        `    ${C.red}❌ 仅远端(${backupTagDiff.onlyRemote.length} 个,本地缺失 — 必须 fetch):${C.reset} ${backupTagDiff.onlyRemote.map((t) => C.cyan + t + C.reset).join(', ')}`,
      )
    }
  }

  // 5.3 tag 对象可达性
  const unreachableTags = reachability.filter((r) => !r.ok)
  console.log(`\n  ${C.bold}tag 对象可达性(annotated tag peel 验证):${C.reset}`)
  if (allLocalBackupTags.length === 0) {
    console.log(`    ${C.dim}(无 lost-commit/backup tag 需校验)${C.reset}`)
  } else if (unreachableTags.length === 0) {
    console.log(
      `    ${C.green}✅ 全部 ${reachability.length} 个 tag 对象可达(tag + commit 都可访问)${C.reset}`,
    )
  } else {
    console.log(
      `    ${C.red}❌ ${unreachableTags.length}/${reachability.length} 个 tag 对象不可达:${C.reset}`,
    )
    for (const r of unreachableTags) {
      const hash = r.hash ? r.hash.slice(0, 12) : '?'
      console.log(
        `       ${C.cyan}${r.tag}${C.reset} → ${C.dim}${hash}${C.reset}  ${C.red}(${r.reason})${C.reset}`,
      )
    }
    console.log(
      `    ${C.yellow}💡 修复:运行 ${C.cyan}node scripts/sync-lost-commit-tags.mjs --fetch${C.yellow} 从 origin 拉回 tag${C.reset}`,
    )
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
    // 2026-08-28 性能修复:原实现对每个 lost-commit tag 单独 execSync(git rev-list -1),
    // 数千个 tag 时累积 5+ 分钟阻塞 pre-commit [30a]。改用上方 verifyAllTagReachability
    // 已通过单次 git for-each-ref 批量算出的 hash(peeled || obj),零额外子进程。
    const lostTagNames = new Set(lostTags)
    const backedUp = new Set(
      reachability
        .filter((r) => lostTagNames.has(r.tag))
        .map((r) => r.hash)
        .filter(Boolean),
    )
    // 2026-09-04 修复:stash WIP/index commit 与其原 base commit 的树完全一致
    // (stash 只额外记录 untracked 文件,而 untracked 不进 commit 对象).
    // 因此只要悬空 commit subject 内嵌的原 hash 在备份集(base)或其 tree 被任一
    // 备份 tag 覆盖,其内容即可完整重建,不构成丢失风险 → 放行.
    // (原实现仅按 commit hash / stash subject 内嵌 hash 比对,并行会话高频
    // stash/drop 导致每次操作新增 2 个未备份悬空 commit,死锁所有后续 commit.)
    // ⚠ 重要事实修正(2026-09-04 二次诊断):"index on main" commit 是 stash
    //   时暂存区快照,与 HEAD/base 树**并不恒等**(部分 stage 场景),纯 tree
    //   等价判定对这类 commit 会漏放;且 stash 链 parent/grandparent 均不可达
    //   时唯一可靠出口是显式 tag 备份(unreachable-commits-backup/*).
    // 性能:backedUp ~4400 个 hash,批量 for-each-ref + cat-file --batch-check,
    // 且用 spawnSync argv 直调(不经 shell)避免 %(xxx) format 被破坏.
    const backedTrees = new Set()
    {
      // 2026-09-04 加固:改用 execSync argv 数组直调(shell:false,不经 cmd).
      // 原字符串版经 shell:true 时 cmd 会把 %(objectname) 当环境变量展开、
      // 把双引号原样传给 git,导致 refOut 为空/格式错乱;虽然 backedUp 集合
      // 兜底使主路径未爆,但并行高频 stash 场景下该兜底可能失效,
      // 必须从根上消除 shell 依赖.
      let refOut = ''
      try {
        refOut = runGit([
          'for-each-ref',
          'refs/tags/lost-commit',
          'refs/tags/backup',
          '--format=%(objectname)%09%(*objectname)',
        ])
      } catch {
        refOut = ''
      }
      const hashes = new Set(backedUp)
      for (const line of refOut.split('\n')) {
        const cols = line.trim().split('\t')
        // annotated tag: 两列都有 → 第 2 列 peeled commit;
        // lightweight: 仅第 1 列(第 2 列为空串)→ 即 commit 本身.
        // 注意:必须用 || 而非 ??——peeled 空串在轻量 tag 下是常态.
        const commitHash = cols[1] || cols[0]
        if (/^[0-9a-f]{40}$/.test(commitHash || '')) hashes.add(commitHash)
      }
      const treeInput = [...hashes].map((h) => `${h}^{tree}`).join('\n') + '\n'
      try {
        // 2026-09-04 加固:runGit argv 直调,--batch-check=<fmt> 等号形式免引号
        const out = runGit(['cat-file', '--batch-check=%(objectname)'], {
          input: treeInput,
          timeout: LOCAL_GIT_TIMEOUT_MS * 10,
          maxBuffer: 64 * 1024 * 1024,
        })
        for (const line of out.split('\n')) {
          const t = line.trim().split(/\s+/)[0]
          if (/^[0-9a-f]{40}$/.test(t)) backedTrees.add(t)
        }
      } catch {
        /* 批量失败时安全降级:backedTrees 为空,退回 hash/subject 判定 */
      }
    }
    // 性能:批量取 subject(同 filterStashLike 的 --no-walk 分批法),
    // 再对仍未放行者一次 cat-file --batch-check 批量取 tree,避免逐 commit execSync.
    const unbacked = (() => {
      const candidates = unreachable.filter((c) => !backedUp.has(c))
      // ① subject 内嵌原 hash 匹配(stash-like 指向已备份 base)
      const BATCH = 50
      const subjectByHash = new Map()
      for (let i = 0; i < candidates.length; i += BATCH) {
        const batch = candidates.slice(i, i + BATCH)
        const out = run(
          `git log --no-walk --format=%H%x09%s ${batch.join(' ')}`,
          { allowFail: true, timeout: LOCAL_GIT_TIMEOUT_MS },
        )
        if (!out) continue
        for (const line of out.split('\n')) {
          const [hash, ...rest] = line.split('\t')
          if (hash) subjectByHash.set(hash, rest.join('\t'))
        }
      }
      const survivors = []
      for (const c of candidates) {
        const subject = subjectByHash.get(c) || ''
        const origHash = extractOriginalHashFromStash(subject)
        if (origHash && backedUp.has(origHash)) continue
        survivors.push(c)
      }
      if (survivors.length === 0) return survivors
      // ② tree 等价放行(stash WIP/index commit 树与 base 恒等)
      const treeInput = survivors.map((h) => `${h}^{tree}`).join('\n') + '\n'
      const treeByCommit = new Map()
      try {
        // 2026-09-04 加固:runGit argv 直调,消除 shell 对 %(objectname) 的破坏
        const out = runGit(['cat-file', '--batch-check=%(objectname)'], {
          input: treeInput,
          timeout: LOCAL_GIT_TIMEOUT_MS * 10,
          maxBuffer: 64 * 1024 * 1024,
        })
        const lines = out.split('\n').filter(Boolean)
        for (let i = 0; i < survivors.length && i < lines.length; i++) {
          const t = lines[i].trim().split(/\s+/)[0]
          if (/^[0-9a-f]{40}$/.test(t)) treeByCommit.set(survivors[i], t)
        }
      } catch {
        /* 批量失败时安全降级:无 tree 映射,退回 hash/subject 判定 */
      }
      return survivors.filter((c) => {
        const tree = treeByCommit.get(c)
        return !(tree && backedTrees.has(tree))
      })
    })()
    if (unbacked.length > 0) {
      issues.push(
        `${unbacked.length} 个悬空 commit 未 tag 备份(运行 git tag lost-commit/<name> <hash> 备份)`,
      )
      // 2026-09-04 修复:打印具体未备份 hash(原仅报数量,无法定位处置;
      // 并行 agent 高频 fsck 会持续产生新悬空对象,需可见才能针对性 tag 备份)
      for (const c of unbacked.slice(0, 10)) {
        const subj = run(`git log -1 --format=%s ${c}`, { allowFail: true }) || ''
        console.log(
          `  ${C.yellow}   ↳ 未备份:${C.cyan}${c.slice(0, 12)}${C.reset} ${C.dim}${subj.slice(0, 80)}${C.reset}`,
        )
      }
      if (unbacked.length > 10)
        console.log(`  ${C.dim}   ↳ …另有 ${unbacked.length - 10} 个未显示${C.reset}`)
      blocking = true
    } else {
      issues.push(
        `${unreachable.length} 个悬空 commit 已全部 tag 备份(防止 git gc 清理)`,
      )
    }
  }

  // 2026-07-26 升级:远程 tag 完整性加入综合判定
  // 仅远端缺失 / tag 对象不可达 → blocking(必须先 fetch 拉回)
  // 仅本地缺失(远端没有)→ warn,可能是临时备份,不阻塞
  if (lostTagDiff.onlyRemote.length > 0) {
    issues.push(
      `${lostTagDiff.onlyRemote.length} 个 lost-commit tag 仅远端(本地缺失,需 fetch):${lostTagDiff.onlyRemote.join(', ')}`,
    )
    blocking = true
  }
  if (backupTagDiff.onlyRemote.length > 0) {
    issues.push(
      `${backupTagDiff.onlyRemote.length} 个 backup tag 仅远端(本地缺失,需 fetch):${backupTagDiff.onlyRemote.join(', ')}`,
    )
    blocking = true
  }
  if (unreachableTags.length > 0) {
    issues.push(
      `${unreachableTags.length} 个 tag 对象不可达(commit 即将被 git gc 清理,需 fetch 拉回)`,
    )
    blocking = true
  }
  if (lostTagDiff.onlyLocal.length > 0) {
    issues.push(
      `${lostTagDiff.onlyLocal.length} 个 lost-commit tag 仅本地(未 push,本地 git gc 后会丢失):${lostTagDiff.onlyLocal.join(', ')}`,
    )
    // 仅本地不阻塞,只 warn
  }
  if (backupTagDiff.onlyLocal.length > 0) {
    issues.push(
      `${backupTagDiff.onlyLocal.length} 个 backup tag 仅本地(未 push):${backupTagDiff.onlyLocal.join(', ')}`,
    )
    // 仅本地不阻塞,只 warn
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
