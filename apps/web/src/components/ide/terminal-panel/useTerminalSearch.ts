import * as React from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { MATCH_HIGHLIGHT_LIMIT } from './constants'
import type { TerminalInstance, TerminalLike, SearchOptions, MatchPosition } from './types'

export interface UseTerminalSearchResult {
  searchOpen: boolean
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  matchIndex: number
  setMatchIndex: React.Dispatch<React.SetStateAction<number>>
  matchTotal: number
  setMatchTotal: React.Dispatch<React.SetStateAction<number>>
  searchOpts: SearchOptions
  setSearchOpts: React.Dispatch<React.SetStateAction<SearchOptions>>
  searchInputRef: React.RefObject<HTMLInputElement | null>
  doSearch: (forward: boolean) => void
  clearDecorations: () => void
}

/**
 * 终端搜索状态与逻辑(深化:正则 + 全字 + 大小写)。
 *
 * 从 TerminalViewport 提取的独立 hook,负责:
 * - 搜索框开关 / 词 / 选项 / 计数状态
 * - buffer 遍历匹配(findAllMatches)+ registerDecoration 高亮(applyMatchHighlights)
 * - 降级搜索(fallbackSearch,内置 findNext 不存在时遍历 buffer)
 * - 搜索词 250ms debounce(避免大 buffer 每次按键全量遍历卡顿)
 *
 * termRef 由调用方持有(xterm 实例),本 hook 通过类型断言读取 findNext / registerDecoration。
 */
export function useTerminalSearch(
  termRef: React.RefObject<TerminalInstance | null>,
): UseTerminalSearchResult {
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
  // 装饰高亮引用(每次搜索变化时全部 dispose 后重建)
  const decorationsRef = React.useRef<Array<{ dispose(): void }>>([])

  // 当前搜索词引用(供 doSearch 闭包读取最新值)
  const searchTermRef = React.useRef('')
  React.useEffect(() => {
    searchTermRef.current = searchTerm
  }, [searchTerm])

  // P2 修复:搜索词加 250ms debounce,避免大 buffer(5000 行)每次按键触发 findAllMatches 全量遍历导致卡顿。
  // doSearch 内部用 searchTermRef.current(最新值)执行实际搜索,因此 debounce 只控制"何时触发",
  // 用户按 Enter 时仍立即用最新词搜索,无延迟。
  const debouncedSearchTerm = useDebounce(searchTerm, 250)

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
    [compileSearchRegex, termRef],
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
    [clearDecorations, termRef],
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
    [compileSearchRegex, termRef],
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
    [searchOpts, findAllMatches, applyMatchHighlights, fallbackSearch, clearDecorations, termRef],
  )

  // 搜索词或选项变化时重新搜索 + 高亮(搜索词经 250ms debounce,避免大 buffer 每次按键卡顿)
  const lastSearchTermRef = React.useRef('')
  const lastSearchOptsRef = React.useRef('')
  React.useEffect(() => {
    if (!searchOpen) return
    const term = debouncedSearchTerm
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
  }, [debouncedSearchTerm, searchOpts, searchOpen, doSearch, clearDecorations])

  // 搜索条打开时聚焦输入框
  React.useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
    }
  }, [searchOpen])

  return {
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
    matchIndex,
    setMatchIndex,
    matchTotal,
    setMatchTotal,
    searchOpts,
    setSearchOpts,
    searchInputRef,
    doSearch,
    clearDecorations,
  }
}
