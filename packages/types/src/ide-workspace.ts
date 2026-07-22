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
}
