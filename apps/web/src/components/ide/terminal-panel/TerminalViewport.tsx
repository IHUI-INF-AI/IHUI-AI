'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import '@xterm/xterm/css/xterm.css'
import { useTerminalSession } from '@/hooks/use-terminal-session'
import type { TerminalSplitDirection } from '@/stores/terminal'
import { cn } from '@/lib/utils'
import type { TerminalWSServerMessage } from '@ihui/types'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import {
  DARK_THEME,
  LIGHT_THEME,
  FONT_FAMILY,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from './constants'
import type { TerminalInstance, ContextMenuState } from './types'
import { useTerminalSearch } from './useTerminalSearch'
import { TerminalPaneToolbar } from './TerminalPaneToolbar'
import { TerminalSearchBar } from './TerminalSearchBar'
import { AiSuggestOverlay } from './AiSuggestOverlay'
import { AiDiagnoseOverlay } from './AiDiagnoseOverlay'
import { TerminalHistorySearch } from './TerminalHistorySearch'
import { TerminalContextMenu } from './TerminalContextMenu'
import { TerminalStatusIndicators } from './TerminalStatusIndicators'

interface TerminalViewportProps {
  sessionId: string
  paneId: string
  fontSize: number
  onFontSizeChange: React.Dispatch<React.SetStateAction<number>>
  onSplitRequest: (direction: TerminalSplitDirection) => void
  onClosePane: () => void
  canClosePane: boolean
  isActive: boolean
  onFocusPane: () => void
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
 *
 * 纯重构:搜索逻辑见 ./useTerminalSearch,浮层/工具条/菜单等见同目录子组件。
 */
export function TerminalViewport({
  sessionId,
  paneId,
  fontSize,
  onFontSizeChange,
  onSplitRequest,
  onClosePane,
  canClosePane,
  isActive,
  onFocusPane,
}: TerminalViewportProps) {
  const { resolvedTheme } = useTheme()
  const t = useTranslations('ide')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const {
    connectWS,
    resizeSession,
    // AI 辅助 / 智能历史(2026-07-23 立)
    aiSuggestOpen,
    aiSuggestLoading,
    aiSuggestions,
    aiDiagnoseOpen,
    aiDiagnoseLoading,
    aiDiagnoseResult,
    aiError,
    commandHistory,
    suggestCommand,
    diagnoseError,
    autoFix,
    recordHistory,
    getSmartHistory,
    setAiSuggestOpen,
    setAiDiagnoseOpen,
    setAiError,
  } = useTerminalSession()
  const [connected, setConnected] = React.useState(false)
  const [wsError, setWsError] = React.useState<string | null>(null)
  // xterm 实例引用
  const termRef = React.useRef<TerminalInstance | null>(null)
  const fitAddonRef = React.useRef<FitAddon | null>(null)
  const wsHandleRef = React.useRef<ReturnType<typeof connectWS> | null>(null)
  const roRef = React.useRef<ResizeObserver | null>(null)
  const resizeDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // 命令追踪(用于 AI 诊断上下文 + 历史记录)
  const lastCommandRef = React.useRef('')
  const commandBufferRef = React.useRef('')
  const commandTaintedRef = React.useRef(false)
  // 最近输出缓冲(用于 AI 诊断 stderr 上下文,保留最后 2000 字符)
  const recentOutputRef = React.useRef('')

  // Ctrl+R 智能历史搜索(本地状态,仅活跃 pane 渲染)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [historyQuery, setHistoryQuery] = React.useState('')
  const [historyIndex, setHistoryIndex] = React.useState(0)
  const historyInputRef = React.useRef<HTMLInputElement>(null)

  // 右键菜单状态
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)

  // 搜索状态与逻辑(独立 hook,见 ./useTerminalSearch)
  const {
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
    matchIndex,
    matchTotal,
    searchOpts,
    setSearchOpts,
    searchInputRef,
    doSearch,
    clearDecorations,
  } = useTerminalSearch(termRef)

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
        // - Ctrl+R → 智能历史搜索(2026-07-23 立)
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          // Ctrl+F → 搜索
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key === 'f' &&
            !event.shiftKey &&
            !event.altKey
          ) {
            if (event.type === 'keydown') {
              setSearchOpen(true)
            }
            return false
          }
          // Ctrl+R → 智能历史搜索(仅活跃 pane 响应)
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key === 'r' &&
            !event.shiftKey &&
            !event.altKey
          ) {
            if (event.type === 'keydown' && isActive) {
              setHistoryOpen(true)
              // 拉取智能历史(相关性打分排序)
              void getSmartHistory(sessionId)
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
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            (event.key === 'c' || event.key === 'C')
          ) {
            if (event.type === 'keydown') {
              const sel = term.getSelection()
              if (sel) {
                void navigator.clipboard.writeText(sel)
              }
            }
            return false
          }
          // Ctrl+Shift+V 粘贴
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            (event.key === 'v' || event.key === 'V')
          ) {
            if (event.type === 'keydown') {
              void navigator.clipboard
                .readText()
                .then((text) => {
                  term.paste(text)
                })
                .catch(() => {
                  // 2026-08-02 修复: Bug 4 — 剪贴板权限拒绝时静默忽略
                })
            }
            return false
          }
          // Ctrl+Shift+D → 垂直分屏(列并排)
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            (event.key === 'd' || event.key === 'D')
          ) {
            if (event.type === 'keydown') {
              onSplitRequest('vertical')
            }
            return false
          }
          // Ctrl+Shift+H → 水平分屏(行堆叠)
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            (event.key === 'h' || event.key === 'H')
          ) {
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
              // 累积最近输出(保留最后 2000 字符,供 AI 诊断 stderr 上下文)
              recentOutputRef.current = (recentOutputRef.current + msg.data).slice(-2000)
            } else if (msg.type === 'exit') {
              term.write(`\r\n\x1b[33m${msg.data}\x1b[0m\r\n`)
              setConnected(false)
              // 2026-08-02 修复: Bug 5 — Enter 时不再立即 recordHistory(exitCode:0),
              // 改为在 exit 消息到达时统一记录(用真实退出码),避免历史混乱。
              // 进程退出码非 0 → 自动触发 AI 诊断(失败自动弹出,2026-07-23 立)
              if (isActive && lastCommandRef.current) {
                // 记录命令到智能历史(成功或失败均记录,用真实 exit code)
                void recordHistory(sessionId, {
                  command: lastCommandRef.current,
                  exitCode: msg.code,
                }).catch(() => {
                  /* 历史记录失败不影响终端使用,静默忽略 */
                })
                if (msg.code !== 0) {
                  void diagnoseError(sessionId, {
                    command: lastCommandRef.current,
                    stderr: recentOutputRef.current,
                    exitCode: msg.code,
                    cwd: '',
                  })
                    .then((result) => {
                      if (result) {
                        setAiDiagnoseOpen(true)
                      }
                    })
                    .catch((e: unknown) => {
                      // 2026-08-02 修复: Bug 4 — diagnoseError rejection 设 wsError
                      setWsError(e instanceof Error ? e.message : String(e))
                    })
                }
                lastCommandRef.current = ''
              }
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

        // xterm 输入 → WebSocket + 命令追踪(检测 Enter 完成命令,供 AI 诊断上下文 + 历史记录)
        const inputDisposable = term.onData((data: string) => {
          handle.send({ type: 'input', data })
          // 命令缓冲累积(检测可打印字符 + Enter 完成,转义序列污染时跳过)
          for (const ch of data) {
            const code = ch.charCodeAt(0)
            if (ch === '\r' || ch === '\n') {
              if (!commandTaintedRef.current) {
                const cmd = commandBufferRef.current.trim()
                if (cmd) {
                  // 2026-08-02 修复: Bug 5 — Enter 时只缓存 lastCommandRef,
                  // 不调 recordHistory(等 exit 消息到达时用真实 exit code 统一记录)
                  lastCommandRef.current = cmd
                }
              }
              commandBufferRef.current = ''
              commandTaintedRef.current = false
              // 命令完成后清空最近输出缓冲(下一次命令的输出从头累积)
              recentOutputRef.current = ''
            } else if (code === 0x7f) {
              // Backspace
              commandBufferRef.current = commandBufferRef.current.slice(0, -1)
            } else if (code === 0x1b) {
              // 转义序列(箭头键/Ctrl+组合键)→ 污染标记
              commandTaintedRef.current = true
            } else if (code >= 0x20 && code <= 0x7e) {
              if (!commandTaintedRef.current) commandBufferRef.current += ch
            } else if (code >= 0x80) {
              if (!commandTaintedRef.current) commandBufferRef.current += ch
            }
          }
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
        ;(term as Terminal & { _terminalCleanup?: () => void })._terminalCleanup = () => {
          inputDisposable.dispose()
          resizeDisposable.dispose()
          ro.disconnect()
          handle.close()
          // 清除搜索高亮装饰(见 ./useTerminalSearch)
          clearDecorations()
          term.dispose()
        }
      })
      .catch((e) => {
        setWsError(t('terminalPanel.loadFailed', { message: (e as Error).message }))
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
      // P3 修复:主 effect cleanup 中显式调 clearDecorations,
      // 防止 dynamic import 未 resolve 时切换 session 导致装饰残留
      // (此时 termRef.current 可能为 null,_terminalCleanup 未挂载,decorationsRef 残留旧 session 装饰)
      clearDecorations()
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
      const fit = fitAddonRef.current
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
  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onFocusPane()
      const tt = termRef.current
      const hasSelection = !!(tt && tt.getSelection && tt.getSelection())
      setContextMenu({ x: e.clientX, y: e.clientY, hasSelection })
    },
    [onFocusPane],
  )

  const handleCopy = React.useCallback(() => {
    const tt = termRef.current
    if (!tt) return
    const sel = tt.getSelection?.() ?? ''
    if (sel) {
      void navigator.clipboard.writeText(sel)
    }
    setContextMenu(null)
  }, [])

  const handlePaste = React.useCallback(() => {
    const tt = termRef.current
    if (!tt) return
    void navigator.clipboard
      .readText()
      .then((text) => {
        tt.paste?.(text)
      })
      .catch(() => {
        // 2026-08-02 修复: Bug 4 — 剪贴板权限拒绝时静默忽略
      })
    setContextMenu(null)
  }, [])

  const handleClear = React.useCallback(() => {
    const tt = termRef.current
    tt?.clear?.()
    setContextMenu(null)
  }, [])

  const handleSearchFromMenu = React.useCallback(() => {
    setSearchOpen(true)
    setContextMenu(null)
  }, [setSearchOpen])

  const handleSplitFromMenu = React.useCallback(
    (direction: TerminalSplitDirection) => {
      onSplitRequest(direction)
      setContextMenu(null)
    },
    [onSplitRequest],
  )

  // ==================== AI 辅助 / 智能历史 handlers(2026-07-23 立) ====================

  /** 打开 AI 建议浮层 + 触发建议请求(用当前 cwd + lastCommand 作为上下文) */
  const handleOpenSuggest = React.useCallback(() => {
    if (!isActive) return
    setAiSuggestOpen(true)
    setAiError(null)
    void suggestCommand(sessionId, {
      cwd: '',
      lastCommand: lastCommandRef.current || undefined,
    })
  }, [isActive, sessionId, setAiSuggestOpen, setAiError, suggestCommand])

  /** 刷新 AI 建议(重新请求) */
  const handleRefreshSuggest = React.useCallback(() => {
    void suggestCommand(sessionId, {
      cwd: '',
      lastCommand: lastCommandRef.current || undefined,
    })
  }, [sessionId, suggestCommand])

  /** 插入建议命令到终端(term.paste 触发 onData → WS input) */
  const handleInsertSuggestion = React.useCallback(
    (command: string) => {
      const tt = termRef.current
      if (!tt) return
      tt.paste?.(command)
      setAiSuggestOpen(false)
    },
    [setAiSuggestOpen],
  )

  /** 一键修复(把 fixCommand 写入 PTY 执行) */
  const handleAutoFix = React.useCallback(() => {
    const fixCommand = aiDiagnoseResult?.fixCommand
    if (!fixCommand) return
    void autoFix(sessionId, fixCommand)
      .then((result) => {
        if (result?.applied) {
          setAiDiagnoseOpen(false)
        }
      })
      .catch((e: unknown) => {
        // 2026-08-02 修复: Bug 4 — autoFix rejection 设 wsError(用户可见)
        setWsError(e instanceof Error ? e.message : String(e))
      })
  }, [aiDiagnoseResult, sessionId, autoFix, setAiDiagnoseOpen])

  /** 从历史搜索中选择一条命令插入终端 */
  const handleHistorySelect = React.useCallback((command: string) => {
    const tt = termRef.current
    if (!tt) return
    tt.paste?.(command)
    setHistoryOpen(false)
    setHistoryQuery('')
    setHistoryIndex(0)
  }, [])

  /** 关闭历史搜索 */
  const handleHistoryClose = React.useCallback(() => {
    setHistoryOpen(false)
    setHistoryQuery('')
    setHistoryIndex(0)
  }, [])

  // 历史搜索打开时聚焦输入框
  React.useEffect(() => {
    if (historyOpen && historyInputRef.current) {
      historyInputRef.current.focus()
      historyInputRef.current.select()
    }
  }, [historyOpen])

  // 历史搜索重置选中索引(query 变化时)
  React.useEffect(() => {
    setHistoryIndex(0)
  }, [historyQuery])

  // 历史搜索过滤结果(按 query 子串匹配,大小写不敏感)
  const filteredHistory = React.useMemo(() => {
    if (!historyQuery) return commandHistory
    const q = historyQuery.toLowerCase()
    return commandHistory.filter((e) => e.command.toLowerCase().includes(q))
  }, [commandHistory, historyQuery])

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden',
        isActive ? 'bg-card' : 'bg-card/60',
      )}
      onContextMenu={handleContextMenu}
      onMouseDown={onFocusPane}
    >
      {/* pane 工具条(右上角:AI + 分屏 + 关闭) */}
      <TerminalPaneToolbar
        isActive={isActive}
        aiSuggestOpen={aiSuggestOpen}
        onOpenSuggest={handleOpenSuggest}
        onSplitRequest={onSplitRequest}
        onClosePane={onClosePane}
        canClosePane={canClosePane}
      />

      {/* 搜索条(Ctrl+F 触发,深化:正则 + 全字 + 大小写三开关) */}
      {searchOpen && (
        <TerminalSearchBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchOpts={searchOpts}
          setSearchOpts={setSearchOpts}
          matchIndex={matchIndex}
          matchTotal={matchTotal}
          searchInputRef={searchInputRef}
          doSearch={doSearch}
          clearDecorations={clearDecorations}
          setSearchOpen={setSearchOpen}
        />
      )}

      {/* xterm 容器 */}
      <div className="min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" style={{ padding: '4px 8px' }} />
      </div>

      {/* ==================== AI 建议浮层(2026-07-23 立,仅活跃 pane) ==================== */}
      {isActive && aiSuggestOpen && (
        <AiSuggestOverlay
          loading={aiSuggestLoading}
          error={aiError}
          suggestions={aiSuggestions}
          onRefresh={handleRefreshSuggest}
          onClose={() => setAiSuggestOpen(false)}
          onInsert={handleInsertSuggestion}
        />
      )}

      {/* ==================== AI 诊断浮层(2026-07-23 立,失败自动弹出,仅活跃 pane) ==================== */}
      {isActive && aiDiagnoseOpen && (
        <AiDiagnoseOverlay
          loading={aiDiagnoseLoading}
          error={aiError}
          result={aiDiagnoseResult}
          onClose={() => setAiDiagnoseOpen(false)}
          onAutoFix={handleAutoFix}
        />
      )}

      {/* ==================== Ctrl+R 智能历史搜索(2026-07-23 立,仅活跃 pane) ==================== */}
      {isActive && historyOpen && (
        <TerminalHistorySearch
          query={historyQuery}
          setQuery={setHistoryQuery}
          index={historyIndex}
          setIndex={setHistoryIndex}
          entries={filteredHistory}
          allEntries={commandHistory}
          onSelect={handleHistorySelect}
          onClose={handleHistoryClose}
          inputRef={historyInputRef}
        />
      )}

      {/* 连接状态 + 字号状态 + 错误横幅 */}
      <TerminalStatusIndicators connected={connected} wsError={wsError} fontSize={fontSize} />

      {/* 右键菜单 */}
      {contextMenu && (
        <TerminalContextMenu
          state={contextMenu}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onSearch={handleSearchFromMenu}
          onSplit={handleSplitFromMenu}
          onClear={handleClear}
        />
      )}
    </div>
  )
}
