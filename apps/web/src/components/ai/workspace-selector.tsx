// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
// 2026-11-16 立:浮层与视口边缘的统一安全间距(单一源)
import { FLOATING_VIEWPORT_PADDING_PX } from '@ihui/shared/ui/floating-layer-spec'
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
import { IconButton } from '@ihui/ui-react'
import { useAiPanelStore } from '@/stores/ai-panel'
import { toast } from '@/components/common'
import { isTauri } from '@/lib/tauri-bridge'
import {
  clearBrowserWorkspaceHandle,
  getBrowserWorkspaceHandle,
  getBrowserWorkspacePermission,
  hydrateBrowserWorkspaceHandles,
  isBrowserHandleWorkspaceKey,
  requestBrowserWorkspacePermission,
} from '@/lib/workspace-context-loader'
import { getGlobalEngineMode, resolveEffectiveEngineLeg } from '@ihui/shared/stores'
import { isRemoteWindow } from '@/lib/api-base-url'
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

/** 浏览器句柄型工作区:句柄已持久化但需要用户手势重新授权时的提示(每次页面加载最多一次) */
let browserPermissionWarned = false
function warnBrowserPermissionOnce(name: string): void {
  if (isTauri() || browserPermissionWarned) return
  browserPermissionWarned = true
  toast.warning('工作区目录授权需要重新确认', {
    description: `「${name}」的目录授权在刷新后需要重新选择一次该目录,AI 才能继续读写文件。请点「添加工作区」重新选择同一目录。`,
    duration: 8000,
  })
}

/**
 * 点击工作区按钮时在用户手势内恢复目录授权。
 * 刷新后 queryPermission 常为 'prompt',而 requestPermission 只在手势窗口内可用;
 * 触发器点击/菜单选择正是这个窗口,因此不要求用户重新走一遍选目录。
 */
function ensureHandlePermission(name: string): void {
  if (isTauri() || !isBrowserHandleWorkspaceKey(name)) return
  void (async () => {
    const perm = await requestBrowserWorkspacePermission(name)
    if (perm === 'granted') {
      browserPermissionWarned = false
      return
    }
    warnBrowserPermissionOnce(name)
  })()
}

/** 桌面薄壳加载线上站点 + 云端引擎:本地文件工具必然不可用,绑定后明确提示一次 */
let remoteShellCloudWarned = false
function warnRemoteShellCloudOnce(): void {
  if (remoteShellCloudWarned || !isTauri() || !isRemoteWindow()) return
  const leg = resolveEffectiveEngineLeg(getGlobalEngineMode(), {
    isTauri: true,
    isRemoteWindow: true,
  })
  if (leg !== 'cloud') return
  remoteShellCloudWarned = true
  toast.warning('本地文件工具当前不可用', {
    description:
      '当前桌面端加载的是线上站点且引擎为「云端」,服务器读不到本机磁盘。请在 设置→偏好→执行引擎 切到「本地」并启动本机服务,或改用浏览器选择目录。',
    duration: 10000,
  })
}

/** AI 面板顶部"工作区选择器"(参考 主流 AI IDE 顶部 project selector 设计)
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
  // 浏览器端持久化(IndexedDB)的工作区名:刷新后仍可列出并一键切回(2026-11-16)
  const [persistedNames, setPersistedNames] = React.useState<string[]>([])

  /** 解绑当前工作区:清 store + 清浏览器 handle + 清 context 缓存(2026-08-29) */
  const unbindActiveWorkspace = React.useCallback(() => {
    const name = useAiPanelStore.getState().activeWorkspace?.name
    if (name) {
      clearBrowserWorkspaceHandle(name)
      invalidateBrowserWorkspaceContext(name)
      setPersistedNames((prev) => prev.filter((n) => n !== name))
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
    // 2026-11-16:浏览器句柄型工作区的 path 只是文件夹名,服务端不可见,
    // 不能拿它调 /fs/browse 做存在性校验(否则每次刷新都会被自动解绑)。
    if (!isTauri() && isBrowserHandleWorkspaceKey(ws.path)) return
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

  // 2026-11-16:刷新后把 IndexedDB 里的浏览器目录句柄回填内存,并检查当前工作区授权。
  // 之前句柄只存模块级 Map,刷新必丢 → AI 读不到文件且用户无感知。
  React.useEffect(() => {
    if (isTauri()) return
    let cancelled = false
    void (async () => {
      const names = await hydrateBrowserWorkspaceHandles()
      if (cancelled) return
      setPersistedNames(names)
      const ws = useAiPanelStore.getState().activeWorkspace
      if (!ws || !isBrowserHandleWorkspaceKey(ws.path)) return
      const perm = await getBrowserWorkspacePermission(ws.name)
      if (cancelled || perm === 'granted') return
      warnBrowserPermissionOnce(ws.name)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  // 服务端最近列表 + 浏览器本地持久化句柄名合并(2026-11-16):
  // 纯浏览器里 showDirectoryPicker 只给文件夹名,服务端 /fs/recent 永远没有它,
  // 不合并的话刷新后用户在菜单里看不到自己刚绑过的本地目录。
  const recentList: RecentWorkspace[] = React.useMemo(() => {
    const server = recentData ?? []
    if (isTauri() || persistedNames.length === 0) return server
    const known = new Set(server.map((w) => w.path))
    const extras = persistedNames
      .filter((name) => !known.has(name))
      .map((name) => ({ path: name, name, lastOpened: 0 }))
    return [...server, ...extras]
  }, [recentData, persistedNames])
  const hasActive = !!activeWorkspace

  const handleSelect = (ws: RecentWorkspace) => {
    setActiveWorkspace({ path: ws.path, name: ws.name })
    if (!isTauri() && isBrowserHandleWorkspaceKey(ws.path)) {
      // 句柄型工作区:菜单项点击本身是用户手势,直接尝试恢复授权(不必重选目录)
      ensureHandlePermission(ws.name)
    } else {
      // 最近列表切换拿不到 FileSystemDirectoryHandle(需用户手势重新授权):
      // 非 Tauri 且无 handle 时提示,否则 AI 读不到文件内容(2026-09-04)
      warnHandleLossOnce(ws.name)
    }
    setMenuOpen(false)
  }

  const handlePickerOpened = (path: string, name: string, perm: WorkspacePermission | null) => {
    // 读取未绑定工作区时暂存的权限模式(2026-08-31 改:store 响应式,替代 sessionStorage)
    const pendingMode = useAiPanelStore.getState().pendingPermissionMode ?? undefined
    // 浏览器句柄型工作区:服务端不持有该路径,无法落 workspace_permissions
    // ⇒ 权限档只记在本地(默认 accept-edits,与权限弹窗默认档一致)。
    const handleOnly = !isTauri() && isBrowserHandleWorkspaceKey(path)
    if (handleOnly) {
      // 立即进入最近工作区列表(刷新后由 IndexedDB 句柄回填继续列出)
      setPersistedNames((prev) => (prev.includes(name) ? prev : [...prev, name]))
    }
    setActiveWorkspace({
      path,
      name,
      mode: pendingMode ?? perm?.mode ?? (handleOnly ? 'accept-edits' : undefined),
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
    // 桌面薄壳加载线上站点 + 云端引擎:本地文件工具必然不可用,绑定后明确提示一次
    if (!handleOnly) warnRemoteShellCloudOnce()
    // 2026-07-25 深度遵循统一工程规范
    // 立即弹权限确认 Dialog,让用户主动选择是否完全访问(避免 AI 静默拿到完全访问权限)。
    if (!handleOnly && !perm && !pendingMode) {
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
          <IconButton
            aria-label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
            onClick={() => {
              // 点击触发器 = 用户手势:顺手恢复句柄授权,避免刷新后必须重选目录
              const ws = useAiPanelStore.getState().activeWorkspace
              if (ws) ensureHandlePermission(ws.path)
            }}
          >
            {hasActive ? (
              <Folder className="shrink-0 text-amber-500" />
            ) : (
              <FolderPlus className="shrink-0 text-primary" />
            )}
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            // 2026-11-16 立:与视口边缘留统一安全间距,避免菜单贴屏幕边缘
            collisionPadding={FLOATING_VIEWPORT_PADDING_PX}
            className="z-popover min-w-[16rem] max-w-[20rem] overflow-hidden rounded-lg border bg-card p-1 text-card-foreground shadow-elevation-md"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-label font-semibold uppercase tracking-wide text-muted-foreground">
              {tw('recentWorkspaces')}
            </DropdownMenu.Label>

            {/* 最近工作区列表 */}
            <div className="max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
              {recentLoading ? (
                <div className="flex items-center justify-center gap-2 px-2 py-4 text-label text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {tw('loading')}
                </div>
              ) : recentList.length === 0 ? (
                <div className="px-2 py-4 text-center text-label text-muted-foreground">
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
                        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
                  'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
                    'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-body outline-none',
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
