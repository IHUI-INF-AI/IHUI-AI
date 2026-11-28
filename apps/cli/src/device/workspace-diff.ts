// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区改动抓取与逐文件回退(G4,2026-11-28)。
 *
 * 为什么落在执行端而不是服务端:只有设备知道"这轮跑之前工作区长什么样"。
 * 服务端拿到的必须是一份**带判据的快照**(revertable),不能只拿 patch 让它猜
 * —— 猜错的代价是把用户自己的未提交改动一起 checkout 掉。
 *
 * 判据三条:
 *  1. 只有执行前干净(被 git 跟踪且无 index/worktree 改动)的路径才标 revertable;
 *     执行前就脏的文件,回退会连用户原来的改动一起丢,一律不可回退;
 *  2. 新增文件只在"执行前不在 untracked 集合里"时才可回退(删除);
 *  3. 回退一律走 `git checkout HEAD -- <path>` / 删文件,不碰用户其余路径。
 *
 * 非 git 工作区:能看(改动靠 git 无从谈起 —— 本模块直接返回 null),
 * 执行端如实报"抓不到 diff",不伪造。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs'
import { isAbsolute, join, normalize, sep } from 'node:path'
import {
  DEVICE_DIFF_MAX_FILES,
  DEVICE_DIFF_MAX_PATCH_CHARS,
  DEVICE_DIFF_MAX_TOTAL_CHARS,
  type DeviceTaskDiffSummary,
  type DeviceTaskFileDiff,
  type DeviceDiffFileStatus,
} from '@ihui/types'

/** `git` 调用统一上限:diff 正文再大也只读到这里,防一枚畸形仓库把设备内存打爆 */
const GIT_MAX_BUFFER = 8 * 1024 * 1024

interface GitRun {
  ok: boolean
  out: string
}

function git(cwd: string, args: string[]): GitRun {
  try {
    // --literal-pathspecs:路径按字面处理。回退是 `git checkout -- <path>`,
    // 若路径含 `*`/`?`/`[` 被当 glob 展开,会误改用户别的文件。
    const out = execFileSync('git', ['--literal-pathspecs', '-C', cwd, ...args], {
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return { ok: true, out }
  } catch {
    return { ok: false, out: '' }
  }
}

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/')
}

/** 工作区相对路径合法性:只接受仓库内相对路径,`..`/绝对路径一律拒绝(回退动作的准入) */
function isSafeRelativePath(p: string): boolean {
  if (!p || isAbsolute(p)) return false
  if (p.includes('\u0000')) return false
  return !normalize(p).split(/[\\/]/).some((seg) => seg === '..')
}

export interface WorkspaceSnapshot {
  /** git 仓库根;null = 不是 git 仓库(或 git 不可用) */
  repoRoot: string | null
  /** 工作区相对仓库根的 POSIX 前缀;'' = 工作区就是仓库根 */
  workspaceRel: string
  /** 执行前 HEAD;空仓库(null)无法对 tracked 做 diff,只能看新增文件 */
  baseRef: string | null
  /** 执行前已脏(被跟踪且有改动)的仓库相对路径 —— 这些文件不可回退 */
  dirty: Set<string>
  /** 执行前就存在的 untracked 文件 —— 新出现的才归本轮,才可回退 */
  untracked: Set<string>
}

/** `git status --porcelain=v1 -z --no-renames` 的解析结果(路径均为仓库相对) */
interface StatusEntry {
  code: string
  path: string
}

function readStatus(repoRoot: string): StatusEntry[] {
  const res = git(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'])
  if (!res.ok || !res.out) return []
  const entries: StatusEntry[] = []
  for (const token of res.out.split('\u0000')) {
    if (token.length < 4) continue
    const code = token.slice(0, 2)
    const path = token.slice(3)
    if (!path) continue
    entries.push({ code, path })
  }
  return entries
}

/** 取执行前快照。非 git / git 缺失 → repoRoot=null,后续只报"抓不到",不猜。 */
export function snapshotWorkspace(workspacePath: string): WorkspaceSnapshot {
  const empty: WorkspaceSnapshot = {
    repoRoot: null,
    workspaceRel: '',
    baseRef: null,
    dirty: new Set(),
    untracked: new Set(),
  }
  let wsReal: string
  try {
    wsReal = realpathSync.native(workspacePath)
  } catch {
    return empty
  }
  const top = git(wsReal, ['rev-parse', '--show-toplevel'])
  if (!top.ok || !top.out.trim()) return empty
  let repoRoot: string
  try {
    repoRoot = realpathSync.native(top.out.trim())
  } catch {
    return empty
  }
  const wsPosix = toPosix(wsReal)
  const rootPosix = toPosix(repoRoot)
  const inside = wsPosix === rootPosix || wsPosix.startsWith(`${rootPosix}/`)
  if (!inside) return empty
  const workspaceRel = wsPosix === rootPosix ? '' : wsPosix.slice(rootPosix.length + 1)

  const head = git(repoRoot, ['rev-parse', 'HEAD'])
  const baseRef = head.ok && head.out.trim() ? head.out.trim() : null

  const dirty = new Set<string>()
  const untracked = new Set<string>()
  for (const entry of readStatus(repoRoot)) {
    if (entry.code === '??') untracked.add(entry.path)
    else dirty.add(entry.path)
  }
  return { repoRoot, workspaceRel, baseRef, dirty, untracked }
}

/** 仓库相对路径 → 工作区相对路径;不在工作区内返回 null(子目录工作区只报自己目录内的改动) */
function toWorkspacePath(snapshot: WorkspaceSnapshot, repoPath: string): string | null {
  if (!snapshot.workspaceRel) return repoPath
  const prefix = `${snapshot.workspaceRel}/`
  return repoPath.startsWith(prefix) ? repoPath.slice(prefix.length) : null
}

/** 工作区相对路径 → 仓库相对路径 */
function toRepoPath(snapshot: WorkspaceSnapshot, path: string): string {
  return snapshot.workspaceRel ? `${snapshot.workspaceRel}/${path}` : path
}

function readPatch(
  snapshot: WorkspaceSnapshot,
  repoPath: string,
  budget: number,
): { patch: string; truncated: boolean } {
  if (!snapshot.repoRoot || budget <= 0) return { patch: '', truncated: false }
  const res = git(snapshot.repoRoot, [
    'diff',
    '--no-color',
    '--no-ext-diff',
    '--no-renames',
    '--unified=3',
    'HEAD',
    '--',
    repoPath,
  ])
  if (!res.ok || !res.out) return { patch: '', truncated: false }
  if (res.out.length <= budget) return { patch: res.out, truncated: false }
  return { patch: res.out.slice(0, budget), truncated: true }
}

/** 新增文件伪 diff:标题行 + 逐行 `+`(只在预算内,超了标 truncated) */
function syntheticAddPatch(workspacePath: string, path: string, budget: number): {
  patch: string
  truncated: boolean
  additions: number
} {
  if (budget <= 0) return { patch: '', truncated: true, additions: 0 }
  let content: string
  try {
    const full = join(workspacePath, path)
    if (statSync(full).size > GIT_MAX_BUFFER) {
      return { patch: '', truncated: true, additions: 0 }
    }
    content = readFileSync(full, 'utf8')
  } catch {
    return { patch: '', truncated: true, additions: 0 }
  }
  if (content.includes('\u0000')) {
    // 二进制文件不伪造成文本 diff(展示层会破形,行数也没有意义)
    return { patch: '', truncated: true, additions: 0 }
  }
  const lines = content.split(/\r?\n/)
  // 末尾换行会 split 出空串,不算一行
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const header = `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n`
  let patch = header
  let shown = 0
  for (const line of lines) {
    const next = `+${line}\n`
    if (patch.length + next.length > budget) {
      return { patch, truncated: true, additions: lines.length }
    }
    patch += next
    shown += 1
  }
  return { patch, truncated: shown < lines.length, additions: lines.length }
}

interface NumstatEntry {
  additions: number
  deletions: number
  binary: boolean
}

function readNumstat(snapshot: WorkspaceSnapshot): Map<string, NumstatEntry> {
  const result = new Map<string, NumstatEntry>()
  if (!snapshot.repoRoot || !snapshot.baseRef) return result
  const res = git(snapshot.repoRoot, ['diff', '--numstat', '-z', '--no-renames', 'HEAD'])
  if (!res.ok || !res.out) return result
  for (const token of res.out.split('\u0000')) {
    if (!token) continue
    const firstTab = token.indexOf('\t')
    const secondTab = token.indexOf('\t', firstTab + 1)
    if (firstTab < 0 || secondTab < 0) continue
    const addRaw = token.slice(0, firstTab)
    const delRaw = token.slice(firstTab + 1, secondTab)
    const path = token.slice(secondTab + 1)
    if (!path) continue
    const binary = addRaw === '-' || delRaw === '-'
    result.set(path, {
      additions: binary ? 0 : Number.parseInt(addRaw, 10) || 0,
      deletions: binary ? 0 : Number.parseInt(delRaw, 10) || 0,
      binary,
    })
  }
  return result
}

/**
 * 抓本轮改动。返回 null = 工作区不是 git 仓库 / 没有 HEAD / 一个文件都没变。
 * 所有路径均为**工作区相对** POSIX 路径;超预算截断而不是报错。
 */
export function captureWorkspaceDiff(
  workspacePath: string,
  snapshot: WorkspaceSnapshot,
): DeviceTaskDiffSummary | null {
  if (!snapshot.repoRoot) return null
  const numstat = readNumstat(snapshot)
  const statusEntries = readStatus(snapshot.repoRoot)
  const statusByPath = new Map<string, string>()
  for (const entry of statusEntries) statusByPath.set(entry.path, entry.code)

  const collected: DeviceTaskFileDiff[] = []
  let totalChars = 0
  let truncatedFiles = false

  const pushFile = (
    repoPath: string,
    status: DeviceDiffFileStatus,
    additions: number,
    deletions: number,
    patchBuilder: (budget: number) => { patch: string; truncated: boolean },
    revertable: boolean,
  ): void => {
    if (collected.length >= DEVICE_DIFF_MAX_FILES) {
      truncatedFiles = true
      return
    }
    const wsPath = toWorkspacePath(snapshot, repoPath)
    if (!wsPath || !isSafeRelativePath(wsPath)) return
    const budget = Math.min(DEVICE_DIFF_MAX_PATCH_CHARS, DEVICE_DIFF_MAX_TOTAL_CHARS - totalChars)
    const built = patchBuilder(budget)
    totalChars += built.patch.length
    collected.push({
      path: wsPath,
      status,
      additions,
      deletions,
      ...(built.patch ? { patch: built.patch } : {}),
      ...(built.truncated ? { truncated: true } : {}),
      revertable,
    })
  }

  // 1) tracked 改动(含删除)
  for (const [repoPath, stat] of numstat) {
    const code = statusByPath.get(repoPath) ?? ''
    const status: DeviceDiffFileStatus = code.replace(/ /g, '').includes('D') ? 'deleted' : 'modified'
    // 执行前就脏 ⇒ 无法区分"用户的改动"与"这轮 agent 的改动" ⇒ 不可回退
    const revertable = !snapshot.dirty.has(repoPath)
    pushFile(
      repoPath,
      status,
      stat.additions,
      stat.deletions,
      (budget) => (stat.binary ? { patch: '', truncated: false } : readPatch(snapshot, repoPath, budget)),
      revertable,
    )
  }

  // 2) 本轮新增的 untracked 文件(执行前不在集合里)
  for (const entry of statusEntries) {
    if (entry.code !== '??') continue
    if (snapshot.untracked.has(entry.path)) continue
    const wsPath = toWorkspacePath(snapshot, entry.path)
    if (!wsPath || !isSafeRelativePath(wsPath)) continue
    let synthetic = { patch: '', truncated: true, additions: 0 }
    const budget = Math.min(DEVICE_DIFF_MAX_PATCH_CHARS, DEVICE_DIFF_MAX_TOTAL_CHARS - totalChars)
    try {
      synthetic = syntheticAddPatch(workspacePath, wsPath, budget)
    } catch {
      /* 读不到就只报文件名 */
    }
    pushFile(entry.path, 'added', synthetic.additions, 0, () => ({
      patch: synthetic.patch,
      truncated: synthetic.truncated,
    }), true)
  }

  if (collected.length === 0) return null
  const additions = collected.reduce((sum, f) => sum + f.additions, 0)
  const deletions = collected.reduce((sum, f) => sum + f.deletions, 0)
  return {
    baseRef: snapshot.baseRef,
    files: collected,
    additions,
    deletions,
    truncated: truncatedFiles,
    capturedAt: new Date().toISOString(),
  }
}

export interface RevertOutcome {
  reverted: string[]
  skipped: { path: string; reason: string }[]
}

/**
 * 按"收下清单"回退其余**可回退**文件。
 * `keepPaths` 为 undefined = 没给逐文件清单(全收,一个都不回退);为 `[]` = 一个都不收(全退回)。
 * 不可回退的文件一律留在原处并如实列进 skipped —— 不假装回退成功。
 */
export function revertWorkspaceChanges(
  workspacePath: string,
  snapshot: WorkspaceSnapshot,
  files: DeviceTaskFileDiff[],
  keepPaths: string[] | undefined,
): RevertOutcome {
  const outcome: RevertOutcome = { reverted: [], skipped: [] }
  if (!snapshot.repoRoot) {
    return {
      reverted: [],
      skipped: files.map((f) => ({ path: f.path, reason: '工作区不是 git 仓库,无法回退' })),
    }
  }
  const keep = new Set(keepPaths === undefined ? files.map((f) => f.path) : keepPaths)
  for (const file of files) {
    if (keep.has(file.path)) continue
    if (!file.revertable) {
      outcome.skipped.push({ path: file.path, reason: '执行前已有未提交改动,回退会连带丢掉' })
      continue
    }
    if (!isSafeRelativePath(file.path)) {
      outcome.skipped.push({ path: file.path, reason: '路径不合法' })
      continue
    }
    const repoPath = toRepoPath(snapshot, file.path)
    try {
      if (file.status === 'added') {
        const full = join(workspacePath, file.path)
        if (existsSync(full)) rmSync(full, { force: true })
        outcome.reverted.push(file.path)
        continue
      }
      // modified / deleted 都走 HEAD 恢复(删除的文件也由 HEAD 版本重建)
      const res = git(snapshot.repoRoot, ['checkout', 'HEAD', '--', repoPath])
      if (!res.ok) {
        outcome.skipped.push({ path: file.path, reason: 'git checkout 失败' })
        continue
      }
      outcome.reverted.push(file.path)
    } catch (e) {
      outcome.skipped.push({
        path: file.path,
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return outcome
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
