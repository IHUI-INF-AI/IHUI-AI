'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, Folder, FolderPlus, Loader2, X } from 'lucide-react'
import { getRecentWorkspaces, type RecentWorkspace } from '@ihui/api-client/endpoints/workspace'

import { cn } from '@/lib/utils'
import { useAiPanelStore, type ActiveWorkspace } from '@/stores/ai-panel'
import { LocalFolderPicker } from '@/components/workspace/local-folder-picker'

/** AI 面板顶部"工作区选择器"(参考 Trae/Codex/Claude Code 顶部 project selector 设计)
 *
 * - trigger 紧凑图标按钮(h-6 px-1.5),放在 displayTitle 文字旁边
 *   - 空工作区:FolderPlus 图标(提示"添加工作区")
 *   - 已绑定:Folder 图标(amber,提示"切换工作区")
 * - 下拉菜单:
 *   - 最近工作区列表(点击切换)
 *   - "添加工作区"项(触发 LocalFolderPicker)
 *   - 已绑定时显示"清除工作区"项(解绑)
 * - 状态通过 useAiPanelStore.activeWorkspace 管理,持久化到 localStorage
 */
export function WorkspaceSelector() {
  const t = useTranslations('aiChat')
  const tw = useTranslations('workspace')

  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)

  // 拉取最近打开的工作区列表(menuOpen 时启用,避免面板打开就请求)
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['workspace', 'recent'],
    queryFn: async () => {
      const res = await getRecentWorkspaces()
      if (!res.success) throw new Error(res.error)
      return res.data.workspaces
    },
    enabled: menuOpen,
    staleTime: 10_000,
  })

  const recentList: RecentWorkspace[] = recentData ?? []
  const hasActive = !!activeWorkspace

  const handleSelect = (ws: RecentWorkspace) => {
    setActiveWorkspace({ path: ws.path, name: ws.name })
    setMenuOpen(false)
  }

  const handlePickerOpened = (path: string, name: string) => {
    setActiveWorkspace({ path, name })
  }

  const triggerLabel = hasActive ? tw('selectWorkspace') : t('addWorkspace')
  const triggerTitle = activeWorkspace
    ? `${activeWorkspace.name}\n${activeWorkspace.path}`
    : t('addWorkspace')

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={triggerLabel}
            title={triggerTitle}
            className={cn(
              'inline-flex h-6 shrink-0 items-center gap-0.5 rounded px-1.5 text-xs font-medium transition-colors',
              'bg-muted/60 text-foreground/70 hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
              // 2026-07-19 中文 + 图标垂直对齐:文字 span 视觉居中(此处只有图标 + chevron,无中文 span)
            )}
          >
            {hasActive ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            ) : (
              <FolderPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-popover min-w-[16rem] max-w-[20rem] overflow-hidden rounded-lg border bg-card p-1 text-card-foreground shadow-md"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tw('recentWorkspaces')}
            </DropdownMenu.Label>

            {/* 最近工作区列表 */}
            <div className="max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
              {recentLoading ? (
                <div className="flex items-center justify-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {tw('loading')}
                </div>
              ) : recentList.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {t('noRecentWorkspaces')}
                </div>
              ) : (
                recentList.map((ws) => {
                  const isActive = activeWorkspace?.path === ws.path
                  return (
                    <DropdownMenu.Item
                      key={ws.path}
                      onSelect={() => handleSelect(ws)}
                      className={cn(
                        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                        'focus:bg-accent focus:text-accent-foreground',
                      )}
                    >
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{ws.name}</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {ws.path}
                        </span>
                      </div>
                    </DropdownMenu.Item>
                  )
                })
              )}
            </div>

            <div className="mt-1 flex flex-col gap-0.5">
              {/* 添加工作区 */}
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault()
                  setMenuOpen(false)
                  setPickerOpen(true)
                }}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                  'focus:bg-accent focus:text-accent-foreground',
                )}
              >
                <FolderPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-medium">{t('addWorkspace')}</span>
              </DropdownMenu.Item>

              {/* 清除当前工作区(仅已绑定时显示) */}
              {hasActive && (
                <DropdownMenu.Item
                  onSelect={() => {
                    setActiveWorkspace(null)
                    setMenuOpen(false)
                  }}
                  className={cn(
                    'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
                    'text-destructive focus:bg-destructive/10 focus:text-destructive',
                  )}
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{t('clearWorkspace')}</span>
                </DropdownMenu.Item>
              )}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <LocalFolderPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onWorkspaceOpened={handlePickerOpened}
      />
    </>
  )
}

export type { ActiveWorkspace }
