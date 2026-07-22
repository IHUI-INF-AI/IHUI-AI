'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import '@xterm/xterm/css/xterm.css'
import { TerminalTabBar } from './terminal-tab-bar'
import { useTerminalSession } from '@/hooks/use-terminal-session'
import type { TerminalSplitDirection } from '@/stores/terminal'
import { cn } from '@/lib/utils'
import type { TerminalWSServerMessage } from '@ihui/types'
import {
  Search as SearchIcon,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  ClipboardPaste,
  Eraser,
  Columns2,
  Rows2,
} from 'lucide-react'

// xterm 主题定义(满足 AGENTS.md §4:dark #1e1e1e/#d4d4d4, light #ffffff/#1e1e1e)
const DARK_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
}

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1e1e1e',
  cursor: '#1e1e1e',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
}

const FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

/** 字号范围(任务约束:默认 12,范围 8-32) */
const FONT_SIZE_DEFAULT = 12
const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 32

/** 搜索匹配高亮上限(避免大量匹配导致 registerDecoration 性能问题) */
const MATCH_HIGHLIGHT_LIMIT = 200

/**
 * xterm 6.0.0 已将 findNext/findPrev 移到 @xterm/addon-search(项目未安装)。
 * 任务要求"无需 addon-search",这里用可选方法类型断言,运行时优先调用内置 API,
 * 不存在时降级为 buffer 遍历搜索 + scrollToLine 跳转 + select 高亮。
 */
type TerminalLike = {
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
interface SearchOptions {
  regex: boolean
  wholeWord: boolean
  caseSensitive: boolean
}

/** 右键菜单项 */
interface ContextMenuState {
  x: number
  y: number
  hasSelection: boolean
}

/** 匹配位置(buffer 坐标) */
interface MatchPosition {
  line: number
  col: number
  len: number
}

/**
 * 单个 xterm viewport(分屏后每个 pane 一个实例,共享同一 WS 数据流)。
 *
 * 深化(2026-07-22):
 * - paneId:用于 React key + 焦点路由
 * - onSplitRequest:Ctrl+Shift+D/H 触发分屏
 * - onClosePane:关闭当前 pane(非最后一个时)
 * - onFocusPane:Alt+Arrow 焦点切换
 * - 正则搜索:regex/wholeWord/caseSensitive 三开关 + registerDecoration 高亮
 */
function TerminalViewport({
  sessionId,
  paneId,
  fontSize,
  onFontSizeChange,
  onSplitRequest,
  onClosePane,
  canClosePane,
  isActive,
  onFocusPane,
}: {
  sessionId: string
  paneId: string
  fontSize: number
  onFontSizeChange: React.Dispatch<React.SetStateAction<number>>
  onSplitRequest: (direction: TerminalSplitDirection) => void
  onClosePane: () => void
  canClosePane: boolean
  isActive: boolean
  onFocusPane: () => void
}) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { connectWS, resizeSession } = useTerminalSession()
  const [connected, setConnected] = React.useState(false)
  const [wsError, setWsError] = React.useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- xterm 6.x 实例类型在动态 import 后才能确定,用 any 简化跨 API 调用
  const termRef = React.useRef<any>(null)
  const fitAddonRef = React.useRef<unknown>(null)
  const wsHandleRef = React.useRef<ReturnType<typeof connectWS> | null>(null)
  const roRef = React.useRef<ResizeObserver | null>(null)
  const resizeDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // 搜索状态(深化:正则 + 全字 + 大小写)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [matchIndex, setMatchIndex] = React.useState(0)
  const [matchTotal, setMatchTotal] = React.useState(0)
  const [searchOpts, setSearchOpts] = React.useState<SearchOptions>({
    regex: false,
    wholeWord: false,
    caseSensitive: false,
  })
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const lastSearchTermRef = React.useRef('')
  const lastSearchOptsRef = React.useRef<string>('')
  // 装饰高亮引用(每次搜索变化时全部 dispose 后重建)
  const decorationsRef = React.useRef<Array<{ dispose(): void }>>([])

  // 右键菜单状态
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)

  // 当前搜索词引用(供 keyEventHandler 闭包读取最新值)
  const searchTermRef = React.useRef('')
  React.useEffect(() => {
    searchTermRef.current = searchTerm
  }, [searchTerm])

  /** 清除所有匹配高亮装饰 */
  const clearDecorations = React.useCallback(() => {
    for (const d of decorationsRef.current) {
      try {
        d.dispose()
      } catch {
        /* 装饰已失效 */
      }
    }
    decorationsRef.current = []
  }, [])

  /** 编译搜索正则(根据 searchOpts 生成 RegExp,失败返回 null) */
  const compileSearchRegex = React.useCallback(
    (term: string, opts: SearchOptions): RegExp | null => {
      if (!term) return null
      try {
        let pattern: string
        if (opts.regex) {
          pattern = term
        } else if (opts.wholeWord) {
          // 转义正则元字符 + \b 边界
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          pattern = `\\b${escaped}\\b`
        } else {
          pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        }
        const flags = opts.caseSensitive ? 'g' : 'gi'
        return new RegExp(pattern, flags)
      } catch {
        // 正则编译失败(语法错误)→ 返回 null,前端显示 0 匹配
        return null
      }
    },
    [],
  )

  /** 遍历 buffer 找所有匹配(用于计数 + 高亮) */
  const findAllMatches = React.useCallback(
    (term: string, opts: SearchOptions): MatchPosition[] => {
      if (!term) return []
      const t = termRef.current
      if (!t) return []
      try {
        const regex = compileSearchRegex(term, opts)
        if (!regex) return []
        const buffer = t.buffer.active
        const matches: MatchPosition[] = []
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i)
          if (!line) continue
          const text = line.translateToString(true)
          // 重置 lastIndex(全局正则需重置)
          regex.lastIndex = 0
          let m: RegExpExecArray | null
          let safety = 0
          while ((m = regex.exec(text)) !== null && safety < 1000) {
            if (m[0].length > 0) {
              matches.push({ line: i, col: m.index, len: m[0].length })
            }
            // 避免零长度匹配死循环
            if (m.index === regex.lastIndex) {
              regex.lastIndex++
            }
            safety++
          }
        }
        return matches
      } catch {
        return []
      }
    },
    [compileSearchRegex],
  )

  /** 应用匹配高亮(用 registerDecoration,最多 MATCH_HIGHLIGHT_LIMIT 条) */
  const applyMatchHighlights = React.useCallback(
    (matches: MatchPosition[]) => {
      clearDecorations()
      const t = termRef.current as TerminalLike | null
      if (!t?.registerDecoration) return
      const limited = matches.slice(0, MATCH_HIGHLIGHT_LIMIT)
      for (const m of limited) {
        try {
          const decoration = t.registerDecoration({
            startLine: m.line,
            endLine: m.line,
            startColumn: m.col,
            endColumn: m.col + m.len,
            backgroundColor: 'rgba(255, 213, 0, 0.25)',
          })
          if (decoration) {
            decorationsRef.current.push(decoration)
          }
        } catch {
          /* registerDecoration 不可用或行号越界,忽略 */
        }
      }
    },
    [clearDecorations],
  )

  /** 降级搜索:遍历 buffer 找到匹配并滚动 + 选中 */
  const fallbackSearch = React.useCallback(
    (term: string, opts: SearchOptions, forward: boolean): boolean => {
      const t = termRef.current
      if (!t || !term) return false
      try {
        const regex = compileSearchRegex(term, opts)
        if (!regex) return false
        const buffer = t.buffer.active
        const total = buffer.length
        const currentY = buffer.baseY + buffer.cursorY
        const startLine = forward ? currentY + 1 : currentY - 1
        for (let offset = 0; offset < total; offset++) {
          const i = forward
            ? (startLine + offset + total) % total
            : (startLine - offset + total) % total
          const line = buffer.getLine(i)
          if (!line) continue
          const text = line.translateToString(true)
          regex.lastIndex = 0
          const m = regex.exec(text)
          if (m && m.index !== -1) {
            t.scrollToLine(i - buffer.baseY)
            t.select(m.index, i, m[0].length)
            return true
          }
        }
        return false
      } catch {
        return false
      }
    },
    [compileSearchRegex],
  )

  /** 执行搜索(优先 xterm 内置 findNext,降级 buffer 遍历) */
  const doSearch = React.useCallback(
    (forward: boolean) => {
      const term = searchTermRef.current
      if (!term) {
        setMatchTotal(0)
        setMatchIndex(0)
        clearDecorations()
        return
      }
      const t = termRef.current as TerminalLike | null
      if (!t) return
      // 计算所有匹配(用于计数 + 高亮)
      const matches = findAllMatches(term, searchOpts)
      setMatchTotal(matches.length)
      applyMatchHighlights(matches)
      // 跳转匹配位置(内置 findNext 或降级遍历)
      let found = false
      try {
        if (forward) {
          found =
            t.findNext?.(term, {
              caseSensitive: searchOpts.caseSensitive,
              wholeWord: searchOpts.wholeWord,
              regex: searchOpts.regex,
            }) ?? fallbackSearch(term, searchOpts, true)
        } else {
          found = t.findPrev?.(term) ?? fallbackSearch(term, searchOpts, false)
        }
      } catch {
        found = fallbackSearch(term, searchOpts, forward)
      }
      if (found && matches.length > 0) {
        setMatchIndex((prev) => (prev > 0 ? prev : 1))
      }
    },
    [searchOpts, findAllMatches, applyMatchHighlights, fallbackSearch, clearDecorations],
  )

  /** 搜索词或选项变化时重新搜索 + 高亮 */
  React.useEffect(() => {
    if (!searchOpen) return
    const term = searchTerm
    const optsKey = JSON.stringify(searchOpts)
    if (term === lastSearchTermRef.current && optsKey === lastSearchOptsRef.current) return
    lastSearchTermRef.current = term
    lastSearchOptsRef.current = optsKey
    if (!term) {
      setMatchTotal(0)
      setMatchIndex(0)
      clearDecorations()
      return
    }
    doSearch(true)
  }, [searchTerm, searchOpts, searchOpen, doSearch, clearDecorations])

  // 搜索条打开时聚焦输入框
  React.useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
    }
  }, [searchOpen])

  // 关闭右键菜单(任意点击)
  React.useEffect(() => {
    if (!contextMenu) return
    const handle = () => setContextMenu(null)
    document.addEventListener('click', handle)
    document.addEventListener('contextmenu', handle)
    return () => {
      document.removeEventListener('click', handle)
      document.removeEventListener('contextmenu', handle)
    }
  }, [contextMenu])

  React.useEffect(() => {
    let disposed = false
    const container = containerRef.current
    if (!container) return

    // 动态加载 xterm(SSR 安全,同 CodeEditor 动态 import 模式)
    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-web-links'),
    ])
      .then(([{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }]) => {
        if (disposed || !container) return

        const theme = resolvedTheme === 'dark' ? DARK_THEME : LIGHT_THEME
        const term = new XTerm({
          fontSize,
          fontFamily: FONT_FAMILY,
          theme,
          cursorBlink: true,
          allowProposedApi: true,
          scrollback: 5000,
          convertEol: true,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(new WebLinksAddon())

        term.open(container)
        try {
          fitAddon.fit()
        } catch {
          /* container 尚未布局,忽略 */
        }

        termRef.current = term
        fitAddonRef.current = fitAddon

        // 自定义键盘事件:
        // - Ctrl+F 搜索
        // - Ctrl+=/-/0 缩放
        // - Ctrl+Shift+C/V 复制粘贴
        // - Ctrl+Shift+D 垂直分屏(列并排)
        // - Ctrl+Shift+H 水平分屏(行堆叠)
        // - Alt+ArrowLeft/Right/Up/Down 焦点切换
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          // Ctrl+F → 搜索
          if ((event.ctrlKey || event.metaKey) && event.key === 'f' && !event.shiftKey && !event.altKey) {
            if (event.type === 'keydown') {
              setSearchOpen(true)
            }
            return false
          }
          // Ctrl+= 放大字号
          if ((event.ctrlKey || event.metaKey) && (event.key === '=' || event.key === '+')) {
            if (event.type === 'keydown') {
              onFontSizeChange((prev) => Math.min(FONT_SIZE_MAX, prev + 1))
            }
            return false
          }
          // Ctrl+- 缩小字号
          if ((event.ctrlKey || event.metaKey) && event.key === '-') {
            if (event.type === 'keydown') {
              onFontSizeChange((prev) => Math.max(FONT_SIZE_MIN, prev - 1))
            }
            return false
          }
          // Ctrl+0 重置字号
          if ((event.ctrlKey || event.metaKey) && event.key === '0') {
            if (event.type === 'keydown') {
              onFontSizeChange(FONT_SIZE_DEFAULT)
            }
            return false
          }
          // Ctrl+Shift+C 复制选中文本
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
            if (event.type === 'keydown') {
              const sel = term.getSelection()
              if (sel) {
                void navigator.clipboard.writeText(sel)
              }
            }
            return false
          }
          // Ctrl+Shift+V 粘贴
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'v' || event.key === 'V')) {
            if (event.type === 'keydown') {
              void navigator.clipboard.readText().then((text) => {
                term.paste(text)
              })
            }
            return false
          }
          // Ctrl+Shift+D → 垂直分屏(列并排)
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'd' || event.key === 'D')) {
            if (event.type === 'keydown') {
              onSplitRequest('vertical')
            }
            return false
          }
          // Ctrl+Shift+H → 水平分屏(行堆叠)
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'h' || event.key === 'H')) {
            if (event.type === 'keydown') {
              onSplitRequest('horizontal')
            }
            return false
          }
          // Alt+ArrowLeft/Right/Up/Down → 焦点切换(由父容器路由)
          if (event.altKey && event.key.startsWith('Arrow')) {
            if (event.type === 'keydown') {
              onFocusPane()
            }
            return false
          }
          return true
        })

        // WebSocket 连接:双向数据流(分屏场景下,每个 pane 各自建立 WS,后端广播给所有 WS 连接)
        const handle = connectWS(sessionId, {
          onOpen: () => {
            setConnected(true)
            setWsError(null)
          },
          onMessage: (msg: TerminalWSServerMessage) => {
            if (msg.type === 'output') {
              term.write(msg.data)
            } else if (msg.type === 'exit') {
              term.write(`\r\n\x1b[33m${msg.data}\x1b[0m\r\n`)
              setConnected(false)
            } else if (msg.type === 'error') {
              setWsError(msg.data)
            }
            // scrollback-end 标记:由父组件控制,viewport 不区分 scrollback / 实时数据
          },
          onClose: () => {
            setConnected(false)
          },
          onError: (err: string) => {
            setWsError(err)
          },
        })
        wsHandleRef.current = handle

        // xterm 输入 → WebSocket
        const inputDisposable = term.onData((data: string) => {
          handle.send({ type: 'input', data })
        })

        // xterm resize → WebSocket + REST
        const resizeDisposable = term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          handle.send({ type: 'resize', data: { cols, rows } })
          if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current)
          resizeDebounceRef.current = setTimeout(() => {
            void resizeSession(sessionId, cols, rows)
          }, 300)
        })

        // ResizeObserver → fitAddon.fit() → 自动触发 onResize
        const ro = new ResizeObserver(() => {
          try {
            fitAddon.fit()
          } catch {
            /* 容器未布局时忽略 */
          }
        })
        ro.observe(container)
        roRef.current = ro

        // 清理函数(挂到 term 实例上,组件卸载时调用)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(term as any)._terminalCleanup = () => {
          inputDisposable.dispose()
          resizeDisposable.dispose()
          ro.disconnect()
          handle.close()
          // 清除搜索高亮装饰
          for (const d of decorationsRef.current) {
            try {
              d.dispose()
            } catch {
              /* ignore */
            }
          }
          decorationsRef.current = []
          term.dispose()
        }
      })
      .catch((e) => {
        setWsError(`终端加载失败: ${(e as Error).message}`)
      })

    return () => {
      disposed = true
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current)
      if (roRef.current) roRef.current.disconnect()
      const term = termRef.current
      if (term?._terminalCleanup) term._terminalCleanup()
      wsHandleRef.current?.close()
      termRef.current = null
      fitAddonRef.current = null
      wsHandleRef.current = null
      roRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 sessionId/paneId 变化时重建,fontSize/theme 通过独立 effect 更新
  }, [sessionId, paneId])

  // 主题切换 → 更新 xterm theme
  React.useEffect(() => {
    const term = termRef.current
    if (!term) return
    const theme = resolvedTheme === 'dark' ? DARK_THEME : LIGHT_THEME
    try {
      term.options = { ...term.options, theme }
    } catch {
      /* 旧版 xterm 不支持 options setter,忽略 */
    }
  }, [resolvedTheme])

  // 字号变化 → 更新 xterm fontSize + refresh + fit
  React.useEffect(() => {
    const term = termRef.current
    if (!term) return
    try {
      term.options = { ...term.options, fontSize }
      if (typeof term.rows === 'number' && term.rows > 0) {
        term.refresh(0, term.rows - 1)
      }
      const fit = fitAddonRef.current as { fit?: () => void } | null
      fit?.fit?.()
    } catch {
      /* options setter 不可用时忽略 */
    }
  }, [fontSize])

  // 卸载时清除装饰
  React.useEffect(() => {
    return () => clearDecorations()
  }, [clearDecorations])

  /** 右键菜单:复制选中 / 粘贴 / 清屏 / 搜索 / 分屏 */
  const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onFocusPane()
    const t = termRef.current
    const hasSelection = !!(t && t.getSelection && t.getSelection())
    setContextMenu({ x: e.clientX, y: e.clientY, hasSelection })
  }, [onFocusPane])

  const handleCopy = React.useCallback(() => {
    const t = termRef.current
    if (!t) return
    const sel = t.getSelection?.() ?? ''
    if (sel) {
      void navigator.clipboard.writeText(sel)
    }
    setContextMenu(null)
  }, [])

  const handlePaste = React.useCallback(() => {
    const t = termRef.current
    if (!t) return
    void navigator.clipboard.readText().then((text) => {
      t.paste?.(text)
    })
    setContextMenu(null)
  }, [])

  const handleClear = React.useCallback(() => {
    const t = termRef.current
    t?.clear?.()
    setContextMenu(null)
  }, [])

  const handleSearchFromMenu = React.useCallback(() => {
    setSearchOpen(true)
    setContextMenu(null)
  }, [])

  const handleSplitFromMenu = React.useCallback(
    (direction: TerminalSplitDirection) => {
      onSplitRequest(direction)
      setContextMenu(null)
    },
    [onSplitRequest],
  )

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden',
        isActive ? 'bg-card' : 'bg-card/60',
      )}
      onContextMenu={handleContextMenu}
      onMouseDown={onFocusPane}
    >
      {/* pane 工具条(右上角:分屏 + 关闭) */}
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded bg-background/80 p-0.5 backdrop-blur-sm">
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => onSplitRequest('vertical')}
            title="垂直分屏 (Ctrl+Shift+D)"
            aria-label="垂直分屏"
          >
            <Columns2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => onSplitRequest('horizontal')}
            title="水平分屏 (Ctrl+Shift+H)"
            aria-label="水平分屏"
          >
            <Rows2 className="h-3 w-3" />
          </button>
          {canClosePane && (
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
              onClick={onClosePane}
              title="关闭分屏"
              aria-label="关闭分屏"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 搜索条(Ctrl+F 触发,深化:正则 + 全字 + 大小写三开关) */}
      {searchOpen && (
        <div className="flex flex-col gap-1 border-b border-border bg-card px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  doSearch(!e.shiftKey)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setSearchOpen(false)
                  setSearchTerm('')
                  clearDecorations()
                }
              }}
              placeholder={searchOpts.regex ? '输入正则表达式...' : '搜索终端输出...'}
              className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs outline-none focus:border-ring/50"
              aria-label="搜索终端"
            />
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {matchTotal > 0 ? `${matchIndex}/${matchTotal}` : '0/0'}
            </span>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              onClick={() => doSearch(false)}
              disabled={!searchTerm}
              aria-label="上一个匹配"
              title="上一个 (Shift+Enter)"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              onClick={() => doSearch(true)}
              disabled={!searchTerm}
              aria-label="下一个匹配"
              title="下一个 (Enter)"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => {
                setSearchOpen(false)
                setSearchTerm('')
                clearDecorations()
              }}
              aria-label="关闭搜索"
              title="关闭 (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* 搜索选项开关(正则 / 全字 / 大小写) */}
          <div className="flex items-center gap-1 pl-5">
            <button
              type="button"
              className={cn(
                'flex h-5 items-center gap-1 rounded px-1.5 text-[10px] transition-colors',
                searchOpts.regex
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              onClick={() => setSearchOpts((p) => ({ ...p, regex: !p.regex, wholeWord: false }))}
              title="正则模式"
            >
              <span>.*</span>
              <span>正则</span>
            </button>
            <button
              type="button"
              className={cn(
                'flex h-5 items-center gap-1 rounded px-1.5 text-[10px] transition-colors',
                searchOpts.wholeWord
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              onClick={() => setSearchOpts((p) => ({ ...p, wholeWord: !p.wholeWord, regex: false }))}
              title="全字匹配"
            >
              <span>W</span>
              <span>全字</span>
            </button>
            <button
              type="button"
              className={cn(
                'flex h-5 items-center gap-1 rounded px-1.5 text-[10px] transition-colors',
                searchOpts.caseSensitive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              onClick={() => setSearchOpts((p) => ({ ...p, caseSensitive: !p.caseSensitive }))}
              title="大小写敏感"
            >
              <span>Aa</span>
              <span>大小写</span>
            </button>
            {searchOpts.regex && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                正则模式(全字已禁用)
              </span>
            )}
          </div>
        </div>
      )}

      {/* xterm 容器 */}
      <div className="min-h-0 flex-1">
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{ padding: '4px 8px' }}
        />
      </div>

      {/* 连接状态指示器(左下角,不使用 rounded-full,用 rounded 紧凑) */}
      <div className="pointer-events-none absolute bottom-1 left-2 flex items-center gap-1.5 rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
        <span
          className={cn(
            'inline-block h-1.5 w-1.5',
            connected ? 'bg-green-500' : wsError ? 'bg-red-500' : 'bg-muted-foreground',
          )}
          style={{ borderRadius: '50%' }}
        />
        <span>
          {connected ? '已连接' : wsError ? '连接错误' : '连接中...'}
        </span>
      </div>

      {/* 字号状态栏(右下角) */}
      <div className="pointer-events-none absolute bottom-1 right-2 flex items-center gap-2 rounded bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
        <span>{fontSize}px</span>
        <span className="opacity-60">Ctrl+/−/0</span>
      </div>

      {wsError && (
        <div className="absolute inset-x-0 bottom-0 bg-destructive/10 px-3 py-1 text-xs text-destructive">
          {wsError}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-36 overflow-hidden rounded-md border border-border bg-popover py-0.5 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleCopy}
            disabled={!contextMenu.hasSelection}
          >
            <Copy className="h-3 w-3" />
            <span>复制选中</span>
            <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+C</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={handlePaste}
          >
            <ClipboardPaste className="h-3 w-3" />
            <span>粘贴</span>
            <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+V</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={handleSearchFromMenu}
          >
            <SearchIcon className="h-3 w-3" />
            <span>搜索</span>
            <span className="ml-auto text-[10px] opacity-50">Ctrl+F</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleSplitFromMenu('vertical')}
          >
            <Columns2 className="h-3 w-3" />
            <span>垂直分屏</span>
            <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+D</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleSplitFromMenu('horizontal')}
          >
            <Rows2 className="h-3 w-3" />
            <span>水平分屏</span>
            <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+H</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={handleClear}
          >
            <Eraser className="h-3 w-3" />
            <span>清屏</span>
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 分屏容器 — 用 CSS Grid 渲染多个 pane。
 *
 * - vertical:grid-template-columns: repeat(N, 1fr) 左右并排
 * - horizontal:grid-template-rows: repeat(N, 1fr) 上下堆叠
 *
 * 每个 pane 独立 xterm 实例,共享同一 WS 数据流(后端 PTY 广播给所有 WS 连接)。
 */
function SplitPaneContainer({
  sessionId,
  paneIds,
  direction,
  activePaneId,
  fontSize,
  onFontSizeChange,
  onAddPane,
  onRemovePane,
  onSetActivePane,
}: {
  sessionId: string
  paneIds: string[]
  direction: TerminalSplitDirection
  activePaneId: string | null
  fontSize: number
  onFontSizeChange: React.Dispatch<React.SetStateAction<number>>
  onAddPane: (direction: TerminalSplitDirection) => void
  onRemovePane: (paneId: string) => void
  onSetActivePane: (paneId: string) => void
}) {
  // 焦点切换:Alt+Arrow 按 pane 顺序循环
  const handleFocusSwitch = React.useCallback(
    (direction: 'prev' | 'next') => {
      if (paneIds.length <= 1) return
      const currentIdx = activePaneId ? paneIds.indexOf(activePaneId) : 0
      let nextIdx: number
      if (direction === 'next') {
        nextIdx = (currentIdx + 1) % paneIds.length
      } else {
        nextIdx = (currentIdx - 1 + paneIds.length) % paneIds.length
      }
      const nextId = paneIds[nextIdx]
      if (nextId) onSetActivePane(nextId)
    },
    [paneIds, activePaneId, onSetActivePane],
  )

  // 容器级键盘事件(Alt+Arrow 焦点切换)
  React.useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.altKey && e.key.startsWith('Arrow')) {
        // Alt+ArrowLeft/Up → prev;Alt+ArrowRight/Down → next
        const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 'prev' : 'next'
        handleFocusSwitch(dir)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [handleFocusSwitch])

  if (paneIds.length === 0) return null

  // 单 pane 直接渲染(避免 grid 分隔线)
  if (paneIds.length === 1) {
    const singlePaneId = paneIds[0]
    if (!singlePaneId) return null
    return (
      <TerminalViewport
        key={singlePaneId}
        sessionId={sessionId}
        paneId={singlePaneId}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        onSplitRequest={onAddPane}
        onClosePane={() => onRemovePane(singlePaneId)}
        canClosePane={false}
        isActive={activePaneId === singlePaneId}
        onFocusPane={() => onSetActivePane(singlePaneId)}
      />
    )
  }

  // 多 pane 用 CSS Grid 布局
  const gridStyle: React.CSSProperties =
    direction === 'vertical'
      ? { display: 'grid', gridTemplateColumns: `repeat(${paneIds.length}, 1fr)`, gap: '1px', background: 'var(--border, hsl(var(--border)))', height: '100%', width: '100%' }
      : { display: 'grid', gridTemplateRows: `repeat(${paneIds.length}, 1fr)`, gap: '1px', background: 'var(--border, hsl(var(--border)))', height: '100%', width: '100%' }

  return (
    <div style={gridStyle}>
      {paneIds.map((paneId) => (
        <div key={paneId} className="relative overflow-hidden bg-card">
          <TerminalViewport
            sessionId={sessionId}
            paneId={paneId}
            fontSize={fontSize}
            onFontSizeChange={onFontSizeChange}
            onSplitRequest={onAddPane}
            onClosePane={() => onRemovePane(paneId)}
            canClosePane={paneIds.length > 1}
            isActive={activePaneId === paneId}
            onFocusPane={() => onSetActivePane(paneId)}
          />
        </div>
      ))}
    </div>
  )
}

/** 终端面板主组件 — tab bar + 分屏容器 */
export function TerminalPanel() {
  const {
    sessions,
    activeSessionId,
    createSession,
    closeSession,
    renameSession,
    setActive,
    refreshSessions,
    hasToken,
    loading,
    // pane state
    panes,
    activePaneId,
    splitDirections,
    addPane,
    removePane,
    setActivePane,
  } = useTerminalSession()

  // 全局字号状态(所有 session/pane 共享)
  const [fontSize, setFontSize] = React.useState<number>(FONT_SIZE_DEFAULT)

  // 首次挂载:刷新 session 列表,如果为空则自动创建一个
  const initRef = React.useRef(false)
  React.useEffect(() => {
    if (initRef.current || !hasToken) return
    initRef.current = true
    void (async () => {
      await refreshSessions()
      const store = await import('@/stores/terminal')
      const current = store.useTerminalStore.getState()
      if (current.sessions.length === 0) {
        await createSession()
      }
    })()
  }, [hasToken, createSession, refreshSessions])

  const handleNew = React.useCallback(
    (opts?: Parameters<typeof createSession>[0]) => {
      void createSession(opts)
    },
    [createSession],
  )

  const handleClose = React.useCallback(
    (id: string) => {
      void closeSession(id)
    },
    [closeSession],
  )

  const handleRename = React.useCallback(
    (id: string, name: string) => {
      void renameSession(id, name)
    },
    [renameSession],
  )

  // 当前激活 session 的 pane 列表
  const currentPaneIds = activeSessionId ? (panes[activeSessionId] ?? []) : []
  const currentDirection = activeSessionId
    ? (splitDirections[activeSessionId] ?? 'vertical')
    : 'vertical'

  // 分屏操作回调(传给 SplitPaneContainer)
  const handleAddPane = React.useCallback(
    (direction: TerminalSplitDirection) => {
      if (!activeSessionId) return
      addPane(activeSessionId, direction)
    },
    [activeSessionId, addPane],
  )

  const handleRemovePane = React.useCallback(
    (paneId: string) => {
      if (!activeSessionId) return
      const paneList = panes[activeSessionId] ?? []
      if (paneList.length <= 1) {
        // 只有一个 pane 时,关闭 pane = 关闭 session
        handleClose(activeSessionId)
        return
      }
      removePane(activeSessionId, paneId)
    },
    [activeSessionId, panes, removePane, handleClose],
  )

  if (!hasToken) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        请先登录以使用终端
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <TerminalTabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActive}
        onClose={handleClose}
        onNew={handleNew}
        onRename={handleRename}
        loading={loading}
      />
      <div className="min-h-0 flex-1">
        {activeSessionId && currentPaneIds.length > 0 ? (
          <SplitPaneContainer
            sessionId={activeSessionId}
            paneIds={currentPaneIds}
            direction={currentDirection}
            activePaneId={activePaneId}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            onAddPane={handleAddPane}
            onRemovePane={handleRemovePane}
            onSetActivePane={setActivePane}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            {loading ? '正在创建终端...' : '点击 + 新建终端会话'}
          </div>
        )}
      </div>
    </div>
  )
}
