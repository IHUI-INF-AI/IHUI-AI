'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { EditorEmptyState } from './editor-empty-state'
import { EditorTabBar } from './editor-tab-bar'
import { CodeViewer } from '@/components/media/CodeViewer'
import { ChevronRight, Search, X, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const LANG_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript React',
  js: 'JavaScript',
  jsx: 'JavaScript React',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
  md: 'Markdown',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  sh: 'Shell',
  yml: 'YAML',
  yaml: 'YAML',
  text: 'Plain Text',
}

const DEFAULT_FONT_SIZE = 14
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 24
/** minimap 最多渲染的行数(避免超大文件卡顿) */
const MINIMAP_MAX_LINES = 200

export function CodeEditorPane() {
  const { openTabs, activeTabId } = useIDEWorkspace()
  const t = useTranslations('ide')
  const activeTab = openTabs.find((tab) => tab.id === activeTabId)
  const [fontSize, setFontSize] = React.useState(DEFAULT_FONT_SIZE)
  const [showSearch, setShowSearch] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [hoverTop, setHoverTop] = React.useState(-1)
  // 行高随字号联动(SyntaxHighlighter 默认 lineHeight: 1.5)
  const lineHeight = Math.round(fontSize * 1.5)

  // 切换 tab 时重置搜索态
  React.useEffect(() => {
    setShowSearch(false)
    setQuery('')
  }, [activeTabId])

  // Ctrl+F 切换文件内搜索 / Escape 关闭
  React.useEffect(() => {
    if (!activeTab) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch((v) => !v)
      } else if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab])

  const matchCount = React.useMemo(() => {
    if (!query || !activeTab) return 0
    return activeTab.content.split(query).length - 1
  }, [query, activeTab])

  const minimapLines = React.useMemo(() => {
    if (!activeTab) return []
    return activeTab.content
      .split('\n')
      .slice(0, MINIMAP_MAX_LINES)
      .map((l) => l.trim().length)
  }, [activeTab])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <EditorTabBar />
      {activeTab ? (
        <>
          {/* 面包屑 + 语言指示器 */}
          <div className="flex h-7 shrink-0 items-center gap-1 px-3 text-xs text-muted-foreground">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {activeTab.path
                .split('/')
                .filter(Boolean)
                .map((seg, i, arr) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                    <span
                      className={cn(
                        i === arr.length - 1 ? 'min-w-0 truncate text-foreground' : 'shrink-0',
                      )}
                    >
                      {seg}
                    </span>
                  </React.Fragment>
                ))}
            </div>
            <span className="shrink-0 text-muted-foreground/70">
              {LANG_LABELS[activeTab.language] ?? activeTab.language}
            </span>
          </div>

          {/* 编辑器主体:代码区 + minimap + 搜索 + 字号 */}
          <div className="relative flex flex-1 overflow-hidden">
            {/* 文件内搜索框 */}
            {showSearch && (
              <div className="absolute right-3 top-2 z-20 flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 shadow-sm">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('codeEditor.findPlaceholder')}
                  className="w-40 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                  {t('codeEditor.matchCount', { count: matchCount })}
                </span>
                <button
                  onClick={() => {
                    setShowSearch(false)
                    setQuery('')
                  }}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t('codeEditor.closeSearch')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* 代码区 + 鼠标悬停行高亮 */}
            <div
              className="relative flex-1 overflow-auto"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const y = e.clientY - rect.top + e.currentTarget.scrollTop
                const top = Math.floor(y / lineHeight) * lineHeight
                setHoverTop((prev) => (prev === top ? prev : top))
              }}
              onMouseLeave={() => setHoverTop(-1)}
            >
              <div
                className="[&_pre]:!text-[var(--editor-font-size)]"
                style={{ '--editor-font-size': `${fontSize}px` } as React.CSSProperties}
              >
                <CodeViewer
                  code={activeTab.content}
                  language={activeTab.language}
                  showLineNumbers
                  showCopyButton
                  className="rounded-none border-0"
                />
              </div>
              {/* 悬停行高亮层(pointer-events-none 不拦截鼠标) */}
              {hoverTop >= 0 && (
                <div
                  className="pointer-events-none absolute left-0 right-0 bg-muted/25"
                  style={{ top: hoverTop, height: lineHeight }}
                />
              )}
            </div>

            {/* Minimap 缩略图:每行用 2px 高的色条表示代码密度 */}
            <div className="hidden w-14 shrink-0 overflow-hidden bg-muted/15 py-2 lg:block">
              <div className="flex flex-col gap-px px-1">
                {minimapLines.map((len, i) => (
                  <div
                    key={i}
                    className="bg-muted-foreground/30"
                    style={{
                      height: '2px',
                      width: `${Math.min(100, Math.max(4, len * 1.5))}%`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 字号控制:- / 当前 / + */}
            <div className="absolute bottom-2 right-20 z-10 flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm">
              <button
                onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 1))}
                className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('codeEditor.zoomOut')}
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[2ch] text-center text-xs tabular-nums text-muted-foreground">
                {fontSize}
              </span>
              <button
                onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 1))}
                className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('codeEditor.zoomIn')}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <EditorEmptyState />
      )}
    </div>
  )
}
