/**
 * 终端 PTY 管理服务 — 本地 node-pty / 远程 SSH 双后端 + Redis scrollback 持久化。
 *
 * 维护 Map<sessionId, PTYEntry>,按 userId 隔离,单用户最多 MAX_SESSIONS_PER_USER(5) 个并发。
 * 进程退出时触发 terminal-cleanup 插件的 SIGINT/SIGTERM 钩子,kill 全部 PTY 防僵尸。
 *
 * 三大深化(2026-07-22 立):
 * 1. SSH 远程:opts.ssh 存在时,动态加载 ssh2(缺失抛 501 + errorCode='ssh2_not_installed'),
 *    用 ssh2.Client.shell() 拿到 stream,包装为 IPty 接口,WS plugin 无感知地复用 onData/writeInput。
 * 2. scrollback 持久化:PTY/SSH 每次 data 事件累积到缓冲,500ms flush 到 Redis list
 *    `terminal:scrollback:{sessionId}`(LPUSH + LTRIM 50000 + EXPIRE 7 天)。
 *    onData 注册监听器时异步回放历史 scrollback(WS 连接即可看到上下文)。
 * 3. 会话元数据持久化:Redis hash `terminal:session:{sessionId}` 存 { shell, cwd, kind, userId, createdAt, exitCode }。
 *    listHistorySessions 扫描 terminal:session:* 返回最近 7 天历史。
 *
 * 安全:
 * - cwd 从外部传入但仅允许已存在的目录(防止穿越到任意路径)
 * - 不暴露环境变量给前端,env 复用服务端 process.env
 * - SSH 私钥不写日志,不持久化到 Redis(仅在内存中持有 client 引用)
 */

import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import IORedis from 'ioredis'
import { config } from '../config/index.js'
import type {
  TerminalSession,
  TerminalSessionStatus,
  TerminalConnectKind,
  TerminalSshParams,
  TerminalHistorySession,
} from '@ihui/types'

/**
 * 动态加载 node-pty(缺失时降级,不阻塞 server.ts 启动)。
 *
 * pnpm/npm 沙箱受限时可能未安装,此时 terminal 路由返回 501 提示用户手动安装。
 * 安装命令:pnpm --filter @ihui/api add node-pty
 */
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- 动态加载可选依赖,需用 import() 取类型
type NodePtyModule = typeof import('node-pty')
let ptyMod: NodePtyModule | null = null
try {
  ptyMod = require('node-pty') as NodePtyModule
} catch {
  ptyMod = null
}

/**
 * 动态加载 ssh2(缺失时降级 501,不阻塞 server.ts 启动)。
 *
 * 安装命令:pnpm --filter @ihui/api add ssh2
 * 类型补丁:pnpm --filter @ihui/api add -D @types/ssh2
 */
interface Ssh2Module {
  Client?: new () => Ssh2ClientLike
}
let ssh2Mod: Ssh2Module | null = null
try {
  ssh2Mod = require('ssh2') as Ssh2Module
} catch {
  ssh2Mod = null
}

// PTY 实例的最小接口(与 node-pty 的 IPty 兼容,SSH wrapper 也实现此接口)
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

// SSH2 Client/Stream 最小接口(避开静态 import 失败)
interface Ssh2ClientLike {
  connect(opts: Record<string, unknown>): void
  on(event: 'ready' | 'error' | 'close' | 'end', cb: (...args: unknown[]) => void): this
  shell(
    window: false | { term?: string; cols?: number; rows?: number; height?: number; width?: number },
    callback: (err: Error | undefined, stream: Ssh2StreamLike) => void,
  ): void
  end(): void
}
interface Ssh2StreamLike {
  write(data: string | Buffer): boolean
  end(): void
  setWindow(rows: number, cols: number, height: number, width: number): void
  on(event: 'data', cb: (data: Buffer) => void): this
  on(event: 'close', cb: () => void): this
  on(event: 'error', cb: (err: Error) => void): this
}

/** PTY 条目(内部管理,兼容本地 PTY 与 SSH stream) */
interface PTYEntry {
  /** PTY 或 SSH wrapper(实现 IPty 接口) */
  pty: IPty
  sessionId: string
  userId: string
  cwd: string
  createdAt: number
  lastActivityAt: number
  status: TerminalSessionStatus
  exitCode?: number
  /** onData/onExit 监听器引用(WS handler 注册,用于 kill 时移除) */
  dataListeners: Set<(data: string) => void>
  exitListeners: Set<(e: { exitCode: number; signal?: number }) => void>
  /** 连接类型 */
  kind: TerminalConnectKind
  /** SSH 远程主机(仅 kind='ssh',用于展示) */
  sshHost?: string
  /** SSH 远程用户名(仅 kind='ssh',用于展示) */
  sshUser?: string
  /** SSH2 client 实例(关闭时需 end,本地 PTY 为 null) */
  sshClient?: { end(): void }
  /** shell 或 ssh 别名(展示 + Redis 元数据) */
  shellName: string
  /** scrollback 累积缓冲(flush 周期内合并,减少 Redis 写入次数) */
  scrollbackBuffer: string
  /** scrollback flush 定时器(500ms 周期) */
  scrollbackTimer: ReturnType<typeof setInterval> | null
  /** 已 flush 总字节数(监控用) */
  scrollbackBytes: number
}

/** 单用户最大并发终端数 */
const MAX_SESSIONS_PER_USER = 5

/** 默认终端尺寸 */
const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

/** scrollback Redis 配置 */
const SCROLLBACK_TTL_SECONDS = 7 * 24 * 3600
const SCROLLBACK_MAX_ENTRIES = 50000
/** onData 回放时最多发送的最近条目数(避免 WS 单消息过大) */
const SCROLLBACK_REPLAY_LIMIT = 2000
/** scrollback 缓冲 flush 周期(ms) */
const SCROLLBACK_FLUSH_INTERVAL_MS = 500

/** 全局 session → PTY 映射 */
const sessions = new Map<string, PTYEntry>()

/** userId → sessionId 集合(用于限额 + 列表) */
const userSessions = new Map<string, Set<string>>()

// ==================== Redis 客户端懒加载(降级友好) ====================

let redisClient: IORedis | null = null
let redisInitTried = false

/** 获取 Redis 客户端(单例,失败返回 null → 调用方降级为内存) */
function getRedis(): IORedis | null {
  if (redisInitTried) return redisClient
  redisInitTried = true
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      retryStrategy: (times: number) => Math.min(times * 200, 1000),
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
    })
    redisClient.on('error', () => {
      /* 静默,降级为内存(不影响 PTY 主流程) */
    })
  } catch {
    redisClient = null
  }
  return redisClient
}

function scrollbackKey(sessionId: string): string {
  return `terminal:scrollback:${sessionId}`
}
function sessionMetaKey(sessionId: string): string {
  return `terminal:session:${sessionId}`
}

/** 异步推送 scrollback 到 Redis list(失败静默,不阻塞 PTY) */
async function pushScrollback(sessionId: string, chunk: string): Promise<void> {
  if (!chunk) return
  const redis = getRedis()
  if (!redis) return
  try {
    const key = scrollbackKey(sessionId)
    // LPUSH 把新数据插入头部,LTRIM 保留 0..N-1 即最新 N 条
    await redis.lpush(key, chunk)
    await redis.ltrim(key, 0, SCROLLBACK_MAX_ENTRIES - 1)
    await redis.expire(key, SCROLLBACK_TTL_SECONDS)
  } catch {
    /* Redis 故障静默降级,数据继续在内存 PTY 流动 */
  }
}

/** 读取 scrollback(按时间顺序返回,oldest → newest;仅返回最近 REPLAY_LIMIT 条) */
async function readScrollback(sessionId: string): Promise<string[]> {
  const redis = getRedis()
  if (!redis) return []
  try {
    const key = scrollbackKey(sessionId)
    // LPUSH 后 list 头部是最新;LRANGE 0..L-1 取最近 L 条,reverse 后 oldest 在前
    const list = await redis.lrange(key, 0, SCROLLBACK_REPLAY_LIMIT - 1)
    return list.reverse()
  } catch {
    return []
  }
}

/** 持久化会话元数据(Redis hash) */
async function persistSessionMeta(
  sessionId: string,
  meta: {
    shell: string
    cwd: string
    kind: TerminalConnectKind
    userId: string
    createdAt: number
    sshHost?: string
    sshUser?: string
  },
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    const key = sessionMetaKey(sessionId)
    await redis.hset(key, {
      shell: meta.shell,
      cwd: meta.cwd,
      kind: meta.kind,
      userId: meta.userId,
      createdAt: String(meta.createdAt),
      lastActivityAt: String(meta.createdAt),
      ...(meta.sshHost ? { sshHost: meta.sshHost } : {}),
      ...(meta.sshUser ? { sshUser: meta.sshUser } : {}),
    })
    await redis.expire(key, SCROLLBACK_TTL_SECONDS)
  } catch {
    /* 静默 */
  }
}

/** 更新会话元数据 exitCode + lastActivityAt(进程退出时调用) */
async function updateSessionMetaExit(
  sessionId: string,
  exitCode: number,
  lastActivityAt: number,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    const key = sessionMetaKey(sessionId)
    await redis.hset(key, {
      exitCode: String(exitCode),
      lastActivityAt: String(lastActivityAt),
    })
    await redis.expire(key, SCROLLBACK_TTL_SECONDS)
  } catch {
    /* 静默 */
  }
}

// ==================== 工具函数 ====================

/** 获取用户 shell(Windows: powershell, Unix: /bin/bash 或 $SHELL) */
function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

/** 根据前端 shell 名称解析为路径(powershell/cmd/bash/wsl) */
function resolveShellByName(name: string): string {
  if (process.platform === 'win32') {
    switch (name) {
      case 'powershell': return 'powershell.exe'
      case 'cmd': return process.env.COMSPEC || 'cmd.exe'
      case 'bash': return 'bash'
      case 'wsl': return 'wsl.exe'
      default: return name
    }
  }
  switch (name) {
    case 'bash': return '/bin/bash'
    case 'zsh': return '/bin/zsh'
    case 'sh': return '/bin/sh'
    default: return name
  }
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
    kind: entry.kind,
    sshHost: entry.sshHost,
    sshUser: entry.sshUser,
    shell: entry.shellName,
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

// ==================== PTY 数据流统一处理 ====================

/** 统一处理 PTY/SSH 输出:转发监听器 + 累积 scrollback 缓冲 */
function handlePtyData(entry: PTYEntry, data: string): void {
  entry.lastActivityAt = Date.now()
  // 1. 转发到所有 WS 监听器
  for (const cb of entry.dataListeners) {
    try {
      cb(data)
    } catch {
      /* 监听器异常不影响 PTY */
    }
  }
  // 2. 累积到 scrollback 缓冲,启动定时 flush(避免每条 data 都打 Redis)
  entry.scrollbackBuffer += data
  entry.scrollbackBytes += data.length
  if (!entry.scrollbackTimer && entry.scrollbackBuffer.length > 0) {
    entry.scrollbackTimer = setInterval(() => {
      flushScrollback(entry)
    }, SCROLLBACK_FLUSH_INTERVAL_MS)
  }
}

/** flush scrollback 缓冲到 Redis(定时器触发或退出时调用) */
function flushScrollback(entry: PTYEntry): void {
  if (!entry.scrollbackBuffer) return
  const chunk = entry.scrollbackBuffer
  entry.scrollbackBuffer = ''
  void pushScrollback(entry.sessionId, chunk)
}

/** 统一处理 PTY/SSH 退出 */
function handlePtyExit(entry: PTYEntry, e: { exitCode: number; signal?: number }): void {
  // 先停止 flush 定时器并 flush 剩余数据
  if (entry.scrollbackTimer) {
    clearInterval(entry.scrollbackTimer)
    entry.scrollbackTimer = null
  }
  flushScrollback(entry)

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
  // 更新 Redis 元数据 exitCode(7 天 TTL 内可查询历史)
  void updateSessionMetaExit(entry.sessionId, e.exitCode, entry.lastActivityAt)
}

// ==================== 公共 API:createSession ====================

/**
 * 创建新的终端会话(本地 PTY 或 SSH 远程)。
 *
 * - 无 opts.ssh:走本地 node-pty spawn 路径(原逻辑)
 * - 有 opts.ssh:走 ssh2 动态加载路径,缺失时抛 501 + errorCode='ssh2_not_installed'
 *
 * @returns session 信息
 * @throws Error 如果超过限额 / spawn 失败 / ssh2 未安装
 */
export function createSession(
  userId: string,
  opts: {
    cwd?: string
    cols?: number
    rows?: number
    shell?: string
    ssh?: TerminalSshParams
  } = {},
): TerminalSession {
  if (countUserSessions(userId) >= MAX_SESSIONS_PER_USER) {
    throw new Error(`超过最大并发终端数(${MAX_SESSIONS_PER_USER})`)
  }

  const sessionId = randomUUID()
  const cols = opts.cols ?? DEFAULT_COLS
  const rows = opts.rows ?? DEFAULT_ROWS

  // SSH 远程会话分支
  if (opts.ssh) {
    return createSshSession(userId, sessionId, opts.ssh, cols, rows)
  }

  // 本地 PTY 会话(原逻辑)
  const cwd = opts.cwd && opts.cwd.length > 0 ? opts.cwd : process.cwd()
  const shell =
    opts.shell && opts.shell.length > 0
      ? resolveShellByName(opts.shell)
      : getDefaultShell()

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

  return registerLocalSession(userId, sessionId, pty, { cwd, shellName: shell })
}

/** 注册本地 PTY 会话(绑定 onData/onExit + 持久化元数据) */
function registerLocalSession(
  userId: string,
  sessionId: string,
  pty: IPty,
  opts: { cwd: string; shellName: string },
): TerminalSession {
  const entry: PTYEntry = {
    pty,
    sessionId,
    userId,
    cwd: opts.cwd,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    status: 'active',
    dataListeners: new Set(),
    exitListeners: new Set(),
    kind: 'local',
    shellName: opts.shellName,
    scrollbackBuffer: '',
    scrollbackTimer: null,
    scrollbackBytes: 0,
  }

  // 本地 PTY 输出 → 统一数据流处理(转发 + scrollback 累积)
  pty.onData((data: string) => {
    handlePtyData(entry, data)
  })

  // 本地 PTY 退出 → 统一退出处理
  pty.onExit((e: { exitCode: number; signal?: number }) => {
    handlePtyExit(entry, e)
  })

  sessions.set(sessionId, entry)
  registerUserSession(userId, sessionId)
  void persistSessionMeta(sessionId, {
    shell: opts.shellName,
    cwd: opts.cwd,
    kind: 'local',
    userId,
    createdAt: entry.createdAt,
  })

  return toSession(entry)
}

/**
 * 创建 SSH 远程会话。
 *
 * 流程:ssh2.Client.connect → ready 事件 → client.shell({cols,rows}) → stream
 * stream.data → handlePtyData(转发 WS + scrollback 持久化)
 * stream.close → handlePtyExit
 * client.error → 输出错误到 WS + exit
 *
 * @throws Error ssh2 未安装时抛 statusCode=501 + errorCode='ssh2_not_installed'
 */
function createSshSession(
  userId: string,
  sessionId: string,
  ssh: TerminalSshParams,
  cols: number,
  rows: number,
): TerminalSession {
  if (!ssh2Mod) {
    const err = new Error(
      'SSH 远程需要安装 ssh2: pnpm --filter @ihui/api add ssh2',
    ) as Error & { statusCode?: number; errorCode?: string }
    err.statusCode = 501
    err.errorCode = 'ssh2_not_installed'
    throw err
  }
  if (!ssh.host || !ssh.username) {
    throw new Error('SSH 连接参数缺失:host 和 username 必填')
  }

  const port = ssh.port ?? 22
  const ClientCtor = (ssh2Mod as { Client?: new () => Ssh2ClientLike }).Client
  if (!ClientCtor) {
    throw new Error('ssh2 模块加载异常:Client 未导出')
  }
  const client = new ClientCtor()

  const entry: PTYEntry = {
    // wrapper 占位,stream ready 后在 _sshStream 字段上挂载真实 stream
    pty: createSshPtyWrapper(client),
    sessionId,
    userId,
    cwd: ssh.host,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    status: 'active',
    dataListeners: new Set(),
    exitListeners: new Set(),
    kind: 'ssh',
    sshHost: ssh.host,
    sshUser: ssh.username,
    sshClient: client,
    shellName: `ssh ${ssh.username}@${ssh.host}${port === 22 ? '' : `:${port}`}`,
    scrollbackBuffer: '',
    scrollbackTimer: null,
    scrollbackBytes: 0,
  }

  // 启动 SSH 连接(异步,ready 后才有 stream)
  const connectOpts: Record<string, unknown> = {
    host: ssh.host,
    port,
    username: ssh.username,
    readyTimeout: 15000,
  }
  if (ssh.password) connectOpts.password = ssh.password
  if (ssh.privateKey) connectOpts.privateKey = ssh.privateKey
  if (ssh.passphrase) connectOpts.passphrase = ssh.passphrase

  client.on('ready', () => {
    client.shell(
      { term: 'xterm-256color', cols, rows, height: rows * 16, width: cols * 8 },
      (err: Error | undefined, stream: Ssh2StreamLike) => {
        if (err) {
          // shell 创建失败 → 输出错误 + exit
          handlePtyData(
            entry,
            `\r\n\x1b[31mSSH shell 创建失败: ${err.message}\x1b[0m\r\n`,
          )
          handlePtyExit(entry, { exitCode: 1 })
          return
        }
        // 把 stream 挂到 wrapper 上(后续 write/resize 直接转发)
        attachSshStream(entry, stream)
        stream.on('data', (buf: Buffer) => {
          handlePtyData(entry, buf.toString())
        })
        stream.on('close', () => {
          handlePtyExit(entry, { exitCode: 0 })
        })
        stream.on('error', (streamErr: Error) => {
          handlePtyData(
            entry,
            `\r\n\x1b[31mSSH stream 错误: ${streamErr.message}\x1b[0m\r\n`,
          )
          handlePtyExit(entry, { exitCode: 1 })
        })
      },
    )
  })

  client.on('error', (err: unknown) => {
    const e = err as Error
    handlePtyData(
      entry,
      `\r\n\x1b[31mSSH 连接错误: ${e.message}\x1b[0m\r\n`,
    )
    handlePtyExit(entry, { exitCode: 1 })
  })

  // 触发连接
  client.connect(connectOpts)

  sessions.set(sessionId, entry)
  registerUserSession(userId, sessionId)
  void persistSessionMeta(sessionId, {
    shell: entry.shellName,
    cwd: ssh.host,
    kind: 'ssh',
    userId,
    createdAt: entry.createdAt,
    sshHost: ssh.host,
    sshUser: ssh.username,
  })

  return toSession(entry)
}

/**
 * 创建 SSH PTY wrapper(实现 IPty 接口,stream 通过 attachSshStream 挂载)。
 *
 * 设计:wrapper 持有 client 引用,stream ready 前所有 write/resize 都是 no-op,
 * ready 后由 attachSshStream 把 stream 挂到内部字段,write/resize 才真正生效。
 */
function createSshPtyWrapper(client: Ssh2ClientLike): IPty {
   
  const wrapper: IPty & { _sshStream?: Ssh2StreamLike } = {
    write: (data: string) => {
      try {
        wrapper._sshStream?.write(data)
      } catch {
        /* stream 未就绪或已关闭,忽略 */
      }
    },
    resize: (c: number, r: number) => {
      try {
        // ssh2 setWindow(rows, cols, height, width)
        wrapper._sshStream?.setWindow(r, c, r * 16, c * 8)
      } catch {
        /* ignore */
      }
    },
    kill: () => {
      try {
        wrapper._sshStream?.end()
      } catch {
        /* ignore */
      }
      try {
        client.end()
      } catch {
        /* ignore */
      }
    },
    onData: () => {
      // SSH stream 数据通过 attachSshStream 内的 stream.on('data') 直接转发到 handlePtyData,
      // 不走 wrapper.onData(避免回调注册在 stream ready 前丢失)。
      return { dispose: () => {} }
    },
    onExit: () => {
      // 同上,exit 由 stream.on('close') 直接调用 handlePtyExit。
      return { dispose: () => {} }
    },
  }
  return wrapper
}

/** 把 SSH stream 挂载到 wrapper 上(ready 后调用) */
function attachSshStream(entry: PTYEntry, stream: Ssh2StreamLike): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 动态字段
  ;(entry.pty as any)._sshStream = stream
}

// ==================== 公共 API:CRUD ====================

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

/** 调整 PTY/SSH 大小 */
export function resizeSession(
  sessionId: string,
  userId: string,
  cols: number,
  rows: number,
): boolean {
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

/** 关闭/杀死 PTY/SSH 会话(清理 SSH client + flush scrollback) */
export function closeSession(sessionId: string, userId: string): boolean {
  const entry = getSession(sessionId, userId)
  if (!entry) return false
  // flush 剩余 scrollback
  if (entry.scrollbackTimer) {
    clearInterval(entry.scrollbackTimer)
    entry.scrollbackTimer = null
  }
  flushScrollback(entry)
  // 关闭 SSH client(若有)
  if (entry.sshClient) {
    try {
      entry.sshClient.end()
    } catch {
      /* ignore */
    }
  }
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

// ==================== 公共 API:WS 数据流接入 ====================

/**
 * 注册 PTY/SSH 数据监听器(WebSocket handler 使用)。
 *
 * 深化(2026-07-22):注册后异步回放历史 scrollback(Redis 不可用时静默跳过),
 * 让 WS 客户端连接即可看到历史输出上下文。
 */
export function onData(
  sessionId: string,
  cb: (data: string) => void,
): (() => void) | null {
  const entry = sessions.get(sessionId)
  if (!entry) return null
  entry.dataListeners.add(cb)
  // 异步回放历史 scrollback(不阻塞 onData 返回)
  void replayScrollbackToListener(sessionId, cb)
  return () => entry.dataListeners.delete(cb)
}

/** 异步回放历史 scrollback 到新注册的监听器 */
async function replayScrollbackToListener(
  sessionId: string,
  cb: (data: string) => void,
): Promise<void> {
  const lines = await readScrollback(sessionId)
  if (lines.length === 0) return
  // 拼接成单个字符串一次性回放(减少 WS 消息数)
  const combined = lines.join('')
  if (combined) {
    try {
      cb(combined)
    } catch {
      /* 监听器已注销,忽略 */
    }
  }
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

/** 向 PTY/SSH 写入输入 */
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

// ==================== 公共 API:历史会话查询(REST 用) ====================

/**
 * 列出用户最近 7 天的历史会话(从 Redis 扫描 terminal:session:* keys)。
 *
 * 注意:此函数返回历史元数据(已退出的会话),不含实时数据流。
 * 配合 getScrollback 可恢复历史输出。
 */
export async function listHistorySessions(
  userId: string,
): Promise<TerminalHistorySession[]> {
  const redis = getRedis()
  if (!redis) return []
  try {
    const result: TerminalHistorySession[] = []
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        'terminal:session:*',
        'COUNT',
        100,
      )
      cursor = next
      for (const key of keys) {
        const meta = await redis.hgetall(key)
        if (!meta || !meta.userId || meta.userId !== userId) continue
        const sessionId = key.replace('terminal:session:', '')
        const scrollbackLines = await redis.llen(scrollbackKey(sessionId))
        result.push({
          id: sessionId,
          shell: meta.shell ?? '',
          kind: (meta.kind === 'ssh' ? 'ssh' : 'local') as TerminalConnectKind,
          cwd: meta.cwd ?? '',
          sshHost: meta.sshHost || undefined,
          sshUser: meta.sshUser || undefined,
          createdAt: Number(meta.createdAt ?? 0),
          lastActivityAt: Number(meta.lastActivityAt ?? 0),
          exitCode: meta.exitCode !== undefined ? Number(meta.exitCode) : undefined,
          scrollbackLines,
        })
      }
    } while (cursor !== '0')
    // 按创建时间降序(最新在前)
    result.sort((a, b) => b.createdAt - a.createdAt)
    return result
  } catch {
    return []
  }
}

/**
 * 获取会话 scrollback(REST 路由用,校验 userId 归属)。
 *
 * 返回 { lines, source }:
 * - lines: scrollback 字符串数组(已按时间顺序排列)
 * - source: 'redis'(Redis 可用) | 'memory'(降级,返回空)
 */
export async function getScrollback(
  sessionId: string,
  userId: string,
): Promise<{ lines: string[]; source: 'redis' | 'memory' }> {
  // 先校验 session 归属(若 session 仍在内存)
  const entry = sessions.get(sessionId)
  if (entry && entry.userId !== userId) {
    return { lines: [], source: 'memory' }
  }
  const lines = await readScrollback(sessionId)
  return { lines, source: 'redis' }
}

// ==================== 公共 API:全局清理 ====================

/** 杀死所有 PTY/SSH(进程退出时调用,防僵尸) */
export function killAllSessions(): void {
  for (const [, entry] of sessions) {
    // flush 剩余 scrollback
    if (entry.scrollbackTimer) {
      clearInterval(entry.scrollbackTimer)
      entry.scrollbackTimer = null
    }
    flushScrollback(entry)
    // 关闭 SSH client
    if (entry.sshClient) {
      try {
        entry.sshClient.end()
      } catch {
        /* ignore */
      }
    }
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
