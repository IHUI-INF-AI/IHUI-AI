// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Git 工作区写通道(2026-11-23 立)。
 *
 * 参考 WorkBuddy `main` 的 `/api/v1/git/*`(status/stage/unstage/commit/diff/discard/
 * branches/branch/switch/create/push/pull/log)。本仓原先只有只读的 `git/status`、
 * `git/review-diff`、`git/worktrees`;缺的是**写面**。这里只补写面,不改只读面。
 *
 * 安全边界:
 *  1. workspacePath 必须落在 `IHUI_WORKSPACE_ROOTS` 登记根内(与 FSBridge 同源判据);
 *  2. 用 `execFile('git', argv)` 直接传参,不经 shell,杜绝 `; | &` 注入;
 *  3. 一律带 `-c core.hooksPath=.git/ihui-no-hooks`、`commit.gpgsign=false`,
 *     工作区自带的 pre-commit/post-commit 钩子不会执行,避免"提交即执行仓库代码";
 *  4. pathspec 只收仓库内相对路径,拒绝绝对路径、盘符、`..` 段与 NUL;
 *  5. 子进程环境只保留 PATH/SystemRoot 等最小键,`GIT_TERMINAL_PROMPT=0`,
 *     不会把 JWT_SECRET/DATABASE_URL 之类带进可能被钩子读取的环境;
 *  6. push/pull 由路由层要求 admin,并走网络档;本服务只负责执行与形状。
 */

import { execFile } from 'node:child_process'
import { assertWithinRegisteredRoots } from '../utils/workspace-roots.js'

const MAX_BUFFER = 4 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 20_000
const MAX_PATHS = 500
const MAX_MESSAGE_LENGTH = 5_000

/** git 自身配置:禁钩子、禁签名、禁 fsmonitor;不依赖仓库本地配置。 */
const HARDENING_CONFIG = [
  '-c',
  'core.hooksPath=.git/ihui-no-hooks',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'tag.gpgsign=false',
  '-c',
  'advice.detachedHead=false',
]

export interface GitRunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export type GitRunner = (
  args: string[],
  opts: { cwd: string; timeoutMs: number },
) => Promise<GitRunResult>

export interface GitBranch {
  name: string
  current: boolean
  upstream: string
  head: string
}

export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  date: string
  subject: string
}

/** `git diff HEAD` 的单文件行;status 与 DiffFileStatus 同词。 */
export interface GitDiffStatFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
}

export class GitWorkspaceError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message)
    this.name = 'GitWorkspaceError'
  }
}

/** 只保留 git 执行真正需要的环境键;绝不把业务密钥传给子进程。 */
function buildGitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of [
    'PATH',
    'SystemRoot',
    'SYSTEMROOT',
    'COMSPEC',
    'HOME',
    'USERPROFILE',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
  ]) {
    const value = process.env[key]
    if (value !== undefined) env[key] = value
  }
  env.GIT_TERMINAL_PROMPT = '0'
  env.GIT_ASKPASS = 'echo'
  env.SSH_ASKPASS = 'echo'
  env.GCM_INTERACTIVE = 'never'
  return env
}

function defaultRunner(
  args: string[],
  opts: { cwd: string; timeoutMs: number },
): Promise<GitRunResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: opts.cwd,
        timeout: opts.timeoutMs,
        maxBuffer: MAX_BUFFER,
        shell: false,
        windowsHide: true,
        env: buildGitEnv(),
      },
      (err, stdout, stderr) => {
        const rawCode = (err as (Error & { code?: number | string }) | null)?.code
        const exitCode = typeof rawCode === 'number' ? rawCode : err ? 127 : 0
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode })
      },
    )
  })
}

/** 仓库内相对路径;拒绝一切可逃出 worktree 的形态。 */
export function normalizeRepoPaths(paths: string[]): string[] {
  if (!Array.isArray(paths)) throw new GitWorkspaceError('paths 必须是数组', 400)
  if (paths.length > MAX_PATHS) throw new GitWorkspaceError(`paths 最多 ${MAX_PATHS} 条`, 400)
  return paths.map((raw) => {
    if (typeof raw !== 'string') throw new GitWorkspaceError('path 必须是字符串', 400)
    const path = raw.replace(/\\/g, '/')
    if (!path || path.length > 4096) throw new GitWorkspaceError('path 为空或过长', 400)
    if (path.includes('\0')) throw new GitWorkspaceError('path 含非法字符', 400)
    if (path.startsWith('/') || /^[A-Za-z]:/.test(path))
      throw new GitWorkspaceError(`path 必须是仓库内相对路径: ${raw}`, 400)
    if (path.split('/').some((seg) => seg === '..'))
      throw new GitWorkspaceError(`path 不得包含 ..: ${raw}`, 400)
    return path
  })
}

/** 分支名既用于 argv,也用于 ref;先按 git 的 ref 规则收窄。 */
export function assertSafeBranchName(name: string): string {
  if (typeof name !== 'string' || !name || name.length > 120)
    throw new GitWorkspaceError('分支名为空或过长', 400)
  if (
    !/^[A-Za-z0-9._/-]+$/.test(name) ||
    name.startsWith('-') ||
    name.includes('..') ||
    name.includes('@{') ||
    name.endsWith('/') ||
    name.endsWith('.lock')
  ) {
    throw new GitWorkspaceError(`分支名不合法: ${name}`, 400)
  }
  return name
}

function parseLines(stdout: string, separator: string): string[][] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(separator))
}

export class GitWorkspace {
  constructor(private readonly runner: GitRunner = defaultRunner) {}

  async run(
    workspacePath: string,
    args: string[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<GitRunResult> {
    const result = await this.runRaw(workspacePath, args, timeoutMs)
    if (result.exitCode !== 0) {
      const detail = (result.stderr || result.stdout || `git 退出码 ${result.exitCode}`).trim()
      throw new GitWorkspaceError(detail.slice(0, 2000), result.exitCode)
    }
    return result
  }

  /** 允许非零退出码的通道(check-ignore 命中 1 是正常语义,不是失败)。 */
  async runRaw(
    workspacePath: string,
    args: string[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<GitRunResult> {
    const root = assertWithinRegisteredRoots(workspacePath, '工作区')
    return this.runner([...HARDENING_CONFIG, ...args], { cwd: root, timeoutMs })
  }

  async stage(workspacePath: string, paths: string[]): Promise<GitRunResult> {
    const safePaths = normalizeRepoPaths(paths)
    return this.run(workspacePath, [
      'add',
      ...(safePaths.length > 0 ? ['--', ...safePaths] : ['-A']),
    ])
  }

  async unstage(workspacePath: string, paths: string[]): Promise<GitRunResult> {
    const safePaths = normalizeRepoPaths(paths)
    return this.run(workspacePath, [
      'restore',
      '--staged',
      '--',
      ...(safePaths.length > 0 ? safePaths : ['.']),
    ])
  }

  async discard(workspacePath: string, paths: string[]): Promise<GitRunResult> {
    const safePaths = normalizeRepoPaths(paths)
    return this.run(workspacePath, ['restore', '--', ...(safePaths.length > 0 ? safePaths : ['.'])])
  }

  /**
   * 统一 diff(2026-11-23,对齐 WorkBuddy `/api/v1/git/diff`)。
   * 只回 unified patch 原文,不在这里解析 hunk —— 前端 diff 视图与 review-diff 共用同一段文本。
   */
  async diff(
    workspacePath: string,
    opts: { staged?: boolean; paths?: string[]; contextLines?: number } = {},
  ): Promise<{ diff: string; staged: boolean }> {
    const safePaths = normalizeRepoPaths(opts.paths ?? [])
    const context = Math.max(0, Math.min(10, Math.trunc(opts.contextLines ?? 3)))
    const args = ['diff', '--no-ext-diff', '--no-color', `--unified=${context}`]
    if (opts.staged) args.push('--cached')
    if (safePaths.length > 0) args.push('--', ...safePaths)
    const result = await this.run(workspacePath, args, 30_000)
    return { diff: result.stdout, staged: Boolean(opts.staged) }
  }

  /**
   * 工作区相对 HEAD 的变更清单 + 逐文件增删行数（2026-11-23，对齐 WorkBuddy
   * `/api/v1/git/diff` 的“列表 + 统计”消费面）。
   *
   * 立因：源码管理面板此前是 `git diff --name-status HEAD` 之后**每个文件再跑一次**
   * `git diff --numstat`（N+1 次子进程）。这里一次请求内只跑两条 git，统计与状态
   * 在同一回包里对齐；`--no-renames` 让重命名以 D+A 呈现，统计准确优先于标签。
   */
  async diffStat(workspacePath: string, base = 'HEAD'): Promise<GitDiffStatFile[]> {
    const [statusResult, numstatResult] = await Promise.all([
      this.run(workspacePath, ['diff', '--name-status', '--no-renames', '--no-ext-diff', base]),
      this.run(workspacePath, ['diff', '--numstat', '--no-renames', '--no-ext-diff', base]),
    ])
    const stats = new Map<string, { additions: number; deletions: number }>()
    for (const line of numstatResult.stdout.split('\n')) {
      if (!line.trim()) continue
      const [addRaw = '', delRaw = '', ...pathParts] = line.split('\t')
      const path = pathParts.join('\t')
      if (!path) continue
      stats.set(path, {
        additions: addRaw === '-' ? 0 : Number.parseInt(addRaw, 10) || 0,
        deletions: delRaw === '-' ? 0 : Number.parseInt(delRaw, 10) || 0,
      })
    }
    const files: GitDiffStatFile[] = []
    for (const line of statusResult.stdout.split('\n')) {
      if (!line.trim()) continue
      const [code = '', ...pathParts] = line.split('\t')
      const path = pathParts.join('\t')
      if (!path) continue
      const kind = code.charAt(0)
      const status: GitDiffStatFile['status'] =
        kind === 'A' ? 'added' : kind === 'D' ? 'deleted' : kind === 'R' ? 'renamed' : 'modified'
      const stat = stats.get(path) ?? { additions: 0, deletions: 0 }
      files.push({ path, status, ...stat })
    }
    return files
  }

  /**
   * 查哪些路径被忽略(2026-11-23,对齐 WorkBuddy `/api/v1/git/check-ignore`)。
   * `git check-ignore` 无命中时退出码为 1 —— 这是"没有文件被忽略"的正常回包,
   * 不能按失败抛错,否则 UI 每次都会看到一条假红。
   */
  async checkIgnore(workspacePath: string, paths: string[]): Promise<string[]> {
    const safePaths = normalizeRepoPaths(paths)
    if (safePaths.length === 0) return []
    const result = await this.runRaw(workspacePath, ['check-ignore', '-v', '--', ...safePaths])
    if (result.exitCode === 1) return []
    if (result.exitCode !== 0) {
      const detail = (result.stderr || result.stdout || `git 退出码 ${result.exitCode}`).trim()
      throw new GitWorkspaceError(detail.slice(0, 2000), result.exitCode)
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split('\t').pop() ?? '')
      .filter(Boolean)
  }

  async commit(workspacePath: string, message: string, paths: string[]): Promise<GitRunResult> {
    const text = typeof message === 'string' ? message.trim() : ''
    if (!text) throw new GitWorkspaceError('commit message 不能为空', 400)
    if (text.length > MAX_MESSAGE_LENGTH)
      throw new GitWorkspaceError(`commit message 超过 ${MAX_MESSAGE_LENGTH} 字符`, 400)
    const safePaths = normalizeRepoPaths(paths)
    return this.run(
      workspacePath,
      ['commit', '-m', text, '--no-verify', ...(safePaths.length > 0 ? ['--', ...safePaths] : [])],
      30_000,
    )
  }

  async branches(workspacePath: string): Promise<GitBranch[]> {
    const sep = '\x1f'
    const format = ['%(refname:short)', '%(HEAD)', '%(upstream:short)', '%(objectname:short)'].join(
      sep,
    )
    const result = await this.run(workspacePath, [
      'for-each-ref',
      `--format=${format}`,
      'refs/heads',
    ])
    return parseLines(result.stdout, sep).map(
      ([name = '', head = '', upstream = '', object = '']) => ({
        name,
        current: head.trim() === '*',
        upstream,
        head: object,
      }),
    )
  }

  async createBranch(
    workspacePath: string,
    name: string,
    checkout: boolean,
  ): Promise<GitRunResult> {
    const branch = assertSafeBranchName(name)
    return this.run(workspacePath, checkout ? ['switch', '-c', branch] : ['branch', branch])
  }

  async switchBranch(workspacePath: string, name: string): Promise<GitRunResult> {
    return this.run(workspacePath, ['switch', assertSafeBranchName(name)])
  }

  async log(workspacePath: string, limit: number): Promise<GitCommit[]> {
    const count = Math.max(1, Math.min(200, Math.trunc(limit)))
    const result = await this.run(workspacePath, [
      'log',
      '-n',
      String(count),
      '--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e',
    ])
    return result.stdout
      .split('\x1e')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [hash = '', shortHash = '', author = '', date = '', subject = ''] = item.split('\x1f')
        return { hash, shortHash, author, date, subject }
      })
  }

  /** 网络动作:只由 admin 路由调用;仍禁钩子并禁交互式凭据。 */
  async push(workspacePath: string, remote = 'origin', branch?: string): Promise<GitRunResult> {
    return this.run(workspacePath, ['push', remote, ...(branch ? [branch] : [])], 60_000)
  }

  async pull(workspacePath: string, remote = 'origin', branch?: string): Promise<GitRunResult> {
    return this.run(
      workspacePath,
      ['pull', '--ff-only', remote, ...(branch ? [branch] : [])],
      60_000,
    )
  }
}

export const gitWorkspace = new GitWorkspace()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
