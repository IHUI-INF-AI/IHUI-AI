// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen, Code2, Folder, Terminal, FileText } from 'lucide-react'

import { SearchInput } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'
import { useAiPanelStore } from '@/stores/ai-panel'
import { PortalPanel } from '@/components/feedback/portal-panel'

interface MentionFile {
  id: string
  name: string
  path: string
}

type MentionKind = 'file' | 'dir' | 'semantic'

interface MentionItem extends MentionFile {
  kind: MentionKind
  icon?: React.ComponentType<{ className?: string }>
  desc?: string
}

// 新增分组 UI 文案(i18n 键 groupDir/groupSemantic/semantic*Desc 已入 packages/i18n 5 语言,组件内 t() 引用)

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
  '__pycache__',
  'target',
  'out',
  '.output',
  'venv',
  'env',
])

interface FileMentionPopoverProps {
  files: MentionFile[]
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onSelect: (file: MentionFile) => void
  onClose: () => void
}

export function FileMentionPopover({
  files,
  open,
  anchorRef,
  onSelect,
  onClose,
}: FileMentionPopoverProps) {
  const t = useTranslations('fileMention')
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  // 活跃工作区第 1 层目录(异步读取 FileSystemDirectoryHandle)
  const [dirItems, setDirItems] = React.useState<MentionItem[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    const ws = useAiPanelStore.getState().activeWorkspace
    const handle = ws?.name ? getBrowserWorkspaceHandle(ws.name) : null
    if (!handle) {
      setDirItems([])
    } else {
      const run = async () => {
        try {
          const iterable = handle as unknown as {
            values(): AsyncIterableIterator<FileSystemHandle>
          }
          const items: MentionItem[] = []
          for await (const entry of iterable.values()) {
            if (entry.kind === 'directory' && !SKIP_DIRS.has(entry.name)) {
              items.push({
                id: `dir:${entry.name}`,
                name: entry.name,
                path: `@目录:${entry.name}`,
                kind: 'dir',
                icon: Folder,
              })
            }
          }
          if (!cancelled) setDirItems(items)
        } catch {
          if (!cancelled) setDirItems([])
        }
      }
      void run()
    }
    return () => {
      cancelled = true
    }
  }, [open])

  const semanticItems = React.useMemo<MentionItem[]>(
    () => [
      {
        id: 'sem-codebase',
        name: '#Codebase',
        path: '#Codebase',
        kind: 'semantic',
        icon: Code2,
        desc: t('semanticCodebaseDesc'),
      },
      {
        id: 'sem-terminal',
        name: '#Terminal',
        path: '#Terminal',
        kind: 'semantic',
        icon: Terminal,
        desc: t('semanticTerminalDesc'),
      },
      {
        id: 'sem-docs',
        name: '#Docs',
        path: '#Docs',
        kind: 'semantic',
        icon: BookOpen,
        desc: t('semanticDocsDesc'),
      },
    ],
    [t],
  )

  // 语义源 + 目录 + 文件 统一过滤(对齐现有文件过滤姿势)
  const allItems = React.useMemo<MentionItem[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (item: MentionItem) =>
      !q || item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
    return [
      ...semanticItems.filter(match),
      ...dirItems.filter(match),
      ...files.map((f) => ({ ...f, kind: 'file' as const })).filter(match),
    ]
  }, [query, semanticItems, dirItems, files])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const count = allItems.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (count === 0 ? 0 : Math.min(prev + 1, count - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = allItems[activeIndex]
      if (current) {
        onSelect(current)
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <PortalPanel
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      side="top"
      align="start"
      gap={8}
      testId="file-mention-popover"
      className="flex w-72 flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
    >
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('fileSearchPlaceholder')}
        clearable
        clearAriaLabel={t('clearAriaLabel')}
        wrapperClassName="p-1.5"
      />
      <ul ref={listRef} className="max-h-60 min-h-0 flex-1 overflow-y-auto p-1.5">
        {allItems.length === 0 ? (
          <li className="flex flex-col items-center gap-1 py-8 text-center text-sm text-muted-foreground">
            {t('noMatch')}
          </li>
        ) : (
          allItems.map((item, idx) => {
            const prev = allItems[idx - 1]
            const showHeading =
              idx === 0 ||
              (prev !== undefined &&
                item.kind !== prev.kind &&
                (item.kind === 'semantic' || item.kind === 'dir'))
            const isActive = idx === activeIndex
            const Icon = item.icon ?? FileText
            return (
              <React.Fragment key={`wrap-${item.id}`}>
                {showHeading && (
                  <li className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.kind === 'semantic' ? t('groupSemantic') : t('groupDir')}
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    data-idx={idx}
                    onClick={() => {
                      onSelect(item)
                      onClose()
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'relative flex w-full items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50',
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-sm bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium leading-tight">
                        {item.name}
                      </span>
                      <span className="truncate font-mono text-[10px] leading-snug text-muted-foreground">
                        {item.kind === 'semantic' ? (item.desc ?? item.path) : item.path}
                      </span>
                    </div>
                  </button>
                </li>
              </React.Fragment>
            )
          })
        )}
      </ul>
      <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ↑↓
          </kbd>
          {t('hintSelect')}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            Enter
          </kbd>
          {t('hintConfirm')}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ESC
          </kbd>
          {t('hintClose')}
        </span>
        <span className="ml-auto text-muted-foreground/60">
          {t('hintFilesCount', { n: allItems.length })}
        </span>
      </div>
    </PortalPanel>
  )
}

export default FileMentionPopover
