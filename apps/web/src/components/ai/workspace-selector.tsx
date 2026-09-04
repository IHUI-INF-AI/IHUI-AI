// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Check, Folder, FolderPlus, Loader2, X } from 'lucide-react'
import {
  browseDirectory,
  getRecentWorkspaces,
  type RecentWorkspace,
  type WorkspacePermission,
} from '@ihui/api-client/endpoints/workspace'

import { cn } from '@/lib/utils'
import { useAiPanelStore } from '@/stores/ai-panel'
import { toast } from '@/components/common'
import { isTauri } from '@/lib/tauri-bridge'
import {
  clearBrowserWorkspaceHandle,
  getBrowserWorkspaceHandle,
} from '@/lib/workspace-context-loader'
import { invalidateBrowserWorkspaceContext } from '@/hooks/use-chat/workspace'
import { LocalFolderPicker } from '@/components/workspace/local-folder-picker'

/**
 * 浏览器端 handle 丢失警告(2026-09-04 立,每次页面加载最多提示一次)。
 * FileSystemDirectoryHandle 是会话级存储:刷新页面后 handle 丢失但 activeWorkspace
 * 仍从 localStorage 恢复 → AI 读不到工作区文件内容(此前静默失败,用户无感知)。
 */
let handleLossWarned = false
function warnHandleLossOnce(name: string): void {
  if (isTauri() || handleLossWarned) return
  // handle 仍存在(同一会话内重新授权过)则不提示
  if (getBrowserWorkspaceHandle(name)) return
  handleLossWarned = true
  toast.warning('工作区目录授权已失效', {
    description: `「${name}」的浏览器目录授权在刷新后丢失,AI 暂无法读取其文件内容。请点「添加工作区」用系统选择器重新选择一次该目录。`,
    duration: 8000,
  })
}

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
  const setPendingPermissionSetup = useAiPanelStore((s) => s.setPendingPermissionSetup)

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)

  /** 解绑当前工作区:清 store + 清浏览器 handle + 清 context 缓存(2026-08-29) */
  const unbindActiveWorkspace = React.useCallback(() => {
    const name = useAiPanelStore.getState().activeWorkspace?.name
    if (name) {
      clearBrowserWorkspaceHandle(name)
      invalidateBrowserWorkspaceContext(name)
    }
    // 同步清掉暂存模式,避免下次绑定误套用解绑前的暂存值(2026-08-31)
    useAiPanelStore.getState().setPendingPermissionMode(null)
    setActiveWorkspace(null)
  }, [setActiveWorkspace])

  // 持久化的 activeWorkspace 在挂载时校验路径是否仍存在(跨机器/移动硬盘等场景)。
  // 不存在则自动解绑,避免后续 AI 调用 fs 工具时因路径无效报错。
  React.useEffect(() => {
    // dev 自验模式(2026-07-25):自动化测试通过 window.__IHUI_SKIP_WS_VALIDATE__=true 跳过路径校验
    // - 自验脚本注入 mock 工作区(macOS/Linux 风格的虚构路径),避免被自动解绑
    // - 仅 dev 模式生效(production 不挂 window flag,逻辑不变)
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      (window as unknown as { __IHUI_SKIP_WS_VALIDATE__?: boolean }).__IHUI_SKIP_WS_VALIDATE__
    ) {
      return
    }
    const ws = useAiPanelStore.getState().activeWorkspace
    if (!ws?.path) return
    let cancelled = false
    void (async () => {
      try {
        const res = await browseDirectory(ws.path)
        if (cancelled) return
        if (!res.success) {
          // 路径不存在或无权限 → 自动解绑
          unbindActiveWorkspace()
        }
      } catch {
        // 网络错误不解绑(避免离线时误清空用户选择)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [unbindActiveWorkspace])

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
    // 最近列表切换拿不到 FileSystemDirectoryHandle(需用户手势重新授权):
    // 非 Tauri 且无 handle 时提示,否则 AI 读不到文件内容(2026-09-04)
    warnHandleLossOnce(ws.name)
    setMenuOpen(false)
  }

  const handlePickerOpened = (path: string, name: string, perm: WorkspacePermission | null) => {
    // 读取未绑定工作区时暂存的权限模式(2026-08-31 改:store 响应式,替代 sessionStorage)
    const pendingMode = useAiPanelStore.getState().pendingPermissionMode ?? undefined
    setActiveWorkspace({
      path,
      name,
      mode: pendingMode ?? perm?.mode,
      techStack: perm?.techStack
        ? perm.techStack
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    })
    if (pendingMode) {
      // 已应用暂存模式,清掉避免下次绑定时重复应用
      useAiPanelStore.getState().setPendingPermissionMode(null)
    }
    // 2026-07-25 深度对标 Codex:选择项目文件后,若该工作区尚未配置权限,
    // 立即弹权限确认 Dialog,让用户主动选择是否完全访问(避免 AI 静默拿到完全访问权限)。
    if (!perm && !pendingMode) {
      setPendingPermissionSetup({ path, name })
    } else {
      setPendingPermissionSetup(null)
    }
  }

  const triggerLabel = hasActive ? tw('selectWorkspace') : t('addWorkspace')

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
            )}
          >
            {hasActive ? (
              <Folder className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <FolderPlus className="h-4 w-4 shrink-0 text-primary" />
            )}
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
                onSelect={() => {
                  setMenuOpen(false)
                  // 延迟打开 picker:Radix DropdownMenu 关闭菜单时 portal 卸载是异步的,
                  // 同步 setPickerOpen(true) 会导致 Dialog 与 Menu 卸载冲突,Dialog 渲染为 display:none。
                  // 用 setTimeout 推到下一个事件循环,确保 Menu 完全卸载后再打开 Dialog。
                  window.setTimeout(() => setPickerOpen(true), 0)
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
                    unbindActiveWorkspace()
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
