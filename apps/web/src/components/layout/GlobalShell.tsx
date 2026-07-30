'use client'

import * as React from 'react'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Sidebar } from '@/components/sidebar'
import { AISidePanel } from '@/components/ai/ai-side-panel'
import { WebWorkPanel } from '@/components/work-panel/web-work-panel'
import { PWAInstallPrompt, PWAUpdatePrompt } from '@/components/common'
import { WorkspacePermissionRequestDialog } from '@/components/workspace/workspace-permission-request-dialog'
import { GlobalTopBar } from '@/components/layout/GlobalTopBar'
import { Button } from '@ihui/ui-react'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useMounted } from '@/hooks/use-mounted'
import { useAuthStore } from '@/stores/auth'
import { useNativeShortcuts } from '@/hooks/use-native-shortcuts'
import { dispatchMenuAction } from '@/lib/menu-actions'
import { startAutoRefresh } from '@/lib/tokenUtils'

/**
 * GlobalShell — 真正的全局外壳(2026-07-19 立)
 *
 * 设计目的:
 * - 把左侧 Sidebar 与右侧 AISidePanel 提升到根 layout.tsx 层级,
 *   让所有路由组((main) / (marketing) / (auth) / sso / h5 / forbidden 等)
 *   共享同一套全局组件,符合用户"本项目所有内容都应包含在工作区"的全局设定。
 * - 取代原先只在 (main) 路由组挂载 MainShell 的做法。
 *
 * 结构:
 *   <div flex h-screen overflow-hidden>
 *     <Sidebar />                       ← 桌面端固定侧边栏(相对定位,flex 流)
 *     <div id="work-area-portal-root"   ← 内容区,作为 Sidebar 搜索弹层的 portal 目标
 *         relative flex-1 flex-col overflow-hidden>
 *       <Button mobile menu />          ← 移动端浮动菜单按钮(lg:hidden)
 *       {children}                      ← 各路由组 layout 内容填充此处
 *     </div>
 *   </div>
 *   <AISidePanel />                     ← fixed 定位,紧贴 Sidebar 右侧
 *   <PWA prompts />                     ← fixed 定位,右下角
 *
 * 与 MainShell 的分工:
 * - GlobalShell:负责全局骨架(Sidebar + 内容槽 + AISidePanel + PWA),所有路由共享
 * - MainShell:仅负责 (main) 路由组的工作区面板样式(圆角卡片 + padding + TagsView)
 *   现已精简,不再渲染 Sidebar/AISidePanel,避免与 GlobalShell 重复挂载
 *
 * sidebar-collapsed 状态同步:
 * - localStorage 持久化(桌面端折叠态)
 * - storage 事件跨标签页同步
 * - 折叠/展开/拖拽宽度通过 :root --sidebar-width CSS 变量传递给 AISidePanel
 *   (见 sidebar.tsx 第 1117 行 useEffect)
 */
export function GlobalShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const t = useTranslations('a11y')
  // 静态 ID(非 useId),避免 React 18 useId 在 SSR/CSR 之间偶尔漂移导致 hydration mismatch。
  // Sidebar 内部会再派生 desktop/mobile 两个 nav id,确保两个 <nav> 元素不会共享同一 id。
  const sidebarId = 'main-sidebar'

  // --ai-panel-occupy CSS 变量(2026-07-30 修订:不再用于 paddingLeft,仅供 WebWorkPanel 计算最大宽度)。
  // 旧架构(已废弃):work-area-portal-root 用 padding-left:var(--ai-panel-occupy) 避让 fixed AISidePanel,
  //   但 padding-left 压缩整个 work-area(包括 TagsView)→ 标签栏反复消失。
  // 新架构:AISidePanel 移入 flex 流,自然占据空间,work-area-portal-root 无 padding-left。
  //   --ai-panel-occupy 仍同步到 :root,供 WebWorkPanel 读取计算自身最大可用宽度。
  const mounted = useMounted()
  // 性能修复(2026-07-25):拆分为单字段 selector,避免订阅 isResizing/activeWorkspace
  // 等高频变化字段触发整棵路由树重渲染(原 `{ open, width } = useAiPanelStore()` 等价于全订阅)。
  const aiOpen = useAiPanelStore((s) => s.open)
  const aiWidth = useAiPanelStore((s) => s.width)
  const aiFloatMode = useAiPanelStore((s) => s.floatMode)
  const aiFloatMinimized = useAiPanelStore((s) => s.floatMinimized)
  const currentUserId = useAuthStore((s) => s.user?.id)
  // 2026-07-26 用户反馈:TagsView 从 GlobalShell 移到 MainShell(只覆盖 main 同宽容器)
  // 之前放右列顶部会横跨 work-area-portal-root + WebWorkPanel,违反"只覆盖 main 同宽"要求
  // 现在 TagsView 跟随 MainShell 一起渲染,所有 (main) 路由组都能看到,
  // 非 (main) 路由组(marketing/auth/sso 等)不显示(因为没有 MainShell)
  // MainShell 内部:无 tag 时显示 placeholder,首帧直接渲染,SSR 安全

  // 桌面端快捷键全局监听(2026-07-26 迁移:从 NativeTopBar 移到 GlobalShell,
  // 因为 NativeTopBar 已删除,窗口控制按钮跟随 TagsView 一起搬到 MainShell 内部)
  // - 全局路由都能响应 Ctrl+R / F12 / Ctrl+Shift+A / Ctrl+Q
  // - 走 dispatchMenuAction 单一逻辑源
  useNativeShortcuts((id) => void dispatchMenuAction(id))

  // 运行时同步 CSS 变量(跟随用户拖拽 AI 面板宽度 / 关闭面板)
  // +6:AI 面板右边缘与工作区卡片之间固定 6px 间距(用户强制要求,不可更改)
  // 浮窗模式(floatMode)或最小化时:occupy=0,面板 fixed 定位不占 flex 空间
  React.useEffect(() => {
    const docked = aiOpen && !aiFloatMode && !aiFloatMinimized
    const occupy = docked ? aiWidth + 6 : 0
    document.documentElement.style.setProperty('--ai-panel-occupy', `${occupy}px`)
  }, [aiOpen, aiWidth, aiFloatMode, aiFloatMinimized])

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved === 'true') setCollapsed(true)
    } catch {
      // localStorage 不可用
    }
  }, [])

  // 页面刷新后:从 cookie 恢复 refreshToken + 按偏好启动自动续期(实现"记住 30 天")
  React.useEffect(() => {
    if (!mounted) return
    const store = useAuthStore.getState()
    store.hydrateRefreshToken()
    const { refreshToken, isAuthenticated } = useAuthStore.getState()
    if (isAuthenticated && refreshToken) {
      // 读 autoRenew 偏好,决定是否恢复自动续期
      try {
        const raw = localStorage.getItem('ihui-login-prefs')
        const autoRenew = raw ? (JSON.parse(raw).autoRenew ?? true) : true
        if (autoRenew) startAutoRefresh()
      } catch {
        startAutoRefresh()
      }
    }
  }, [mounted])

  React.useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed', String(collapsed))
    } catch {
      // localStorage 不可用
    }
  }, [collapsed])

  // 侧边栏折叠状态跨标签页同步:其他标签页切换折叠时,本标签页跟随
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'sidebar-collapsed' || e.newValue === null) return
      setCollapsed(e.newValue === 'true')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  React.useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <>
      {/* 布局结构(2026-07-30 彻底根治:AI 面板从 fixed 改为 flex 流内布局):
          左列 = <Sidebar />                          全高侧边栏
          右列 = <flex-row>                           横向排列
                   <AISidePanel />                    AI 面板(flex item,open 时占 width px)
                   <work-area-portal-root>            内容区(flex-1,含 MainShell = TagsView + 工作区卡片)
                   <WebWorkPanel />                   右侧内置浏览器面板
          TagsView + 窗口控制按钮由 MainShell 内部渲染,严格匹配 main 同宽容器。
          AISidePanel 不再用 fixed 定位,改为 flex 子元素自然占空间,彻底消除 padding-left 压缩问题。 */}
      <div className="flex h-screen overflow-hidden">
        {/* 左列:桌面端全高侧边栏(占据左上角,不再有 40px 顶部空) */}
        <React.Suspense fallback={null}>
          <Sidebar
            id={sidebarId}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </React.Suspense>

        {/* 右列:flex-row 横向排列(AISidePanel + work-area + WebWorkPanel)
            2026-07-30 彻底根治:AISidePanel 从 fixed 改为 flex 子元素,
            不再需要 padding-left 避让,TagsView 永不被压缩。
            flex-row 保证三者横向并列:AISidePanel(左,可折叠)→ work-area(flex-1)→ WebWorkPanel(右)。 */}
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          {/* output: 'export' 模式:Sidebar 内部 useSearchParams() 需 Suspense 包裹 */}
          {/*
            AISidePanel(2026-07-30 彻底根治:从 fixed 改为 flex 流内布局)
            - 旧架构根因:AISidePanel 用 fixed 定位 + work-area-portal-root 用 padding-left 避让,
              padding-left 压缩整个 work-area(包括 TagsView),导致标签栏反复消失
            - 新架构:AISidePanel 作为 flex-row 第一个子元素,open 时占 width px,close 时 width:0
            - flex 布局保证 AISidePanel 与 work-area-portal-root 永不重叠,TagsView 永不被压缩
            - --ai-panel-occupy CSS 变量仍同步到 :root(供 WebWorkPanel 计算最大可用宽度)
          */}
          <React.Suspense fallback={null}>
            <AISidePanel />
          </React.Suspense>
          {/*
            work-area-portal-root:作为 TagsView 搜索弹层(TagsViewSearchButton) 的 portal 目标。
            overflow-hidden 裁剪搜索弹层 slide-in-from-top 动画的初始 translateY(-100%)。
            flex-1 min-h-0 让内容区在 flex 容器中正确填充并允许子元素滚动。
            不再有 padding-left(AISidePanel 已移入 flex 流,自然占据空间)。
          */}
          <div
            id="work-area-portal-root"
            className="relative flex min-w-0 flex-1 min-h-0 flex-col overflow-hidden"
          >
            {/* 移动端浮动菜单按钮(Header 移除后,用浮动按钮打开侧边栏抽屉) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen((o) => !o)}
              className="absolute left-2 top-2 z-30 h-9 w-9 lg:hidden"
              aria-label={t('menu')}
            >
              <Menu className="h-5 w-5" />
            </Button>
            {/* 全局顶栏(2026-07-30 立):所有路由组((main)/marketing/auth/sso/forbidden)
                都常驻显示。包含 TagsView + Plus 弹窗(9 项视图/工具/设置)+ 桌面端窗口控制。
                桌面端拖拽/resize/主题跟随/托盘状态等副作用由 GlobalTopBar 内部管理。 */}
            <React.Suspense fallback={null}>
              <GlobalTopBar />
            </React.Suspense>
            {children}
          </div>
          {/* 工作展示区(右侧固定面板):AI 对话内嵌浏览器 / URL 预览。
              open=false 时渲染 null,不影响布局;open=true 时参与 flex 流,work-area 自动收缩。
              不弹独立窗口,纯组件渲染(遵守用户规则:dev server 只在 TRAE 内部运行)。 */}
          <WebWorkPanel />
        </div>
      </div>
      {/* PWA 提示:固定悬浮于右下角,不影响主布局。层级 z-modal(2000,引用 --z-modal)。 */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-modal flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <div className="pointer-events-auto">
          <PWAInstallPrompt />
        </div>
        <div className="pointer-events-auto">
          <PWAUpdatePrompt onUpdate={() => window.location.reload()} />
        </div>
      </div>
      {/*
        工作区人工审计确认弹窗(全局挂载,任意页面触发 FS 工具权限请求时弹出)。
        Dialog 内部通过 usePermissionRequest 订阅 workspace.permission.request WS 事件。
        未登录时不订阅、未挂载,登录后自动启用。
      */}
      <WorkspacePermissionRequestDialog userId={currentUserId} />
      {/*
        Agent 任务进度 popover(2026-07-27 v6):
        trigger + popover 已内嵌到 MessageInput 输入框附加栏(上方居中),
        点击 trigger 弹小 popover 显示 plan steps 列表,不再全局挂载底部大弹窗。
      */}
    </>
  )
}

export default GlobalShell
