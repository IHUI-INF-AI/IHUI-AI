// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { DiffFile } from '@ihui/types'
import { runCommand, readFile } from '@ihui/api-client'
import { DiffStatsBar, type DiffFilterType } from './diff-stats-bar'
import { DiffFileList } from './diff-file-list'
import {
  loadReviewedIds,
  persistReviewedIds,
  countReviewed,
  filterReviewFiles,
} from './diff-file-list'
import {
  buildUnifiedPatch,
  buildGitApplyCommand,
  type PatchFileInput,
} from '@/components/ai/diff-hunk-controls'
import { useClipboard } from '@/hooks/use-clipboard'
import { useToast } from '@/hooks/use-toast'
import { DiffPreview } from '@/components/ai/diff-preview'
import { InlineDiffViewer, ThreeWayMergeView } from '@/components/ai/inline-diff-viewer'
import {
  attachViewModeMirror,
  useDiffViewModeStore,
  type ViewModeMirror,
} from '@/lib/diff-view-mode'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Loader2,
  Search,
  Eye,
  ExternalLink,
  Copy,
  TriangleAlert,
  RotateCcw,
  GitMerge,
} from 'lucide-react'

type DiffContent = { oldContent: string; newContent: string }

/** 内容加载最大重试次数(超过后展示"重试后仍无法加载",D98③) */
export const MAX_LOAD_RETRIES = 2

export interface DiffViewerPaneProps {
  /**
   * D98④:PR 入口复用 D15 数据 —— 调用方传入环境面板同一 PR URL(见
   * environment-info-popover PullRequestRow 的 snapshot.pullRequest.url),
   * 本面板只做跳转展示,不另建 PR 数据面/查询。缺省不渲染入口。
   */
  pullRequestUrl?: string
  pullRequestNumber?: number
}

export function DiffViewerPane({ pullRequestUrl, pullRequestNumber }: DiffViewerPaneProps = {}) {
  const { diffFiles, activeDiffFileId, setActiveDiffFile, workspacePath } = useIDEWorkspace()
  // V3 #66:档位读唯一真相源(`@/lib/diff-view-mode`,含持久化),与 chat 内联 diff 同一份。
  const diffViewMode = useDiffViewModeStore((s) => s.mode)
  const threeWayOpen = useDiffViewModeStore((s) => s.threeWayOpen)
  const setThreeWayOpen = useDiffViewModeStore((s) => s.setThreeWayOpen)
  const t = useTranslations('ide')
  const [showFileList, setShowFileList] = React.useState(true)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [filter, setFilter] = React.useState<DiffFilterType>('all')
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [contentCache, setContentCache] = React.useState<Map<string, DiffContent>>(new Map())
  const [loadingFileId, setLoadingFileId] = React.useState<string | null>(null)
  // D98②:文件名跳转输入 + 生成文件隐藏(筛选逻辑复用 diff-file-list.filterReviewFiles)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [hideGenerated, setHideGenerated] = React.useState(false)
  // D98①:逐文件已审阅态(scope=workspacePath,localStorage 持久化,刷新后仍存)
  const [reviewedIds, setReviewedIds] = React.useState<Set<string>>(() =>
    loadReviewedIds(workspacePath),
  )
  // D98③:内容加载失败态(可读错误 + 重试;超过 MAX_LOAD_RETRIES 展示终态)
  const [loadErrorFileId, setLoadErrorFileId] = React.useState<string | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)
  const [fetchNonce, setFetchNonce] = React.useState(0)
  // D98⑤(G-135):导出 git apply 命令进行态
  const [exporting, setExporting] = React.useState(false)
  const clipboard = useClipboard()
  const { success: toastSuccess, error: toastError } = useToast()

  const activeIdx = diffFiles.findIndex((f) => f.id === activeDiffFileId)
  const activeDiff = activeIdx >= 0 ? diffFiles[activeIdx] : undefined
  const showList = showFileList && !isFullscreen

  const activeFileId = activeDiff?.id
  const activeFilename = activeDiff?.filename
  const activeStatus = activeDiff?.status

  // ref 镜像缓存,供 effect 内"命中检查"使用,避免把缓存放进 deps 触发重复请求
  const contentCacheRef = React.useRef(contentCache)
  contentCacheRef.current = contentCache

  // 2026-08-02 修复: Bug 10 — contentCache 永不过期,文件修改后显示旧内容。
  // 监听 activeFileId 变化时清空缓存,强制下次重新拉取真实 diff 内容。
  const prevActiveFileIdRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (prevActiveFileIdRef.current !== undefined && prevActiveFileIdRef.current !== activeFileId) {
      // 切换文件时清空旧缓存(防陈旧数据)
      setContentCache(new Map())
      contentCacheRef.current = new Map()
    }
    prevActiveFileIdRef.current = activeFileId
  }, [activeFileId])

  // 选中文件变化时拉取真实 diff 内容(old/new),缓存避免重复请求
  // D98③:任一必需侧拉取失败即记 loadError(给可读错误 + 重试出口,不再静默空内容)
  React.useEffect(() => {
    if (!activeFileId || !activeFilename || !activeStatus || !workspacePath) return
    if (contentCacheRef.current.has(activeFileId)) return

    let cancelled = false
    setLoadingFileId(activeFileId)

    const fetchContent = async () => {
      let oldContent = ''
      let newContent = ''
      let oldOk = activeStatus === 'added'
      let newOk = activeStatus === 'deleted'

      // oldContent: 上一次提交版本(新增文件跳过)
      if (activeStatus !== 'added') {
        try {
          const oldResult = await runCommand({
            command: `git show HEAD:"${activeFilename}"`,
            workspacePath,
            mode: 'read-only',
          })
          if (oldResult.success) {
            oldContent = oldResult.data.stdout
            oldOk = true
          }
        } catch {
          // 失败由下方 loadError 统一呈现
        }
      }

      // newContent: 工作区文件(删除文件跳过)
      if (activeStatus !== 'deleted') {
        try {
          const newResult = await readFile({
            path: `${workspacePath}/${activeFilename}`,
            workspacePath,
          })
          if (newResult.success) {
            newContent = newResult.data.content
            newOk = true
          }
        } catch {
          // 失败由下方 loadError 统一呈现
        }
      }

      if (cancelled) return
      setContentCache((prev) => {
        const next = new Map(prev)
        next.set(activeFileId, { oldContent, newContent })
        return next
      })
      setLoadingFileId((curr) => (curr === activeFileId ? null : curr))
      setLoadErrorFileId(!oldOk || !newOk ? activeFileId : null)
    }

    void fetchContent()
    return () => {
      cancelled = true
    }
  }, [activeFileId, activeFilename, activeStatus, workspacePath, fetchNonce])

  // D98①:workspace 切换时落盘旧 scope 审阅态并载入新 scope(防跨工作区串态)
  const reviewedIdsRef = React.useRef(reviewedIds)
  reviewedIdsRef.current = reviewedIds
  const scopeRef = React.useRef(workspacePath)
  React.useEffect(() => {
    if (scopeRef.current === workspacePath) return
    persistReviewedIds(scopeRef.current, reviewedIdsRef.current)
    scopeRef.current = workspacePath
    setReviewedIds(loadReviewedIds(workspacePath))
  }, [workspacePath])

  // D98①:审阅态变更即落盘(刷新后仍存);diff 集变化时剪掉已不在集中的 id(防计数虚高)
  React.useEffect(() => {
    persistReviewedIds(scopeRef.current, reviewedIds)
  }, [reviewedIds])
  React.useEffect(() => {
    setReviewedIds((prev) => {
      if (prev.size === 0) return prev
      const alive = new Set<string>()
      for (const f of diffFiles) if (prev.has(f.id)) alive.add(f.id)
      return alive.size === prev.size ? prev : alive
    })
  }, [diffFiles])

  // V3 #66:把 IDE store 里那份遗留档位接成唯一真相源的镜像 ——
  // `diff-stats-bar.tsx` 的切换按钮仍写 `useIDEWorkspace`(该文件与 store 都不在本票可改范围),
  // 不接桥就会点一下没反应。方向语义:真相源永远是 lib store,mirror 只负责"显示与点击都成立"。
  React.useEffect(() => {
    const mirror: ViewModeMirror = {
      get: () => useIDEWorkspace.getState().diffViewMode,
      set: (mode) => useIDEWorkspace.getState().setDiffViewMode(mode),
      subscribe: (listener) =>
        useIDEWorkspace.subscribe((state, prev) => {
          if (state.diffViewMode !== prev.diffViewMode) listener()
        }),
    }
    return attachViewModeMirror(mirror)
  }, [])

  // V3 #66:三方合并的三份内容 —— 优先取 git 索引的 stage 1/2/3(真正处于冲突态时),
  // 不在冲突态则退到「共同祖先 = HEAD,当前 = 工作区,传入 = HEAD」(即无传入改动,块全部自动可解)。
  const [threeWayContents, setThreeWayContents] = React.useState<{
    base: string
    ours: string
    theirs: string
    conflicted: boolean
  } | null>(null)
  const [threeWayBusy, setThreeWayBusy] = React.useState(false)
  const [threeWayNonce, setThreeWayNonce] = React.useState(0)
  React.useEffect(() => {
    if (!threeWayOpen || !activeFilename || !workspacePath) return
    let cancelled = false
    setThreeWayBusy(true)
    const readStage = async (stage: 1 | 2 | 3): Promise<string | null> => {
      try {
        const r = await runCommand({
          command: `git show :${stage}:"${activeFilename}"`,
          workspacePath,
          mode: 'read-only',
        })
        return r.success ? r.data.stdout : null
      } catch {
        return null
      }
    }
    void (async () => {
      const st1 = await readStage(1)
      const st2 = await readStage(2)
      const st3 = await readStage(3)
      const conflicted = st2 !== null && st3 !== null
      let base = st1
      let ours = st2
      let theirs = st3
      if (base === null) {
        try {
          const r = await runCommand({
            command: `git show HEAD:"${activeFilename}"`,
            workspacePath,
            mode: 'read-only',
          })
          base = r.success ? r.data.stdout : ''
        } catch {
          base = ''
        }
      }
      if (ours === null) {
        try {
          const r = await readFile({ path: `${workspacePath}/${activeFilename}`, workspacePath })
          ours = r.success ? r.data.content : ''
        } catch {
          ours = ''
        }
      }
      // 无 stage 3 ⇒ 没有"传入"这一侧,以祖先充当(全部块自动可解),而不是伪造一份改动
      if (theirs === null) theirs = base
      if (cancelled) return
      setThreeWayContents({ base, ours, theirs, conflicted })
      setThreeWayBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [threeWayOpen, activeFilename, workspacePath, threeWayNonce])

  // D98③:切换文件时重置失败/重试计数
  React.useEffect(() => {
    setLoadErrorFileId(null)
    setRetryCount(0)
    setThreeWayContents(null)
  }, [activeFileId])

  const toggleReviewed = React.useCallback((id: string) => {
    setReviewedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const markAllReviewed = React.useCallback(() => {
    setReviewedIds(new Set(diffFiles.map((f) => f.id)))
  }, [diffFiles])
  const clearReviewed = React.useCallback(() => {
    setReviewedIds(new Set())
  }, [])
  const reviewedCount = countReviewed(reviewedIds, diffFiles)

  // D98②:跳转目标(与列表同一筛选语义);回车跳首个匹配
  const jumpTargets = React.useMemo(
    () => filterReviewFiles(diffFiles, { status: filter, searchQuery, hideGenerated }),
    [diffFiles, filter, searchQuery, hideGenerated],
  )
  const handleJumpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const first = jumpTargets[0]
    if (first) setActiveDiffFile(first.id)
  }

  // D98③:重试当前文件(清缓存 + 计数 + 触发重拉)
  const handleRetryLoad = React.useCallback(() => {
    if (!activeFileId) return
    setContentCache((prev) => {
      const next = new Map(prev)
      next.delete(activeFileId)
      return next
    })
    setLoadErrorFileId(null)
    setRetryCount((c) => c + 1)
    setFetchNonce((n) => n + 1)
  }, [activeFileId])

  // D98⑤(G-135):一键导出可执行迁移命令(缺失侧按需拉取 → patch → heredoc 命令 → 剪贴板 + 成功 toast)
  const handleCopyGitApply = React.useCallback(async () => {
    if (exporting || diffFiles.length === 0 || !workspacePath) return
    setExporting(true)
    try {
      const inputs: PatchFileInput[] = []
      for (const f of diffFiles) {
        const cached = contentCacheRef.current.get(f.id)
        let oldContent = cached?.oldContent ?? f.oldContent ?? ''
        let newContent = cached?.newContent ?? f.newContent ?? ''
        if (f.status !== 'added' && oldContent === '') {
          try {
            const r = await runCommand({
              command: `git show HEAD:"${f.filename}"`,
              workspacePath,
              mode: 'read-only',
            })
            if (r.success) oldContent = r.data.stdout
          } catch {
            /* 缺失则保留空串,buildUnifiedPatch 跳过无改动文件 */
          }
        }
        if (f.status !== 'deleted' && newContent === '') {
          try {
            const r = await readFile({ path: `${workspacePath}/${f.filename}`, workspacePath })
            if (r.success) newContent = r.data.content
          } catch {
            /* 同上 */
          }
        }
        inputs.push({ filename: f.filename, oldContent, newContent })
      }
      const patch = buildUnifiedPatch(inputs)
      if (!patch) {
        toastError(t('diffReview.copyGitApplyEmpty'))
        return
      }
      const ok = await clipboard.copy(buildGitApplyCommand(patch))
      if (ok) toastSuccess(t('diffReview.copyGitApplyToast'))
      else toastError(t('diffReview.copyGitApplyFailed'))
    } finally {
      setExporting(false)
    }
  }, [exporting, diffFiles, workspacePath, clipboard, toastSuccess, toastError, t])

  // 当前活动文件的有效内容(优先用缓存,回退到 DiffFile 原始字段)
  const cached = activeDiff ? contentCache.get(activeDiff.id) : undefined
  const effectiveOld = cached?.oldContent ?? activeDiff?.oldContent ?? ''
  const effectiveNew = cached?.newContent ?? activeDiff?.newContent ?? ''
  const isLoading = loadingFileId !== null && loadingFileId === activeDiffFileId
  const effectiveDiff: DiffFile | undefined = activeDiff
    ? { ...activeDiff, oldContent: effectiveOld, newContent: effectiveNew }
    : undefined

  const goPrev = () => {
    const prev = diffFiles[activeIdx - 1]
    if (prev) setActiveDiffFile(prev.id)
  }
  const goNext = () => {
    const next = diffFiles[activeIdx + 1]
    if (next) setActiveDiffFile(next.id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DiffStatsBar
        filter={filter}
        onFilterChange={setFilter}
        onCommit={() => setSelectedIds(new Set())}
      />
      {/* D98②④⑤:审阅工具条 —— 文件跳转 / 生成文件隐藏 / 已审计数 / PR 入口 / 导出迁移命令 */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1 text-xs">
        <div className="flex min-w-0 items-center gap-1 rounded-sm border border-border/60 bg-background px-1.5 py-0.5">
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleJumpKeyDown}
            placeholder={t('diffReview.jumpToFile')}
            aria-label={t('diffReview.jumpToFile')}
            className="w-28 bg-transparent outline-none placeholder:text-muted-foreground/60"
            data-testid="diff-jump-input"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1 text-muted-foreground">
          <input
            type="checkbox"
            checked={hideGenerated}
            onChange={(e) => setHideGenerated(e.target.checked)}
            className="h-3 w-3 shrink-0 accent-foreground"
            data-testid="diff-hide-generated"
          />
          <span>{t('diffReview.hideGenerated')}</span>
        </label>
        {/* V3 #66:三方合并入口(与 unified/split 档位正交:它换的是"内容来源",不是排版) */}
        <button
          type="button"
          onClick={() => {
            setThreeWayOpen(!threeWayOpen)
            setThreeWayNonce((n) => n + 1)
          }}
          disabled={!activeDiff}
          aria-pressed={threeWayOpen}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            threeWayOpen
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
          data-testid="diff-3way-toggle"
        >
          <GitMerge className="h-3 w-3" aria-hidden />
          <span>{t('diffViewer.threeWayView')}</span>
        </button>
        {threeWayOpen && threeWayContents && (
          <span
            className="shrink-0 text-[10px] text-muted-foreground"
            data-testid="diff-3way-source"
          >
            {threeWayContents.conflicted
              ? t('diffViewer.threeWayFromStages')
              : t('diffViewer.threeWayNoConflictSource')}
          </span>
        )}
        {diffFiles.length > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
            data-testid="diff-pane-review-count"
          >
            <Eye className="h-3 w-3" aria-hidden />
            <span className="tabular-nums">
              {t('diffReview.reviewedCount', { viewed: reviewedCount, total: diffFiles.length })}
            </span>
          </span>
        )}
        {pullRequestUrl && (
          <a
            href={pullRequestUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            data-testid="diff-pr-link"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span>
              {t('diffReview.viewPullRequest')}
              {pullRequestNumber !== undefined ? ` #${pullRequestNumber}` : ''}
            </span>
          </a>
        )}
        <button
          type="button"
          onClick={() => void handleCopyGitApply()}
          disabled={exporting || diffFiles.length === 0}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="diff-copy-git-apply"
        >
          {exporting ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Copy className="h-3 w-3" aria-hidden />
          )}
          <span>{t('diffReview.copyGitApply')}</span>
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        {showList && (
          <div className="w-56 shrink-0 overflow-auto bg-muted/20 p-1">
            <DiffFileList
              filter={filter}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              showActions
              reviewedIds={reviewedIds}
              onToggleReviewed={toggleReviewed}
              onMarkAllReviewed={markAllReviewed}
              onClearReviewed={clearReviewed}
              searchQuery={searchQuery}
              hideGenerated={hideGenerated}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1 text-xs">
            <button
              onClick={() => setShowFileList(!showFileList)}
              className="flex items-center rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              {showFileList ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            <span className="truncate text-muted-foreground">
              {activeDiff?.filename ?? t('diffViewer.selectFile')}
            </span>
            {activeDiff && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={goPrev}
                  disabled={activeIdx <= 0}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={goNext}
                  disabled={activeIdx >= diffFiles.length - 1}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <span className="text-muted-foreground">
                  {activeIdx + 1}/{diffFiles.length}
                </span>
              </div>
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </button>
          </div>
          {effectiveDiff && <ChangeSummary file={effectiveDiff} />}
          {/* D98③:内容加载失败可读横幅(首次失败给原因 + 重试;超限给终态) */}
          {loadErrorFileId !== null && loadErrorFileId === activeDiffFileId && (
            <div
              className="flex items-center gap-1.5 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-400"
              data-testid="diff-content-error"
            >
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {retryCount >= MAX_LOAD_RETRIES
                  ? t('diffReview.loadFailedAfterRetrying')
                  : t('diffReview.fullContentLoadFailed')}
              </span>
              <button
                type="button"
                onClick={handleRetryLoad}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-red-500/15"
                data-testid="diff-content-retry"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                <span>{t('diffReview.retry')}</span>
              </button>
            </div>
          )}
          <div className="flex-1 overflow-auto">
            {isLoading && (
              <div
                className="flex h-full items-center justify-center text-xs text-muted-foreground"
                data-testid="diff-content-loading"
              >
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t('diffReview.loading')}
              </div>
            )}
            {threeWayOpen && effectiveDiff && threeWayBusy && (
              <div
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground"
                data-testid="diff-3way-loading"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                <span>{t('diffReview.loading')}</span>
              </div>
            )}
            {threeWayOpen && effectiveDiff && !threeWayBusy && threeWayContents && (
              <ThreeWayMergeView
                base={threeWayContents.base}
                ours={threeWayContents.ours}
                theirs={threeWayContents.theirs}
              />
            )}
            {!threeWayOpen && !isLoading && effectiveDiff && diffViewMode === 'split' && (
              <DiffPreview
                oldContent={effectiveOld}
                newContent={effectiveNew}
                language={effectiveDiff.language}
                filename={effectiveDiff.filename}
              />
            )}
            {!threeWayOpen && !isLoading && effectiveDiff && diffViewMode === 'unified' && (
              <InlineDiffViewer
                oldContent={effectiveOld}
                newContent={effectiveNew}
                filename={effectiveDiff.filename}
              />
            )}
            {!isLoading && !effectiveDiff && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t('diffViewer.selectToCompare')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangeSummary({ file }: { file: DiffFile }) {
  const t = useTranslations('ide')
  const total = file.additions + file.deletions
  const pct = total > 0 ? Math.round((file.additions / total) * 100) : 0
  // 2026-08-02 修复: Bug 11 — useMemo 依赖整个 file 对象(引用每次变,useMemo 失效),
  // 改为依赖具体的 oldContent/newContent 字符串,内容不变时 memo 命中。
  const blocks = React.useMemo(
    () => countChangeBlocks(file.oldContent, file.newContent),
    [file.oldContent, file.newContent],
  )
  const preview = React.useMemo(
    () => computeWordDiffPreview(file.oldContent, file.newContent),
    [file.oldContent, file.newContent],
  )

  return (
    <div className="flex flex-col gap-1 bg-muted/20 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
          <Plus className="h-3 w-3" />
          {file.additions}
        </span>
        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
          <Minus className="h-3 w-3" />
          {file.deletions}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="flex h-1 w-16 overflow-hidden rounded-sm bg-muted">
            <div className="h-full bg-green-500/70" style={{ width: `${pct}%` }} />
            <div className="h-full bg-red-500/70" style={{ width: `${100 - pct}%` }} />
          </div>
          <span className="text-muted-foreground">{t('diffViewer.addPct', { pct })}</span>
        </div>
        <span className="text-muted-foreground">
          {t('diffViewer.changeBlocks', { count: blocks })}
        </span>
      </div>
      {preview && (
        <div className="flex flex-wrap items-center gap-0.5 font-mono text-[11px]">
          <span className="text-muted-foreground">{t('diffViewer.wordLevel')}</span>
          {preview.map((tok, i) => (
            <span
              key={i}
              className={cn(
                'rounded-sm px-0.5',
                tok.type === 'add' && 'bg-green-500/20 text-green-600 dark:text-green-400',
                tok.type === 'del' && 'bg-red-500/20 text-red-600 dark:text-red-400 line-through',
              )}
            >
              {tok.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

type WordToken = { text: string; type: 'eq' | 'del' | 'add' }

function computeWordDiffPreview(oldContent: string, newContent: string): WordToken[] | null {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
    const ol = oldLines[i] ?? ''
    const nl = newLines[i] ?? ''
    if (ol !== nl && ol.trim() && nl.trim()) {
      return wordDiff(ol, nl)
        .filter((t) => t.type !== 'eq')
        .slice(0, 10)
    }
  }
  return null
}

function wordDiff(a: string, b: string): WordToken[] {
  const aw = a.split(/(\s+)/).filter((w) => w.length > 0)
  const bw = b.split(/(\s+)/).filter((w) => w.length > 0)
  const m = aw.length
  const n = bw.length
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]
    const nextRow = dp[i + 1]
    if (!row || !nextRow) continue
    for (let j = n - 1; j >= 0; j--) {
      if ((aw[i] ?? '') === (bw[j] ?? '')) {
        row[j] = (nextRow[j + 1] ?? 0) + 1
      } else {
        row[j] = Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0)
      }
    }
  }
  const result: WordToken[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    const ai = aw[i] ?? ''
    const bj = bw[j] ?? ''
    if (ai === bj) {
      result.push({ text: ai, type: 'eq' })
      i++
      j++
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      result.push({ text: ai, type: 'del' })
      i++
    } else {
      result.push({ text: bj, type: 'add' })
      j++
    }
  }
  while (i < m) result.push({ text: aw[i++] ?? '', type: 'del' })
  while (j < n) result.push({ text: bw[j++] ?? '', type: 'add' })
  return result
}

function countChangeBlocks(oldContent: string, newContent: string): number {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const maxLen = Math.max(oldLines.length, newLines.length)
  let blocks = 0
  let inBlock = false
  for (let i = 0; i < maxLen; i++) {
    const diff = (oldLines[i] ?? '') !== (newLines[i] ?? '')
    if (diff) {
      if (!inBlock) {
        blocks++
        inBlock = true
      }
    } else {
      inBlock = false
    }
  }
  return blocks
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
