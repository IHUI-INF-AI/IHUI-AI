// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按工作区的本地索引开关(2026-11-04 立)。
 *
 * 设计取向(与"全盘常驻后台扫描"明确相反):
 *   - **显式开关**:环境变量 `IHUI_WORKSPACE_INDEX`,取值 `off`(默认) / `workspace`;
 *     非法取值一律回落到 off 并把原因写进结论(不静默改语义)。
 *   - **范围严格**:`workspace` 模式只扫描当前工作区根(或其内部子目录),每个待索引路径
 *     都过一遍归属校验 `resolveWorkspacePath`;符号链接一概不跟随(链接可指向父目录/其他
 *     工作区,跟随即越界)。
 *   - **硬阈值**:文件数 / 字节数双上限,超限**整次拒绝建索引**并报出实际值与上限,
 *     不写半份索引、不靠"写到满盘再说"。
 *   - **产物落点**:固定外部缓存 `~/.ihui/workspace-index/<workspaceHash>/`,永不写进工作区
 *     ⇒ 天然不进 git(仓库 `.gitignore` 的 `.ihui/*` 另有一层兜底);`clearWorkspaceIndex` 一键清除。
 *   - **无后台**:只在本函数被显式调用时扫一次,不存在定时器/守护线程。
 */

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export const WORKSPACE_INDEX_ENV = 'IHUI_WORKSPACE_INDEX'
export type WorkspaceIndexMode = 'off' | 'workspace'

/** 与 `IndexManager` 同一份忽略口径:依赖/构建产物/版本库不进索引。 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.output',
  '.wxt',
  'target',
  'build',
  '.turbo',
  '.cache',
  'coverage',
])
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** 硬阈值:文件数与源码总字节数。超限拒绝建索引(两条都是"不许默默吃满磁盘"的落地)。 */
export const MAX_INDEX_FILES = 20_000
export const MAX_INDEX_BYTES = 64 * 1024 * 1024
export const WORKSPACE_INDEX_FILENAME = 'workspace-index.json'

export interface WorkspaceIndexDecision {
  mode: WorkspaceIndexMode
  /** 原始取值(便于把"为什么是 off"写进日志)。 */
  requested: string | null
  reason: string
}

/** 开关判定唯一出口:`off`(默认) / `workspace`;其它值 ⇒ off + 明确原因。 */
export function resolveWorkspaceIndexMode(
  raw: string | undefined | null = process.env[WORKSPACE_INDEX_ENV],
): WorkspaceIndexDecision {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return {
      mode: 'off',
      requested: null,
      reason: `${WORKSPACE_INDEX_ENV} 未设置 ⇒ 默认 off(不建本地索引)`,
    }
  }
  const value = raw.trim().toLowerCase()
  if (value === 'off') return { mode: 'off', requested: raw, reason: '显式 off' }
  if (value === 'workspace') return { mode: 'workspace', requested: raw, reason: '仅当前工作区' }
  return {
    mode: 'off',
    requested: raw,
    reason: `${WORKSPACE_INDEX_ENV}=${JSON.stringify(raw)} 不是 off/workspace ⇒ 回落到 off`,
  }
}

/** 路径越界(父目录 / 其他工作区 / 符号链接逃逸)。 */
export class WorkspaceIndexScopeError extends Error {
  constructor(workspaceRoot: string, candidate: string) {
    super(`路径越界:${candidate} 不在工作区 ${workspaceRoot} 内 ⇒ 拒绝访问`)
    this.name = 'WorkspaceIndexScopeError'
  }
}

/** 体量超限。消息里必须同时带实际值与上限,便于判断"该不该调阈值"。 */
export class WorkspaceIndexLimitError extends Error {
  constructor(
    readonly dimension: 'files' | 'bytes',
    readonly actual: number,
    readonly limit: number,
    detail: string,
  ) {
    super(
      `索引体量超限(${dimension}:实际 ${actual},上限 ${limit})⇒ 拒绝建索引。${detail}`,
    )
    this.name = 'WorkspaceIndexLimitError'
  }
}

/** 归属校验:把 candidate 解析为绝对路径并断言仍在工作区内(不跟随 ../ 逃逸)。 */
export function resolveWorkspacePath(workspaceRoot: string, candidate: string): string {
  const root = path.resolve(workspaceRoot)
  const abs = path.resolve(root, candidate)
  const rel = path.relative(root, abs)
  if (rel === '') return abs
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new WorkspaceIndexScopeError(root, abs)
  }
  return abs
}

/** 工作区是否有归属(用于外部传入路径的守卫;不存在的路径同样判越界)。 */
export function isInsideWorkspace(workspaceRoot: string, candidate: string): boolean {
  try {
    resolveWorkspacePath(workspaceRoot, candidate)
    return true
  } catch {
    return false
  }
}

/** 固定外部缓存目录:同一工作区确定性一致,且永远不在工作区内。 */
export function getWorkspaceIndexDir(workspaceRoot: string, cacheRoot?: string): string {
  const root = path.resolve(workspaceRoot)
  const hash = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 16)
  const base = cacheRoot ? path.resolve(cacheRoot) : path.join(os.homedir(), '.ihui', 'workspace-index')
  return path.join(base, hash)
}

export interface WorkspaceIndexFile {
  path: string
  size: number
  sha256: string
}

export interface WorkspaceIndexBuildResult {
  built: boolean
  mode: WorkspaceIndexMode
  files: number
  bytes: number
  indexPath: string | null
  reason: string
}

export interface BuildWorkspaceIndexOptions {
  workspaceRoot: string
  /** 缺省读 `IHUI_WORKSPACE_INDEX`;显式传值只给测试与调用方兜底。 */
  mode?: WorkspaceIndexMode
  /** 只索引工作区内某个子目录(仍过归属校验)。 */
  subdir?: string
  cacheRoot?: string
  fileLimit?: number
  byteLimit?: number
}

function collectFiles(dir: string, workspaceRoot: string): string[] {
  const out: string[] = []
  const stack: string[] = [dir]
  while (stack.length > 0) {
    const cur = stack.pop() as string
    // 每进入一层都重算归属:符号链接/相对路径拼出来的目录也逃不出工作区
    resolveWorkspacePath(workspaceRoot, cur)
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue // 链接可能指向父目录/其他工作区 ⇒ 一律不跟
      const abs = path.join(cur, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (entry.name.startsWith('.')) continue
        stack.push(abs)
        continue
      }
      if (!entry.isFile()) continue
      // 点文件(.env.ts 之类)多为本地配置/密钥,与源码索引无关 ⇒ 不进索引
      if (entry.name.startsWith('.')) continue
      if (!CODE_EXTS.has(path.extname(entry.name).toLowerCase())) continue
      out.push(abs)
    }
  }
  return out
}

function sha256File(absPath: string): string {
  return createHash('sha256').update(fs.readFileSync(absPath)).digest('hex')
}

/**
 * 只做体量盘点(不读内容、不哈希),供既有 IndexManager 在真正全量索引前做硬阈值闸门。
 * 超限抛 `WorkspaceIndexLimitError`(消息含实际值/上限/「拒绝建索引」)。
 */
export function assertWorkspaceIndexBudget(
  workspaceRoot: string,
  limits: { fileLimit?: number; byteLimit?: number } = {},
): { files: number; bytes: number } {
  const root = path.resolve(workspaceRoot)
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`工作区不存在或不是目录:${root} ⇒ 拒绝建索引`)
  }
  const fileLimit = limits.fileLimit ?? MAX_INDEX_FILES
  const byteLimit = limits.byteLimit ?? MAX_INDEX_BYTES
  const absFiles = collectFiles(root, root)
  if (absFiles.length > fileLimit) {
    throw new WorkspaceIndexLimitError(
      'files',
      absFiles.length,
      fileLimit,
      '请缩小工作区或用 .gitignore 排除生成物后重试',
    )
  }
  let bytes = 0
  for (const abs of absFiles) {
    bytes += fs.statSync(abs).size
    if (bytes > byteLimit) {
      throw new WorkspaceIndexLimitError(
        'bytes',
        bytes,
        byteLimit,
        `在 ${path.relative(root, abs).split(path.sep).join('/')} 处越线`,
      )
    }
  }
  return { files: absFiles.length, bytes }
}

/**
 * 建一次工作区索引。`off` 直接返回 built:false(不创建任何目录)。
 * 超阈值抛 `WorkspaceIndexLimitError`,此时不写盘(不留半份索引)。
 */
export async function buildWorkspaceIndex(
  opts: BuildWorkspaceIndexOptions,
): Promise<WorkspaceIndexBuildResult> {
  const decision =
    opts.mode === undefined
      ? resolveWorkspaceIndexMode()
      : { mode: opts.mode, requested: opts.mode, reason: `显式 ${opts.mode}` }
  if (decision.mode === 'off') {
    return {
      built: false,
      mode: 'off',
      files: 0,
      bytes: 0,
      indexPath: null,
      reason: decision.reason,
    }
  }

  const root = path.resolve(opts.workspaceRoot)
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`工作区不存在或不是目录:${root} ⇒ 拒绝建索引`)
  }
  const scanRoot = opts.subdir ? resolveWorkspacePath(root, opts.subdir) : root
  const fileLimit = opts.fileLimit ?? MAX_INDEX_FILES
  const byteLimit = opts.byteLimit ?? MAX_INDEX_BYTES

  const absFiles = collectFiles(scanRoot, root)
  if (absFiles.length > fileLimit) {
    throw new WorkspaceIndexLimitError(
      'files',
      absFiles.length,
      fileLimit,
      '请缩小工作区或用 .gitignore 排除生成物后重试',
    )
  }

  const entries: WorkspaceIndexFile[] = []
  let bytes = 0
  for (const abs of absFiles) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
    const size = fs.statSync(abs).size
    bytes += size
    if (bytes > byteLimit) {
      throw new WorkspaceIndexLimitError(
        'bytes',
        bytes,
        byteLimit,
        `在 ${rel} 处越线,已读 ${bytes} B`,
      )
    }
    entries.push({ path: rel, size, sha256: sha256File(abs) })
  }

  const indexDir = getWorkspaceIndexDir(root, opts.cacheRoot)
  if (isInsideWorkspace(root, indexDir)) {
    throw new Error(`索引目录落在了工作区内(${indexDir})⇒ 拒绝写盘(产物不得进 git)`)
  }
  fs.mkdirSync(indexDir, { recursive: true })
  const indexPath = path.join(indexDir, WORKSPACE_INDEX_FILENAME)
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        workspaceRoot: root,
        generatedAt: new Date().toISOString(),
        mode: decision.mode,
        files: entries,
      },
      null,
      2,
    ),
    'utf-8',
  )
  return {
    built: true,
    mode: 'workspace',
    files: entries.length,
    bytes,
    indexPath,
    reason: `已索引 ${entries.length} 个文件 / ${bytes} B(仅工作区 ${root})`,
  }
}

/** 一键清除:删除该工作区的本地索引目录,幂等。 */
export function clearWorkspaceIndex(
  workspaceRoot: string,
  cacheRoot?: string,
): { removed: boolean; dir: string } {
  const dir = getWorkspaceIndexDir(workspaceRoot, cacheRoot)
  if (!fs.existsSync(dir)) return { removed: false, dir }
  if (path.resolve(dir) === path.resolve(workspaceRoot)) {
    throw new Error(`拒绝清除:索引目录等于工作区根(${dir})`)
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return { removed: true, dir }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
