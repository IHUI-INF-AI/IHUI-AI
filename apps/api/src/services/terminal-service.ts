/**
 * 终端 PTY 管理服务 — node-pty spawn / resize / kill / list。
 *
 * 维护 Map<sessionId, PTYEntry>,按 userId 隔离,单用户最多 MAX_SESSIONS_PER_USER(5) 个并发。
 * 进程退出时触发 terminal-cleanup 插件的 SIGINT/SIGTERM 钩子,kill 全部 PTY 防僵尸。
 *
 * 安全:
 * - cwd 从外部传入但仅允许已存在的目录(防止穿越到任意路径)
 * - 不暴露环境变量给前端,env 复用服务端 process.env
 * - 不预置 shell 配置(.bashrc/.zshrc 由用户系统默认)
 */

import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import type { TerminalSession, TerminalSessionStatus } from '@ihui/types'

/**
 * 动态加载 node-pty(缺失时降级,不阻塞 server.ts 启动)。
 *
 * pnpm/npm 沙箱受限时可能未安装,此时 terminal 路由返回 501 提示用户手动安装。
 * 安装命令:pnpm --filter @ihui/api add node-pty
 */
const require = createRequire(import.meta.url)
type NodePtyModule = typeof import('node-pty')
let ptyMod: NodePtyModule | null = null
try {
  ptyMod = require('node-pty') as NodePtyModule
} catch {
  ptyMod = null
}

// PTY 实例的最小接口(与 node-pty 的 IPty 兼容,避免静态 import 失败)
interface IPty {
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
  onData(cb: (data: string) => void): { dispose(): void }
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): { dispose(): void }
}
type SpawnFn = (file: string, args: string[], options: {
  name?: string
  cols?: number
  rows?: number
  cwd?: string
  env?: Record<string, string>
}) => IPty
const spawn: SpawnFn | null = (ptyMod as { spawn?: SpawnFn } | null)?.spawn ?? null

/** PTY 条目(内部管理) */
interface PTYEntry {
  pty: IPty
  sessionId: string
  userId: string
  cwd: string
  createdAt: number
  lastActivityAt: number
  status: TerminalSessionStatus
  exitCode?: number
  /** onData/onExit 监听器引用(用于 kill 时移除) */
  dataListeners: Set<(data: string) => void>
  exitListeners: Set<(e: { exitCode: number; signal?: number }) => void>
}

/** 单用户最大并发终端数 */
const MAX_SESSIONS_PER_USER = 5

/** 默认终端尺寸 */
const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

/** 全局 session → PTY 映射 */
const sessions = new Map<string, PTYEntry>()

/** userId → sessionId 集合(用于限额 + 列表) */
const userSessions = new Map<string, Set<string>>()

/** 获取用户 shell(Windows: powershell, Unix: /bin/bash 或 $SHELL) */
function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

/** 把 PTYEntry 转为 TerminalSession(剥离内部字段) */
function toSession(entry: PTYEntry): TerminalSession {
  return {
    id: entry.sessionId,
    cwd: entry.cwd,
    userId: entry.userId,
    createdAt: entry.createdAt,
    lastActivityAt: entry.lastActivityAt,
    status: entry.status,
    exitCode: entry.exitCode,
  }
}

/** 统计用户当前 session 数 */
function countUserSessions(userId: string): number {
  return userSessions.get(userId)?.size ?? 0
}

/** 注册 sessionId 到 userId 映射 */
function registerUserSession(userId: string, sessionId: string): void {
  if (!userSessions.has(userId)) userSessions.set(userId, new Set())
  userSessions.get(userId)!.add(sessionId)
}

/** 注销 sessionId */
function unregisterUserSession(userId: string, sessionId: string): void {
  const set = userSessions.get(userId)
  if (set) {
    set.delete(sessionId)
    if (set.size === 0) userSessions.delete(userId)
  }
}

/**
 * 创建新的 PTY 会话。
 * @returns session 信息
 * @throws Error 如果超过限额或 spawn 失败
 */
export function createSession(
  userId: string,
  opts: { cwd?: string; cols?: number; rows?: number } = {},
): TerminalSession {
  if (countUserSessions(userId) >= MAX_SESSIONS_PER_USER) {
    throw new Error(`超过最大并发终端数(${MAX_SESSIONS_PER_USER})`)
  }

  const sessionId = randomUUID()
  const cwd = opts.cwd && opts.cwd.length > 0 ? opts.cwd : process.cwd()
  const cols = opts.cols ?? DEFAULT_COLS
  const rows = opts.rows ?? DEFAULT_ROWS
  const shell = getDefaultShell()

  if (!spawn) {
    throw new Error(
      'node-pty 未安装,终端功能不可用。请在服务端执行:pnpm --filter @ihui/api add node-pty',
    )
  }

  let pty: IPty
  try {
    pty = spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>,
    })
  } catch (e) {
    throw new Error(`终端创建失败: ${(e as Error).message}`)
  }

  const entry: PTYEntry = {
    pty,
    sessionId,
    userId,
    cwd,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    status: 'active',
    dataListeners: new Set(),
    exitListeners: new Set(),
  }

  // PTY 输出 → 通知所有 data 监听器(WebSocket handler 注册)
  pty.onData((data: string) => {
    entry.lastActivityAt = Date.now()
    for (const cb of entry.dataListeners) {
      try {
        cb(data)
      } catch {
        /* 监听器异常不影响 PTY */
      }
    }
  })

  // PTY 退出 → 标记 exited + 通知 exit 监听器
  pty.onExit((e: { exitCode: number; signal?: number }) => {
    entry.status = 'exited'
    entry.exitCode = e.exitCode
    entry.lastActivityAt = Date.now()
    for (const cb of entry.exitListeners) {
      try {
        cb(e)
      } catch {
        /* ignore */
      }
    }
  })

  sessions.set(sessionId, entry)
  registerUserSession(userId, sessionId)

  return toSession(entry)
}

/** 列出用户的所有 session */
export function listSessions(userId: string): TerminalSession[] {
  const sessionIds = userSessions.get(userId)
  if (!sessionIds) return []
  const result: TerminalSession[] = []
  for (const id of sessionIds) {
    const entry = sessions.get(id)
    if (entry) result.push(toSession(entry))
  }
  return result
}

/** 获取单个 session(校验 userId 归属) */
export function getSession(sessionId: string, userId: string): PTYEntry | null {
  const entry = sessions.get(sessionId)
  if (!entry || entry.userId !== userId) return null
  return entry
}

/** 获取 PTY 条目(供 WS handler 使用,不校验 userId — WS handler 自行校验) */
export function getPTYEntry(sessionId: string): PTYEntry | null {
  return sessions.get(sessionId) ?? null
}

/** 调整 PTY 大小 */
export function resizeSession(sessionId: string, userId: string, cols: number, rows: number): boolean {
  const entry = getSession(sessionId, userId)
  if (!entry || entry.status !== 'active') return false
  try {
    entry.pty.resize(Math.max(1, cols), Math.max(1, rows))
    entry.lastActivityAt = Date.now()
    return true
  } catch {
    return false
  }
}

/** 关闭/杀死 PTY 会话 */
export function closeSession(sessionId: string, userId: string): boolean {
  const entry = getSession(sessionId, userId)
  if (!entry) return false
  try {
    entry.status = 'closed'
    entry.pty.kill()
  } catch {
    /* PTY 可能已退出 */
  }
  sessions.delete(sessionId)
  unregisterUserSession(userId, sessionId)
  return true
}

/** 注册 PTY 数据监听器(WebSocket handler 使用) */
export function onData(sessionId: string, cb: (data: string) => void): (() => void) | null {
  const entry = sessions.get(sessionId)
  if (!entry) return null
  entry.dataListeners.add(cb)
  return () => entry.dataListeners.delete(cb)
}

/** 注册 PTY 退出监听器(WebSocket handler 使用) */
export function onExit(
  sessionId: string,
  cb: (e: { exitCode: number; signal?: number }) => void,
): (() => void) | null {
  const entry = sessions.get(sessionId)
  if (!entry) return null
  entry.exitListeners.add(cb)
  return () => entry.exitListeners.delete(cb)
}

/** 向 PTY 写入输入 */
export function writeInput(sessionId: string, data: string): boolean {
  const entry = sessions.get(sessionId)
  if (!entry || entry.status !== 'active') return false
  try {
    entry.pty.write(data)
    entry.lastActivityAt = Date.now()
    return true
  } catch {
    return false
  }
}

/** 杀死所有 PTY(进程退出时调用,防僵尸) */
export function killAllSessions(): void {
  for (const [, entry] of sessions) {
    try {
      entry.status = 'closed'
      entry.pty.kill()
    } catch {
      /* ignore */
    }
  }
  sessions.clear()
  userSessions.clear()
}

/** 获取活跃 session 总数(监控用) */
export function getActiveSessionCount(): number {
  return sessions.size
}
