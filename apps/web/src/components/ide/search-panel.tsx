'use client'
import * as React from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { cn } from '@/lib/utils'
import {
  Search, CaseSensitive, Regex, WholeWord, Replace, ReplaceAll,
  ChevronRight, ChevronDown, FileCode, FileJson, Hash, FileText, History, X,
} from 'lucide-react'

interface SearchResult {
  filename: string
  line: number
  preview: string
  matchStart?: number
  matchEnd?: number
}

type FileType = 'all' | 'tsx' | 'ts' | 'css' | 'json'

const FILE_TYPE_FILTERS: { id: FileType; label: string; icon: typeof FileCode }[] = [
  { id: 'all', label: '全部', icon: FileText },
  { id: 'tsx', label: 'TSX', icon: FileCode },
  { id: 'ts', label: 'TS', icon: FileCode },
  { id: 'css', label: 'CSS', icon: Hash },
  { id: 'json', label: 'JSON', icon: FileJson },
]

const SAMPLE_RESULTS: SearchResult[] = [
  { filename: 'ide-layout.tsx', line: 5, preview: 'import { FileExplorer } from ...', matchStart: 8, matchEnd: 20 },
  { filename: 'ide-layout.tsx', line: 12, preview: 'export function IDELayout() {', matchStart: 7, matchEnd: 19 },
  { filename: 'activity-bar.tsx', line: 8, preview: 'export function ActivityBar()', matchStart: 7, matchEnd: 19 },
  { filename: 'activity-bar.tsx', line: 18, preview: 'className="flex w-12"', matchStart: 16, matchEnd: 28 },
  { filename: 'globals.css', line: 22, preview: '.btn { color: red }', matchStart: 14, matchEnd: 26 },
  { filename: 'tsconfig.json', line: 3, preview: '"target": "ES2022"', matchStart: 12, matchEnd: 24 },
]

function getExt(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function groupByFile(results: SearchResult[]): Map<string, SearchResult[]> {
  const map = new Map<string, SearchResult[]>()
  for (const r of results) {
    if (!map.has(r.filename)) map.set(r.filename, [])
    map.get(r.filename)!.push(r)
  }
  return map
}

export function SearchPanel() {
  const { activeView } = useIDEWorkspace()
  const [query, setQuery] = React.useState('')
  const [replaceValue, setReplaceValue] = React.useState('')
  const [showReplace, setShowReplace] = React.useState(false)
  const [caseSensitive, setCaseSensitive] = React.useState(false)
  const [wholeWord, setWholeWord] = React.useState(false)
  const [useRegex, setUseRegex] = React.useState(false)
  const [fileType, setFileType] = React.useState<FileType>('all')
  const [collapsedFiles, setCollapsedFiles] = React.useState<Set<string>>(new Set())
  const [history, setHistory] = React.useState<string[]>(['FileExplorer', 'IDELayout', 'ActivityBar', 'useIDEWorkspace'])

  if (activeView !== 'search') return null

  const filtered = SAMPLE_RESULTS.filter((r) => fileType === 'all' || getExt(r.filename) === fileType)
  const grouped = groupByFile(filtered)
  const totalMatches = filtered.length
  const fileCount = grouped.size

  const toggleFile = (filename: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  const runSearch = () => {
    if (!query.trim()) return
    setHistory((prev) => [query, ...prev.filter((h) => h !== query)].slice(0, 5))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch()
  }

  const toggleBtn = (active: boolean) =>
    cn('rounded p-1 transition-colors', active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50')

  return (
    <div className="flex w-72 shrink-0 flex-col bg-muted/20">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={() => setShowReplace(!showReplace)}
          className="rounded p-1 text-muted-foreground hover:bg-muted/50"
          aria-label="切换替换"
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', showReplace && 'rotate-90')} />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索"
            className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs focus:outline-none"
          />
        </div>
        <button onClick={() => setCaseSensitive(!caseSensitive)} className={toggleBtn(caseSensitive)} aria-label="区分大小写">
          <CaseSensitive className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setWholeWord(!wholeWord)} className={toggleBtn(wholeWord)} aria-label="全词匹配">
          <WholeWord className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setUseRegex(!useRegex)} className={toggleBtn(useRegex)} aria-label="正则表达式">
          <Regex className="h-3.5 w-3.5" />
        </button>
      </div>

      {showReplace && (
        <div className="flex items-center gap-1 px-2 pb-1.5 pl-7">
          <div className="relative flex-1">
            <Replace className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              placeholder="替换"
              className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs focus:outline-none"
            />
          </div>
          <button className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label="替换">
            <Replace className="h-3.5 w-3.5" />
          </button>
          <button className="rounded p-1 text-muted-foreground hover:bg-muted/50" aria-label="全部替换">
            <ReplaceAll className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 pb-1.5">
        {FILE_TYPE_FILTERS.map((f) => {
          const Icon = f.icon
          return (
            <button
              key={f.id}
              onClick={() => setFileType(f.id)}
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
                fileType === f.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{f.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {query && totalMatches > 0 ? (
          <div className="px-2 py-1">
            <div className="mb-1 text-xs text-muted-foreground">
              {totalMatches} 个结果 · {fileCount} 个文件
            </div>
            {Array.from(grouped.entries()).map(([filename, items]) => {
              const collapsed = collapsedFiles.has(filename)
              const Icon = getExt(filename) === 'json' ? FileJson : getExt(filename) === 'css' ? Hash : FileCode
              return (
                <div key={filename} className="mb-0.5">
                  <button
                    onClick={() => toggleFile(filename)}
                    className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-muted/40"
                  >
                    {collapsed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{filename}</span>
                    <span className="ml-auto rounded bg-muted px-1 text-muted-foreground">{items.length}</span>
                  </button>
                  {!collapsed && (
                    <div className="ml-4">
                      {items.map((r, i) => (
                        <div key={i} className="cursor-pointer rounded px-1.5 py-0.5 text-xs hover:bg-muted/30">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span className="text-foreground/70">{r.line}</span>
                            <span className="truncate">{r.preview}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : query ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">未找到结果</div>
        ) : history.length > 0 ? (
          <div className="px-2 py-1">
            <div className="mb-1 flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <History className="h-3 w-3" />
              <span>最近搜索</span>
            </div>
            {history.map((h, i) => (
              <div
                key={i}
                className="group flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-muted/30"
              >
                <Search className="h-3 w-3 text-muted-foreground" />
                <button onClick={() => setQuery(h)} className="flex-1 truncate text-left">
                  {h}
                </button>
                <button
                  onClick={() => setHistory((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                  aria-label="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground">输入关键词搜索</div>
        )}
      </div>
    </div>
  )
}
