'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Check, ChevronRight, Folder, FolderOpen, Loader2, X } from 'lucide-react'

import { Button, Input } from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
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

/**
 * 浏览器能力检测:
 * - showDirectoryPicker:Chrome/Edge 86+(win/mac/linux/Android),弹**系统原生**文件夹选择对话框
 * - webkitdirectory:<input type=file> 属性,弹**系统原生**"选择文件夹"对话框(所有 Chromium 系 + Safari 14+)
 * - 都不支持:只能降级到 web 内置 browse 或手动输入
 */
function detectPickerCapability(): {
  showDirectoryPicker: boolean
  webkitdirectory: boolean
} {
  if (typeof window === 'undefined') return { showDirectoryPicker: false, webkitdirectory: false }
  const w = window as unknown as {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
  return {
    showDirectoryPicker: typeof w.showDirectoryPicker === 'function',
    webkitdirectory: 'webkitdirectory' in document.createElement('input'),
  }
}

/** 用 showDirectoryPicker 弹系统原生选择器 */
async function pickDirectoryNative(): Promise<FileSystemDirectoryHandle | null> {
  const w = window as unknown as {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
  if (typeof w.showDirectoryPicker !== 'function') return null
  try {
    const handle = await w.showDirectoryPicker({ mode: 'read' })
    return handle
  } catch (err) {
    // 用户取消(AbortError)→ 当作 null 处理,不抛错
    if (err instanceof Error && err.name === 'AbortError') return null
    throw err
  }
}

/** 列出 handle 内的一级子项(名称 + 类型 + 大小) */
async function listHandleChildren(
  handle: FileSystemDirectoryHandle,
): Promise<Array<{ name: string; kind: 'file' | 'directory'; size?: number }>> {
  const items: Array<{ name: string; kind: 'file' | 'directory'; size?: number }> = []
  // 限制最多 20 项,避免拖慢
  let count = 0
  // FileSystemDirectoryHandle 在 Chromium 实现中是 AsyncIterable<[string, FileSystemHandle]>,
  // 但 TS 标准库类型未声明;经 unknown 转型强制断言
  const asyncIterable = handle as unknown as AsyncIterable<[string, FileSystemHandle]>
  for await (const [name, child] of asyncIterable) {
    if (count >= 20) break
    if (child.kind === 'file') {
      try {
        const file = await (child as FileSystemFileHandle).getFile()
        items.push({ name, kind: 'file', size: file.size })
      } catch {
        items.push({ name, kind: 'file' })
      }
    } else {
      items.push({ name, kind: 'directory' })
    }
    count++
  }
  // 文件夹在前
  return items.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name)
    return a.kind === 'directory' ? -1 : 1
  })
}

/** 从 webkitdirectory 提取选定文件夹的根名(所有 file.webkitRelativePath 的公共前缀) */
function extractWebkitRootName(files: FileList): string | null {
  if (files.length === 0) return null
  const first = files[0]
  const rel = (first as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!rel) return null
  const segs = rel.split('/')
  return segs[0] || null
}

/**
 * 本地文件夹选择器 — 三级方案,确保**真正弹出系统原生文件夹选择器**:
 *
 *   1. showDirectoryPicker()(首选,Chrome/Edge 86+)
 *      - 弹**真正的系统原生对话框**(Windows 资源管理器风格)
 *      - 拿到 FileSystemDirectoryHandle,name 即选中文件夹名
 *      - 由于浏览器安全模型,handle **不暴露真实绝对路径** → 用户从资源管理器复制粘贴
 *      - 列出 handle 内的子目录(最多 20 项)作为确认
 *
 *   2. <input type=file webkitdirectory>(降级,所有 Chromium 系 + Safari)
 *      - 弹系统原生"选择文件夹"对话框
 *      - 同样不暴露绝对路径,但能确认根文件夹名
 *
 *   3. 手动输入完整绝对路径(最终降级)
 *
 * 选完后调 /api/workspace/fs/open(后端需要绝对路径才能定位工作区)
 */
export function LocalFolderPicker({
  open,
  onOpenChange,
  onWorkspaceOpened,
}: LocalFolderPickerProps) {
  const t = useTranslations('workspace.folderPicker')

  const [currentPath, setCurrentPath] = React.useState<string>('')
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [manualPath, setManualPath] = React.useState<string>('')
  const [permDialogPath, setPermDialogPath] = React.useState<{
    path: string
    name: string
    techStack: string[]
    needsSetup: boolean
  } | null>(null)

  // 系统原生 handle 状态
  const [nativeHandle, setNativeHandle] = React.useState<FileSystemDirectoryHandle | null>(null)
  const [nativeChildren, setNativeChildren] = React.useState<
    Array<{ name: string; kind: 'file' | 'directory'; size?: number }>
  >([])
  const [nativeError, setNativeError] = React.useState<string | null>(null)
  const [pickingNative, setPickingNative] = React.useState(false)

  // 浏览器能力(SSR 安全)
  const capability = React.useMemo(
    () =>
      open ? detectPickerCapability() : { showDirectoryPicker: false, webkitdirectory: false },
    [open],
  )

  // webkitdirectory 隐藏 input 的 ref
  const webkitInputRef = React.useRef<HTMLInputElement | null>(null)

  // 浏览当前目录
  const { data: browseData, isLoading: browsing } = useQuery({
    queryKey: ['workspace', 'fs-browse', currentPath],
    queryFn: async () => {
      const res = await browseDirectory(currentPath || undefined)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: open,
  })

  // 打开工作区(写入 recent + 检测技术栈 + 返回权限配置)
  const openMutation = useMutation({
    mutationFn: async (path: string) => {
      const res = await openWorkspace(path)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      if (data.needsPermissionSetup) {
        // 首次打开 → 弹权限配置弹窗
        setPermDialogPath({
          path: data.path,
          name: data.name,
          techStack: data.techStack,
          needsSetup: true,
        })
      } else {
        // 已有权限配置 → 直接放行
        onWorkspaceOpened?.(data.path, data.name, data.permission)
        onOpenChange(false)
      }
    },
  })

  const entries: BrowseEntry[] = browseData?.entries ?? []
  const directories = entries.filter((e) => e.isDir)

  const handleSelect = (path: string) => {
    setSelectedPath(path)
  }

  const handleConfirm = () => {
    if (!selectedPath) return
    openMutation.mutate(selectedPath)
  }

  // 主按钮:弹系统原生选择器
  const handleNativePick = async () => {
    setNativeError(null)
    setPickingNative(true)
    try {
      const handle = await pickDirectoryNative()
      if (!handle) {
        // 用户取消,静默返回
        return
      }
      setNativeHandle(handle)
      // 列出 handle 内子项作为确认
      const children = await listHandleChildren(handle)
      setNativeChildren(children)
      // 自动填入手动输入框,引导用户补全绝对路径
      setManualPath(handle.name)
    } catch (err) {
      setNativeError((err as Error).message || t('nativePickError'))
    } finally {
      setPickingNative(false)
    }
  }

  // 降级:触发 webkitdirectory 隐藏 input
  const handleWebkitTrigger = () => {
    webkitInputRef.current?.click()
  }

  // webkitdirectory 选中后
  const handleWebkitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const rootName = extractWebkitRootName(files)
    if (rootName) {
      setManualPath(rootName)
      setNativeError(null)
    } else {
      setNativeError(t('webkitNoRoot'))
    }
    // 允许重复选同一个文件夹
    e.target.value = ''
  }

  // 直接输入路径:不走 browse,直接调 openWorkspace
  const handleManualOpen = () => {
    const trimmed = manualPath.trim()
    if (!trimmed) return
    setSelectedPath(trimmed)
    openMutation.mutate(trimmed)
  }

  // 清除已选 handle
  const handleClearNative = () => {
    setNativeHandle(null)
    setNativeChildren([])
    setNativeError(null)
    setManualPath('')
  }

  const handlePermissionSaved = (perm: WorkspacePermission) => {
    onWorkspaceOpened?.(perm.workspacePath, perm.name, perm)
    setPermDialogPath(null)
    onOpenChange(false)
    setSelectedPath('')
    setCurrentPath('')
    setNativeHandle(null)
    setNativeChildren([])
    setManualPath('')
  }

  // 关闭时重置状态
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedPath('')
      setCurrentPath('')
      setManualPath('')
      setNativeHandle(null)
      setNativeChildren([])
      setNativeError(null)
    }
    onOpenChange(next)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-amber-500" />
              <span>{t('title')}</span>
            </DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          {/* ===== 1. 系统原生选择器(主路径) ===== */}
          {capability.showDirectoryPicker && (
            <div className="rounded-lg border border-border bg-card p-4">
              {nativeHandle ? (
                // 已选中状态
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('nativeSelected')}</p>
                        <p className="truncate text-sm font-medium" title={nativeHandle.name}>
                          {nativeHandle.name}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearNative}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={t('reselect')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 列出 handle 内一级子项(确认选对了) */}
                  {nativeChildren.length > 0 && (
                    <div className="rounded-md bg-muted/40 p-2">
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                        {t('nativeChildren')} ({Math.min(nativeChildren.length, 20)})
                      </p>
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        {nativeChildren.map((c) => (
                          <li
                            key={c.name}
                            className="flex items-center gap-1.5 truncate"
                            title={c.name}
                          >
                            {c.kind === 'directory' ? (
                              <Folder className="h-3 w-3 shrink-0 text-amber-500" />
                            ) : (
                              <span className="h-3 w-3 shrink-0 rounded-sm bg-muted-foreground/30" />
                            )}
                            <span className="truncate">{c.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                // 未选中状态:大主按钮
                <div className="space-y-2 text-center">
                  <Button
                    type="button"
                    onClick={handleNativePick}
                    disabled={pickingNative || openMutation.isPending}
                    className="h-11 w-full"
                    size="lg"
                  >
                    {pickingNative ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('nativePicking')}
                      </>
                    ) : (
                      <>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        {t('nativePick')}
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t('nativePickHint')}
                  </p>
                </div>
              )}

              {nativeError && (
                <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{nativeError}</span>
                </div>
              )}
            </div>
          )}

          {/* ===== 2. webkitdirectory 降级(无 showDirectoryPicker 但支持 webkitdirectory) ===== */}
          {!capability.showDirectoryPicker && capability.webkitdirectory && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="space-y-2 text-center">
                <Button
                  type="button"
                  onClick={handleWebkitTrigger}
                  disabled={openMutation.isPending}
                  className="h-11 w-full"
                  size="lg"
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t('webkitPick')}
                </Button>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {t('webkitPickHint')}
                </p>
                {/* 隐藏的 webkitdirectory input */}
                <input
                  ref={webkitInputRef}
                  type="file"
                  // @ts-expect-error - webkitdirectory 是非标准 HTML 属性,Chromium/Firefox 实现
                  webkitdirectory=""
                  multiple
                  onChange={handleWebkitChange}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          {/* ===== 3. 都不支持时的提示 ===== */}
          {!capability.showDirectoryPicker && !capability.webkitdirectory && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t('noNativeSupport')}</span>
            </div>
          )}

          {/* ===== 手动输入完整路径(始终可用,系统原生选择器的下游) ===== */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="workspace-manual-path"
                className="text-xs font-medium text-muted-foreground"
              >
                {t('manualPathLabel')}
              </label>
              <Input
                id="workspace-manual-path"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualPath.trim() && !openMutation.isPending) {
                    e.preventDefault()
                    handleManualOpen()
                  }
                }}
                placeholder={t('manualPathPlaceholder')}
                disabled={openMutation.isPending}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                {nativeHandle ? t('manualPathHintWithNative') : t('manualPathHint')}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleManualOpen}
              disabled={!manualPath.trim() || openMutation.isPending}
              className="shrink-0"
            >
              {openMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {openMutation.isPending ? t('opening') : t('openPath')}
            </Button>
          </div>

          {/* 手动输入与后端浏览的过渡(用间距分隔,符合 AGENTS §4 禁止分割线约束) */}
          <p className="text-center text-xs text-muted-foreground">{t('orBrowse')}</p>

          {/* ===== 4. 后端 browse(降级) ===== */}
          {/* 面包屑导航 */}
          {currentPath && (
            <div className="flex items-center gap-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
              <button
                type="button"
                onClick={() => setCurrentPath('')}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('root')}
              </button>
              {currentPath
                .split(/[\\/]/)
                .filter(Boolean)
                .map((seg, idx, arr) => {
                  const fullPath = arr.slice(0, idx + 1).join('\\') + (idx === 0 ? ':' : '')
                  return (
                    <React.Fragment key={fullPath}>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => setCurrentPath(fullPath)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {seg}
                      </button>
                    </React.Fragment>
                  )
                })}
            </div>
          )}

          {/* 目录列表 */}
          <div className="max-h-60 overflow-y-auto rounded-md border bg-card">
            {browsing ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : directories.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t('noDirectories')}
              </div>
            ) : (
              <ul className="py-1">
                {directories.map((entry) => {
                  const isSel = entry.path === selectedPath
                  return (
                    <li key={entry.path}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelect(entry.path)}
                        onDoubleClick={() => setCurrentPath(entry.path)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSelect(entry.path)
                          if (e.key === 'ArrowRight') setCurrentPath(entry.path)
                        }}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                          isSel ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
                        )}
                      >
                        <Folder
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isSel ? 'text-primary' : 'text-amber-500',
                          )}
                        />
                        <span className="flex-1 truncate">{entry.name}</span>
                        {isSel && <Check className="h-4 w-4 text-primary" />}
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* 选中路径展示 */}
          {selectedPath && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">{t('selected')}</span>
              <span className="ml-2 font-mono">{selectedPath}</span>
            </div>
          )}

          {openMutation.isError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{(openMutation.error as Error)?.message}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={openMutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedPath || openMutation.isPending}
            >
              {openMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {openMutation.isPending ? t('opening') : t('selectAndOpen')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限配置弹窗(首次打开时) */}
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
