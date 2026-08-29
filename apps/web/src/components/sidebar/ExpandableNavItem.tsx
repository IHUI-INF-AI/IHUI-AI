'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  NAV_ITEM_BASE_CLASS,
  NAV_ITEM_COLLAPSED_CLASS,
  NAV_ITEM_EXPANDED_CLASS,
  NAV_CHILD_CLASS,
} from '@/lib/nav-styles'
import { Dropdown } from '@/components/feedback'
import { useNotificationStore } from '@/stores/notification'
import type { NavItem, RegisterRef } from './types'

interface ExpandableNavItemProps {
  item: NavItem
  collapsed: boolean
  activeHref: string | undefined
  onCloseMobile: () => void
  registerRef: RegisterRef
  t: (key: string) => string
  /**
   * 桌面 / 移动 aside 各自独立 ID 空间,避免 DOM 重复 id。
   * 派生 listId 必须含 scope 才能保证 HTML5 id 唯一性 + SSR/CSR 完全一致(不依赖 useId)。
   */
  scope: 'desktop' | 'mobile'
  /** 点击导航时立即更新 active 状态不等导航完成 */
  onBeforeNav?: (href: string) => void
}

const ExpandableNavItem = React.memo(function ExpandableNavItem({
  item,
  collapsed,
  activeHref,
  onCloseMobile,
  registerRef,
  t,
  scope,
  onBeforeNav,
}: ExpandableNavItemProps) {
  const router = useRouter()
  const children = item.children ?? []
  // 性能修复:使用预计算的 activeHref 替代 pathname，避免 isHrefActive 遍历 ALL_NAV_HREFS。
  const parentActive = activeHref ? children.some((child) => child.href === activeHref) : false
  const storageKey = `sidebar-expand-${item.href}`
  // hydration-safe 持久化展开(2026-08-28 根因修复,与 NavGroupSection 同模式):
  // 旧实现(2026-07-22)用 lazy initializer 读 localStorage,存在两个问题:
  //   1. hydration 陷阱:子菜单是条件渲染({open && childList}),SSR 固定 false,
  //      client lazy initializer 为 true 时产生结构性 mismatch,React 走 recoverable error 路径整体重渲;
  //      aria-expanded 属性 mismatch 则被 suppressHydrationWarning 压制且永不 patch。
  //   2. mount 写污染:persist effect 在首次挂载就写 localStorage('0'),
  //      复发 2026-07-20 已在分组侧根除的"首挂载写 localStorage 污染测试环境"问题。
  // 新方案:首帧(hydration)固定 false 与 SSR 一致;mount 后 effect 只读同步;
  // 持久化只在用户主动 toggle 时写入。
  const [open, setOpen] = React.useState(false)

  // mount 后同步 localStorage 持久化值(只读不写)
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === '1') setOpen(true)
    } catch {
      // localStorage 不可用(隐私模式等),保持默认折叠
    }
  }, [storageKey])
  // 静态派生 listId(不含 useId),保证 SSR/CSR 字节级一致 + DOM 唯一 id。
  // React 18 useId 在两个 React 树(桌面/移动 aside)间偶发漂移会导致 hydration mismatch + Radix aria-controls 失效。
  const listId = `exp-list-${scope}-${item.href.replace(/[^a-z0-9]+/gi, '-')}`

  // 未读数 badge:/messages 子项显示未读私信/通知数(从 useNotificationStore 获取)
  const notifUnread = useNotificationStore((s) => s.unreadCount)
  const msgUnread = useNotificationStore(
    (s) => s.notifications.filter((n) => n.type === 'message').length,
  )
  const getBadgeCount = (badge?: 'messages' | 'notification'): number => {
    if (badge === 'messages') return msgUnread
    if (badge === 'notification') return notifUnread
    return 0
  }

  // 2026-07-22 简化:删除原 useEffect 延迟读取(open 已由 lazy initializer 同步设置)。
  // 仅在 parentActive 变化时同步处理(URL 命中子项时父菜单应展开)。
  React.useEffect(() => {
    if (parentActive && !open) setOpen(true)
  }, [parentActive, open])

  // 2026-08-28 修复:持久化只在用户主动 toggle 时写入(handleToggleOpen),
  // 不再挂在 effect 上 —— 旧写法首次挂载(open=false)就写 '0',污染 localStorage,
  // 且与只读同步 effect 形成"读自己刚写的值"的混乱时序。
  const handleToggleOpen = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        // localStorage 不可用
      }
      return next
    })
  }, [storageKey])

  const Icon = item.icon
  // 测量文字宽度，用于将 indicator 定位到文字正中下方
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [textWidth, setTextWidth] = React.useState(0)
  // label 优先级:dynamicLabel(admin 动态加载的路由名)> t(labelKey)(i18n 翻译)
  // 2026-08-29 修:声明必须在 useEffect 之前(此前依赖 [label] 的 effect 先于声明,TS2448 TDZ)
  const label = item.dynamicLabel ?? t(item.labelKey)
  React.useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.offsetWidth)
    }
  }, [label])

  const parentClassName = cn(
    // group/exp:精简高级的二级菜单指示样式(GitHub/Linear/Notion 风格)
    //   - 闭合态:与普通 NavLink 一致,前景色 70% + hover 反馈
    //   - 展开 / 父级激活(子路由命中):统一为微弱主色背景(bg-primary/10)+ 主色文本(text-primary)+ 文本加粗
    //     **根因(2026-07-19 二次修复)**:旧逻辑 parentActive → bg-primary + 子级 active → bg-primary
    //     两者同色,父级深绿底白字 + 子级深绿底白字 = 视觉上"两个绿色容器"垂直堆叠。
    //     根治:parentActive 状态不再用满色,改用 bg-primary/10(浅薄荷绿)+ text-primary 主色文字;
    //     满色 bg-primary 仅保留给叶子级(active 子级),保证视觉上只有一个绿色块。
    //   - focus-visible ring 保留键盘可访问性指示
    // 指示符是 lucide ChevronDown 图标(absolute 定位在按钮底部居中),不是 border/hr/divide-*
    // 不违反项目"禁止分割线"硬约束(规则禁止的是 <hr>、divide-*、单边 border 分隔,不禁止图标指示符)
    'group/exp relative',
    NAV_ITEM_BASE_CLASS,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    // 二态优先级:展开/子级激活合一(都是浅绿+主色文字+加粗) vs 闭合态(70% 灰+hover)
    parentActive || open
      ? 'bg-primary/10 text-primary font-semibold'
      : 'text-foreground/70 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
    collapsed ? NAV_ITEM_COLLAPSED_CLASS : NAV_ITEM_EXPANDED_CLASS,
  )

  const childClassName = (active: boolean) =>
    cn(
      NAV_CHILD_CLASS,
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-foreground/70 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
    )

  const childList = (
    <div id={listId} role="group" aria-label={label} className="flex flex-col gap-0.5">
      {children.map((child) => {
        const ChildIcon = child.icon
        const active = activeHref === child.href
        const childLabel = child.dynamicLabel ?? t(child.labelKey)
        const badgeCount = getBadgeCount(child.badge)
        const refCb = (el: HTMLElement | null) => registerRef(child.href, el)
        const childHandleClick = () => {
          onBeforeNav?.(child.href)
          onCloseMobile()
        }
        return (
          <Link
            key={child.href}
            data-testid={`nav-${child.labelKey}`}
            href={child.href}
            ref={refCb}
            onClick={childHandleClick}
            aria-current={active ? 'page' : undefined}
            className={childClassName(active)}
          >
            <ChildIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate text-left">{childLabel}</span>
            {badgeCount > 0 && (
              <span className="ml-auto shrink-0 rounded-md bg-red-500 px-1.5 text-[10px] font-medium leading-4 text-white">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )

  if (collapsed) {
    return (
      <Dropdown
        side="right"
        align="start"
        items={children.map((child) => ({
          key: child.href,
          label: child.dynamicLabel ?? t(child.labelKey),
          icon: child.icon,
          onSelect: () => {
            onBeforeNav?.(child.href)
            router.push(child.href)
            onCloseMobile()
          },
        }))}
        trigger={
          <button
            type="button"
            data-testid={`nav-${item.labelKey}`}
            aria-label={label}
            aria-controls={listId}
            className={parentClassName}
          >
            <Icon className="h-5 w-5 shrink-0" />
          </button>
        }
      />
    )
  }

  return (
    <div>
      <button
        type="button"
        data-testid={`nav-${item.labelKey}`}
        onClick={handleToggleOpen}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={listId}
        className={parentClassName}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {/*
          文字 span 故意**不**用 `flex-1`:
          - flex-1 会让 span 被 blockified 为 display:block,内容宽度 100% 占用剩余空间
          - 一旦父级 flex 容器或祖先元素出现 `text-align: center`(如登录按钮 / 全局规则),
            inline text 会被居中在 span 内,导致 first-char 位置偏移(实测 29px,反复出现的对齐 bug 根因)
          - 父级 button 已是 flex 容器,左对齐由 justify-content:flex-start 默认保证
          - 与 NavLink 完全一致,text 始终从 icon + gap 处开始,字符越多越往右但首字符位置稳定
          - 展开/父级激活的 font-semibold 在 parentClassName 已统一,这里只保留 min-w-0 防溢出
            与 whitespace-nowrap 避免换行
        */}
        <span ref={textRef} className="min-w-0 whitespace-nowrap text-left">
          {label}
        </span>
        {/*
          二级菜单底部指示符 — 对齐文字下方
          用 ref 测量文字宽度，将指示器定位到文字正中下方而非按钮居中。
          公式：left = 20 + textWidth/2
          说明：indicator 用 -translate-x-1/2(-20px) 后，视觉中心 = left + 20px。
                按钮内文字起点 = padding(10px) + icon(20px) + gap(10px) = 40px
                文字中心 = 40 + textWidth/2
                所以 left + 20 = 40 + textWidth/2 → left = 20 + textWidth/2
        */}
        {(() => {
          const left = 20 + textWidth / 2
          return (
            <span
              aria-hidden="true"
              data-testid={`nav-${item.labelKey}-indicator`}
              className={cn(
                'pointer-events-none absolute bottom-1 h-[2px] w-10 -translate-x-1/2 transition-colors duration-200',
                parentActive || open
                  ? 'bg-primary'
                  : 'bg-muted-foreground/40 group-hover/exp:bg-muted-foreground/70',
              )}
              style={{ left }}
            />
          )
        })()}
      </button>
      {open && <div className="mt-0.5">{childList}</div>}
    </div>
  )
})

export { ExpandableNavItem }
