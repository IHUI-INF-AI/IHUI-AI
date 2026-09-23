// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useNavigateWithProgress } from '@/stores/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { TOPBAR_BTN_BASE, TOPBAR_BTN_W9 } from '@/lib/nav-styles'
import { Button, ThemeLogo } from '@ihui/ui-react'
import { useDesktop } from '@/hooks/use-desktop'
import { armWindowDragOnFirstMove, isDraggableBlankArea } from '@/lib/window-drag'
import { Tooltip } from '@/components/feedback'
import { rnRadius } from '@ihui/design-tokens'

interface SidebarHeaderProps {
  variant: 'desktop' | 'mobile'
  collapsed: boolean
  onToggleCollapse?: () => void
  onCloseMobile?: () => void
}

/** 自定义侧边栏折叠/展开图标(对标设计稿):大圆角面板 + 左侧短竖线(两端不贴外框) + 方向箭头
 *  open=false 箭头朝左(收起);open=true 箭头朝右(展开) */
function PanelLeftRounded({
  open = false,
  ...props
}: React.SVGProps<SVGSVGElement> & { open?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx={rnRadius.sm} />
      <path d="M7.5 8v8" />
      {open ? <path d="m14 9 3 3-3 3" /> : <path d="m16 15-3-3 3-3" />}
    </svg>
  )
}

/**
 * 侧边栏顶部:Logo + 折叠/展开按钮(桌面端)或 Logo + 关闭按钮(移动端抽屉)。
 * 桌面端 logo 按下即拖拽窗口(Tauri decorations:false 无边框窗口)。
 */
export function SidebarHeader({
  variant,
  collapsed,
  onToggleCollapse,
  onCloseMobile,
}: SidebarHeaderProps) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const navigate = useNavigateWithProgress()
  const { isDesktop } = useDesktop()

  // 桌面端 sidebar header 按下即拖拽窗口(Tauri decorations:false 无边框窗口;
  // 2026-09-21 用户要求"直接点击就可以拖拽,不需要长按",实现见 lib/window-drag.ts)。
  // 拖拽面 = 整条 header 含 logo(用户习惯抓 logo 拖窗口,旧实现即如此);排除折叠/展开
  // Button 等真控件,避免 Tauri 原生拖拽循环吞掉它们的 click(曾致"展开按钮点了没反应")。
  // logo 的"点一下跳首页"由位移阈值保护:无位移 → 不启动拖拽 → click 照常派发。
  const handleLogoMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || e.button !== 0) return
    if (!isDraggableBlankArea(e.target as HTMLElement)) return
    armWindowDragOnFirstMove(e.screenX, e.screenY)
  }

  if (variant === 'mobile') {
    /**
     * 移动端 drawer header:Logo + 关闭按钮。
     * 与 desktopHeader 分离,移动关闭按钮仅出现在移动 drawer 中,
     * 防止移动端桌面 sidebar 中出现无用的 X 关闭按钮(点击调用 onCloseMobile 但 drawer 未打开)。
     */
    return (
      <div
        className={cn(
          // 与 desktopHeader 同尺寸结构,但无桌面端拖拽窗口逻辑
          // 2026-09-05 修复:左侧 pl-12(48px) 避让 GlobalShell 悬浮的拉出/收回切换按钮
          // (z-popover,常驻 x=6-42),避免 logo 被按钮盖住;logo 允许收缩(flex-1 min-w-0)
          'flex h-[44px] shrink-0 items-center justify-between gap-1 pl-12 pr-2 pt-2 pb-0 mx-0',
        )}
      >
        <div className="min-w-0 flex-1">
          <ThemeLogo
            clickable
            width={80}
            height={26}
            className="h-[26px] max-h-[26px] w-auto max-w-full cursor-pointer transition-opacity hover:opacity-75"
            // 2026-09-05 修复:点击 logo 跳首页的同时收起抽屉(原实现跳转后抽屉仍开着,
            // 用户感知"点了没反应")
            onClick={() => {
              onCloseMobile?.()
              navigate('/')
            }}
          />
        </div>
        {/* 2026-07-31 第十八次微调(用户反馈"X 关闭按钮也不是 web 端那个,为什么要单独额外又配置图标"):
            - 改用 nav-styles.ts 共享的 TOPBAR_BTN_BASE + TOPBAR_BTN_W9,跟 GlobalTopBar
              的搜索/Plus/chevron/窗口控制 4 类按钮字节级一致(同 bg-card / hover:bg-accent / rounded-md / focus-visible:bg-accent)
            - 去掉之前单独加的 `border border-border` 和 `hover:text-foreground` —— web 顶栏的
              4 类按钮都没 border,移动端"凭空多出边框"是视觉不一致的根因
            - icon h-3.5 w-3.5 (14px) 跟顶栏窗口控制 X (h-3.5 w-3.5) + Plus (h-3.5 w-3.5) 完全统一,
              不再单独配 h-4 w-4 (16px) 跟顶栏不一致
            - h-9 w-9 通过 TOPBAR_BTN_W9 自动应用(原 h-9 w-9 也对,TOPBAR_BTN_BASE 是 h-full,
              移动端 wrapper 没 h-9 父容器,所以在移动端实例上加 h-9 让按钮自身 36×36,跟桌面端 h-9
              父容器 + h-full 子元素等价)
            - 跟顶栏按钮共用 base 后,改一处生效所有同源按钮,杜绝"漏改"漂移 */}
        {/* 2026-09-21 修复:36×36 定尺寸 wrapper(原生 div,Button 守门豁免)。
            TOPBAR_BTN_BASE 内置 h-full,直接放在 h-[44px] header 里会被拉成 36×44 长方形;
            wrapper 提供确定高度后 h-full 正确解析为 36px。ml-auto/shrink-0 随之上移到 wrapper。 */}
        <div className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            className={cn(
              // 跟顶栏按钮共用 base 后,移动端两个按钮视觉/交互/焦点环完全一致,改一处生效所有同源按钮
              TOPBAR_BTN_BASE,
              TOPBAR_BTN_W9,
            )}
            aria-label={tc('close')}
          >
            {/* 2026-09-05:图标 14px→20px(h-5 w-5),与桌面端折叠按钮 2026-08-01 用户要求"图标加大"对齐,
                移动端触屏更易辨识/命中 */}
            <PanelLeftRounded className="h-5 w-5" />
          </Button>
        </div>
      </div>
    )
  }

  /**
   * 折叠态 header(2026-09-07 重做):方形 logo + 展开按钮竖排。
   * 此前折叠态只渲染折叠按钮且按钮带 hidden min-[1024px]:flex,在 768-1023px
   * 视口强制折叠区间按钮被 display:none,logo 也被 CSS 隐藏 → header 整块空白(用户反馈红框)。
   * 现在:36×36 方形 logo(/images/logo.png,同 EmptyState 图)+ 20px 展开按钮竖排,
   * 60px 条内水平居中,点击 logo 跳首页(与展开态长 logo 行为一致)。
   */
  if (collapsed) {
    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 同展开态:Tauri 窗口按下即拖拽
      <div
        data-tauri-drag-region
        className={cn(
          'flex shrink-0 flex-col items-center gap-1 px-1 pt-2 pb-1 mx-0',
          isDesktop && 'cursor-move',
        )}
        onMouseDown={handleLogoMouseDown}
      >
        {/* 方形品牌logo:与 EmptyState 同源 /images/logo.png,36×36 原样显示。
            2026-09-21 用户要求去掉遮罩容器圆角:该 PNG 自身已是 22% 圆角 + 四角透明的成品图
            (2534px 上约 558px 半径,缩到 36px ≈ 8px),再套 rounded-xl(12px)比图自身更圆,
            会把黑底四角切出缺口露出底色。
            2026-09-22 与展开态统一:改用 span[role=button] 而非 <button> —— Tauri 拖拽脚本
            跳过 img/button 等原生可交互标签(实测挂在 img 上零位移、挂在 div/span 上 1:1),
            故把 img 置 pointer-events-none、拖窗属性与点击挂在本层 span;键盘可达性由
            tabIndex + Enter/Space 补齐,不靠豁免 lint。 */}
        <span
          role="button"
          tabIndex={0}
          aria-label="IHUI AI"
          data-tauri-drag-region
          data-window-drag
          onClick={() => navigate('/')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navigate('/')
            }
          }}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_img]:pointer-events-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 与 EmptyState/ThemeLogo 同源,img 保证 SSR 一致 */}
          <img
            src="/images/logo.png?v=20260719-unify"
            alt=""
            width={36}
            height={36}
            draggable={false}
            className="h-9 w-9 select-none object-contain"
          />
        </span>
        {/* 2026-09-21 修复(用户反馈"拉出按钮跟+号重合 + 按钮变长方形"):
            TOPBAR_BTN_BASE 内置 h-full,折叠态 header 是 flex-col 自动高度,循环百分比解析
            被 Chrome 一次性解析成 60px 高 → 按钮变 36×60 长方形并压住下方 + 新建任务按钮。
            h-full 需要"确定高度"父容器才成立:包一层 36×36 定尺寸 wrapper(原生 div,
            Button 守门豁免),按钮 h-full/w-9 在其中正确解析为 36×36 正方形。 */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center">
          <Tooltip content={t('expand')} side="right">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn(
                TOPBAR_BTN_BASE,
                TOPBAR_BTN_W9,
                // 注意:不再用 hidden min-[1024px]:flex —— 768-1023px 视口强制折叠时按钮必须可见
                'p-0 flex bg-transparent [&>svg]:!h-5 [&>svg]:!w-5',
              )}
              aria-label={t('expand')}
            >
              <PanelLeftRounded open className="h-5 w-5" />
            </Button>
          </Tooltip>
        </div>
      </div>
    )
  }

  /**
   * 展开态 header(折叠态已在上方独立分支提前返回):
   * Logo + 折叠按钮,仅在展开态渲染(≥1024px 桌面,或用户未折叠时)。
   */
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 桌面端 Tauri 窗口按下即拖拽(鼠标专属交互,无法用键盘拖拽窗口);键盘用户通过内部折叠 Button + logo 点击提供等价交互
    <div
      // data-sidebar-header-expanded:标记展开态 header,globals.css 平板区间(768-1023px)
      // 用它在 hydration 前隐藏 80px 长 logo 并居中折叠按钮 —— SSR 输出展开态 HTML,
      // 该区间 CSS 已强制 aside 60px,长 logo 会与折叠按钮重叠(2026-09-09 修复)。
      // hydration 后 React 切到折叠态分支(方形 logo + 展开按钮),此标记不再存在。
      data-sidebar-header-expanded
      data-tauri-drag-region
      className={cn(
        // header 高 44px(保持不变,新建任务按钮位置不动)。
        // pt-2 pb-0 + items-center:content-box = 44-8-0 = 36px(从 y=8 到 y=44),
        // 折叠按钮(36px)填满 content-box,logo(26px)在 content-box 内居中,
        // 两者中心都在 y=26,与 GlobalTopBar 按钮中心(pt-2+h-9/2=26)垂直对齐(2026-07-30 用户反馈)。
        // gap-1(4px)让 logo(80) + gap(4) + 按钮(28) = 112px < 内容区 114px,不溢出。
        'flex h-[44px] shrink-0 items-center justify-between gap-1 px-2 pt-2 pb-0 mx-0 transition-[padding] duration-200',
        // 桌面端按下即可拖拽窗口,显示 move 光标提示;非桌面端不加(避免误导)。
        isDesktop && 'cursor-move',
      )}
      onMouseDown={handleLogoMouseDown}
    >
      {/* data-sidebar-logo:标识侧边栏长 logo(旧版 CSS 在 768-1023px 隐藏;
          2026-09-07 起该区间走折叠态分支渲染方形 logo,此 span 仅展开态存在) */}
      <span
        data-sidebar-logo
        // 拖窗属性必须挂在"真正承接 mousedown 的元素"上:Tauri 的拖拽脚本会跳过
        // img 这类原生可拖标签(实测挂在 img 上完全不生效),故把 img 置为
        // pointer-events-none,让按下落到本 span;点击语义随之上移到本层。
        // 用 span+role 而非 <button>:button 标签同样在 Tauri 拖拽脚本的跳过名单里。
        data-tauri-drag-region
        // 双保险:原生拖拽生效时模态循环会吃掉 mousemove(JS 路径自然不触发);
        // 若 Tauri 也跳过 role=button,则退到 JS 位移阈值路径,不至于完全拖不动
        data-window-drag
        role="button"
        tabIndex={0}
        aria-label="IHUI AI"
        onDragStart={(e) => {
          if (isDesktop) e.preventDefault()
        }}
        onClick={() => navigate('/')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate('/')
          }
        }}
        className="flex shrink-0 cursor-pointer [&_img]:pointer-events-none"
      >
        <ThemeLogo
          clickable
          width={80}
          height={26}
          className="h-[26px] w-auto max-w-[80px] flex-shrink-0 transition-opacity hover:opacity-75"
        />
      </span>
      <Tooltip content={t('collapse')} side="right">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          // 2026-07-31 立:桌面端折叠按钮改用 TOPBAR_BTN_BASE + TOPBAR_BTN_W9 共享样式,
          // 跟移动端关闭按钮 / 顶栏 Plus 按钮同源(bg-card + hover:bg-accent + text-foreground/80)
          // 统一按钮风格,杜绝"桌面端用 hover:bg-foreground/20 / 移动端用 hover:bg-accent"风格漂移
          // h-9 显式覆盖 TOPBAR_BTN_BASE 的 h-full(父容器 h-[44px] 用 h-full 会撑到 44px,跟其他元素不对齐)
          // 2026-08-01 立:用户要求收起按钮默认无背景容器色,用 bg-transparent 覆盖 bg-card。
          // 2026-08-01 立:用户要求"右上角的拉出缩回按钮图标加大,容器大小别变":
          // - 容器 h-9 w-9 (36×36) 保持不变(跟顶栏其他按钮同尺寸)
          // - 图标从 h-3.5 w-3.5 (14px) 加大到 h-5 w-5 (20px),更显眼易点击
          // - 追加 [&>svg]:!h-5 [&>svg]:!w-5 覆盖 TOPBAR_BTN_BASE 末尾的 [&>svg]:!h-3.5 [&>svg]:!w-3.5
          //   (tailwind-merge 同 specificity 后定义胜出,确保 20px 生效)
          // 2026-09-07:去掉 hidden min-[1024px]:flex —— 展开态 header 只在侧边栏可见时渲染,
          // 按钮恒 flex(旧规则曾在 768-1023px 把按钮藏成空白)
          className={cn(
            TOPBAR_BTN_BASE,
            TOPBAR_BTN_W9,
            'h-9 p-0 flex bg-transparent [&>svg]:!h-5 [&>svg]:!w-5',
          )}
          aria-label={t('collapse')}
        >
          {/* 图标 20px (h-5 w-5),2026-08-01 用户要求加大 */}
          <PanelLeftRounded className="h-5 w-5" />
        </Button>
      </Tooltip>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
