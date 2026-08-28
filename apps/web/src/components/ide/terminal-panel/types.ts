import type { Terminal } from '@xterm/xterm'

/** xterm 实例(挂载内部清理钩子) */
export type TerminalInstance = Terminal & { _terminalCleanup?: () => void }

/**
 * xterm 6.0.0 已将 findNext/findPrev 移到 @xterm/addon-search(项目未安装)。
 * 任务要求"无需 addon-search",这里用可选方法类型断言,运行时优先调用内置 API,
 * 不存在时降级为 buffer 遍历搜索 + scrollToLine 跳转 + select 高亮。
 */
export type TerminalLike = {
  findNext?: (
    term: string,
    options?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean },
  ) => boolean
  findPrev?: (term: string) => boolean
  // registerDecoration 是 xterm v4.5+ proposed API(allowProposedApi: true 启用)
  registerDecoration?: (opts: {
    startLine: number
    endLine?: number
    startColumn?: number
    endColumn?: number
    backgroundColor?: string
  }) => { dispose(): void } | null
}

/** 搜索选项(2026-07-22 深化:正则 + 全字 + 大小写) */
export interface SearchOptions {
  regex: boolean
  wholeWord: boolean
  caseSensitive: boolean
}

/** 右键菜单项 */
export interface ContextMenuState {
  x: number
  y: number
  hasSelection: boolean
}

/** 匹配位置(buffer 坐标) */
export interface MatchPosition {
  line: number
  col: number
  len: number
}
