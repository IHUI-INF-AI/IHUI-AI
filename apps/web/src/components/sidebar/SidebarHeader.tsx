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
import { startWindowDrag } from '@/lib/tauri-bridge'
import { Tooltip } from '@/components/feedback'

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
      <rect width="18" height="18" x="3" y="3" rx="5" />
      <path d="M7.5 8v8" />
      {open ? <path d="m14 9 3 3-3 3" /> : <path d="m16 15-3-3 3-3" />}
    </svg>
  )
}

/**
 * 侧边栏顶部:Logo + 折叠/展开按钮(桌面端)或 Logo + 关闭按钮(移动端抽屉)。
 * 桌面端 logo 支持长按拖拽窗口(Tauri decorations:false 无边框窗口)。
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

  // 桌面端 sidebar logo 长按拖拽窗口(Tauri decorations:false 无边框窗口)。
  // 短按(< 300ms)→ ThemeLogo 自身 onClick 跳首页保持不变;长按(≥ 300ms)→ startWindowDrag()。
  const logoDragTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLogoMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || e.button !== 0) return
    logoDragTimer.current = setTimeout(() => {
      void startWindowDrag()
    }, 300)
  }

  const handleLogoDragEnd = () => {
    if (logoDragTimer.current) {
      clearTimeout(logoDragTimer.current)
      logoDragTimer.current = null
    }
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
          'flex h-[44px] shrink-0 items-center justify-between gap-1 px-2 pt-2 pb-0 mx-0',
        )}
      >
        <ThemeLogo
          clickable
          width={80}
          height={26}
          className="h-[26px] w-auto max-w-[80px] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-75"
          onClick={() => navigate('/')}
        />
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
        <Button
          variant="ghost"
          size="icon"
          onClick={onCloseMobile}
          className={cn(
            // h-9 w-9 已被 Button size="icon" + TOPBAR_BTN_W9 覆盖,无需重复声明
            // 跟顶栏按钮共用 base 后,移动端两个按钮视觉/交互/焦点环完全一致,改一处生效所有同源按钮
            'ml-auto shrink-0',
            TOPBAR_BTN_BASE,
            TOPBAR_BTN_W9,
          )}
          aria-label={tc('close')}
        >
          <PanelLeftRounded className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  /**
   * 桌面端 sidebar header:Logo + 折叠/展开按钮(桌面端可见)。
   * 移动端(<1024px)下桌面 sidebar 被 CSS 强制 60px 宽,header 仅显示折叠按钮(隐藏于移动端),
   * 不包含移动关闭按钮,避免移动端看到无用的 X 按钮(关闭按钮只在 mobileHeader 中)。
   */
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 桌面端 Tauri 窗口长按拖拽(鼠标专属交互,无法用键盘拖拽窗口);键盘用户通过内部折叠 Button + logo 点击提供等价交互
    <div
      className={cn(
        // header 高 44px(保持不变,新建任务按钮位置不动)。
        // pt-2 pb-0 + items-center:content-box = 44-8-0 = 36px(从 y=8 到 y=44),
        // 折叠按钮(36px)填满 content-box,logo(26px)在 content-box 内居中,
        // 两者中心都在 y=26,与 GlobalTopBar 按钮中心(pt-2+h-9/2=26)垂直对齐(2026-07-30 用户反馈)。
        // gap-1(4px)让 logo(80) + gap(4) + 按钮(28) = 112px < 内容区 114px,不溢出。
        'flex h-[44px] shrink-0 items-center justify-between gap-1 px-2 pt-2 pb-0 mx-0 transition-[padding] duration-200',
        // 折叠态:aside 的 border-r(1px)使内容区 59px,header 居中后按钮会偏左 0.5px。
        // 用 pl-[9px] pr-2 补偿,让按钮回到 60px 视觉中心。
        collapsed && 'justify-center pl-[9px] pr-2 mx-0',
        // 桌面端长按可拖拽窗口,显示 move 光标提示;非桌面端不加(避免误导)。
        isDesktop && 'cursor-move',
      )}
      onMouseDown={handleLogoMouseDown}
      onMouseUp={handleLogoDragEnd}
      onMouseLeave={handleLogoDragEnd}
    >
      {!collapsed && (
        <ThemeLogo
          clickable
          width={80}
          height={26}
          className="h-[26px] w-auto max-w-[80px] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-75"
          onClick={() => navigate('/')}
        />
      )}
      <Tooltip content={collapsed ? t('expand') : t('collapse')} side="right">
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
          className={cn(
            TOPBAR_BTN_BASE,
            TOPBAR_BTN_W9,
            'h-9 p-0 hidden min-[1024px]:flex bg-transparent [&>svg]:!h-5 [&>svg]:!w-5',
          )}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          {/* 图标 20px (h-5 w-5),2026-08-01 用户要求加大 */}
          {collapsed ? (
            <PanelLeftRounded open className="h-5 w-5" />
          ) : (
            <PanelLeftRounded className="h-5 w-5" />
          )}
        </Button>
      </Tooltip>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
