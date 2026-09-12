#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-refs-heal.mjs — 嵌套 ref 存续修复(2026-09-12 立)
 *
 * 事故(2026-09-12 实测):
 *   `refs/remotes/origin/main` 反复变 `[gone]`;`refs/tags/backup/push4-*` 反复"仅远端",
 *   于是守门 #30a(commit 丢失防护,blocking)**抖动性阻塞**提交:
 *   刚 fetch 完是绿的,几十秒后宿主一清理又变红。
 *
 * 机理(对照实验,2026-09-12):
 *   宿主清理层会删除 gitdir 下 **depth >= 2** 的嵌套命名空间目录:
 *     refs/heads/main            → depth1 文件 → 存活 ✅
 *     refs/tags/<tag>            → depth1 文件 → 存活 ✅
 *     refs/remotes/origin/main   → depth2 目录 → 被删 ❌(git update-ref 返回 0 但不落盘)
 *     refs/tags/backup/<tag>     → depth2 目录 → 被删 ❌
 *
 * 解法(不是 workaround:换成 git 自带的"打包引用"载体):
 *   把嵌套 ref 固化进 `packed-refs`(gitdir 顶层单文件 → 存活),
 *   松散文件被删也能正常解析;同时用 `refs-manifest.json`(同为顶层文件)留期望值,
 *   缺失即可在**不联网**的前提下重建。时序:
 *     松散写入(嵌套 dir) → `git pack-refs --all --prune` → 松散被 prune,只剩 packed
 *
 * 用法:
 *   node scripts/git-refs-heal.mjs                    # 本地修复:按清单补写 + pack(不联网)
 *   node scripts/git-refs-heal.mjs --refresh-remote   # 联网:从 origin 校准全量 tag/heads,再固化
 *   node scripts/git-refs-heal.mjs --status           # 只查看,不修改
 *
 * 退出码:0 = 清单内 ref 全部可解析;1 = 仍有缺失(需人工)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const WORKTREE = 'D:/IHUI-AI'
const POINTER = join(WORKTREE, '.git')

const GIT_CANDIDATES = [
  process.env.GIT_BIN,
  'git',
  'C:/Program Files/Git/cmd/git.exe',
  'C:/Program Files (x86)/Git/cmd/git.exe',
  'C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe',
].filter(Boolean)

let GIT_BIN = null
function resolveGitBin() {
  if (GIT_BIN) return GIT_BIN
  for (const c of GIT_CANDIDATES) {
    try {
      execFileSync(c, ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 })
      GIT_BIN = c
      return GIT_BIN
    } catch {
      /* 试下一个候选 */
    }
  }
  return null
}

function git(args, allowFail = false) {
  const bin = resolveGitBin()
  if (!bin) {
    if (allowFail) return null
    throw new Error('git 不可用:候选可执行文件均不可调用')
  }
  try {
    return execFileSync(bin, ['-c', 'safe.directory=*', '-C', WORKTREE, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180000,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/** 从 .git 指针文件解析真实 gitdir(支持 separate-git-dir;兼容 .git 为目录的常规仓库) */
function resolveGitdir() {
  try {
    const raw = readFileSync(POINTER, 'utf8').trim()
    const m = raw.match(/^gitdir:\s*(.+)$/i)
    if (m) return m[1].trim().replace(/\\/g, '/')
  } catch {
    /* 落到默认 */
  }
  return POINTER
}

const GITDIR = resolveGitdir()
const REFS_MANIFEST = join(GITDIR, 'refs-manifest.json')

/**
 * 是否需要"打包固化"的 ref:
 *   depth >= 2 的命名空间在 gitdir 下会被宿主清理(实测),必须固化进 packed-refs。
 *   refs/heads/main → 3 段;refs/tags/backup/x → 4 段;refs/remotes/origin/main → 4 段。
 */
function isNestedRef(ref) {
  return !ref.startsWith('refs/heads/') && ref.split('/').length >= 4
}

function readManifest() {
  try {
    const m = JSON.parse(readFileSync(REFS_MANIFEST, 'utf8'))
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

function saveManifest(map) {
  try {
    writeFileSync(REFS_MANIFEST, JSON.stringify(map, null, 1) + '\n', 'utf8')
    return true
  } catch (e) {
    console.error('清单写入失败:', String(e.message || e))
    return false
  }
}

/** 当前全部 ref(name → sha),含 packed 与松散 */
function currentRefs() {
  const out = git(['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/tags', 'refs/remotes'], true)
  const map = {}
  if (!out) return map
  for (const line of out.split('\n')) {
    const [ref, sha] = line.trim().split(/\s+/)
    if (ref && sha) map[ref] = sha
  }
  return map
}

/** 单 ref 是否可解析(宽松:packed 或松散均可) */
function refResolvable(ref) {
  const sha = git(['rev-parse', '--verify', '--quiet', ref], true)
  return !!sha
}

/** 直写松散 ref(node fs —— `git update-ref` 对嵌套命名空间返回 0 却不落盘) */
function writeLooseRef(ref, sha) {
  const p = join(GITDIR, ref.replace(/\//g, '/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, sha + '\n', 'utf8')
}

/** 把松散 ref 固化进 packed-refs(顶层单文件,宿主清理不到) */
function packRefs() {
  git(['pack-refs', '--all', '--prune'], true)
}

/**
 * 从 FETCH_HEAD(gitdir 顶层文件 → 宿主清理不到)取 `origin/main` 的权威值。
 *
 * 为什么需要:git fetch 把新值写成**松散** refs/remotes/origin/main(嵌套目录),
 * 该文件实测在 1 秒内即被宿主清理;若 packed-refs 里还留着上一次的旧值,
 * git 就回落到旧值 → 明明同 sha 却显示 `## main...origin/main [ahead 1]`。
 * FETCH_HEAD 是 fetch 自己写的顶层文件,内容形如:
 *   <sha>\t\tbranch 'main' of https://github.com/...
 */
function fetchHeadMain() {
  let text
  try {
    text = readFileSync(join(GITDIR, 'FETCH_HEAD'), 'utf8')
  } catch {
    return null
  }
  const lines = text.split('\n').filter((l) => /^[0-9a-f]{40}\b/.test(l.trim()))
  if (lines.length === 0) return null
  // 优先取显式提到 main 的那一行;仅一行时直接采用(单 ref fetch 的常规形态)
  const mainLine =
    lines.find((l) => /branch\s+'?main'?\b/.test(l)) ?? (lines.length === 1 ? lines[0] : null)
  if (!mainLine) return null
  const m = mainLine.trim().match(/^([0-9a-f]{40})/)
  return m ? m[1] : null
}

/** 从 origin 校准:全量 tag + refs/heads/main(需网络;代理走环境变量) */
function refreshFromRemote() {
  const out = git(['ls-remote', '--tags', '--heads', 'origin'], true)
  if (!out) {
    console.error('❌ 无法读取远端 ref(网络/代理不可达)。可先设置:')
    console.error('   http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897')
    return false
  }
  const map = readManifest()
  let added = 0
  for (const line of out.split('\n')) {
    const [sha, ref] = line.trim().split(/\s+/)
    if (!sha || !ref) continue
    if (ref.endsWith('^{}')) continue // annotated tag 的 peel 行
    // 远端分支只跟 main(refs/heads/main → refs/remotes/origin/main)
    const local = ref === 'refs/heads/main' ? 'refs/remotes/origin/main' : ref
    if (!isNestedRef(local)) continue // depth1 的天然存活,不入清单
    if (map[local] !== sha) added++
    map[local] = sha
  }
  const ok = saveManifest(map)
  console.log(`[refresh-remote] 已从 origin 校准 ${Object.keys(map).length} 个嵌套 ref(变更 ${added} 个)`)
  return ok
}

function status() {
  const cur = currentRefs()
  const map = readManifest()
  const entries = Object.entries(map)
  const missing = entries.filter(([ref, sha]) => cur[ref] !== sha).map(([ref]) => ref)
  return { gitdir: GITDIR, manifestCount: entries.length, currentCount: Object.keys(cur).length, missing }
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--status')) {
    const s = status()
    console.log(JSON.stringify(s, null, 1))
    process.exit(s.missing.length === 0 ? 0 : 1)
  }

  if (args.includes('--refresh-remote') && !refreshFromRemote()) process.exit(1)

  // 1) 以"当前可见 ref"为准更新清单(自维护:新出现的嵌套 ref 自动纳入)
  const cur = currentRefs()
  const map = readManifest()
  let learned = 0
  for (const [ref, sha] of Object.entries(cur)) {
    if (!isNestedRef(ref)) continue
    if (map[ref] !== sha) {
      map[ref] = sha
      learned++
    }
  }
  // 1b) FETCH_HEAD 是 origin/main 的权威值(松散 ref 被 1 秒内清理,packed 可能留旧值)
  const fh = fetchHeadMain()
  if (fh && map['refs/remotes/origin/main'] && map['refs/remotes/origin/main'] !== fh) {
    console.log(
      `[fetch-head] origin/main 以 FETCH_HEAD 为准: ${map['refs/remotes/origin/main'].slice(0, 12)} -> ${fh.slice(0, 12)}`,
    )
    map['refs/remotes/origin/main'] = fh
  }
  if (learned) console.log(`[learning] 纳入 ${learned} 个新出现的嵌套 ref`)
  saveManifest(map)

  // 2) 清单里与当前解析值不符的(缺失 or 旧值残留)→ 按清单重建
  const broken = Object.entries(map).filter(([ref, sha]) => {
    if (!refResolvable(ref)) return true
    const resolved = git(['rev-parse', ref], true)
    return !!resolved && resolved !== sha
  })
  if (broken.length === 0) {
    console.log(`[refs-heal] ✅ 清单内 ${Object.keys(map).length} 个嵌套 ref 全部与清单一致`)
    process.exit(0)
  }

  console.log(`[refs-heal] 🔧 ${broken.length} 个嵌套 ref 缺失,按清单重建:`)
  for (const [ref, sha] of broken) {
    writeLooseRef(ref, sha)
    console.log(`  - ${ref} = ${sha.slice(0, 12)}`)
  }
  packRefs()

  // 3) 回读校验(不信任写入动作): 既要可解析,也要与清单值一致
  const still = Object.entries(map)
    .filter(([ref, sha]) => {
      const resolved = git(['rev-parse', ref], true)
      return !resolved || resolved !== sha
    })
    .map(([ref]) => ref)
  if (still.length) {
    console.error(`❌ 重建后仍有 ${still.length} 个 ref 不可解析或值不符: ${still.join(', ')}`)
    process.exit(1)
  }
  console.log(`[refs-heal] ✅ 已重建 ${broken.length} 个 ref 并固化进 packed-refs(无需联网)`)
  process.exit(0)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
