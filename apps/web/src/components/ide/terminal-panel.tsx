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
  Sparkles,
  Stethoscope,
  History,
  Wand2,
  RefreshCw,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- xterm 6.x 实例类型在动态 import 后才能确定,用 any 简化跨 API 调用
  const termRef = React.useRef<any>(null)
  const fitAddonRef = React.useRef<unknown>(null)
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
        // - Ctrl+R → 智能历史搜索(2026-07-23 立)
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          // Ctrl+F → 搜索
          if ((event.ctrlKey || event.metaKey) && event.key === 'f' && !event.shiftKey && !event.altKey) {
            if (event.type === 'keydown') {
              setSearchOpen(true)
            }
            return false
          }
          // Ctrl+R → 智能历史搜索(仅活跃 pane 响应)
          if ((event.ctrlKey || event.metaKey) && event.key === 'r' && !event.shiftKey && !event.altKey) {
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
              // 累积最近输出(保留最后 2000 字符,供 AI 诊断 stderr 上下文)
              recentOutputRef.current = (recentOutputRef.current + msg.data).slice(-2000)
            } else if (msg.type === 'exit') {
              term.write(`\r\n\x1b[33m${msg.data}\x1b[0m\r\n`)
              setConnected(false)
              // 进程退出码非 0 → 自动触发 AI 诊断(失败自动弹出,2026-07-23 立)
              if (msg.code !== 0 && isActive && lastCommandRef.current) {
                void diagnoseError(sessionId, {
                  command: lastCommandRef.current,
                  stderr: recentOutputRef.current,
                  exitCode: msg.code,
                  cwd: '',
                }).then((result) => {
                  if (result) {
                    setAiDiagnoseOpen(true)
                  }
                })
                // 记录失败命令到智能历史(exitCode != 0)
                void recordHistory(sessionId, {
                  command: lastCommandRef.current,
                  exitCode: msg.code,
                })
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
                  lastCommandRef.current = cmd
                  // 命令成功完成(退出码 0,由后续 exit 消息覆盖非 0 情况)
                  void recordHistory(sessionId, { command: cmd, exitCode: 0 })
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
  const handleInsertSuggestion = React.useCallback((command: string) => {
    const t = termRef.current
    if (!t) return
    t.paste?.(command)
    setAiSuggestOpen(false)
  }, [setAiSuggestOpen])

  /** 一键修复(把 fixCommand 写入 PTY 执行) */
  const handleAutoFix = React.useCallback(() => {
    const fixCommand = aiDiagnoseResult?.fixCommand
    if (!fixCommand) return
    void autoFix(sessionId, fixCommand).then((result) => {
      if (result?.applied) {
        setAiDiagnoseOpen(false)
      }
    })
  }, [aiDiagnoseResult, sessionId, autoFix, setAiDiagnoseOpen])

  /** 从历史搜索中选择一条命令插入终端 */
  const handleHistorySelect = React.useCallback((command: string) => {
    const t = termRef.current
    if (!t) return
    t.paste?.(command)
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
    <div
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden',
        isActive ? 'bg-card' : 'bg-card/60',
      )}
      onContextMenu={handleContextMenu}
      onMouseDown={onFocusPane}
    >
      {/* pane 工具条(右上角:AI + 分屏 + 关闭) */}
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded bg-background/80 p-0.5 backdrop-blur-sm">
          {/* AI 建议按钮(2026-07-23 立,仅活跃 pane 显示) */}
          {isActive && (
            <button
              type="button"
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded transition-colors',
                aiSuggestOpen
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              onClick={handleOpenSuggest}
              title="AI 命令建议"
              aria-label="AI 命令建议"
            >
              <Sparkles className="h-3 w-3" />
            </button>
          )}
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

      {/* ==================== AI 建议浮层(2026-07-23 立,仅活跃 pane) ==================== */}
      {isActive && aiSuggestOpen && (
        <div className="absolute left-2 top-10 z-20 w-80 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">AI 命令建议</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                onClick={handleRefreshSuggest}
                disabled={aiSuggestLoading}
                aria-label="刷新建议"
                title="刷新建议"
              >
                <RefreshCw className={cn('h-3 w-3', aiSuggestLoading && 'animate-spin')} />
              </button>
              <button
                type="button"
                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setAiSuggestOpen(false)}
                aria-label="关闭"
                title="关闭"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {aiError ? (
              <div className="px-2.5 py-3 text-center text-xs text-destructive">
                {aiError}
                <div className="mt-1 text-[10px] text-muted-foreground">AI 服务暂不可用,请稍后重试</div>
              </div>
            ) : aiSuggestLoading ? (
              <div className="flex items-center gap-1.5 px-2.5 py-3 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>正在生成建议...</span>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                暂无建议。尝试执行命令后点击刷新。
              </div>
            ) : (
              aiSuggestions.map((s, i) => (
                <button
                  key={`${i}-${s.command}`}
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  onClick={() => handleInsertSuggestion(s.command)}
                  title="点击插入到终端"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-foreground">{s.command}</code>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </div>
                  {s.description && (
                    <span className="text-[10px] text-muted-foreground">{s.description}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================== AI 诊断浮层(2026-07-23 立,失败自动弹出,仅活跃 pane) ==================== */}
      {isActive && aiDiagnoseOpen && (
        <div className="absolute right-2 top-10 z-20 w-96 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              <Stethoscope className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">AI 错误诊断</span>
            </div>
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setAiDiagnoseOpen(false)}
              aria-label="关闭"
              title="关闭"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto px-2.5 py-2 text-xs">
            {aiError ? (
              <div className="text-center text-destructive">
                {aiError}
                <div className="mt-1 text-[10px] text-muted-foreground">AI 服务暂不可用,请稍后重试</div>
              </div>
            ) : aiDiagnoseLoading ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>正在诊断错误...</span>
              </div>
            ) : aiDiagnoseResult ? (
              <div className="flex flex-col gap-1.5">
                <div>
                  <span className="font-medium text-foreground">诊断:</span>
                  <span className="text-muted-foreground"> {aiDiagnoseResult.diagnosis}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">根因:</span>
                  <span className="text-muted-foreground"> {aiDiagnoseResult.rootCause}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">建议:</span>
                  <span className="text-muted-foreground"> {aiDiagnoseResult.suggestedFix}</span>
                </div>
                {aiDiagnoseResult.fixCommand && (
                  <div className="mt-1 flex items-center gap-2 rounded bg-muted/50 p-1.5">
                    <code className="flex-1 truncate font-mono text-[11px] text-foreground">
                      {aiDiagnoseResult.fixCommand}
                    </code>
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground transition-colors hover:bg-accent/80"
                      onClick={handleAutoFix}
                      title="一键执行修复命令"
                    >
                      <Wand2 className="h-2.5 w-2.5" />
                      <span>一键修复</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">暂无诊断结果</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== Ctrl+R 智能历史搜索(2026-07-23 立,仅活跃 pane) ==================== */}
      {isActive && historyOpen && (
        <div className="absolute left-1/2 top-2 z-30 w-96 -translate-x-1/2 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
            <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={historyInputRef}
              type="text"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const item = filteredHistory[historyIndex]
                  if (item) handleHistorySelect(item.command)
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHistoryIndex((prev) =>
                    Math.min(prev + 1, Math.max(0, filteredHistory.length - 1)),
                  )
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHistoryIndex((prev) => Math.max(prev - 1, 0))
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  handleHistoryClose()
                }
              }}
              placeholder="搜索命令历史(按相关性排序)..."
              className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs outline-none focus:border-ring/50"
              aria-label="搜索命令历史"
            />
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {filteredHistory.length > 0 ? `${historyIndex + 1}/${filteredHistory.length}` : '0/0'}
            </span>
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={handleHistoryClose}
              aria-label="关闭"
              title="关闭 (Esc)"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredHistory.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                {commandHistory.length === 0 ? '暂无历史。执行命令后会自动记录。' : '无匹配命令。'}
              </div>
            ) : (
              filteredHistory.map((entry, i) => (
                <button
                  key={`${i}-${entry.command}`}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors',
                    i === historyIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
                  )}
                  onMouseEnter={() => setHistoryIndex(i)}
                  onClick={() => handleHistorySelect(entry.command)}
                >
                  <code className="flex-1 truncate font-mono">{entry.command}</code>
                  {entry.exitCode !== 0 && (
                    <span className="shrink-0 text-[10px] text-red-500">退出{entry.exitCode}</span>
                  )}
                  {entry.frequency > 1 && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">×{entry.frequency}</span>
                  )}
                  {entry.gitBranch && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">{entry.gitBranch}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

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
    // 录制 / AI state(2026-07-23 立)
    recordingBySession,
    recordings,
    activePlaybackId,
    startRecording,
    stopRecording,
    listRecordings,
    playRecording,
    deleteRecording,
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

  // 录制切换(开始/停止,2026-07-23 立)
  const handleToggleRecording = React.useCallback(
    (sessionId: string) => {
      if (recordingBySession[sessionId]) {
        void stopRecording(sessionId)
      } else {
        void startRecording(sessionId)
      }
    },
    [recordingBySession, startRecording, stopRecording],
  )

  // 回放录制(2026-07-23 立)
  const handlePlayRecording = React.useCallback(
    (recordingId: string) => {
      void playRecording(recordingId)
    },
    [playRecording],
  )

  // 删除录制(2026-07-23 立)
  const handleDeleteRecording = React.useCallback(
    (recordingId: string) => {
      void deleteRecording(recordingId)
    },
    [deleteRecording],
  )

  // 刷新录制列表(2026-07-23 立)
  const handleRefreshRecordings = React.useCallback(() => {
    void listRecordings()
  }, [listRecordings])

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
        recordingBySession={recordingBySession}
        onToggleRecording={handleToggleRecording}
        recordings={recordings}
        onRefreshRecordings={handleRefreshRecordings}
        onPlayRecording={handlePlayRecording}
        onDeleteRecording={handleDeleteRecording}
        activePlaybackId={activePlaybackId}
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
