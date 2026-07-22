'use client'

import * as React from 'react'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Sidebar } from '@/components/sidebar'
import { AISidePanel } from '@/components/ai/ai-side-panel'
import { WebWorkPanel } from '@/components/work-panel/web-work-panel'
import { PWAInstallPrompt, PWAUpdatePrompt } from '@/components/common'
import { WorkspacePermissionRequestDialog } from '@/components/workspace/workspace-permission-request-dialog'
import { DevToolsTrigger } from '@/components/dev/DevToolsTrigger'
import { Button } from '@ihui/ui'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useMounted } from '@/hooks/use-mounted'
import { useAuthStore } from '@/stores/auth'
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

  // AI 面板占位宽度(直接订阅 store,避免 SSR/初始渲染时 --ai-panel-width CSS 变量未同步导致内容区与 AI 面板重叠)。
  // hydration-safe:zustand persist + useSyncExternalStore 保证 SSR 与首 client render 都用默认值
  // (open=true, width=400 → occupy=408px),与 SSR HTML 一致,无 hydration mismatch。
  // rehydrate 完成后(若用户偏好 width≠400)自动切换到持久化值,通过下方 transition-[padding-left]
  // 平滑过渡,避免突变闪烁(2026-07-22 修复"首屏 sidebar 看起来很宽"的闪烁 bug)。
  // 之前用 !mounted 切换默认值/store 值,会在 mounted 切换瞬间触发 paddingLeft 突变;
  // 现在直接读 store,跳变时机由 zustand 内部 rehydrate 接管,且配合 transition 平滑过渡。
  const mounted = useMounted()
  const { open: aiOpen, width: aiWidth } = useAiPanelStore()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const aiPanelOccupy = aiOpen ? aiWidth + 8 : 0

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
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          id={sidebarId}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        {/*
          work-area-portal-root:作为 Sidebar 搜索弹层(SearchNavItem)的 portal 目标。
          原本只在 MainShell 中存在(仅 (main) 路由可用),现在提升到 GlobalShell,
          让所有路由都能正确渲染搜索弹层。
          overflow-hidden 用于裁剪搜索弹层 slide-in-from-top 动画的初始 translateY(-100%),
          形成从顶部边缘"向下滑出"的视觉效果。
          flex-1 min-h-0 让内容区在 flex 容器中正确填充并允许子元素滚动。
          padding-left 由本组件直接计算(见上方 aiPanelOccupy),避让 fixed 定位的 AISidePanel,
          避免 AISidePanel(紧贴 Sidebar 右侧)覆盖内容区(2026-07-20 修复"重叠"问题)。
          占位规则:
          - AI 面板展开:occupy = width + 8(面板宽度 + 右侧 8px 间距)
          - AI 面板收起:occupy = 0(仅渲染 width:0 的拖拽手柄,不占视觉空间)
        */}
        <div
          id="work-area-portal-root"
          className="relative flex min-w-0 flex-1 min-h-0 flex-col overflow-hidden transition-[padding-left] duration-200 ease-out"
          style={{ paddingLeft: `${aiPanelOccupy}px` }}
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
          {children}
        </div>
        {/* 工作展示区(右侧固定面板):AI 对话内嵌浏览器 / URL 预览。
            open=false 时渲染 null,不影响布局;open=true 时参与 flex 流,work-area 自动收缩。
            不弹独立窗口,纯组件渲染(遵守用户规则:dev server 只在 TRAE 内部运行)。 */}
        <WebWorkPanel />
      </div>
      {/* AISidePanel 作为全局 fixed 组件,移出 flex 容器避免挤压内容区宽度。
          定位样式 left:var(--sidebar-width) 由 Sidebar 同步到 :root,紧贴 Sidebar 右侧。
          z-sticky(990, 引用 --z-sticky):高于内容层,低于 modal/PWA 提示层(z-modal 2000)。
          若 AI 面板 z-index 调到 ≥ 1000,登录/客服等弹框会被 AI 面板遮住。 */}
      <React.Suspense fallback={null}>
        <AISidePanel />
      </React.Suspense>
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
      {/* 开发者工具悬浮侧栏 (2026-07-21)
          - 固定在视口最右侧,平时仅露 10px 把手,hover 自动从右往左拉出 320px 面板
          - 独立于主侧边栏,不与 AISidePanel/主 Sidebar 冲突(右侧空间空闲)
          - 面板内容按 hostname 识别 dev/prod,生产态只显示说明不暴露任何工具
          - 详见 DevToolsTrigger.tsx */}
      <DevToolsTrigger />
    </>
  )
}

export default GlobalShell
