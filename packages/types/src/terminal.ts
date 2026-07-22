/**
 * 终端会话跨端类型契约(2026-07-22 立,xterm.js + node-pty + WebSocket 全链路)。
 *
 * Web 端消费:terminal store + use-terminal-session hook + terminal-panel 组件。
 * API 端消费:terminal-service + routes/terminal + plugins/terminal-ws。
 */

/** 终端会话状态 */
export type TerminalSessionStatus = 'active' | 'exited' | 'closed'

/** 终端连接类型(本地 PTY 或 SSH 远程) */
export type TerminalConnectKind = 'local' | 'ssh'

/** SSH 远程连接参数(创建 SSH 会话时必填) */
export interface TerminalSshParams {
  /** 远程主机地址(IP 或域名) */
  host: string
  /** SSH 端口(默认 22) */
  port?: number
  /** 登录用户名 */
  username: string
  /** 密码认证(与 privateKey 二选一) */
  password?: string
  /** 私钥认证(PEM 格式字符串) */
  privateKey?: string
  /** 私钥口令(加密私钥时需要) */
  passphrase?: string
}

/** 终端会话信息(REST API 返回 + store 存储) */
export interface TerminalSession {
  /** 会话唯一 ID(UUID) */
  id: string
  /** 当前工作目录 */
  cwd: string
  /** 会话所属用户 ID */
  userId: string
  /** 创建时间戳(ms) */
  createdAt: number
  /** 最后活动时间戳(ms) */
  lastActivityAt: number
  /** 会话状态 */
  status: TerminalSessionStatus
  /** 退出码(status='exited' 时有值) */
  exitCode?: number
  /** 会话自定义名称(rename 后有值,无值时前端用 "Terminal N" 兜底) */
  name?: string
  /** 创建会话时指定的 shell 类型(powershell/cmd/bash/wsl) */
  shell?: string
  /** 连接类型:本地 PTY 或 SSH 远程(默认 'local') */
  kind?: TerminalConnectKind
  /** SSH 远程主机(仅 kind='ssh',用于展示 "user@host") */
  sshHost?: string
  /** SSH 远程用户名(仅 kind='ssh',用于展示 "user@host") */
  sshUser?: string
}

/** 创建终端会话请求体 */
export interface TerminalCreateInput {
  /** 工作目录(可选,默认服务端 process.cwd()) */
  cwd?: string
  /** 初始列数(默认 80) */
  cols?: number
  /** 初始行数(默认 24) */
  rows?: number
  /** Shell 类型(powershell / cmd / bash / wsl,默认服务端配置) */
  shell?: string
  /** SSH 远程参数(存在时创建 SSH 会话,否则创建本地 PTY) */
  ssh?: TerminalSshParams
}

/** 历史会话信息(从 Redis 元数据恢复,字段比 TerminalSession 精简) */
export interface TerminalHistorySession {
  /** 会话唯一 ID */
  id: string
  /** 连接类型 */
  kind: TerminalConnectKind
  /** shell 或 ssh 别名 */
  shell?: string
  /** 工作目录 */
  cwd?: string
  /** SSH 远程主机(仅 kind='ssh') */
  sshHost?: string
  /** SSH 远程用户名(仅 kind='ssh') */
  sshUser?: string
  /** 创建时间戳(ms) */
  createdAt: number
  /** 最后活动时间戳(ms) */
  lastActivityAt: number
  /** 退出码(已退出时有值) */
  exitCode?: number
  /** scrollback 缓冲区行数(用于前端判断是否有历史输出可恢复) */
  scrollbackLines?: number
}

/** 历史会话列表响应 */
export interface TerminalHistoryListResponse {
  sessions: TerminalHistorySession[]
}

/** scrollback 回滚历史响应 */
export interface TerminalScrollbackResponse {
  /** 回滚行数组(按时间顺序,旧 → 新) */
  lines: string[]
}

/** SSH 不可用错误(ssh2 未安装时返回 501) */
export interface TerminalSshUnavailableError {
  /** 错误码 */
  errorCode: 'ssh2_not_installed'
  /** 提示信息 */
  message: string
  /** 安装命令 */
  installHint?: string
}

/** 重命名终端会话请求体 */
export interface TerminalRenameInput {
  /** 新名称(允许空字符串以清除自定义名) */
  name: string
}

/** 重命名终端会话响应 */
export interface TerminalRenameResponse {
  session: TerminalSession
}

/** 创建终端会话响应 */
export interface TerminalCreateResponse {
  session: TerminalSession
}

/** 调整终端大小请求体 */
export interface TerminalResizeInput {
  cols: number
  rows: number
}

/** 列出终端会话响应 */
export interface TerminalListResponse {
  sessions: TerminalSession[]
}

// ==================== WebSocket 消息协议 ====================

/** 客户端 → 服务端消息 */
export type TerminalWSClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; data: { cols: number; rows: number } }
  | { type: 'close' }

/** 服务端 → 客户端消息 */
export type TerminalWSServerMessage =
  | { type: 'output'; data: string }
  | { type: 'exit'; data: string; code: number }
  | { type: 'error'; data: string }
  | { type: 'scrollback-end' }
