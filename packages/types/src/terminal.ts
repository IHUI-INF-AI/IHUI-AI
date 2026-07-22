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

// ==================== AI 辅助终端(2026-07-23 立) ====================

/** AI 命令建议请求体 */
export interface TerminalSuggestInput {
  /** 当前工作目录 */
  cwd: string
  /** 上一条命令(可选) */
  lastCommand?: string
  /** 上一条命令的标准输出片段(可选,用于上下文) */
  stdout?: string
  /** 上一条命令退出码 */
  exitCode?: number
}

/** 单条命令建议 */
export interface TerminalSuggestion {
  /** 建议命令文本 */
  command: string
  /** 命令用途说明 */
  description: string
  /** 置信度 0-1 */
  confidence: number
}

/** AI 命令建议响应 */
export interface TerminalSuggestResponse {
  suggestions: TerminalSuggestion[]
}

/** AI 错误诊断请求体 */
export interface TerminalDiagnoseInput {
  /** 失败的命令 */
  command: string
  /** 标准错误输出 */
  stderr: string
  /** 退出码 */
  exitCode: number
  /** 当前工作目录 */
  cwd: string
}

/** AI 错误诊断响应 */
export interface TerminalDiagnoseResponse {
  /** 总体诊断描述 */
  diagnosis: string
  /** 根因分析 */
  rootCause: string
  /** 建议修复方案描述 */
  suggestedFix: string
  /** 可一键执行的修复命令(可选) */
  fixCommand?: string
}

/** AI 自动修复请求体 */
export interface TerminalAutoFixInput {
  /** 来自 diagnose 的修复命令 */
  fixCommand: string
}

/** AI 自动修复响应 */
export interface TerminalAutoFixResponse {
  /** 是否已写入 PTY 执行 */
  applied: boolean
  /** 提示信息 */
  message: string
}

/** AI 服务不可用错误(LLM 调用失败时返回 503) */
export interface TerminalAiUnavailableError {
  errorCode: 'ai_unavailable'
  message: string
}

// ==================== 操作录制与回放(2026-07-23 立) ====================

/** 录制事件类型 */
export type TerminalEventType = 'input' | 'output' | 'resize' | 'exit'

/** 单条录制事件(按时序排列) */
export interface TerminalEvent {
  /** 事件类型 */
  type: TerminalEventType
  /** 事件数据(input/output 为字符流,resize 为 "colsxrows",exit 为退出码字符串) */
  data: string
  /** 相对录制开始时间的毫秒偏移 */
  timestamp: number
}

/** 终端录制(超越 asciinema 的"只录不改":支持裁剪/合并/删除/编辑) */
export interface TerminalRecording {
  /** 录制唯一 ID(UUID) */
  id: string
  /** 来源会话 ID */
  sessionId: string
  /** 所属用户 ID */
  userId: string
  /** 按时序排列的事件列表 */
  events: TerminalEvent[]
  /** 录制开始时间戳(ms) */
  startedAt: number
  /** 录制时长(ms) */
  durationMs: number
  /** 录制标题(可选,默认用 "Recording <startedAt>") */
  title?: string
}

/** 开始录制请求体 */
export interface TerminalRecordingStartInput {
  /** 录制标题(可选) */
  title?: string
}

/** 开始录制响应 */
export interface TerminalRecordingStartResponse {
  /** 录制 ID(用于后续 stop/edit/play) */
  recordingId: string
  /** 来源会话 ID */
  sessionId: string
}

/** 停止录制响应 */
export interface TerminalRecordingStopResponse {
  recording: TerminalRecording
}

/** 录制列表项(精简,不含 events 数组以减少传输) */
export interface TerminalRecordingListItem {
  id: string
  sessionId: string
  title?: string
  startedAt: number
  durationMs: number
  /** 事件总数 */
  eventCount: number
}

/** 录制列表响应 */
export interface TerminalRecordingListResponse {
  recordings: TerminalRecordingListItem[]
}

/** 录制详情响应(含完整 events) */
export interface TerminalRecordingDetailResponse {
  recording: TerminalRecording
}

/** 回放录制响应(在新 session 中按 timestamp 顺序回放) */
export interface TerminalRecordingPlayResponse {
  /** 回放所用的新会话 ID */
  sessionId: string
  /** 回放事件数 */
  replayedEvents: number
}

/** 编辑录制请求体(裁剪/合并/删除事件) */
export interface TerminalRecordingEditInput {
  /** 编辑后的事件列表(整体替换) */
  events: TerminalEvent[]
  /** 新标题(可选) */
  title?: string
}

/** 编辑录制响应 */
export interface TerminalRecordingEditResponse {
  recording: TerminalRecording
}

// ==================== 智能命令历史(2026-07-23 立) ====================

/** 智能命令历史条目(超越按时间排序:含 cwd/gitBranch/exitCode/frequency) */
export interface TerminalHistoryEntry {
  /** 命令文本 */
  command: string
  /** 执行时的工作目录 */
  cwd: string
  /** 执行时的 git 分支(可选) */
  gitBranch?: string
  /** 执行时间戳(ms) */
  timestamp: number
  /** 退出码(成功=0) */
  exitCode: number
  /** 累计执行频次 */
  frequency: number
  /** 相关性得分(仅智能排序响应中有,普通记录时为 0) */
  score?: number
}

/** 智能命令历史响应(按相关性打分排序) */
export interface TerminalSmartHistoryResponse {
  /** 当前会话工作目录(用于打分参考) */
  cwd: string
  /** 当前 git 分支(可选,用于打分参考) */
  gitBranch?: string
  /** 按相关性降序排列的历史条目 */
  entries: TerminalHistoryEntry[]
}

/** 命令执行记录请求体(命令执行后由前端回传,用于累积频次) */
export interface TerminalHistoryRecordInput {
  /** 命令文本 */
  command: string
  /** 退出码(成功=0) */
  exitCode: number
  /** git 分支(可选,前端探测后传入) */
  gitBranch?: string
}
