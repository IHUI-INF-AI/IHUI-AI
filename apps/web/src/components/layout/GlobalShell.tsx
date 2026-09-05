// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/sidebar'
import { AISidePanel } from '@/components/ai/ai-side-panel'
import { TooltipProvider } from '@/components/feedback'
import { WebWorkPanel } from '@/components/work-panel/web-work-panel'
import {
  PWAInstallPrompt,
  PWAUpdatePrompt,
  UpdatePrompt,
  QuitUpdateOverlay,
  NavigationProgress,
  VisitTracker,
  AnalyticsCapture,
} from '@/components/common'
import { WorkspacePermissionRequestDialog } from '@/components/workspace/workspace-permission-request-dialog'
import { GlobalTopBar } from '@/components/layout/GlobalTopBar'
import { Button } from '@ihui/ui-react'
import { TOPBAR_BTN_BASE, TOPBAR_BTN_W9 } from '@/lib/nav-styles'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useMounted } from '@/hooks/use-mounted'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { PageSkeleton } from '@/components/common/PageSkeleton'
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
 *       <Button mobile menu />          ← 移动端浮动菜单按钮(min-[1024px]:hidden)
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
 * sidebar-collapsed 状态同步(2026-09-04 下沉到 Sidebar 内部):
 * - collapsed 状态原在 GlobalShell,现下沉到 Sidebar 内部(性能优化:折叠只重渲染 Sidebar,
 *   不牵连 GlobalShell 的 children/AISidePanel/WebWorkPanel)
 * - localStorage 持久化 + storage 事件跨标签页同步均由 Sidebar 内部管理
 * - 折叠/展开/拖拽宽度通过 :root --sidebar-width CSS 变量传递给 AISidePanel
 *   (见 sidebar.tsx 的 useEffect)
 */
export function GlobalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
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
  // 2026-08-17 工作展示区折叠:true 时隐藏 work-area,AI 面板占满右侧(用户需求)
  const workAreaCollapsed = useAiPanelStore((s) => s.workAreaCollapsed)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const pending = useNavigationStore((s) => s.pending)
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

  // 小尺寸侧边栏折叠改用纯 CSS 方案(2026-08-02 修订):
  // - 旧方案用 useIsMobile + setCollapsed effect,但 useIsMobile SSR 返回 false / CSR 返回 true
  //   导致 hydration mismatch + 闪烁(首帧展开态 → effect 跑 setCollapsed(true) → 重渲染折叠态)
  // - 新方案:不在 JS 层强制 collapsed,改由 sidebar.tsx aside 加 CSS 媒体查询类
  //   `max-[1023px]:!w-[60px]` 在小尺寸下强制 60px 折叠宽度,导航项用 collapsed prop 控制图标态
  // - collapsed 状态已下沉到 Sidebar 内部(2026-09-04 性能优化),GlobalShell 不再持有。
  //   小尺寸 CSS 只覆盖宽度,不改 collapsed state,避免 hydration 问题和 JS 时序闪烁。

  // 2026-08-05 性能优化:useCallback 稳定回调引用,配合 React.memo(Sidebar) 防止
  // GlobalShell 重渲染时 Sidebar 因 props 引用变化而跟随重渲染。
  const handleCloseMobile = React.useCallback(() => setMobileOpen(false), [])

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = useAuthStore((s) => s.token)
  const refreshToken = useAuthStore((s) => s.refreshToken)

  /**
   * 页面刷新后自动续期恢复 + bootstrap 静默刷新(2026-08-11 修复,2026-08-14 去并发化)
   *
   * 背景:
   * - isAuthenticated 持久化到 localStorage(页面刷新后恢复为 true)
   * - token / refreshToken 不持久化(安全,防止 XSS 窃取)
   * - httpOnly auth_token cookie 由后端 Set-Cookie 管理,JS 无法读取
   *
   * 修复(2026-08-14):移除场景 B 的 refreshAccessToken() 并发刷新。
   * 原因:GlobalShell 与 useAuthBootstrap 同时发 /auth/refresh 会导致后端 refresh token
   * 单次轮转冲突,触发 RFC 6749 §10.4 family 吊销,自动登录丢失。
   * 现在完全交给 useAuthBootstrap 统一处理刷新,GlobalShell 只负责在 token 恢复后
   * 启动自动续期(startAutoRefresh)。
   *
   * 流程:
   * 1. 页面刷新后 isAuthenticated=true 但 token=null(常态)
   * 2. useAuthBootstrap 统一静默刷新获取新 token
   * 3. token 恢复后,本 effect 因依赖变化重新执行,启动 startAutoRefresh
   * 4. 若 refresh cookie 也过期 → useAuthBootstrap 内 logout(),isAuthenticated 降级为 false,
   *    本 effect 不再启动 startAutoRefresh,用户下次主动操作时触发登录弹窗
   */
  React.useEffect(() => {
    if (!mounted) return
    // 场景:内存已有 token + refreshToken,直接恢复自动续期
    if (isAuthenticated && token && refreshToken) {
      try {
        const raw = localStorage.getItem('ihui-login-prefs')
        const autoRenew = raw ? (JSON.parse(raw).autoRenew ?? true) : true
        if (autoRenew) startAutoRefresh()
      } catch {
        startAutoRefresh()
      }
    }
  }, [mounted, isAuthenticated, token, refreshToken])

  React.useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // /login 路由:嵌入式二维码面板(mobile-rn WebView/iframe 加载)或 QR 完整模式,
  // 不需要 Sidebar / AISidePanel / WebWorkPanel,只渲染 children(PageClient.tsx 内容)。
  // 2026-08-04 修复:此前 /login?method=qr&embed=true 被 GlobalShell 包裹,
  // 导致 iframe 加载的页面显示首页导航 + 任务列表,二维码面板被布局覆盖不可见。
  // 放在所有 hooks 之后,避免违反 React hooks 规则(条件 return 不能在 hooks 调用之前)。
  if (pathname === '/login') {
    return <TooltipProvider>{children}</TooltipProvider>
  }

  return (
    <TooltipProvider>
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
          <React.Suspense
            // 2026-08-28 CLS 根治:此前 fallback={null},Sidebar 因内部 useSearchParams() 在
            // 预渲染/挂起阶段不渲染,懒加载完成后才以 160px 宽度插入 flex 流,
            // 把右列 work-area 从 x=0 全宽挤到 x=160 —— 一次性 0.30 CLS(web-vitals.spec.ts 实锤)。
            // 修复:fallback 渲染等宽占位 aside,预留与真实 Sidebar 相同的空间:
            // - width 引用 layout.tsx inline script 预设的 --sidebar-width(160-180,fallback 160;
            //   折叠持久化时 inline script 预设 60px),与 sidebar.tsx 真实 aside 的宽度策略一致
            // - data-viewport-collapsed="true" 复用 globals.css <1024px 强制 60px 规则,
            //   移动端占位与真实 sidebar 行为字节级一致
            // - bg-background 避免占位期间透出底色闪烁
            fallback={
              <aside
                aria-hidden
                data-viewport-collapsed="true"
                className="relative h-screen shrink-0 bg-background"
                style={{ width: 'var(--sidebar-width, 160px)' }}
              />
            }
          >
            <Sidebar id={sidebarId} mobileOpen={mobileOpen} onCloseMobile={handleCloseMobile} />
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
            <React.Suspense
              // 2026-08-28 CLS 根治:与 Sidebar 同模式。此前 fallback={null},AISidePanel 挂起期间
              // 不占空间,挂载后以 width+6px(默认 386px)插入 flex 流,把 work-area 从 1120px
              // 压到 734px —— 一次性 0.26 CLS。修复:fallback 渲染等宽占位:
              // - width 引用 layout.tsx inline script 预设的 --ai-panel-width(读 localStorage
              //   ihui-ai-panel state.width,范围 320-720,fallback 380),与真实面板宽度策略一致
              // - hidden + min-[768px]:block 复制真实容器的响应式显隐(<768px 走浮窗不占 flex 空间)
              // - mr-1.5 py-2 shrink-0 与真实容器(展开态)class 一致,占位与实体几何对齐
              // - open 恒为 true(store merge 强制)、floatMode/workAreaCollapsed 恒为默认 false
              //   (不持久化),首帧占位宽度与挂载后真实宽度必然一致
              fallback={
                <div
                  aria-hidden
                  className="relative hidden h-full shrink-0 mr-1.5 py-2 min-[768px]:block"
                  style={{ width: 'var(--ai-panel-width, 380px)' }}
                />
              }
            >
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
              className={cn(
                'relative flex min-w-0 flex-1 min-h-0 flex-col overflow-hidden',
                // 2026-08-17 工作展示区折叠:true 时整个右侧内容区隐藏,AI 面板 flex-1 占满
                workAreaCollapsed && 'hidden',
              )}
            >
              {/* 全局导航进度条 + 内容区加载覆盖层(2026-08-05 立):
                点击侧边栏链接时立即显示进度条 + 骨架屏覆盖内容区,
                消除"点击后内容区无反应"的间隙。位于 work-area-portal-root 内部,
                absolute 定位依赖父级 relative 容器。 */}
              <NavigationProgress />
              {/* 移动端菜单按钮(2026-07-31 第十三次重写,改用 GlobalTopBar 注入方式):
                - 原方案:absolute left-2 top-2 z-modal,在 work-area 内绝对定位
                  → 根因:与 TagsViewSearchButton (36x36 bg-card,同位置 left:0) 物理重叠,
                    即使 z-modal 也无法在所有 stacking context 下稳定覆盖
                - 新方案:作为 GlobalTopBar flex 流的第 0 个元素,物理上不重叠任何现有按钮
                - 桌面端 min-[1024px]:flex 隐藏,移动端 lg 以下显示 */}
              <React.Suspense fallback={null}>
                <GlobalTopBar
                  mobileMenu={
                    // 2026-07-31 第十八次微调(用户反馈"button 这个图标和 X 关闭按钮也不是 web 端那个,为什么要单独额外又配置图标"):
                    // - 改用 nav-styles.ts 共享的 TOPBAR_BTN_BASE + TOPBAR_BTN_W9,跟 GlobalTopBar
                    //   的搜索/Plus/chevron/窗口控制 4 类按钮字节级一致(同 bg-card / hover:bg-accent / focus-visible:bg-accent)
                    // - 去掉之前单独加的 `border border-border` 和 `hover:text-foreground` —— web 顶栏的
                    //   4 类按钮都没 border,移动端"凭空多出边框"是视觉不一致的根因
                    // - icon 仍用 h-3.5 w-3.5 (14px) 跟顶栏 Plus / 窗口控制 X 完全统一
                    // - h-9 w-9 通过 TOPBAR_BTN_W9 自动应用,跟顶栏 h-9 父容器 + h-full 子元素视觉等价
                    // - ml-1.5 (6px) 跟其他顶栏按钮 gap-1 (4px) + 按钮视觉中心对齐
                    // - 跟 X 关闭按钮共用 base 后,移动端两个按钮视觉/交互/焦点环完全一致,改一处生效所有同源按钮
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMobileOpen((o) => !o)}
                      aria-label={t('menu')}
                      className={cn(
                        'ml-1.5 h-9 w-9 shrink-0 min-[1024px]:hidden',
                        TOPBAR_BTN_BASE,
                        TOPBAR_BTN_W9,
                      )}
                    >
                      <PanelLeftOpen className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </React.Suspense>
              {/* 2026-08-01 架构改动:WebWorkPanel 从右列独立区域改为嵌入 work-area 内覆盖 children
                (用户规则:"不允许额外出来一个窗口,所有内容必须在工作内容展示区内展示")
                - relative 容器包裹 children + WebWorkPanel
                - WebWorkPanel 内部 absolute inset-0 覆盖 children(MainShell 工作区卡片)
                - open=false 时 WebWorkPanel return null,children 正常显示
                - open=true 时 WebWorkPanel 替换展示工作区内容(非右列独立窗口) */}
              <div className="relative flex min-h-0 flex-1 flex-col">
                {/*
                内容区加载覆盖层(2026-08-05 立,2026-09-02 第三刀重做时序):
                始终在 DOM 中,不依赖条件渲染(点击后立即进入过渡状态,无 React 渲染滞后)。
                时序关键:显示走 delay-150(延迟淡入),隐藏走 duration-75(立即淡出) —
                - 预取命中时路由切换 <50ms,pending 在 150ms 内就复位,骨架淡入从未开始 → 用户直接看到新页面,零骨架、零闪烁;
                - 真正慢的导航(>150ms)骨架才淡入,保留加载反馈;
                - 原"pending 后立即 opacity-100"方案会让预取提速被骨架闪现完全抵消。
                pointer-events 无 delay:pending 期间立即拦截点击,防导航中途重复触发。
              */}
                <div
                  className={cn(
                    'absolute inset-0 z-10 bg-background transition-opacity',
                    pending
                      ? 'opacity-100 duration-100 delay-150'
                      : 'pointer-events-none opacity-0 duration-75',
                  )}
                  role="status"
                  aria-label="页面加载中"
                >
                  <PageSkeleton />
                </div>
                {children}
                <WebWorkPanel />
              </div>
            </div>
          </div>
        </div>
        {/* PWA 提示:固定悬浮于右下角,不影响主布局。层级 z-modal(2000,引用 --z-modal)。
            2026-09-05 移动端:手机(<768px)改挂顶栏下方通栏——右下角悬浮条实测遮挡聊天输入框。 */}
        <div className="pointer-events-none fixed bottom-4 right-4 z-modal flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 max-[767px]:bottom-auto max-[767px]:left-3 max-[767px]:right-3 max-[767px]:top-14 max-[767px]:w-auto">
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
        {/* 桌面端应用更新下拉提示(平台独占:仅 Tauri 环境渲染,浏览器端 no-op)。
          内部调用 useUpdater hook,启动静默检查 + 监听托盘菜单 desktop-check-update 事件。 */}
        <UpdatePrompt />
        {/* 桌面端退出时自动更新遮罩(平台独占:仅 Tauri 环境渲染,浏览器端 no-op)。
          拦截退出流程(Ctrl+Q / 托盘退出),自动检查+下载+安装+重启,显示全屏进度遮罩。 */}
        <QuitUpdateOverlay />
        {/* 页面访问埋点(2026-08-10 立):全局挂载,pathname 变化自动上报 visit_logs */}
        <VisitTracker />
        {/* 全局行为埋点(2026-08-10 立):自动采集点击/搜索/下载/表单提交 → analytics_events */}
        <AnalyticsCapture />
        {/*
        Agent 任务进度 popover(2026-07-27 v6):
        trigger + popover 已内嵌到 MessageInput 输入框附加栏(上方居中),
        点击 trigger 弹小 popover 显示 plan steps 列表,不再全局挂载底部大弹窗。
      */}
      </>
    </TooltipProvider>
  )
}

export default GlobalShell
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
