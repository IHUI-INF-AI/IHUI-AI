// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// @ 提及浮层 —— 由统一提及引擎驱动(V3 第 61 票,2026-09-27 收口)。
//
// 61 票之前这里只有「工作区文件 + 一层目录 + 三条语义源」四组静态候选,
// 而多维检索 hook `useSearchMentions`(file/folder/symbol/database/web 五类,后端
// GET /api/context/mentions)全仓零调用方 —— 引擎写好了没接线。
// 现在顶部一排维度 tab 由 MENTION_DIMENSIONS(dimensionsForSigil('@')) 推导,
// 非「文件」tab 的候选一律走 useSearchMentions;选中即产出引擎的 MentionSelection,
// 交调用方写进唯一那份 store(context-mention),从而让 MentionChips 真的渲染。
// 本文件不再自己解 trigger、不再自己列维度 —— 那是引擎的事(见守门 W2/W3)。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Code2, Folder, Terminal, FileText } from 'lucide-react'

import { SearchInput } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'
import { useAiPanelStore } from '@/stores/ai-panel'
import { PortalPanel } from '@/components/feedback/portal-panel'
import { isTopOverlay } from '@/lib/overlay-stack'
import { useSearchMentions } from '@/hooks/use-context-mention'
import { useMentionTranslator } from '@/hooks/use-mention-dimension-label'
import { viewOfDimensionId } from '@/components/chat/mention/dimension-views'
import { useContextMentionStore } from '@/stores/context-mention'
import {
  dimensionsForSigil,
  selectionFromSearchMention,
  type MentionDimension,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'

/** 层栈 id(见 @/lib/overlay-stack):@ 提及浮层 open 期间为一层,自有 Esc 只在栈顶消费
 *  (同一 id 传给 PortalPanel 后由其统一 push/pop,两层 Esc 共用同一 isTopOverlay 判定) */
const FILE_MENTION_POPOVER_OVERLAY_ID = 'file-mention-popover'

interface MentionFile {
  id: string
  name: string
  path: string
}

type MentionKind = 'file' | 'dir' | 'semantic' | 'search'

interface MentionRow {
  id: string
  name: string
  /** 副位展示(路径 / 摘要) */
  path: string
  kind: MentionKind
  icon?: LucideIcon
  /** 图标着色类(检索类按维度取,文件类沿用它自身) */
  colorClass?: string
  desc?: string
  /** 选中后进 store 与正文的那份数据 */
  selection: MentionSelection
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  '__pycache__',
  'target',
  'out',
  '.output',
  'venv',
  'env',
])

/**
 * `@` 侧维度由引擎表推导,本文件不得再写维度 id 或 sigil 字面量(守门 W2/W3 的射程):
 *  - 工作区文件/语义源这一组属于 `candidateSource === 'workspace-files'` 的维度;
 *  - 目录这一组属于 `mentionType === 'folder'` 的维度(找不到就并回文件维度,不新造一档)。
 */
const AT_DIMENSIONS = dimensionsForSigil('@')
const WORKSPACE_DIMENSION: MentionDimension = AT_DIMENSIONS.find(
  (d) => d.candidateSource === 'workspace-files',
) as MentionDimension
const FOLDER_DIMENSION: MentionDimension =
  (AT_DIMENSIONS.find((d) => d.mentionType === 'folder') as MentionDimension | undefined) ??
  WORKSPACE_DIMENSION
/** 兜底检索类型:只在维度表未给 mentionType 时用到(静态类目即这一类) */
const DEFAULT_MENTION_TYPE = WORKSPACE_DIMENSION.mentionType ?? 'file'

/** 把一条文件树/目录条目归一成引用(`` `path` ``),与 61 票之前的插入形态逐字一致 */
function backtickSelection(
  dim: MentionDimension,
  entry: { id: string; path: string },
): MentionSelection {
  return {
    id: `${dim.id}:${entry.id}`,
    sigil: dim.sigil,
    dimensionId: dim.id,
    label: entry.path,
    insertText: `\`${entry.path}\``,
  }
}

interface FileMentionPopoverProps {
  files: MentionFile[]
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  /** 选中一条提及:调用方负责写进 store 并把 insertText 落到正文 */
  onSelect: (selection: MentionSelection) => void
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
  const tEngine = useTranslations('chat')
  // tab 标签的命名空间跟着维度表走,不在组件里假定 ns
  const tm = useMentionTranslator()
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [dirItems, setDirItems] = React.useState<MentionRow[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  // 维度 tab 的激活态存在那份唯一状态里(store.activeDimensionId),不在本组件另起一份
  const activeDimensionId = useContextMentionStore((s) => s.activeDimensionId)
  const setActiveDimension = useContextMentionStore((s) => s.setActiveDimension)
  const atDimensions = AT_DIMENSIONS
  const activeDim: MentionDimension =
    atDimensions.find((d) => d.id === activeDimensionId) ?? atDimensions[0]!
  const isSearchDim = activeDim.candidateSource === 'context-search'

  const workspacePath = useAiPanelStore((s) => s.activeWorkspace?.path)
  const search = useSearchMentions(
    query,
    activeDim.mentionType ?? DEFAULT_MENTION_TYPE,
    workspacePath,
    open && isSearchDim,
  )

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
          const items: MentionRow[] = []
          for await (const entry of iterable.values()) {
            if (entry.kind === 'directory' && !SKIP_DIRS.has(entry.name)) {
              const path = `@目录:${entry.name}`
              items.push({
                id: `dir:${entry.name}`,
                name: entry.name,
                path,
                kind: 'dir',
                icon: Folder,
                selection: backtickSelection(FOLDER_DIMENSION, {
                  id: `dir:${entry.name}`,
                  path,
                }),
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

  const semanticItems = React.useMemo<MentionRow[]>(
    () => [
      {
        id: 'sem-codebase',
        name: '#Codebase',
        path: '#Codebase',
        kind: 'semantic',
        icon: Code2,
        desc: t('semanticCodebaseDesc'),
        selection: backtickSelection(WORKSPACE_DIMENSION, {
          id: 'sem-codebase',
          path: '#Codebase',
        }),
      },
      {
        id: 'sem-terminal',
        name: '#Terminal',
        path: '#Terminal',
        kind: 'semantic',
        icon: Terminal,
        desc: t('semanticTerminalDesc'),
        selection: backtickSelection(WORKSPACE_DIMENSION, {
          id: 'sem-terminal',
          path: '#Terminal',
        }),
      },
      {
        id: 'sem-docs',
        name: '#Docs',
        path: '#Docs',
        kind: 'semantic',
        icon: BookOpen,
        desc: t('semanticDocsDesc'),
        selection: backtickSelection(WORKSPACE_DIMENSION, { id: 'sem-docs', path: '#Docs' }),
      },
    ],
    [t],
  )

  // 检索维度的候选:后端统一检索的 ContextMention[] 直接映射(引擎负责 id 与 insertText)
  const searchRows = React.useMemo<MentionRow[]>(() => {
    if (!isSearchDim) return []
    const view = viewOfDimensionId(activeDim.id)
    return (search.data?.mentions ?? []).map((m) => ({
      id: m.id,
      name: m.label,
      path: m.detail ?? m.meta?.path ?? m.label,
      kind: 'search' as const,
      icon: view.icon,
      colorClass: view.colorClass,
      selection: selectionFromSearchMention(activeDim, m),
    }))
  }, [isSearchDim, activeDim, search.data])

  const fileRows = React.useMemo<MentionRow[]>(
    () =>
      files.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        kind: 'file' as const,
        selection: backtickSelection(WORKSPACE_DIMENSION, f),
      })),
    [files],
  )

  // 单维度视图:非文件 tab 只看该维度的检索结果;文件 tab 保持 61 票之前的三组同屏
  const allItems = React.useMemo<MentionRow[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (item: MentionRow) =>
      !q || item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
    if (isSearchDim) return searchRows.filter(match)
    return [...semanticItems.filter(match), ...dirItems.filter(match), ...fileRows.filter(match)]
  }, [query, isSearchDim, searchRows, semanticItems, dirItems, fileRows])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query, activeDimensionId])

  const pick = (row: MentionRow) => {
    onSelect(row.selection)
    onClose()
  }

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
      if (current) pick(current)
    } else if (e.key === 'Escape') {
      if (!isTopOverlay(FILE_MENTION_POPOVER_OVERLAY_ID)) return
      e.preventDefault()
      onClose()
    }
  }

  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const stateLine = !isSearchDim
    ? null
    : search.isFetching
      ? tEngine('mentionEngine.searching')
      : search.isError
        ? tEngine('mentionEngine.loadFailed')
        : allItems.length === 0
          ? tEngine('mentionEngine.noMatch')
          : null

  return (
    <PortalPanel
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      side="top"
      align="start"
      gap={8}
      overlayId={FILE_MENTION_POPOVER_OVERLAY_ID}
      testId="file-mention-popover"
      className="flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-md"
    >
      <div
        className="flex flex-wrap gap-1 p-1.5 pb-0"
        role="tablist"
        data-testid="mention-dimension-tabs"
      >
        {atDimensions.map((dim) => {
          const View = viewOfDimensionId(dim.id)
          const DimIcon = View.icon
          const active = dim.id === activeDim.id
          return (
            <button
              key={dim.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={'mention-dimension-tab-' + dim.labelNs + '.' + dim.labelKey}
              onClick={() => setActiveDimension(dim.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              <DimIcon className={cn('h-3.5 w-3.5 shrink-0', View.colorClass)} />
              <span>{tm(dim.labelNs, dim.labelKey)}</span>
            </button>
          )
        })}
      </div>
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
        {stateLine && allItems.length === 0 ? (
          <li
            className="px-2.5 py-6 text-center text-sm text-muted-foreground"
            data-testid="mention-dimension-state"
          >
            {stateLine}
          </li>
        ) : allItems.length === 0 ? (
          <li className="flex flex-col items-center gap-1 py-8 text-center text-sm text-muted-foreground">
            {t('noMatch')}
          </li>
        ) : (
          allItems.map((item, idx) => {
            const prev = allItems[idx - 1]
            const showHeading =
              !isSearchDim &&
              (idx === 0 ||
                (prev !== undefined &&
                  item.kind !== prev.kind &&
                  (item.kind === 'semantic' || item.kind === 'dir')))
            const isActive = idx === activeIndex
            const Icon = item.icon ?? FileText
            return (
              <React.Fragment key={`wrap-${item.kind}-${item.id}`}>
                {showHeading && (
                  <li className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.kind === 'semantic' ? t('groupSemantic') : t('groupDir')}
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    data-idx={idx}
                    data-testid={`mention-item-${item.selection.id}`}
                    onClick={() => pick(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'relative flex w-full items-start gap-2.5 rounded-sm px-2.5 py-1.5 text-left transition-colors',
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
                    <Icon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        item.colorClass ?? 'text-muted-foreground',
                      )}
                    />
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
