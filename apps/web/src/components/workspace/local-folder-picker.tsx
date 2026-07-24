'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  ArrowUp,
  CornerDownLeft,
  Folder,
  FolderOpen,
  HardDrive,
  Keyboard,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import { Button, Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ihui/ui-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import {
  browseDirectory,
  openWorkspace,
  type BrowseEntry,
  type WorkspacePermission,
} from '@ihui/api-client/endpoints/workspace'
import { cn } from '@/lib/utils'
import { WorkspacePermissionDialog } from './workspace-permission-dialog'

interface LocalFolderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onWorkspaceOpened?: (path: string, name: string, perm: WorkspacePermission | null) => void
}

// =============================================================================
// 浏览器能力检测 & 原生选择器
// =============================================================================

/** 浏览器能力检测:仅识别 showDirectoryPicker(主路径) */
function detectPickerCapability(): {
  showDirectoryPicker: boolean
} {
  if (typeof window === 'undefined') {
    return { showDirectoryPicker: false }
  }
  const w = window as unknown as {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
  return {
    showDirectoryPicker: typeof w.showDirectoryPicker === 'function',
  }
}

/** 弹系统原生选择器,只返回 handle.name(浏览器安全模型不暴露真实绝对路径) */
async function pickDirectoryNative(): Promise<string | null> {
  const w = window as unknown as {
    showDirectoryPicker?: (opts?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
  if (typeof w.showDirectoryPicker !== 'function') return null
  try {
    const handle = await w.showDirectoryPicker({ mode: 'read' })
    return handle.name
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return null
    throw err
  }
}

// =============================================================================
// 路径工具
// =============================================================================

function isWindowsPath(p: string): boolean {
  return /^[A-Za-z]:[\\/]?/.test(p)
}

function isUnixPath(p: string): boolean {
  return p.startsWith('/')
}

function normalizeSep(p: string): string {
  return isWindowsPath(p) ? p.replace(/\//g, '\\') : p
}

function parentPath(path: string): string {
  if (!path) return ''
  const p = normalizeSep(path).replace(/[\\/]+$/, '')
  if (isWindowsPath(p)) {
    if (/^[A-Za-z]:$/.test(p)) return ''
    const idx = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
    if (idx < 0) return ''
    if (idx === 2) return p.slice(0, 3)
    return p.slice(0, idx)
  }
  if (isUnixPath(p)) {
    if (p === '/') return ''
    const idx = p.lastIndexOf('/')
    if (idx === 0) return '/'
    return p.slice(0, idx)
  }
  return ''
}

function buildBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  if (!path) return []
  const p = normalizeSep(path)
  if (isWindowsPath(p)) {
    const m = p.match(/^([A-Za-z]:)([\\\/])(.*)$/)
    if (!m) return []
    const drive = m[1] ?? ''
    const rest = m[3] ?? ''
    const sep = '\\'
    const parts = rest.split(/[\\/]/).filter(Boolean)
    const items: Array<{ label: string; path: string }> = []
    items.push({ label: drive, path: `${drive}${sep}` })
    let acc = `${drive}${sep}`
    for (const part of parts) {
      acc = `${acc}${part}${sep}`
      items.push({ label: part, path: acc })
    }
    return items
  }
  if (isUnixPath(p)) {
    const parts = p.split('/').filter(Boolean)
    const items: Array<{ label: string; path: string }> = [{ label: '/', path: '/' }]
    let acc = ''
    for (const part of parts) {
      acc = `${acc}/${part}`
      items.push({ label: part, path: acc })
    }
    return items
  }
  return []
}

function basenameOf(p: string): string {
  if (!p) return ''
  const trimmed = normalizeSep(p).replace(/[\\/]+$/, '')
  const parts = trimmed.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? trimmed
}

// =============================================================================
// 子组件:PathNav — 面包屑 / 路径输入 二合一
// =============================================================================

interface PathNavProps {
  currentPath: string
  onNavigate: (path: string) => void
  onRefresh: () => void
  isRefreshing: boolean
  t: ReturnType<typeof useTranslations<'workspace.folderPicker'>>
}

/**
 * 位置栏 — 两种模式:
 *   - breadcrumb: 可点击面包屑(默认)
 *   - input: 输入框(回车跳转,Esc 取消)
 * 通过右侧 ⌨ 按钮切换。
 */
function PathNav({ currentPath, onNavigate, onRefresh, isRefreshing, t }: PathNavProps) {
  const [mode, setMode] = React.useState<'breadcrumb' | 'input'>('breadcrumb')
  const [draft, setDraft] = React.useState(currentPath)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 跟随 currentPath 同步草稿
  React.useEffect(() => {
    setDraft(currentPath)
  }, [currentPath])

  // 切到 input 模式自动聚焦
  React.useEffect(() => {
    if (mode === 'input') {
      const id = window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
      return () => window.clearTimeout(id)
    }
    return
  }, [mode])

  const crumbs = React.useMemo(() => buildBreadcrumbs(currentPath), [currentPath])
  const isAtRoot = !currentPath

  const commitInput = () => {
    const p = draft.trim()
    if (p && p !== currentPath) {
      onNavigate(normalizeSep(p))
    }
    setMode('breadcrumb')
  }

  const cancelInput = () => {
    setDraft(currentPath)
    setMode('breadcrumb')
  }

  if (mode === 'input') {
    return (
      <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 ring-1 ring-amber-500/30">
        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitInput()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelInput()
            }
          }}
          placeholder={t('manualPathPlaceholder')}
          spellCheck={false}
          autoComplete="off"
          className="h-6 min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancelInput}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('cancel')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Esc</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5">
      {/* 此电脑 / 根 入口 */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onNavigate('')}
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
                isAtRoot
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-label={t('computer')}
            >
              <HardDrive className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('computer')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {crumbs.length > 0 && (
        <>
          <span className="select-none text-muted-foreground/30">/</span>
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
            {crumbs.map((bc, idx) => {
              const isLast = idx === crumbs.length - 1
              return (
                <React.Fragment key={bc.path}>
                  {idx > 0 && (
                    <span className="select-none text-muted-foreground/30">/</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate(bc.path)}
                    title={bc.path}
                    className={cn(
                      'inline-flex h-6 max-w-[12rem] shrink-0 items-center truncate rounded px-1.5 text-xs transition-colors',
                      isLast
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {bc.label}
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        </>
      )}

      {isAtRoot && (
        <span className="flex-1 truncate text-xs text-muted-foreground/80">
          {t('rootHint')}
        </span>
      )}

      {/* 切换到路径输入 */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setMode('input')}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('advancedPath')}
            >
              <Keyboard className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('advancedPath')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* 刷新 */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label={t('refresh')}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('refresh')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// =============================================================================
// 子组件:列表项
// =============================================================================

interface EntryRowProps {
  entry: BrowseEntry
  isSelected: boolean
  onSelect: (entry: BrowseEntry) => void
  onOpen: (entry: BrowseEntry) => void
}

function EntryRow({ entry, isSelected, onSelect, onOpen }: EntryRowProps) {
  const t = useTranslations('workspace.folderPicker')
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry)}
        onDoubleClick={() => onOpen(entry)}
        data-selected={isSelected}
        title={entry.path}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
          isSelected
            ? 'bg-amber-500/15 text-foreground'
            : 'text-foreground hover:bg-muted/60',
        )}
      >
        <Folder
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            isSelected ? 'text-amber-500' : 'text-amber-500/70 group-hover:text-amber-500',
          )}
        />
        <span className="flex-1 truncate font-medium">{entry.name}</span>
        <span
          className={cn(
            'inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1.5 text-[10px] font-medium transition-colors',
            isSelected
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
              : 'text-muted-foreground/50 group-hover:text-muted-foreground',
          )}
        >
          <CornerDownLeft className="h-2.5 w-2.5" />
          {t('rowOpenHint')}
        </span>
      </button>
    </li>
  )
}

// =============================================================================
// 主组件
// =============================================================================

/**
 * 本地文件夹选择器 — Finder / Explorer 风格:
 *
 *   1. 位置栏(置顶) — 面包屑 / 路径输入 二合一,⌨ 切换
 *   2. 工具栏 — 筛选(实时过滤) + 父级(常驻,根时禁用) + 系统选择器
 *   3. 文件夹列表 — 单击选中(amber 高亮),双击进入,Enter 进入/打开,Backspace 上一级
 *   4. 错误条 — 统一展示(amber 警告 / destructive 错误)
 *   5. Footer(背景对比) — 左侧选中信息,右侧 取消 / 打开
 */
export function LocalFolderPicker({
  open,
  onOpenChange,
  onWorkspaceOpened,
}: LocalFolderPickerProps) {
  const t = useTranslations('workspace.folderPicker')
  const queryClient = useQueryClient()

  const [currentPath, setCurrentPath] = React.useState<string>('')
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [filter, setFilter] = React.useState<string>('')
  const [permDialogPath, setPermDialogPath] = React.useState<{
    path: string
    name: string
    techStack: string[]
  } | null>(null)
  const [nativeHint, setNativeHint] = React.useState<string | null>(null)

  const listRef = React.useRef<HTMLUListElement>(null)

  const capability = React.useMemo(
    () => (open ? detectPickerCapability() : { showDirectoryPicker: false }),
    [open],
  )

  // 重置:每次打开从根开始
  React.useEffect(() => {
    if (open) {
      setCurrentPath('')
      setSelectedPath('')
      setFilter('')
      setNativeHint(null)
    }
  }, [open])

  // 浏览当前目录
  const {
    data: browseData,
    isLoading: browsing,
    isFetching: fetching,
    refetch: refetchBrowse,
    error: browseError,
  } = useQuery({
    queryKey: ['workspace', 'fs-browse', currentPath],
    queryFn: async () => {
      const res = await browseDirectory(currentPath || undefined)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: open,
    staleTime: 5_000,
    retry: 1,
  })

  // 打开工作区
  const openMutation = useMutation({
    mutationFn: async (path: string) => {
      const res = await openWorkspace(path)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace', 'recent'] })
      if (data.needsPermissionSetup) {
        setPermDialogPath({
          path: data.path,
          name: data.name,
          techStack: data.techStack,
        })
      } else {
        onWorkspaceOpened?.(data.path, data.name, data.permission)
        onOpenChange(false)
      }
    },
  })

  const sortedDirs = React.useMemo(() => {
    const list = browseData?.entries ?? []
    return list
      .filter((e) => e.isDir)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [browseData])
  const filteredDirs = React.useMemo(() => {
    if (!filter.trim()) return sortedDirs
    const f = filter.toLowerCase()
    return sortedDirs.filter((d) => d.name.toLowerCase().includes(f))
  }, [sortedDirs, filter])

  const parent = React.useMemo(() => parentPath(currentPath), [currentPath])
  const canGoParent = !!parent && parent !== currentPath

  const selectedEntry = React.useMemo(
    () => sortedDirs.find((d) => d.path === selectedPath) ?? null,
    [sortedDirs, selectedPath],
  )

  // 浏览路径变化时清空选中(旧选中的文件夹已不在视图)
  React.useEffect(() => {
    if (selectedPath && !sortedDirs.some((d) => d.path === selectedPath)) {
      setSelectedPath('')
    }
  }, [sortedDirs, selectedPath])

  // 滚动到顶部
  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [currentPath])

  // 当 selectedPath 变化时,确保可见
  React.useEffect(() => {
    if (!listRef.current || !selectedPath) return
    const btn = listRef.current.querySelector<HTMLElement>(
      `[data-selected="true"]`,
    )
    btn?.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])

  // 导航(面包屑 / 此电脑 / 路径输入回车)
  const navigateTo = React.useCallback((path: string) => {
    setCurrentPath(path)
    setSelectedPath('')
    setFilter('')
    setNativeHint(null)
  }, [])

  // 进入文件夹(双击 / Enter on selected)
  const enterDirectory = React.useCallback((entry: BrowseEntry) => {
    setCurrentPath(entry.path)
    setSelectedPath('')
    setFilter('')
  }, [])

  // 选中文件夹(单击 / 键盘 ↑↓)
  const selectEntry = React.useCallback((entry: BrowseEntry) => {
    setSelectedPath(entry.path)
  }, [])

  // 上一级
  const goParent = React.useCallback(() => {
    if (canGoParent) navigateTo(parent)
  }, [canGoParent, parent, navigateTo])

  // 打开(底部按钮 / Enter on list when no selection)
  const openTarget = selectedPath || currentPath
  const openSelected = React.useCallback(() => {
    if (openTarget) openMutation.mutate(openTarget)
  }, [openTarget, openMutation])

  // 列表键盘导航
  const handleListKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (filteredDirs.length === 0) {
        if (e.key === 'Backspace') {
          e.preventDefault()
          goParent()
        }
        return
      }
      const currentIdx = filteredDirs.findIndex((d) => d.path === selectedPath)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, filteredDirs.length - 1)
        const nextEntry = filteredDirs[next]
        if (nextEntry) setSelectedPath(nextEntry.path)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = currentIdx < 0 ? filteredDirs.length - 1 : Math.max(currentIdx - 1, 0)
        const nextEntry = filteredDirs[next]
        if (nextEntry) setSelectedPath(nextEntry.path)
      } else if (e.key === 'Home') {
        e.preventDefault()
        const first = filteredDirs[0]
        if (first) setSelectedPath(first.path)
      } else if (e.key === 'End') {
        e.preventDefault()
        const last = filteredDirs[filteredDirs.length - 1]
        if (last) setSelectedPath(last.path)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectedEntry) {
          enterDirectory(selectedEntry)
        } else if (openTarget) {
          openSelected()
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        goParent()
      }
    },
    [filteredDirs, selectedPath, selectedEntry, enterDirectory, openSelected, goParent, openTarget],
  )

  // 系统原生选择器(只填文件夹名,提示用户补全)
  const handleNativePick = async () => {
    setNativeHint(null)
    try {
      const name = await pickDirectoryNative()
      if (name) {
        setNativeHint(t('nativePickHint', { name }))
      }
    } catch (err) {
      setNativeHint((err as Error).message)
    }
  }

  const handlePermissionSaved = (perm: WorkspacePermission) => {
    onWorkspaceOpened?.(perm.workspacePath, perm.name, perm)
    setPermDialogPath(null)
    onOpenChange(false)
  }

  const canOpen = !!openTarget && !openMutation.isPending
  const selectedName = selectedEntry?.name ?? (currentPath ? basenameOf(currentPath) : '')

  // 错误信息
  const errorMessage = browseError
    ? (browseError as Error).message
    : openMutation.isError
      ? (openMutation.error as Error).message
      : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl gap-0 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <DialogHeader className="px-5 pb-4 pt-5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4 text-amber-500" />
              <span>{t('title')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">{t('description')}</DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="space-y-2.5 px-5 pb-4">
            {/* 位置栏 */}
            <PathNav
              currentPath={currentPath}
              onNavigate={navigateTo}
              onRefresh={() => void refetchBrowse()}
              isRefreshing={fetching && !browsing}
              t={t}
            />

            {/* 工具栏:筛选 + 父级 + 系统选择器 */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t('filterPlaceholder')}
                  className="h-8 pl-8 pr-8 text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
                {filter && (
                  <button
                    type="button"
                    onClick={() => setFilter('')}
                    className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={t('clearFilter')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* 父级(常驻,根时禁用) */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={goParent}
                      disabled={!canGoParent || openMutation.isPending}
                      aria-label={t('parent')}
                      className="h-8 w-8 shrink-0"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('parent')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 系统选择器 */}
              {capability.showDirectoryPicker && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => void handleNativePick()}
                        disabled={openMutation.isPending}
                        aria-label={t('nativePick')}
                        className="h-8 w-8 shrink-0"
                      >
                        <HardDrive className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('nativePick')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* 列表 */}
            <div className="overflow-hidden rounded-md border bg-card">
              <ul
                ref={listRef}
                tabIndex={0}
                role="listbox"
                aria-label={t('title')}
                onKeyDown={handleListKeyDown}
                className="max-h-72 space-y-0.5 overflow-y-auto p-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30"
              >
                {browsing ? (
                  <li>
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('loading')}
                    </div>
                  </li>
                ) : filteredDirs.length === 0 ? (
                  <li>
                    <div className="flex flex-col items-center justify-center gap-2 px-3 py-12 text-center text-sm text-muted-foreground">
                      <Folder className="h-8 w-8 opacity-30" />
                      <span>{filter ? t('noMatch') : t('noDirectories')}</span>
                      {filter && (
                        <button
                          type="button"
                          onClick={() => setFilter('')}
                          className="text-xs text-amber-700 transition-colors hover:underline dark:text-amber-400"
                        >
                          {t('clearFilter')}
                        </button>
                      )}
                    </div>
                  </li>
                ) : (
                  filteredDirs.map((entry) => (
                    <EntryRow
                      key={entry.path}
                      entry={entry}
                      isSelected={selectedPath === entry.path}
                      onSelect={selectEntry}
                      onOpen={enterDirectory}
                    />
                  ))
                )}
              </ul>
            </div>

            {/* 错误条 */}
            {errorMessage && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (browseError) void refetchBrowse()
                    else openMutation.reset()
                  }}
                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-destructive/30 bg-background px-1.5 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  {t('retry')}
                </button>
              </div>
            )}

            {nativeHint && !errorMessage && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{nativeHint}</span>
                <button
                  type="button"
                  onClick={() => setNativeHint(null)}
                  className="inline-flex h-5 shrink-0 items-center justify-center rounded text-amber-700/70 transition-colors hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-400"
                  aria-label={t('cancel')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Footer(背景对比,无 border) */}
          <div className="bg-muted/30 px-5 py-3">
            <div className="flex items-center gap-3">
              {/* 选中信息 */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Folder
                  className={cn(
                    'h-4 w-4 shrink-0',
                    selectedName ? 'text-amber-500' : 'text-muted-foreground/40',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate text-sm font-medium',
                      selectedName ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {selectedName || t('noTarget')}
                  </div>
                  {openTarget && (
                    <div
                      className="truncate font-mono text-[11px] text-muted-foreground"
                      title={openTarget}
                    >
                      {openTarget}
                    </div>
                  )}
                </div>
              </div>

              {/* 计数 */}
              <div className="shrink-0 text-[11px] text-muted-foreground/70">
                {filter
                  ? t('itemCountFiltered', {
                      filtered: filteredDirs.length,
                      total: sortedDirs.length,
                    })
                  : sortedDirs.length > 0
                    ? t('itemCount', { count: sortedDirs.length })
                    : null}
              </div>

              {/* 按钮 */}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={openMutation.isPending}
                  className="h-8"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={openSelected}
                  disabled={!canOpen}
                  className="h-8 min-w-[7rem]"
                >
                  {openMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span className="truncate">
                    {openMutation.isPending
                      ? t('opening')
                      : selectedName
                        ? t('openSelected', { name: selectedName })
                        : t('openAction')}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {permDialogPath && (
        <WorkspacePermissionDialog
          open={true}
          onOpenChange={(next) => {
            if (!next) setPermDialogPath(null)
          }}
          workspacePath={permDialogPath.path}
          workspaceName={permDialogPath.name}
          techStack={permDialogPath.techStack}
          onSaved={handlePermissionSaved}
        />
      )}
    </>
  )
}
