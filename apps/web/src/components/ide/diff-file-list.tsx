// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { DiffFileStatus, DiffFile } from '@ihui/types'
import { getFileIcon, getFileColor } from './file-icons'
import type { DiffFilterType } from './diff-stats-bar'
import { cn } from '@/lib/utils'
import { useDiffViewModeStore } from '@/lib/diff-view-mode'
import { Tooltip } from '@/components/feedback'
import { useClipboard } from '@/hooks/use-clipboard'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  RotateCcw,
  Eye,
  EyeOff,
  Copy,
  Columns2,
  Rows2,
  FileText,
  ListChecks,
  AlertTriangle,
} from 'lucide-react'

const STATUS_LABEL: Record<DiffFileStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
}

const STATUS_COLOR: Record<DiffFileStatus, string> = {
  added: 'text-green-600 dark:text-green-400',
  modified: 'text-amber-600 dark:text-amber-400',
  deleted: 'text-red-600 dark:text-red-400',
  renamed: 'text-blue-600 dark:text-blue-400',
}

const STATUS_GROUP: { key: DiffFileStatus; labelKey: string }[] = [
  { key: 'modified', labelKey: 'diffFileList.groupModified' },
  { key: 'added', labelKey: 'diffFileList.groupAdded' },
  { key: 'deleted', labelKey: 'diffFileList.groupDeleted' },
  { key: 'renamed', labelKey: 'diffFileList.groupRenamed' },
]

// ============================================================================
// D98①②:审阅态持久化 + 生成文件判定 + 列表筛选(纯函数,可单测,不依赖 store)。
//
// 审阅态存 localStorage(键含 workspace scope,刷新后仍存;D24 落库的是会话,
// 此处是"人审了哪几个文件"的本地审阅进度,与 stores/chat.ts 无字段交叉 ——
// D60 正在改 chat.ts,故本任务不碰其 state shape,冲突声明见交付报告)。
// ============================================================================

/** 审阅态 localStorage 键前缀(后接 scope,见 getReviewedStorageKey) */
export const REVIEWED_LS_PREFIX = 'ide:reviewedDiffFiles'

/** scope(workspacePath) → 存储键;空 scope 回退无后缀键(测试/无工作区场景) */
export function getReviewedStorageKey(scope: string): string {
  return scope ? `${REVIEWED_LS_PREFIX}:${scope}` : REVIEWED_LS_PREFIX
}

/** 读审阅态(损坏/缺失一律回空集合,不抛错) */
export function loadReviewedIds(scope: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(getReviewedStorageKey(scope))
    if (!raw) return new Set()
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((v): v is string => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

/** 写审阅态(配额满/禁用静默忽略,不打断审阅交互) */
export function persistReviewedIds(scope: string, ids: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getReviewedStorageKey(scope), JSON.stringify([...ids]))
  } catch {
    /* localStorage 配额满或禁用时静默忽略 */
  }
}

/** 已审计数(只计仍在本次变更集中的 id,防"文件已不在 diff 里计数虚高") */
export function countReviewed(
  ids: ReadonlySet<string>,
  files: ReadonlyArray<{ id: string }>,
): number {
  let n = 0
  for (const f of files) if (ids.has(f.id)) n++
  return n
}

/** 生成文件判定(产物目录 + 压缩产物 + sourcemap + 锁文件 + 声明文件) */
const GENERATED_RE =
  /(^|\/)(dist|build|out|coverage|\.next|node_modules)\/|(\.min\.(js|mjs|cjs|css)$|\.bundle\.js$|\.chunk\.js$|\.map$|\.d\.ts$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$)/

export function isGeneratedFile(filename: string): boolean {
  return GENERATED_RE.test(filename)
}

export interface ReviewFilterOptions {
  status: DiffFilterType
  searchQuery: string
  hideGenerated: boolean
}

/** 列表筛选:状态(既有语义) × 文件名子串(即 jumpToFile) × 生成文件隐藏 */
export function filterReviewFiles(files: DiffFile[], opts: ReviewFilterOptions): DiffFile[] {
  const q = opts.searchQuery.trim().toLowerCase()
  return files.filter((f) => {
    if (opts.status !== 'all' && f.status !== opts.status) return false
    if (opts.hideGenerated && isGeneratedFile(f.filename)) return false
    if (q && !f.filename.toLowerCase().includes(q)) return false
    return true
  })
}

interface DiffFileListProps {
  filter?: DiffFilterType
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  showActions?: boolean
  /** D98①:已审阅文件 id(受控;持久化由 DiffViewerPane 按 workspace scope 持有) */
  reviewedIds?: Set<string>
  onToggleReviewed?: (id: string) => void
  onMarkAllReviewed?: () => void
  onClearReviewed?: () => void
  /** D98②:文件名筛选(即 jumpToFile 输入) + 生成文件隐藏 */
  searchQuery?: string
  hideGenerated?: boolean
  /** D98②:渲染失败行重试(默认回退 store.fetchDiffFiles) */
  onRetryRender?: () => void
}

export function DiffFileList({
  filter = 'all',
  selectable = false,
  selectedIds,
  onSelectionChange,
  showActions = false,
  reviewedIds,
  onToggleReviewed,
  onMarkAllReviewed,
  onClearReviewed,
  searchQuery = '',
  hideGenerated = false,
  onRetryRender,
}: DiffFileListProps) {
  const { diffFiles, activeDiffFileId, setActiveDiffFile } = useIDEWorkspace()
  const t = useTranslations('ide')
  const showReview = onToggleReviewed !== undefined
  const reviewed: ReadonlySet<string> = reviewedIds ?? EMPTY_REVIEWED

  const filtered = React.useMemo(
    () => filterReviewFiles(diffFiles, { status: filter, searchQuery, hideGenerated }),
    [diffFiles, filter, searchQuery, hideGenerated],
  )

  const groups = React.useMemo(() => {
    const map = new Map<DiffFileStatus, DiffFile[]>()
    for (const f of filtered) {
      if (!map.has(f.status)) map.set(f.status, [])
      map.get(f.status)!.push(f)
    }
    return map
  }, [filtered])

  const reviewedCount = React.useMemo(
    () => countReviewed(reviewed, diffFiles),
    [reviewed, diffFiles],
  )
  const searching = searchQuery.trim().length > 0

  const toggleSelect = (id: string) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  return (
    <div className="flex flex-col gap-1">
      {showReview && diffFiles.length > 0 && (
        <div
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground"
          data-testid="diff-review-summary"
        >
          <Eye className="h-3 w-3 shrink-0" aria-hidden />
          <span className="tabular-nums" data-testid="diff-review-count">
            {t('diffReview.reviewedCount', { viewed: reviewedCount, total: diffFiles.length })}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {onMarkAllReviewed && (
              <button
                type="button"
                onClick={onMarkAllReviewed}
                disabled={reviewedCount >= diffFiles.length}
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="diff-review-mark-all"
              >
                <ListChecks className="h-3 w-3" aria-hidden />
                <span>{t('diffReview.markAllViewed')}</span>
              </button>
            )}
            {onClearReviewed && reviewedCount > 0 && (
              <button
                type="button"
                onClick={onClearReviewed}
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground"
                data-testid="diff-review-clear"
              >
                <EyeOff className="h-3 w-3" aria-hidden />
                <span>{t('diffReview.unmarkAll')}</span>
              </button>
            )}
          </div>
        </div>
      )}
      {STATUS_GROUP.map(({ key, labelKey }) => {
        const files = groups.get(key)
        if (!files?.length) return null
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 px-2 py-0.5 text-muted-foreground">
              <span className="font-medium">{t(labelKey)}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px]">{files.length}</span>
            </div>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                isActive={activeDiffFileId === file.id}
                selectable={selectable}
                isSelected={selectedIds?.has(file.id) ?? false}
                onSelect={toggleSelect}
                onClick={setActiveDiffFile}
                showActions={showActions}
                reviewed={reviewed.has(file.id)}
                showReview={showReview}
                onToggleReviewed={onToggleReviewed}
                onRetryRender={onRetryRender}
              />
            ))}
          </div>
        )
      })}
      {!filtered.length && (
        <div
          className="px-2 py-4 text-center text-muted-foreground"
          data-testid={searching ? 'diff-jump-empty' : 'diff-file-list-empty'}
        >
          {searching ? t('diffReview.jumpToFileEmpty') : t('diffFileList.noMatch')}
        </div>
      )}
    </div>
  )
}

const EMPTY_REVIEWED: ReadonlySet<string> = new Set()

interface FileRowProps {
  file: DiffFile
  isActive: boolean
  selectable: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  onClick: (id: string) => void
  showActions: boolean
  reviewed: boolean
  showReview: boolean
  onToggleReviewed?: (id: string) => void
  onRetryRender?: () => void
}

function FileRow({
  file,
  isActive,
  selectable,
  isSelected,
  onSelect,
  onClick,
  showActions,
  reviewed,
  showReview,
  onToggleReviewed,
  onRetryRender,
}: FileRowProps) {
  const t = useTranslations('ide')
  const clipboard = useClipboard()
  const { success } = useToast()
  // V3 #66:右键「打开方式」写唯一真相源(@/lib/diff-view-mode),与 chat 内联 diff 同一份
  const setDiffViewMode = useDiffViewModeStore((s) => s.setMode)
  const setActiveTopTab = useIDEWorkspace((s) => s.setActiveTopTab)
  const openFile = useIDEWorkspace((s) => s.openFile)
  const fetchDiffFiles = useIDEWorkspace((s) => s.fetchDiffFiles)
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    document.addEventListener('click', close)
    document.addEventListener('contextmenu', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('contextmenu', close, true)
    }
  }, [menuPos])

  // D98②:渲染失败行(文件名缺失/非法)—— 不渲染幽灵行,给可读错误 + 重试出口
  if (!file.filename) {
    return (
      <div
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-red-600 dark:text-red-400"
        data-testid={`diff-render-error-${file.id}`}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t('diffReview.renderError')}</span>
        <button
          type="button"
          onClick={() => (onRetryRender ?? (() => void fetchDiffFiles()))()}
          className="shrink-0 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-muted/60"
          data-testid={`diff-render-retry-${file.id}`}
        >
          <span>{t('diffReview.retry')}</span>
        </button>
      </div>
    )
  }

  const Icon = getFileIcon(file.filename)
  const dir = file.filename.includes('/')
    ? file.filename.slice(0, file.filename.lastIndexOf('/'))
    : ''

  const handleCopyPath = () => {
    setMenuPos(null)
    void clipboard.copy(file.filename).then((ok) => {
      if (ok) success(t('diffReview.pathCopied'))
    })
  }
  const handleOpenWith = (mode: 'split' | 'unified') => {
    setMenuPos(null)
    onClick(file.id)
    setDiffViewMode(mode)
  }
  const handleOpenInEditor = () => {
    setMenuPos(null)
    openFile({
      id: file.id,
      name: file.filename.split('/').pop() ?? file.filename,
      path: file.filename,
      type: 'file',
      language: file.language ?? 'text',
    })
    setActiveTopTab('editor')
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(file.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(file.id)
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setMenuPos({ x: e.clientX, y: e.clientY })
      }}
      className={cn(
        'group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
        isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/50',
        reviewed && 'opacity-70',
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(file.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-3 w-3 shrink-0 accent-foreground"
        />
      )}
      {showReview && onToggleReviewed && (
        <Tooltip content={reviewed ? t('diffReview.markedAsViewed') : t('diffReview.markAsViewed')}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleReviewed(file.id)
            }}
            aria-label={reviewed ? t('diffReview.markAsUnviewed') : t('diffReview.markAsViewed')}
            aria-pressed={reviewed}
            className={cn(
              'shrink-0 rounded-sm p-0.5 transition-colors',
              reviewed
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground/40 hover:bg-muted/60 hover:text-foreground',
            )}
            data-testid={`diff-reviewed-toggle-${file.id}`}
          >
            {reviewed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
        </Tooltip>
      )}
      <span className={cn('w-4 text-center font-mono', STATUS_COLOR[file.status])}>
        {STATUS_LABEL[file.status]}
      </span>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(file.filename))} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{file.filename.split('/').pop()}</span>
        {dir && <span className="truncate text-[10px] text-muted-foreground/50">{dir}</span>}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {showActions && (
          // 非交互占位(2026-09-23 a11y 审计):此处曾是一对 onClick 只做 stopPropagation 的假按钮。
          // 缺的能力:① 暂存 —— toggleStage + stagedIds 是 source-control-panel 的组件局部状态,
          // 未下沉到 ide-workspace store,本表面拿不到;② 放弃更改 —— 全仓无实现
          //(grep 无 `git checkout -- <file>` / discard 动作)。
          // 接线需新增数据流(AGENTS.md §24 要先立项),故降级为非交互 span:
          // 保留操作位视觉但不暗示可点(无 hover 反馈类、无焦点、aria-hidden 不向读屏器播报)。
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded p-0.5 text-muted-foreground" aria-hidden="true">
              <Plus className="h-3 w-3" />
            </span>
            <span className="rounded p-0.5 text-muted-foreground" aria-hidden="true">
              <RotateCcw className="h-3 w-3" />
            </span>
          </div>
        )}
        <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
        <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
      </div>
      {menuPos && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 右键菜单遮罩点击外部关闭;菜单项按钮提供键盘等价交互
        <div
          className="fixed z-popover min-w-36 rounded-md border border-border bg-popover py-1 text-xs shadow-md"
          style={{
            left: Math.min(menuPos.x, window.innerWidth - 180),
            top: Math.min(menuPos.y, window.innerHeight - 170),
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid={`diff-row-menu-${file.id}`}
        >
          <button
            type="button"
            onClick={handleCopyPath}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-accent/40"
            data-testid={`diff-row-copy-path-${file.id}`}
          >
            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{t('diffReview.copyPath')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenWith('split')}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-accent/40"
            data-testid={`diff-row-open-split-${file.id}`}
          >
            <Columns2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{t('diffReview.openWithSplit')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenWith('unified')}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-accent/40"
            data-testid={`diff-row-open-unified-${file.id}`}
          >
            <Rows2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{t('diffReview.openWithUnified')}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-accent/40"
            data-testid={`diff-row-open-editor-${file.id}`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{t('diffReview.openInEditor')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
