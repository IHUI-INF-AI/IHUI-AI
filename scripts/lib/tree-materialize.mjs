#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tree-materialize.mjs — 按「门真正需要的路径集」物化 git 树(2026-11-07 立,feat/tree-materialize-1107)。
 *
 * 立因(实测,2026-11-07):冷路径一次 `git archive` 962MB + 解包 42–74 秒,而 13 门里 12 门
 * 只读 `scripts/**` 与少量 app/package 子树(**声明面并集** 5,832 文件 / 119.75MB = 12.7% 字节);
 * 只有 T1(typecheck)逐目录扫描整树。整树解包的成本几乎全在「2 万次小文件落盘 + 杀软扫描」
 * (archive 本身仅 7 秒:见验收报告),所以按路径集物化是唯一有效的杠杆。
 *
 * 硬性质:
 *   1. 内容寻址缓存:`<真实 gitdir>/ihui-gate-cache/trees/v1/<treeSha>/<pathSetKey>/`,
 *      同树同路径集永远只落一份;命中后 0 解包。
 *   2. 同键**只有一个构建者**:`<pathSetKey>.lock` 复用 gate-cache 的 tryAcquireLock
 *      (含死锁回收);等待者轮询 `<pathSetKey>.ready`(在 entry 目录**之外**,
 *      不进门的目录枚举面 —— 保持与全量解包逐字节同形的读取面)。
 *   3. 原子发布:构建到 `.tmp-*` → 写 ready → rename;崩溃只留 `.tmp`(prune 回收)。
 *   4. 引用计数 + 租约:`<pathSetKey>.leases/<pid>-<rand>` 跨进程标记占用;
 *      `release()` 删自己的租约;prune 只回收「无租约 + 无本进程引用」的条目。
 *   5. 全树与子集共用同一份 `<treeSha>` 根:全树门(T1)保留全量,子集门用子集,
 *      互不重建、互不覆盖。
 *
 * 读取面等价由调用方(gate-worker)的读取探针兜底:子集跑完后凡触到未声明路径
 * (含「枚举了未被完整物化的目录」)⇒ 立刻改用全树重跑,绝不把「少文件」当结论。
 * 探针的已知盲区:原生二进制子进程(git/tar 等)的读取不可见 —— 但它们读的是
 * 共享对象库,不是工作区文件;node 子进程经 NODE_OPTIONS 继承探针。
 */

import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { resolveGitBin } from './gitdir.mjs'
import {
  canonicalJson,
  pidAlive,
  sha256Hex,
  sleepSync,
  tryAcquireLock,
} from './gate-cache.mjs'

export const TREE_CACHE_REL = join('ihui-gate-cache', 'trees', 'v1')
export const READY_SUFFIX = '.ready'
export const LEASE_SUFFIX = '.leases'
export const DEFAULT_MATERIALIZE_WAIT_MS = 600_000
export const POLL_MS = 150

/** 树清单内存缓存(treeSha → Map<rel, {mode,type,sha,size}>) */
const manifestCache = new Map()
/** 本进程持有的物化条目(内容寻址目录 → 引用计数) */
const liveEntries = new Map()

const gitBin = () => resolveGitBin() ?? process.env.IHUI_GIT_BIN ?? 'git'

/** 派生 git 时剥掉宿主注入的 GIT_* 环境(IDE 会注入 GIT_DIR,留着会让 `-C` 静默指错)。 */
export function cleanGitEnv(env = process.env) {
  const next = { ...env }
  for (const k of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_INDEX_FILE',
    'GIT_QUARANTINE_PATH',
  ]) {
    delete next[k]
  }
  return next
}

export function treeCacheRoot({ gitDir, cacheRoot } = {}) {
  if (cacheRoot) return cacheRoot
  if (!gitDir) throw new Error('tree-materialize: 需要 gitDir 或 cacheRoot')
  return join(gitDir, TREE_CACHE_REL)
}

/**
 * 路径集规范化:目录项以 `/` 结尾(= 整棵子树);文件项逐字匹配。
 * 排序 + 去重 ⇒ 同一语义的路径集永远得到同一个缓存键(内容寻址)。
 */
export function normalizePathSpecs(paths) {
  if (!paths || paths === 'full') return 'full'
  // 幂等:已规范化的字符串原样返回(否则 matcher 二次规范化会把首项加上 `set:set:` 前缀)。
  if (typeof paths === 'string' && paths.startsWith('set:')) return paths
  if (Array.isArray(paths) && paths.length === 0) return 'full'
  const list = (Array.isArray(paths) ? paths : [paths])
    .map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').trim())
    .filter(Boolean)
  if (list.length === 0) return 'full'
  const dirs = new Set()
  const files = new Set()
  for (const p of list) {
    if (p.endsWith('/')) dirs.add(p)
    else files.add(p)
  }
  return 'set:' + [...dirs].sort().concat([...files].sort()).join('|')
}

export function pathSetKey(paths) {
  const normalized = normalizePathSpecs(paths)
  if (normalized === 'full') return 'full'
  return 'set-' + sha256Hex(canonicalJson(normalized)).slice(0, 16)
}

/** spec 命中判定(rel 用正斜杠、无前导 `./`)。 */
export function matchesSpecSet(rel, specs) {
  if (specs === 'full') return true
  const normalized = normalizePathSpecs(specs)
  const entries = normalized.slice(4).split('|')
  for (const e of entries) {
    if (e.endsWith('/')) {
      if (rel.startsWith(e)) return true
    } else if (rel === e) return true
  }
  return false
}

export function specsList(specs) {
  if (specs === 'full') return 'full'
  return normalizePathSpecs(specs).slice(4).split('|')
}

/** `git ls-tree -r -l -z <tree>` → Map<rel, {mode,type,sha,size}>。 */
export function listTreeEntries(repo, treeSha) {
  if (manifestCache.has(treeSha)) return manifestCache.get(treeSha)
  const res = spawnSync(gitBin(), ['-C', repo, 'ls-tree', '-r', '-l', '-z', treeSha], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 512 * 1024 * 1024,
    env: cleanGitEnv(),
  })
  if ((res.status ?? 1) !== 0) {
    throw new Error(`ls-tree 失败(rc=${res.status}): ${String(res.stderr ?? '').split('\n')[0]}`)
  }
  const entries = new Map()
  for (const rec of String(res.stdout ?? '').split('\0')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).trim().split(/\s+/)
    const rel = rec.slice(tab + 1)
    const mode = meta[0]
    const type = meta[1]
    const sha = meta[2]
    const size = Number(meta[3] ?? 0)
    entries.set(rel, { mode, type, sha, size })
  }
  manifestCache.set(treeSha, entries)
  return entries
}

export function forgetTreeEntries(treeSha) {
  manifestCache.delete(treeSha)
}

/**
 * 落盘:`git archive` 直连 tar stdin(不落 962MB 中间 tar;实测比落 tar 再解快 ~9 秒)。
 *
 * 全树与子集**共用同一个搬字节工具**,这是「读取面逐字节等价」的根:
 * `git archive` 会应用 `.gitattributes` 的 export-ignore / export-subst 与 eol 转换
 * (`core.autocrlf=true` 时 LF→CRLF)。若子集改用 `git cat-file` 直搬 blob,就会出现
 * 两类差异(全量面没有 CRLF、也没有 export-ignore 的剔除),门的字节级判据会被悄悄改掉。
 * 因此子集也只是把同一个 `git archive` 的 pathspec 收窄,而不是换一套读写路径。
 */
function archiveToDir({ repo, treeSha, target, pathspecs }) {
  return new Promise((resolve, reject) => {
    const parent = dirname(target)
    mkdirSync(target, { recursive: true })
    const spec = pathspecs && pathspecs.length > 0 ? ['--', ...pathspecs] : []
    const archive = spawn(gitBin(), ['-C', repo, 'archive', '--format=tar', treeSha, ...spec], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: cleanGitEnv(),
    })
    // cwd + 相对路径:Windows 的 tar 会把 `C:\...` 当成"远端主机 C"。
    const tar = spawn('tar', ['-xf', '-', '-C', basename(target)], {
      cwd: parent,
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true,
    })
    let archiveErr = ''
    let tarErr = ''
    archive.stderr.on('data', (d) => {
      archiveErr += d
    })
    tar.stderr.on('data', (d) => {
      tarErr += d
    })
    archive.stdout.pipe(tar.stdin)
    let archiveCode = null
    let tarCode = null
    const settle = () => {
      if (archiveCode === null || tarCode === null) return
      if (archiveCode !== 0) return reject(new Error(`archive 失败(rc=${archiveCode}): ${archiveErr.split('\n')[0]}`))
      if (tarCode !== 0) return reject(new Error(`解包失败(rc=${tarCode}): ${tarErr.split('\n')[0]}`))
      resolve()
    }
    archive.on('error', reject)
    tar.on('error', reject)
    archive.on('close', (code) => {
      archiveCode = code ?? 1
      settle()
    })
    tar.on('close', (code) => {
      tarCode = code ?? 1
      settle()
    })
  })
}

/**
 * 子集落盘:同一个 `git archive`,只加 pathspec 收窄。
 * 相较 `cat-file --batch` 逐 blob 写文件:不改 eol 语义、不绕过 export-ignore,
 * 且由 tar 一次搬字节(落盘成本只与**选中的字节数**成正比,与整树无关)。
 *
 * pathspec 先按清单过滤:树里不存在的路径不能塞给 `git archive`(它会 fatal:
 * pathspec did not match any files),而「树里本来就没有」在门的语义里只是"读不到",
 * 不能把整份物化变成基础设施失败。
 */
function buildSubset({ repo, treeSha, target, specs }) {
  const entries = listTreeEntries(repo, treeSha)
  const paths = [...entries.keys()]
  const pathspecs = specsList(specs).filter((spec) =>
    spec.endsWith('/') ? paths.some((rel) => rel.startsWith(spec)) : entries.has(spec),
  )
  if (pathspecs.length === 0) {
    mkdirSync(target, { recursive: true })
    return Promise.resolve()
  }
  return archiveToDir({ repo, treeSha, target, pathspecs })
}

/** 全树落盘(T1 typecheck 等确实要扫全树的门)。 */
function buildFull({ repo, treeSha, target }) {
  return archiveToDir({ repo, treeSha, target, pathspecs: null })
}

/** 隔离仓环境(确定性、只读共享对象库)。 */
export function isoEnvFor({ extractDir, gitDir }) {
  const isoGitDir = join(extractDir, '.git')
  return {
    ...cleanGitEnv(),
    GIT_DIR: isoGitDir,
    GIT_WORK_TREE: extractDir,
    GIT_INDEX_FILE: join(isoGitDir, 'index'),
    GIT_OBJECT_DIRECTORY: join(isoGitDir, 'objects'),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(gitDir, 'objects'),
    GIT_AUTHOR_NAME: 'gate-cache',
    GIT_AUTHOR_EMAIL: 'gate-cache@localhost',
    GIT_COMMITTER_NAME: 'gate-cache',
    GIT_COMMITTER_EMAIL: 'gate-cache@localhost',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00 +0000',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00 +0000',
  }
}

/** 隔离 git 仓骨架:与全量解包路径逐字同形(init / commit-tree / update-ref / symbolic-ref / read-tree)。 */
function scaffoldIsoGit({ extractDir, gitDir, treeSha }) {
  const isoEnv = isoEnvFor({ extractDir, gitDir })
  const git = (args, { env } = {}) => {
    const res = spawnSync(gitBin(), ['-C', extractDir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: env ?? cleanGitEnv(),
    })
    if ((res.status ?? 1) !== 0) {
      throw new Error(`隔离仓 ${args[0]} 失败(rc=${res.status}): ${String(res.stderr ?? '').split('\n')[0]}`)
    }
    return String(res.stdout ?? '')
  }
  git(['init', '--quiet'])
  const commit = git(['commit-tree', treeSha, '-m', `gate-cache tree ${treeSha}`], { env: isoEnv }).trim()
  git(['update-ref', 'refs/heads/gate-cache', commit], { env: isoEnv })
  git(['symbolic-ref', 'HEAD', 'refs/heads/gate-cache'], { env: isoEnv })
  git(['read-tree', 'HEAD'], { env: isoEnv })
  return isoEnv
}

/** 把真实仓库的 node_modules 以 junction 接到物化树里(与旧解包路径一致)。 */
function linkNodeModules({ repo, extractDir, onProgress }) {
  const src = join(repo, 'node_modules')
  const dst = join(extractDir, 'node_modules')
  if (!existsSync(src) || existsSync(dst)) return
  try {
    symlinkSync(src, dst, 'junction')
  } catch {
    onProgress?.(`WARN node_modules junction 建不起来:${dst}`)
  }
}

function acquireLease({ treeRoot, key }) {
  const dir = join(treeRoot, `${key}${LEASE_SUFFIX}`)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${process.pid}-${randomBytes(4).toString('hex')}.lease`)
  writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), 'utf8')
  return () => {
    try {
      unlinkSync(file)
    } catch {
      /* 已被清理 */
    }
    try {
      if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

export function hasLiveLease({ treeRoot, key }) {
  const dir = join(treeRoot, `${key}${LEASE_SUFFIX}`)
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return false
  }
  return names.some((name) => {
    if (!name.endsWith('.lease')) return true
    const pid = Number(name.split('-')[0])
    return pidAlive(pid)
  })
}

/** 除本进程外,是否还有别的活进程正占着这个物化条目(并发清扫的保护面)。 */
export function otherLiveLease(entryDir) {
  const treeRoot = dirname(entryDir)
  const key = basename(entryDir)
  let names
  try {
    names = readdirSync(join(treeRoot, `${key}${LEASE_SUFFIX}`))
  } catch {
    return false
  }
  return names.some((name) => {
    if (!name.endsWith('.lease')) return true
    const pid = Number(name.split('-')[0])
    return pid !== process.pid && pidAlive(pid)
  })
}

function safeJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function summarizeDir(dir) {
  let files = 0
  let bytes = 0
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.name === 'node_modules') continue
      const p = join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === '.git') continue
        stack.push(p)
      } else if (e.isFile()) {
        files += 1
        try {
          bytes += statSync(p).size
        } catch {
          /* 被并发清理:不计 */
        }
      }
    }
  }
  return { files, bytes }
}

/** 进程内正在被门引用的物化目录(prune 的保护面)。 */
export function liveEntryDirs() {
  return new Set(liveEntries.keys())
}

/**
 * 清掉物化树里的**非树文件**(门自己落的状态/构建残留)。
 *
 * 为什么必须清:缓存条目是**跨轮复用**的,而旧实现每次都是全新解包。门会顺手写
 * `.ihui-agent/state/*`、`.tsbuildinfo` 之类的未跟踪文件;不清掉的话,第二轮的
 * `cleanTsbuildinfo()`/`prev` 读数就会与第一轮不同(实测 T1 输出会在
 * 「已删除 1 个 .tsbuildinfo」与「未发现 .tsbuildinfo」之间摆动)——判据面被缓存污染。
 *
 * 只删「清单里没有的文件」与「清单里没有的目录」:跟踪文件一个字节都不动
 * (所以即使门改了跟踪文件,也不会被这里"掩盖";那属于门自身越界,由写入探针报出)。
 *
 * @returns {{removedFiles:number, removedDirs:number}}
 */
export function sweepUntracked({ repo, treeSha, dir, manifest }) {
  const entries = manifest ?? listTreeEntries(repo, treeSha)
  const files = new Set(entries.keys())
  const dirs = new Set([''])
  for (const rel of files) {
    let i = rel.lastIndexOf('/')
    while (i > 0) {
      const parent = rel.slice(0, i)
      if (dirs.has(parent)) break
      dirs.add(parent)
      i = parent.lastIndexOf('/')
    }
  }
  let removedFiles = 0
  let removedDirs = 0
  const walk = (abs, rel) => {
    let list
    try {
      list = readdirSync(abs, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of list) {
      if (e.name === '.git' || e.name === 'node_modules') continue
      const childAbs = join(abs, e.name)
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        walk(childAbs, childRel)
        if (!dirs.has(childRel)) {
          try {
            rmSync(childAbs, { recursive: true, force: true })
            removedDirs += 1
          } catch {
            /* 占用中:留给下一次 */
          }
        }
      } else if (!files.has(childRel)) {
        try {
          rmSync(childAbs, { force: true })
          removedFiles += 1
        } catch {
          /* 占用中:留给下一次 */
        }
      }
    }
  }
  walk(dir, '')
  return { removedFiles, removedDirs }
}

/**
 * 取/建一份物化树。返回句柄 `{ dir, treeSha, isoEnv, release, cacheHit, key, files, bytes, specs }`。
 *
 * 同键并发:只有一个构建者;其余进程轮询 `.ready` 复用(同一份内容,绝不各解一份)。
 */
export async function materializeTree({
  repo,
  gitDir,
  treeSha,
  paths = 'full',
  nodeModulesFrom = repo,
  cacheRoot,
  waitMs = DEFAULT_MATERIALIZE_WAIT_MS,
  onProgress,
} = {}) {
  if (!repo || !gitDir || !treeSha) throw new Error('tree-materialize: repo / gitDir / treeSha 必填')
  const specs = normalizePathSpecs(paths)
  const key = pathSetKey(specs)
  const root = treeCacheRoot({ gitDir, cacheRoot })
  const treeRoot = join(root, treeSha)
  mkdirSync(treeRoot, { recursive: true })
  const entry = join(treeRoot, key)
  const readyPath = join(treeRoot, `${key}${READY_SUFFIX}`)
  const lockPath = join(treeRoot, `${key}.lock`)

  const makeHandle = (cacheHit) => {
    const leaseRelease = acquireLease({ treeRoot, key })
    const rec = liveEntries.get(entry) ?? { refs: 0 }
    rec.refs += 1
    liveEntries.set(entry, rec)
    let released = false
    const meta = safeJson(readyPath) ?? {}
    return {
      dir: entry,
      treeSha,
      isoEnv: isoEnvFor({ extractDir: entry, gitDir }),
      cacheHit,
      key,
      specs,
      files: meta.files ?? 0,
      bytes: meta.bytes ?? 0,
      release() {
        if (released) return
        released = true
        leaseRelease()
        const cur = liveEntries.get(entry)
        if (cur) {
          cur.refs -= 1
          if (cur.refs <= 0) liveEntries.delete(entry)
        }
      },
    }
  }

  if (existsSync(readyPath) && existsSync(entry)) {
    onProgress?.(`TREE_CACHE_HIT tree=${treeSha} set=${key}`)
    return makeHandle(true)
  }

  const startedAt = Date.now()
  let lock = null
  for (;;) {
    const attempt = tryAcquireLock({ lockPath, body: { treeSha, key } })
    if (attempt.acquired) {
      lock = attempt
      break
    }
    if (attempt.reason !== 'held') throw new Error(`tree-materialize 取锁失败:${attempt.reason}`)
    // 有构建者:等它发布(ready 在 entry 之外,不污染门的目录枚举面)。
    while (Date.now() - startedAt <= waitMs) {
      if (existsSync(readyPath) && existsSync(entry)) {
        onProgress?.(`TREE_CACHE_WAIT_HIT tree=${treeSha} set=${key} waitMs=${Date.now() - startedAt}`)
        return makeHandle(true)
      }
      sleepSync(POLL_MS)
    }
    throw new Error(`tree-materialize 等待超时(${waitMs}ms): tree=${treeSha} set=${key}`)
  }

  const tmpDir = join(treeRoot, `.tmp-${key}-${process.pid}-${randomBytes(4).toString('hex')}`)
  const buildT0 = Date.now()
  try {
    // 无 ready 的残骸(上次崩溃在 rename 与 ready 之间)由本构建者接管。
    if (existsSync(entry)) rmSync(entry, { recursive: true, force: true })
    mkdirSync(tmpDir, { recursive: true })
    if (specs === 'full') {
      await buildFull({ repo, treeSha, target: tmpDir })
    } else {
      await buildSubset({ repo, treeSha, target: tmpDir, specs })
    }
    linkNodeModules({ repo: nodeModulesFrom, extractDir: tmpDir, onProgress })
    scaffoldIsoGit({ extractDir: tmpDir, gitDir, treeSha })
    const stat = summarizeDir(tmpDir)
    // 先发布目录,最后发布 ready:ready 一旦可见,内容必已完整。
    renameSync(tmpDir, entry)
    const tmpReady = join(treeRoot, `${key}.tmp-ready-${process.pid}`)
    writeFileSync(
      tmpReady,
      JSON.stringify({ treeSha, key, specs, files: stat.files, bytes: stat.bytes, builtAt: new Date().toISOString() }),
      'utf8',
    )
    renameSync(tmpReady, readyPath)
    onProgress?.(
      `TREE_MATERIALIZED tree=${treeSha} set=${key} files=${stat.files} bytes=${stat.bytes} ms=${Date.now() - buildT0}`,
    )
    return makeHandle(false)
  } catch (error) {
    rmSync(tmpDir, { recursive: true, force: true })
    throw error
  } finally {
    lock.release()
  }
}

/**
 * 引用计数 + 租约保护的清理:
 *   · 只回收「无本进程引用 + 无存活租约」的物化目录;
 *   · 顺手清 `.tmp-*` 崩溃残骸与死锁(而**不是**在用的条目);
 *   · 按最久未用优先,直到缓存总字节数回到预算内。
 * @returns {{removed:Array<{dir:string,bytes:number}>, keptBytes:number, skippedLive:number}}
 */
export function pruneTreeCache({ gitDir, cacheRoot, maxBytes = 4 * 1024 ** 3, dryRun = false, staleTmpMs = 60 * 60 * 1000 } = {}) {
  const root = treeCacheRoot({ gitDir, cacheRoot })
  const removed = []
  const skippedLive = []
  const candidates = []
  let keptBytes = 0
  let trees = []
  try {
    trees = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
  } catch {
    return { removed, keptBytes, skippedLive: skippedLive.length }
  }
  const now = Date.now()
  for (const tree of trees) {
    const treeRoot = join(root, tree.name)
    let keys = []
    try {
      keys = readdirSync(treeRoot, { withFileTypes: true }).filter((e) => e.isDirectory())
    } catch {
      continue
    }
    for (const k of keys) {
      const dir = join(treeRoot, k.name)
      if (k.name.startsWith('.tmp-')) {
        let age = 0
        try {
          age = now - statSync(dir).mtimeMs
        } catch {}
        if (age <= staleTmpMs) continue
        if (!dryRun) rmSync(dir, { recursive: true, force: true })
        removed.push({ dir, bytes: 0 })
        continue
      }
      const stat = summarizeDir(dir)
      if (liveEntries.has(dir) || hasLiveLease({ treeRoot, key: k.name })) {
        skippedLive.push(dir)
        keptBytes += stat.bytes
        continue
      }
      candidates.push({ dir, bytes: stat.bytes, mtime: statSync(dir).mtimeMs })
      keptBytes += stat.bytes
    }
  }
  candidates.sort((a, b) => a.mtime - b.mtime)
  for (const c of candidates) {
    if (keptBytes <= maxBytes) break
    if (!dryRun) {
      try {
        rmSync(c.dir, { recursive: true, force: true })
        rmSync(`${c.dir}${READY_SUFFIX}`, { force: true })
      } catch {
        continue
      }
    }
    removed.push({ dir: c.dir, bytes: c.bytes })
    keptBytes -= c.bytes
  }
  return { removed, keptBytes, skippedLive: skippedLive.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
