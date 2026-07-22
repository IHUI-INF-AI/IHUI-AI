/**
 * 终端会话跨端类型契约(2026-07-22 立,xterm.js + node-pty + WebSocket 全链路)。
 *
 * Web 端消费:terminal store + use-terminal-session hook + terminal-panel 组件。
 * API 端消费:terminal-service + routes/terminal + plugins/terminal-ws。
 */

/** 终端会话状态 */
export type TerminalSessionStatus = 'active' | 'exited' | 'closed'

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
}

/** 创建终端会话请求体 */
export interface TerminalCreateInput {
  /** 工作目录(可选,默认服务端 process.cwd()) */
  cwd?: string
  /** 初始列数(默认 80) */
  cols?: number
  /** 初始行数(默认 24) */
  rows?: number
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
