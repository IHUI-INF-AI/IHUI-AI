/**
 * IDE 工作区跨端类型契约(2026-07-22 立,2026-07-22 修订前后端连通)
 *
 * 仿 TRAE/Codex IDE 界面的类型定义,供 web 端 IDE 组件使用。
 * 前后端连通:web 端消费类型,api 端通过 /api/workspace/fs/* 端点提供数据。
 * - FileNode / EditorTab / SearchResult / GitChange → 由 FS Bridge 端点提供数据
 * - Breakpoint / StackFrame / DebugVariable / LaunchConfig → 前端内存/localStorage
 * - OutlineNode → 可由 /api/workspace/codebase/search 提供数据
 * - DiffFile → 由 git diff 数据转换
 */

/** 左侧 activity bar 视图类型 */
export type ViewPanelType =
  | 'files'
  | 'search'
  | 'source-control'
  | 'debug'
  | 'applications'

/** 顶部 tab 栏类型(编辑器 + 8 项下拉) */
export type IDETabType =
  | 'editor'
  | 'document'
  | 'terminal'
  | 'browser'
  | 'code-changes'
  | 'figma'
  | 'agent'
  | 'mcp'
  | 'settings'

/** 文件树节点 */
export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  language?: string
  content?: string
  size?: number
  lastModified?: number
}

/** 打开的编辑器 tab */
export interface EditorTab {
  id: string
  fileId: string
  filename: string
  path: string
  language: string
  content: string
  isDirty: boolean
  isPinned?: boolean
}

/** diff 文件状态 */
export type DiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

/** diff 文件 */
export interface DiffFile {
  id: string
  filename: string
  status: DiffFileStatus
  oldContent: string
  newContent: string
  additions: number
  deletions: number
  language?: string
}

/** diff 视图模式 */
export type DiffViewMode = 'split' | 'unified'

/** 大纲节点 */
export interface OutlineNode {
  id: string
  label: string
  type: 'class' | 'function' | 'variable' | 'interface' | 'type' | 'method'
  line: number
  children?: OutlineNode[]
}

/** 时间线条目 */
export interface TimelineEntry {
  id: string
  label: string
  timestamp: number
  type: 'edit' | 'save' | 'commit'
  author?: string
}

/** 搜索结果 */
export interface SearchResult {
  fileId: string
  filename: string
  line: number
  column: number
  preview: string
  matchCount: number
}

/** 源代码控制变更项 */
export interface GitChange {
  id: string
  filename: string
  status: DiffFileStatus
  additions: number
  deletions: number
}

/** 调试断点 */
export interface Breakpoint {
  id: string
  fileId: string
  line: number
  enabled: boolean
  condition?: string
}

/** 调用栈帧 */
export interface StackFrame {
  id: string
  function: string
  file: string
  line: number
  column: number
}

/** 变量 */
export interface DebugVariable {
  id: string
  name: string
  value: string
  type: string
  scope: 'local' | 'global' | 'closure'
}

/** 应用启动配置 */
export interface LaunchConfig {
  id: string
  name: string
  type: 'node' | 'python' | 'web' | 'terminal'
  command: string
  cwd?: string
  env?: Record<string, string>
  /** 调试模式:launch(启动新进程)或 attach(附加到已运行进程)。默认 'launch'。 */
  mode?: 'launch' | 'attach'
  /** attach 模式下必填:目标进程的调试端口。 */
  port?: number
  /** attach 模式下目标主机,默认 'localhost'。 */
  host?: string
}

/** DAP(Debug Adapter Protocol)session 生命周期状态。 */
export type DebugSessionStatus = 'initializing' | 'running' | 'stopped' | 'terminated'

/** DAP session 摘要信息(列表展示用)。 */
export interface DebugSessionInfo {
  sessionId: string
  language: 'node' | 'python' | 'web'
  status: DebugSessionStatus
  startedAt: number
  lastActivityAt: number
}

/** DAP stopped 事件 — 程序执行暂停(breakpoint/step/exception/pause)。 */
export interface DebugStoppedEvent {
  reason: 'breakpoint' | 'step' | 'exception' | 'pause' | 'entry' | 'branch'
  /** 触发停止的线程 ID。 */
  threadId?: number
  /** 异常停止时的附加文本。 */
  text?: string
  /** 是否所有线程都应停止(allThreadsStopped)。 */
  allThreadsStopped?: boolean
}

/** DAP breakpoint 事件 — 运行时断点状态变更(验证/未命中/已解析)。 */
export interface DebugBreakpointEvent {
  reason: 'changed' | 'new' | 'removed'
  /** 变更后的断点信息(DAP Breakpoint 对象)。 */
  breakpoint: {
    id?: number
    verified: boolean
    message?: string
    source?: { name?: string; path?: string }
    line?: number
    column?: number
  }
}

/** DAP output 事件 — 程序输出(stdout/stderr/console/telemetry)。 */
export interface DebugOutputEvent {
  category: 'console' | 'stdout' | 'stderr' | 'telemetry'
  output: string
  /** 关联的数据组 ID(用于分组显示)。 */
  group?: 'start' | 'startCollapsed' | 'end'
  /** 关联的变量引用(可进一步 get_variables)。 */
  variablesReference?: number
  /** 输出来源(如 'stdout'。 */
  source?: string
}
