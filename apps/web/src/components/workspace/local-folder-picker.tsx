'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Folder,
  Loader2,
} from 'lucide-react'

import { Button } from '@ihui/ui'
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
 * 本地文件夹选择器 — 调 /api/workspace/fs/browse 逐级浏览,选中后弹权限配置弹窗。
 *
 * 流程:
 *   1. 打开后展示盘符列表(win)或根目录(其他平台)
 *   2. 双击目录进入,面包屑导航
 *   3. 单击选中
 *   4. 点击"选择此文件夹" → 调 openWorkspace → 检查 needsPermissionSetup
 *   5. 若 needsPermissionSetup → 弹 WorkspacePermissionDialog
 *   6. 否则 → 直接回调 onWorkspaceOpened
 */
export function LocalFolderPicker({
  open,
  onOpenChange,
  onWorkspaceOpened,
}: LocalFolderPickerProps) {
  const t = useTranslations('workspace.folderPicker')

  const [currentPath, setCurrentPath] = React.useState<string>('')
  const [selectedPath, setSelectedPath] = React.useState<string>('')
  const [permDialogPath, setPermDialogPath] = React.useState<{
    path: string
    name: string
    techStack: string[]
    needsSetup: boolean
  } | null>(null)

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

  const handlePermissionSaved = (perm: WorkspacePermission) => {
    onWorkspaceOpened?.(perm.workspacePath, perm.name, perm)
    setPermDialogPath(null)
    onOpenChange(false)
    setSelectedPath('')
    setCurrentPath('')
  }

  // 关闭时重置状态
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedPath('')
      setCurrentPath('')
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
              {currentPath.split(/[\\/]/).filter(Boolean).map((seg, idx, arr) => {
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
          <div className="max-h-80 overflow-y-auto rounded-md border bg-card">
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
                          isSel
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/50',
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
