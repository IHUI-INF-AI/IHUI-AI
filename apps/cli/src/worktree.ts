/**
 * P1-8 Fast Worktree CoW — 基于 Copy-on-Write 的快速 git worktree 创建。
 *
 * 灵感来源:grok-build xai-fast-worktree。
 * 简化策略(做减法):
 *   - 单文件实现,零新依赖(仅 Node.js 内置 fs/path/os/child_process)
 *   - CoW 能力检测 + 模块级缓存(可选持久化到 ~/.ihui/cache/)
 *   - 文件复制优先 FICLONE(Linux/macOS 由 Node 自动回退),Windows 暂走普通复制
 *   - .git 目录选择性复制(跳过 lock / transient state)
 *   - 不接 worker_threads,顺序遍历复制(简化版)
 *   - 集成由主会话统一处理,本模块不修改 subagents/worktree.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { spawnSync } from 'node:child_process'

// ============ 类型定义 ============

export type CowKind = 'ficlone' | 'clonefile' | 'refs' | 'none'

export interface CopyStats {
  files: number
  dirs: number
  symlinks: number
  bytes: number
  elapsedMs: number
}

export interface CopyTreeOptions {
  skip?: Set<string>
  followSymlinks?: boolean
}

export interface GitDirStats {
  copiedFiles: number
  skippedFiles: number
  elapsedMs: number
}

export interface WorktreeOptions {
  /** 源 git 仓库根目录(必须含 .git) */
  source: string
  /** 目标 worktree 路径(必须不存在或为空) */
  destination: string
  /** checkout 的 ref(branch / tag / commit),缺省用 HEAD */
  ref?: string
  /** 是否保留源 working tree 的未提交修改(PreserveWorkingTree) */
  preserveWorkingTree?: boolean
  /** skip 文件集合(默认空) */
  skip?: Set<string>
}

export interface WorktreeResult {
  destination: string
  gitDirKind: 'file' | 'directory'
  cowKind: CowKind
  copyStats: CopyStats
  gitDirStats: GitDirStats
  elapsedMs: number
}

// ============ CoW 能力检测 ============

const COW_CACHE_PATH = path.join(os.homedir(), '.ihui', 'cache', 'cow-capability.json')
const VALID_COW_KINDS: readonly CowKind[] = ['ficlone', 'clonefile', 'refs', 'none']

let cachedCowKind: CowKind | undefined = undefined

/**
 * 检测文件系统的 CoW 能力。第一次调用时检测并缓存到模块级变量,
 * 可选持久化到 ~/.ihui/cache/cow-capability.json。检测失败返回 'none'。
 */
export function detectCowKind(dir: string): CowKind {
  if (cachedCowKind) return cachedCowKind

  // 尝试从磁盘缓存加载
  const loaded = loadCachedCowKind()
  if (loaded) {
    cachedCowKind = loaded
    return loaded
  }

  let kind: CowKind = 'none'
  try {
    kind = detectCowKindImpl(dir)
  } catch {
    kind = 'none'
  }

  cachedCowKind = kind
  saveCachedCowKind(kind)
  return kind
}

/** 重置 CoW 内存缓存(主要供测试使用,不删除磁盘缓存)。 */
export function resetCowCache(): void {
  cachedCowKind = undefined
}

function detectCowKindImpl(dir: string): CowKind {
  const platform = process.platform

  if (platform === 'win32') {
    return detectRefs(dir) ? 'refs' : 'none'
  }

  if (platform !== 'linux' && platform !== 'darwin') {
    return 'none'
  }

  // Linux/macOS: 创建临时文件尝试 CoW 复制
  const tmpBase = os.tmpdir()
  const suffix = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}`
  const src = path.join(tmpBase, `ihui-cow-src-${suffix}`)
  const dst = path.join(tmpBase, `ihui-cow-dst-${suffix}`)

  try {
    fs.writeFileSync(src, 'cow-detect', 'utf-8')

    if (platform === 'darwin') {
      // macOS: FICLONE_FORCE 强制 clonefile,不支持时抛错
      const force = pickConst('COPYFILE_FICLONE_FORCE')
      if (force === undefined) return 'none'
      try {
        fs.copyFileSync(src, dst, force)
        return 'clonefile'
      } catch {
        return 'none'
      }
    }

    // Linux: FICLONE 由 Node 自动回退,只检测调用成功
    const ficlone = pickConst('COPYFILE_FICLONE')
    if (ficlone === undefined) return 'none'
    try {
      fs.copyFileSync(src, dst, ficlone)
      return 'ficlone'
    } catch {
      return 'none'
    }
  } finally {
    try {
      fs.rmSync(src, { force: true })
    } catch {
      // 忽略清理错误
    }
    try {
      fs.rmSync(dst, { force: true })
    } catch {
      // 忽略清理错误
    }
  }
}

/** 安全读取 fs.constants 上的 CoW 标志常量(跨平台存在性不同)。 */
function pickConst(name: 'COPYFILE_FICLONE' | 'COPYFILE_FICLONE_FORCE'): number | undefined {
  const c = fs.constants as unknown as Record<string, number | undefined>
  const v = c[name]
  return typeof v === 'number' ? v : undefined
}

/** Windows ReFS 检测:fsutil fsinfo volumeinfo 输出含 "ReFS"。 */
function detectRefs(dir: string): boolean {
  try {
    const resolved = path.resolve(dir)
    // 提取盘符,如 "C:"
    const drive = resolved.slice(0, 2)
    if (!/^[A-Za-z]:$/.test(drive)) return false
    const r = spawnSync('fsutil', ['fsinfo', 'volumeinfo', drive], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5_000,
    })
    if (r.error || r.status !== 0) return false
    const out = typeof r.stdout === 'string' ? r.stdout : ''
    return /ReFS/i.test(out)
  } catch {
    return false
  }
}

function loadCachedCowKind(): CowKind | undefined {
  try {
    if (!fs.existsSync(COW_CACHE_PATH)) return undefined
    const raw = fs.readFileSync(COW_CACHE_PATH, 'utf-8')
    const data = JSON.parse(raw) as { kind?: unknown }
    if (
      typeof data.kind === 'string' &&
      (VALID_COW_KINDS as readonly string[]).includes(data.kind)
    ) {
      return data.kind as CowKind
    }
    return undefined
  } catch {
    return undefined
  }
}

function saveCachedCowKind(kind: CowKind): void {
  try {
    fs.mkdirSync(path.dirname(COW_CACHE_PATH), { recursive: true })
    fs.writeFileSync(COW_CACHE_PATH, JSON.stringify({ kind, ts: Date.now() }), 'utf-8')
  } catch {
    // 持久化失败不抛异常
  }
}

// ============ 文件复制(CoW 优先) ============

/**
 * 复制单个文件,优先尝试 CoW(FICLONE),不支持时由 Node 自动回退到普通复制。
 * 复制后保留源文件权限位。src 不存在时抛 ENOENT。
 */
export function copyFileCoW(src: string, dst: string): void {
  const ficlone = pickConst('COPYFILE_FICLONE')
  if (process.platform !== 'win32' && ficlone !== undefined) {
    // Linux/macOS: FICLONE 由 Node 自动回退到普通复制
    try {
      fs.copyFileSync(src, dst, ficlone)
    } catch (e) {
      // 防御性回退:FICLONE 调用抛非 ENOENT 类错误时改走普通复制
      // ENOENT/EACCES/EISDIR 等错误普通复制也会抛,这里不吞
      const code = (e as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT' || code === 'EACCES' || code === 'EISDIR' || code === 'ENOTDIR') {
        throw e
      }
      fs.copyFileSync(src, dst)
    }
  } else {
    // Windows 或无 FICLONE 常量:普通复制
    fs.copyFileSync(src, dst)
  }

  // 保留源文件权限(chmod 在 Windows 上静默无效)
  try {
    const stat = fs.statSync(src)
    fs.chmodSync(dst, stat.mode)
  } catch {
    // 忽略 chmod 错误
  }
}

// ============ 目录复制 ============

/**
 * 递归复制目录树。顺序遍历(简化版),每个文件调 copyFileCoW。
 * symlink:Linux/macOS 创建 symlink,Windows 复制目标文件。
 * skip 集合按文件名匹配跳过(用于 .git 内的 lock 文件等)。
 */
export async function copyTree(
  src: string,
  dst: string,
  opts?: CopyTreeOptions,
): Promise<CopyStats> {
  const start = Date.now()
  const stats: CopyStats = { files: 0, dirs: 0, symlinks: 0, bytes: 0, elapsedMs: 0 }
  const skip = opts?.skip ?? new Set<string>()
  const followSymlinks = opts?.followSymlinks ?? false

  await copyTreeRecursive(src, dst, skip, followSymlinks, stats)
  stats.elapsedMs = Date.now() - start
  return stats
}

async function copyTreeRecursive(
  src: string,
  dst: string,
  skip: Set<string>,
  followSymlinks: boolean,
  stats: CopyStats,
): Promise<void> {
  await fs.promises.mkdir(dst, { recursive: true })
  stats.dirs++

  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const name = entry.name
    if (skip.has(name)) continue

    const srcPath = path.join(src, name)
    const dstPath = path.join(dst, name)

    if (entry.isSymbolicLink() && !followSymlinks) {
      await handleSymlink(srcPath, dstPath, stats)
    } else if (entry.isDirectory()) {
      await copyTreeRecursive(srcPath, dstPath, skip, followSymlinks, stats)
    } else if (entry.isFile()) {
      copyFileCoW(srcPath, dstPath)
      stats.files++
      try {
        const s = await fs.promises.stat(srcPath)
        stats.bytes += s.size
      } catch {
        // 忽略 stat 错误
      }
    }
  }
}

async function handleSymlink(srcPath: string, dstPath: string, stats: CopyStats): Promise<void> {
  if (process.platform === 'win32') {
    // Windows: 复制目标文件(避免 symlink 权限问题)
    try {
      const target = await fs.promises.realpath(srcPath)
      const targetStat = await fs.promises.stat(target)
      if (targetStat.isDirectory()) {
        // 目标是目录:递归复制(用空 skip 避免误跳过)
        await copyTreeRecursive(srcPath, dstPath, new Set<string>(), false, stats)
      } else {
        copyFileCoW(target, dstPath)
        stats.files++
        stats.bytes += targetStat.size
      }
    } catch {
      // realpath 失败(可能 dangling symlink)→ 跳过
    }
  } else {
    // Linux/macOS: 创建 symlink 指向同一目标
    try {
      const target = await fs.promises.readlink(srcPath)
      await fs.promises.symlink(target, dstPath)
      stats.symlinks++
    } catch {
      // symlink 创建失败 → 跳过
    }
  }
}

// ============ .git 目录选择性复制 ============

/** .git 内需要跳过的具体文件名(transient state)。 */
const GIT_SKIP_FILES: ReadonlySet<string> = new Set([
  'MERGE_HEAD',
  'ORIG_HEAD',
  'FETCH_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'REBASE_HEAD',
  'AUTO_MERGE',
  'BISECT_LOG',
  'gc.log',
])

/** .git 内需要跳过的目录名。 */
const GIT_SKIP_DIRS: ReadonlySet<string> = new Set([
  'worktrees',
  'sequencer',
  'rebase-merge',
  'rebase-apply',
])

/** .git 内需要跳过的文件名正则。 */
const GIT_SKIP_PATTERNS: readonly RegExp[] = [/\.lock$/, /^fsmonitor--daemon/]

/**
 * 选择性复制 .git 目录,跳过 lock 文件、worktrees/ 注册表、transient state。
 */
export async function copyGitDir(srcGit: string, dstGit: string): Promise<GitDirStats> {
  const start = Date.now()
  const stats: GitDirStats = { copiedFiles: 0, skippedFiles: 0, elapsedMs: 0 }

  await fs.promises.mkdir(dstGit, { recursive: true })
  await copyGitDirRecursive(srcGit, dstGit, stats)
  stats.elapsedMs = Date.now() - start
  return stats
}

async function copyGitDirRecursive(
  src: string,
  dst: string,
  stats: GitDirStats,
): Promise<void> {
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const name = entry.name

    // 跳过规则(先匹配文件名,再判断目录)
    if (GIT_SKIP_FILES.has(name)) {
      stats.skippedFiles++
      continue
    }
    if (entry.isDirectory() && GIT_SKIP_DIRS.has(name)) {
      stats.skippedFiles++
      continue
    }
    if (GIT_SKIP_PATTERNS.some((p) => p.test(name))) {
      stats.skippedFiles++
      continue
    }

    const srcPath = path.join(src, name)
    const dstPath = path.join(dst, name)

    if (entry.isDirectory()) {
      await fs.promises.mkdir(dstPath, { recursive: true })
      await copyGitDirRecursive(srcPath, dstPath, stats)
    } else if (entry.isFile()) {
      try {
        copyFileCoW(srcPath, dstPath)
        stats.copiedFiles++
      } catch {
        // 复制失败计数为跳过
        stats.skippedFiles++
      }
    }
  }
}

// ============ git 工具函数 ============

/** 从 start 向上查找包含 .git 的目录,找不到返回 undefined。 */
export function findGitRoot(start: string): string | undefined {
  let cur = path.resolve(start)
  while (true) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur
    const parent = path.dirname(cur)
    if (parent === cur) return undefined
    cur = parent
  }
}

/** dir/.git 存在(文件或目录均可)。 */
export function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, '.git'))
}

/** 判断 .git 路径是文件(linked worktree)还是目录(standalone)。 */
export function getGitDirKind(gitPath: string): 'file' | 'directory' {
  try {
    const stat = fs.statSync(gitPath)
    return stat.isFile() ? 'file' : 'directory'
  } catch {
    // 路径不存在时默认 directory(典型情况)
    return 'directory'
  }
}

/**
 * 解析 linked worktree 的 .git 文件(内容形如 "gitdir: /path/to/.git/worktrees/<name>"),
 * 返回源仓库根目录。解析失败返回 undefined。
 */
function parseLinkedGitFile(gitPath: string): string | undefined {
  try {
    const content = fs.readFileSync(gitPath, 'utf-8').trim()
    const m = content.match(/^gitdir:\s*(.+)$/)
    if (!m || !m[1]) return undefined
    const gitdir = m[1]
    // gitdir 形如 /path/to/.git/worktrees/<name>(git 用正斜杠,即使 Windows)
    const marker = '/.git/worktrees/'
    const idx = gitdir.indexOf(marker)
    if (idx < 0) return undefined
    const sourceGitDir = gitdir.slice(0, idx + '/.git'.length)
    // 转换为 OS 路径分隔符后取父目录
    return path.dirname(path.normalize(sourceGitDir))
  } catch {
    return undefined
  }
}

// ============ worktree 创建/删除 ============

/**
 * 创建基于 CoW 复制的 git worktree。
 *
 * 流程:
 *   1. 校验 source/.git 存在(目录或文件均可)
 *   2. 校验 destination 不存在或为空
 *   3. mkdir -p destination.parent + mkdir destination
 *   4. 检测 CowKind(用于返回值统计)
 *   5. 并行:copyGitDir / copyTree / (可选)读 modified files
 *   6. 写 destination/.git/grok-worktree-source marker
 *   7. ref 指定且非 HEAD → git checkout ref
 *   8. preserveWorkingTree=false → git reset --hard
 *   9. 返回 WorktreeResult
 */
export async function createWorktree(opts: WorktreeOptions): Promise<WorktreeResult> {
  const start = Date.now()
  const { source, destination, ref, preserveWorkingTree = false, skip } = opts

  // 1. 校验源 .git 存在
  const srcGit = path.join(source, '.git')
  if (!fs.existsSync(srcGit)) {
    throw new Error(`源目录不是 git 仓库(缺少 .git): ${source}`)
  }

  // 解析 linked worktree 的实际 gitdir(source/.git 是文件时)
  let srcGitDir = srcGit
  if (getGitDirKind(srcGit) === 'file') {
    const sourceRepoRoot = parseLinkedGitFile(srcGit)
    if (sourceRepoRoot) {
      const resolved = path.join(sourceRepoRoot, '.git')
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        srcGitDir = resolved
      }
    }
  }

  // 2. 校验目标不存在或为空
  if (fs.existsSync(destination)) {
    const entries = fs.readdirSync(destination)
    if (entries.length > 0) {
      throw new Error(`目标目录非空: ${destination}`)
    }
  } else {
    // 3. 创建父目录和目标目录
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
    await fs.promises.mkdir(destination, { recursive: true })
  }

  // 4. 检测 CowKind(用于返回值统计)
  const cowKind = detectCowKind(destination)

  // 5. 并行三件事:.git 复制 / 工作树复制 / (可选)读 modified files
  const workSkip = new Set(skip ?? [])
  workSkip.add('.git')

  const [gitDirStats, copyStats] = await Promise.all([
    copyGitDir(srcGitDir, path.join(destination, '.git')),
    copyTree(source, destination, { skip: workSkip }),
    // preserveWorkingTree 时读 modified files 列表(结果未使用,占位并行)
    preserveWorkingTree ? readModifiedFiles(source) : Promise.resolve([]),
  ])

  // 6. 写 marker 文件
  try {
    fs.writeFileSync(
      path.join(destination, '.git', 'grok-worktree-source'),
      source,
      'utf-8',
    )
  } catch {
    // 写 marker 失败不阻断
  }

  // 7. ref 指定且不是 HEAD → checkout
  if (ref && ref !== 'HEAD') {
    const r = spawnSync('git', ['-C', destination, 'checkout', ref], {
      encoding: 'utf-8',
      windowsHide: true,
    })
    if (r.status !== 0) {
      process.stderr.write(
        `warning: git checkout ${ref} 失败: ${r.stderr ?? ''}\n`,
      )
    }
  }

  // 8. preserveWorkingTree=false → reset --hard 丢弃未提交修改
  if (!preserveWorkingTree) {
    const r = spawnSync('git', ['-C', destination, 'reset', '--hard'], {
      encoding: 'utf-8',
      windowsHide: true,
    })
    if (r.status !== 0) {
      process.stderr.write(`warning: git reset --hard 失败: ${r.stderr ?? ''}\n`)
    }
  }

  return {
    destination,
    gitDirKind: getGitDirKind(srcGit),
    cowKind,
    copyStats,
    gitDirStats,
    elapsedMs: Date.now() - start,
  }
}

/** 读 git status --porcelain 获取修改文件列表(并行占位,结果未使用)。 */
async function readModifiedFiles(repoDir: string): Promise<string[]> {
  try {
    const r = spawnSync('git', ['-C', repoDir, 'status', '--porcelain'], {
      encoding: 'utf-8',
      windowsHide: true,
    })
    if (r.status !== 0) return []
    const out = typeof r.stdout === 'string' ? r.stdout : ''
    return out
      .split(/\r?\n/)
      .filter((l) => l.length > 0)
      .map((l) => l.slice(3))
  } catch {
    return []
  }
}

/**
 * 删除 worktree。
 * - linked worktree(.git 是文件)→ 调 git worktree remove --force,失败 fallback 到 rm -rf
 * - standalone worktree(.git 是目录)→ 直接 rm -rf
 * - 路径不存在 → 直接返回(不抛错)
 * - 删除失败记录到 stderr 但返回成功,避免阻塞清理流程
 */
export async function removeWorktree(wtPath: string): Promise<void> {
  if (!fs.existsSync(wtPath)) return

  const gitPath = path.join(wtPath, '.git')

  try {
    let isLinked = false
    let sourceRepo: string | undefined

    if (fs.existsSync(gitPath)) {
      try {
        const stat = fs.statSync(gitPath)
        if (stat.isFile()) {
          isLinked = true
          sourceRepo = parseLinkedGitFile(gitPath)
        }
      } catch {
        isLinked = false
      }
    }

    if (isLinked && sourceRepo) {
      // linked worktree:从源仓库调 git worktree remove --force
      const r = spawnSync('git', ['worktree', 'remove', '--force', wtPath], {
        cwd: sourceRepo,
        encoding: 'utf-8',
        windowsHide: true,
      })
      if (r.status !== 0) {
        // fallback 到 rm -rf
        fs.rmSync(wtPath, { recursive: true, force: true })
      }
    } else {
      // standalone worktree、无 .git、或解析失败:直接 rm -rf
      fs.rmSync(wtPath, { recursive: true, force: true })
    }
  } catch (e) {
    process.stderr.write(`warning: 删除 worktree 失败: ${(e as Error).message}\n`)
  }
}
