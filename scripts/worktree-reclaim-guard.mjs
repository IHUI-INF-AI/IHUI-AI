// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * worktree-reclaim-guard.mjs —— worktree 磁盘约束唯一入口（2026-11-04 立）。
 *
 * 立因：2026-11-03/04 G: 盘两次因 worktree 与构建缓存堆积只剩 1.32 GB，安装中断、
 * git 写 ref 失败；回收时又两次撞上「判活判早了」——判活瞬间干净，删除瞬间被另一
 * 会话写入或进程占用，导致工作树半删。四条约束在此落成硬判据，不再只写在报告里：
 *
 * 1. 新 worktree 默认落 E:\IHUI-worktrees（可用 IHUI_WT_ROOT 覆盖）。
 *    依据：G: 总量仅 165 GB 且要承载主仓 + node_modules + 构建缓存；单个实装 worktree
 *    实测 3.5–14 GB；D 56 GB / E 720 GB 空闲，E 是 G 的 4 倍以上。
 * 2. worktree 一律 junction 复用主仓依赖（根与每个 workspace 包的 node_modules）。
 *    依据：每个实装 pnpm 依赖约 2.7 GB，junction 后只保留一份实体。
 * 3. 构建缓存（.next/.next-ct/.next-ct-v/.turbo/coverage/dist）用完即删。
 *    依据：这些是纯可再生产物，单个 worktree 曾占 10.5 GB 且完全不参与 git。
 * 4. 删除前必过「近 1 小时文件写入 + 进程命令行引用」双判活。
 *    依据：2026-11-03 composer-toolbar、2026-11-04 e2e-red-2 两次事故都发生在
 *    判活与删除之间被其他会话接管；只测 mtime 不够，还必须测进程占用。
 *
 * 纪律：默认 dry-run；--apply 才删。摘 junction 只断链接（unlink 自身），
 * 绝不递归跟随到主仓 node_modules。全程不碰共享暂存区、不 push。
 *
 * 用法：
 *   node scripts/worktree-reclaim-guard.mjs --check <path>
 *   node scripts/worktree-reclaim-guard.mjs --create <名> [--apply]
 *   node scripts/worktree-reclaim-guard.mjs --reclaim <名|path> [--apply]
 *   node scripts/worktree-reclaim-guard.mjs --clean-cache <path> [--apply]
 *   node scripts/worktree-reclaim-guard.mjs --self-test
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
  mkdtempSync,
} from 'node:fs'
import { join, dirname, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const DEFAULT_WT_ROOT = process.env.IHUI_WT_ROOT || 'E:\\IHUI-worktrees'
const ACTIVITY_WINDOW_MS = 60 * 60 * 1000
const CACHE_DIR_NAMES = new Set(['.next', '.next-ct', '.next-ct-v', '.turbo', 'coverage', 'dist'])

function git(args, cwd = ROOT) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() }
}

/** 递归收集普通文件（不进入任何 reparse point，杜绝跟随 junction）。 */
function collectFiles(root, out = []) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(root, e.name)
    let lst
    try {
      lst = lstatSync(p)
    } catch {
      continue
    }
    if (lst.isSymbolicLink()) continue // 只统计链接本身，不进入目标
    if (lst.isDirectory()) collectFiles(p, out)
    else if (lst.isFile()) out.push({ path: p, mtimeMs: lst.mtimeMs })
  }
  return out
}

/** 递归收集 reparse point 目录（junction/symlink），供先摘链。 */
function collectReparse(root, out = []) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(root, e.name)
    let lst
    try {
      lst = lstatSync(p)
    } catch {
      continue
    }
    if (lst.isSymbolicLink()) {
      out.push(p)
      continue // 不进入链接目标
    }
    if (lst.isDirectory()) collectReparse(p, out)
  }
  return out
}

/** 是否有进程命令行引用该路径（Windows）；其他平台跳过。 */
function processesReferencing(path) {
  if (process.platform !== 'win32') return []
  const escaped = path.replace(/'/g, "''")
  const script =
    `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${escaped}') } | ` +
    `ForEach-Object { "$($_.ProcessId)|$($_.Name)" }`
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 20000,
  })
  return (r.stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    // 自匹配排除：node 自身与本次 powershell 查询命令的命令行都含有目标路径字符串，
    // 不过滤会把「自己」误判成占用进程（2026-11-04 self-test 反向例实测命中）。
    .filter((l) => !l.startsWith(`${process.pid}|`) && !l.startsWith(`${r.pid}|`))
}

/**
 * 双判活：近 1 小时文件写入 + 进程命令行引用。
 * quiet=false 即必须跳过；两个维度任一命中都不许删。
 */
function checkActivity(path, now = Date.now()) {
  const files = collectFiles(path)
  const cutoff = now - ACTIVITY_WINDOW_MS
  const recent = files.filter((f) => f.mtimeMs > cutoff)
  const newest = files.reduce((a, f) => (f.mtimeMs > a ? f.mtimeMs : a), 0)
  const procs = processesReferencing(path)
  return {
    quiet: recent.length === 0 && procs.length === 0,
    recentWrites: recent.length,
    processes: procs,
    newest,
    fileCount: files.length,
  }
}

function isMerged(path) {
  return git(['-C', path, 'merge-base', '--is-ancestor', 'HEAD', 'origin/main']).status === 0
}

function isClean(path) {
  const r = git(['-C', path, 'status', '--porcelain'])
  if (r.status !== 0) return false
  return r.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0).length === 0
}

function reapOne(target, { apply = false } = {}) {
  if (!existsSync(target)) return { action: 'skip', reason: '路径不存在' }
  if (!isMerged(target)) return { action: 'skip', reason: 'HEAD 未并入 origin/main' }
  if (!isClean(target)) return { action: 'skip', reason: '工作区不干净（有未提交改动）' }
  const act = checkActivity(target)
  if (!act.quiet) {
    return {
      action: 'skip',
      reason: `双判活未通过（近1h写入=${act.recentWrites}，进程=${act.processes.length}）`,
    }
  }
  if (!apply) return { action: 'dry-run', reason: '三条判据 + 双判活全部通过，可删' }
  const links = collectReparse(target)
  for (const l of links) unlinkSync(l) // 只删链接本身，绝不递归跟随
  rmSync(target, { recursive: true, force: false })
  git(['worktree', 'prune'])
  return { action: 'removed', links: links.length }
}

function cleanCache(root, apply = false) {
  const hits = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      let lst
      try {
        lst = lstatSync(p)
      } catch {
        continue
      }
      if (lst.isSymbolicLink()) continue
      if (!lst.isDirectory()) continue
      if (e.name === 'node_modules') continue
      if (CACHE_DIR_NAMES.has(e.name)) {
        hits.push(p)
        continue
      }
      walk(p)
    }
  }
  walk(root)
  if (apply) for (const p of hits) rmSync(p, { recursive: true, force: true })
  return hits
}

function createWorktree(name, apply = false) {
  const target = join(DEFAULT_WT_ROOT, name)
  if (existsSync(target)) throw new Error(`目标已存在：${target}`)
  const branch = `wt/${name}`
  const cmd = ['worktree', 'add', '-b', branch, target, 'origin/main']
  if (!apply) return { action: 'dry-run', target, branch, cmd: `git ${cmd.join(' ')}` }
  if (git(cmd).status !== 0) throw new Error('git worktree add 失败')
  const link = (src, dst) => {
    if (!existsSync(src) || existsSync(dst)) return 0
    symlinkSync(src, dst, 'junction')
    return 1
  }
  let linked = link(join(ROOT, 'node_modules'), join(target, 'node_modules'))
  for (const base of ['apps', 'packages']) {
    const b = join(ROOT, base)
    if (!existsSync(b)) continue
    for (const e of readdirSync(b, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const src = join(b, e.name, 'node_modules')
      if (existsSync(src)) linked += link(src, join(target, base, e.name, 'node_modules'))
    }
  }
  return { action: 'created', target, branch, junctions: linked }
}

function selfTest() {
  const failures = []
  const base = mkdtempSync(join(tmpdir(), 'wt-guard-'))
  const now = Date.now()
  const active = join(base, 'active')
  const quiet = join(base, 'quiet')
  mkdirSync(active, { recursive: true })
  mkdirSync(quiet, { recursive: true })
  writeFileSync(join(active, 'fresh.txt'), 'fresh')
  const oldFile = join(quiet, 'old.txt')
  writeFileSync(oldFile, 'old')
  const t = (now - 2 * ACTIVITY_WINDOW_MS) / 1000
  utimesSync(oldFile, t, t)

  // 反向例 1：刚写过的目录必须判为 active（quiet=false）
  if (checkActivity(active, now).quiet) failures.push('刚写过的目录被误判为 quiet')
  // 反向例 2：2 小时前的目录必须判为 quiet
  if (!checkActivity(quiet, now).quiet) failures.push('2 小时前的目录被误判为 active')
  // 反向例 3：junction 摘链只删链接，目标必须存活
  const shared = join(base, 'shared')
  mkdirSync(shared, { recursive: true })
  const j = join(base, 'junction-case')
  mkdirSync(j, { recursive: true })
  symlinkSync(shared, join(j, 'node_modules'), 'junction')
  for (const l of collectReparse(j)) unlinkSync(l)
  if (!existsSync(shared)) failures.push('摘 junction 时误删了链接目标')
  if (existsSync(join(j, 'node_modules'))) failures.push('junction 链接未被摘除')

  rmSync(base, { recursive: true, force: true })
  if (failures.length) {
    console.error(`SELFTEST FAIL: ${failures.join(' | ')}`)
    return 1
  }
  console.log('SELFTEST PASS: active/quiet 双态 + junction 摘链三条反向例全部符合')
  return 0
}

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const argOf = (flag) => argv[argv.indexOf(flag) + 1]

if (argv.includes('--self-test')) process.exit(selfTest())

if (argv.includes('--check')) {
  const p = resolve(argOf('--check'))
  const act = checkActivity(p)
  console.log(JSON.stringify({ path: p, ...act }, null, 2))
  process.exit(act.quiet ? 0 : 1)
}

if (argv.includes('--reclaim')) {
  const raw = argOf('--reclaim')
  const p = isAbsolute(raw) ? raw : join(ROOT, '.worktrees', raw)
  try {
    console.log(JSON.stringify({ target: p, ...reapOne(p, { apply }) }, null, 2))
  } catch (e) {
    console.error(`RECLAIM FAIL: ${e.message}`)
    process.exit(1)
  }
  process.exit(0)
}

if (argv.includes('--clean-cache')) {
  const p = resolve(argOf('--clean-cache'))
  console.log(JSON.stringify({ path: p, hits: cleanCache(p, apply), applied: apply }, null, 2))
  process.exit(0)
}

if (argv.includes('--create')) {
  try {
    console.log(JSON.stringify(createWorktree(argOf('--create'), apply), null, 2))
  } catch (e) {
    console.error(`CREATE FAIL: ${e.message}`)
    process.exit(1)
  }
  process.exit(0)
}

console.log(
  'worktree-reclaim-guard: 用 --check <path> / --create <名> / --reclaim <名|path> / --clean-cache <path> / --self-test，加 --apply 才落盘',
)
