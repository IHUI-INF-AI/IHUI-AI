'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import '@xterm/xterm/css/xterm.css'
import { TerminalTabBar } from './terminal-tab-bar'
import { useTerminalSession } from '@/hooks/use-terminal-session'
import { cn } from '@/lib/utils'
import type { TerminalWSServerMessage } from '@ihui/types'

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

/** xterm 容器 + 数据流管理(内部组件,keyed by sessionId 实现切换重建) */
function TerminalViewport({ sessionId }: { sessionId: string }) {
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { connectWS, resizeSession } = useTerminalSession()
  const [connected, setConnected] = React.useState(false)
  const [wsError, setWsError] = React.useState<string | null>(null)
  const termRef = React.useRef<unknown>(null)
  const fitAddonRef = React.useRef<unknown>(null)
  const wsHandleRef = React.useRef<ReturnType<typeof connectWS> | null>(null)
  const roRef = React.useRef<ResizeObserver | null>(null)
  const resizeDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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
          fontSize: 12,
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
          /* container 尚未布局,f忽略 */
        }

        termRef.current = term
        fitAddonRef.current = fitAddon

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

        // 清理函数
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const term = termRef.current as any
      if (term?._terminalCleanup) term._terminalCleanup()
      wsHandleRef.current?.close()
      termRef.current = null
      fitAddonRef.current = null
      wsHandleRef.current = null
      roRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // 主题切换 → 更新 xterm theme
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const term = termRef.current as any
    if (!term) return
    const theme = resolvedTheme === 'dark' ? DARK_THEME : LIGHT_THEME
    try {
      term.options = { ...term.options, theme }
    } catch {
      /* 旧版 xterm 不支持 options setter,忽略 */
    }
  }, [resolvedTheme])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ padding: '4px 8px' }}
      />
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
      {wsError && (
        <div className="absolute inset-x-0 bottom-0 bg-destructive/10 px-3 py-1 text-xs text-destructive">
          {wsError}
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
    setActive,
    refreshSessions,
    hasToken,
    loading,
  } = useTerminalSession()

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

  const handleNew = React.useCallback(() => {
    void createSession()
  }, [createSession])

  const handleClose = React.useCallback(
    (id: string) => {
      void closeSession(id)
    },
    [closeSession],
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
        loading={loading}
      />
      <div className="min-h-0 flex-1">
        {activeSessionId ? (
          <TerminalViewport key={activeSessionId} sessionId={activeSessionId} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            {loading ? '正在创建终端...' : '点击 + 新建终端会话'}
          </div>
        )}
      </div>
    </div>
  )
}


