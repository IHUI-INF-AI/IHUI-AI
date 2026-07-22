'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import '@xterm/xterm/css/xterm.css'
import { TerminalTabBar } from './terminal-tab-bar'
import { useTerminalSession } from '@/hooks/use-terminal-session'
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
}

/** 右键菜单项 */
interface ContextMenuState {
  x: number
  y: number
  hasSelection: boolean
}

/** xterm 容器 + 数据流管理(内部组件,keyed by sessionId 实现切换重建) */
function TerminalViewport({
  sessionId,
  fontSize,
  onFontSizeChange,
}: {
  sessionId: string
  fontSize: number
  onFontSizeChange: React.Dispatch<React.SetStateAction<number>>
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

  // 搜索状态
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [matchIndex, setMatchIndex] = React.useState(0)
  const [matchTotal, setMatchTotal] = React.useState(0)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  // 上次搜索词(用于检测变化触发新搜索)
  const lastSearchTermRef = React.useRef('')

  // 右键菜单状态
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)

  // 当前搜索词引用(供 keyEventHandler 闭包读取最新值)
  const searchTermRef = React.useRef('')
  React.useEffect(() => {
    searchTermRef.current = searchTerm
  }, [searchTerm])

  /** 统计 buffer 中匹配数(降级搜索用) */
  const countBufferMatches = React.useCallback((term: string): number => {
    if (!term) return 0
    const t = termRef.current
    if (!t) return 0
    try {
      const buffer = t.buffer.active
      let total = 0
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i)
        if (!line) continue
        const text = line.translateToString(true)
        let idx = 0
        while ((idx = text.indexOf(term, idx)) !== -1) {
          total++
          idx += term.length
        }
      }
      return total
    } catch {
      return 0
    }
  }, [])

  /** 降级搜索:遍历 buffer 找到匹配并滚动 + 选中 */
  const fallbackSearch = React.useCallback(
    (term: string, forward: boolean): boolean => {
      const t = termRef.current
      if (!t || !term) return false
      try {
        const buffer = t.buffer.active
        const total = buffer.length
        const currentY = buffer.baseY + buffer.cursorY
        // 从当前光标位置开始找
        const startLine = forward ? currentY + 1 : currentY - 1
        for (let offset = 0; offset < total; offset++) {
          const i = forward
            ? (startLine + offset + total) % total
            : (startLine - offset + total) % total
          const line = buffer.getLine(i)
          if (!line) continue
          const text = line.translateToString(true)
          const idx = forward ? text.indexOf(term) : text.lastIndexOf(term)
          if (idx !== -1) {
            t.scrollToLine(i - buffer.baseY)
            t.select(idx, i, term.length)
            return true
          }
        }
        return false
      } catch {
        return false
      }
    },
    [],
  )

  /** 执行搜索(优先 xterm 内置 findNext,降级 buffer 遍历) */
  const doSearch = React.useCallback(
    (forward: boolean) => {
      const term = searchTermRef.current
      if (!term) {
        setMatchTotal(0)
        setMatchIndex(0)
        return
      }
      const t = termRef.current as TerminalLike | null
      if (!t) return
      let found = false
      try {
        if (forward) {
          found = t.findNext?.(term) ?? fallbackSearch(term, true)
        } else {
          found = t.findPrev?.(term) ?? fallbackSearch(term, false)
        }
      } catch {
        found = fallbackSearch(term, forward)
      }
      // 更新匹配计数(无论内置还是降级,都遍历统计)
      setMatchTotal(countBufferMatches(term))
      if (found) {
        // 简单递增序号(无法精确获取当前是第几个匹配,这里用 0 表示有匹配)
        setMatchIndex((prev) => (prev > 0 ? prev : 1))
      }
    },
    [countBufferMatches, fallbackSearch],
  )

  /** 搜索词变化时重新统计并搜索 */
  React.useEffect(() => {
    if (!searchOpen) return
    const term = searchTerm
    if (term === lastSearchTermRef.current) return
    lastSearchTermRef.current = term
    if (!term) {
      setMatchTotal(0)
      setMatchIndex(0)
      return
    }
    doSearch(true)
  }, [searchTerm, searchOpen, doSearch])

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

        // 自定义键盘事件:Ctrl+F 搜索 / Ctrl+= 缩放 / Ctrl+- 缩小 / Ctrl+0 重置 / Ctrl+Shift+C 复制 / Ctrl+Shift+V 粘贴
        // onFontSizeChange 用函数式更新,避免闭包捕获过期 fontSize 导致连续按 Ctrl+= 不生效
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          // Ctrl 或 Meta(Mac)+F → 搜索
          if ((event.ctrlKey || event.metaKey) && event.key === 'f' && !event.shiftKey && !event.altKey) {
            if (event.type === 'keydown') {
              setSearchOpen(true)
            }
            return false
          }
          // Ctrl+= 放大字号(Ctrl++ 同义,Shift+= 即 +)
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
          return true
        })

        // WebSocket 连接:双向数据流
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
          // REST resize (防抖,避免频繁请求)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 通过自定义属性挂载清理逻辑,避开 Disposable 复杂类型
        ;(term as any)._terminalCleanup = () => {
          inputDisposable.dispose()
          resizeDisposable.dispose()
          ro.disconnect()
          handle.close()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 sessionId 变化时重建 term,fontSize/theme 通过独立 effect 更新
  }, [sessionId])

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
      // refresh 让新字号立即生效
      if (typeof term.rows === 'number' && term.rows > 0) {
        term.refresh(0, term.rows - 1)
      }
      // 触发 fit 重新计算行列数(字号变化会影响一屏能容纳的字符数)
      const fit = fitAddonRef.current as { fit?: () => void } | null
      fit?.fit?.()
    } catch {
      /* options setter 不可用时忽略 */
    }
  }, [fontSize])

  /** 右键菜单:复制选中 / 粘贴 / 清屏 / 搜索 */
  const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const t = termRef.current
    const hasSelection = !!(t && t.getSelection && t.getSelection())
    setContextMenu({ x: e.clientX, y: e.clientY, hasSelection })
  }, [])

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

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      onContextMenu={handleContextMenu}
    >
      {/* 搜索条(Ctrl+F 触发) */}
      {searchOpen && (
        <div className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5">
          <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                doSearch(!e.shiftKey) // Shift+Enter 上一个,Enter 下一个
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setSearchOpen(false)
                setSearchTerm('')
              }
            }}
            placeholder="搜索终端输出..."
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
            }}
            aria-label="关闭搜索"
            title="关闭 (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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

      {/* 连接状态指示器(右上角,不使用 rounded-full,用 rounded 紧凑) */}
      <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
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

      {/* 字号状态栏(底部右下,显示当前字号 + 快捷键提示) */}
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

/** 终端面板主组件 — tab bar + xterm 容器 */
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
  } = useTerminalSession()

  // 全局字号状态(所有 session 共享)
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
    (shell?: string) => {
      void createSession(shell ? { shell } : undefined)
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
        {activeSessionId ? (
          <TerminalViewport
            key={activeSessionId}
            sessionId={activeSessionId}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
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
