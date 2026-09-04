// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  NAV_ITEM_BASE_CLASS,
  NAV_ITEM_COLLAPSED_CLASS,
  NAV_ITEM_EXPANDED_CLASS,
} from '@/lib/nav-styles'
import { Tooltip } from '@/components/feedback'
import type { NavItem, RegisterRef } from './types'

interface NavLinkProps {
  item: NavItem
  collapsed: boolean
  active: boolean
  label: string
  onCloseMobile: () => void
  registerRef: RegisterRef
  /** 点击导航时立即更新 active 状态不等导航完成 */
  onBeforeNav?: (href: string) => void
}

const NavLink = React.memo(function NavLink({
  item,
  collapsed,
  active,
  label,
  onCloseMobile,
  registerRef,
  onBeforeNav,
}: NavLinkProps) {
  const Icon = item.icon
  const className = cn(
    NAV_ITEM_BASE_CLASS,
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground/70 hover:bg-sidebar-item-hover-bg hover:text-accent-foreground',
    collapsed ? NAV_ITEM_COLLAPSED_CLASS : NAV_ITEM_EXPANDED_CLASS,
  )
  const refCb = (el: HTMLElement | null) => registerRef(item.href, el)
  const router = useRouter()

  const handleClick = React.useCallback(() => {
    onBeforeNav?.(item.href)
    onCloseMobile()
  }, [onBeforeNav, item.href, onCloseMobile])

  // 悬停/聚焦即显式预取(2026-09-02 页面切换提速·第二刀):
  // <Link> 仅对"视口内"链接自动预取(生产);折叠态/子菜单/未入视口链接在点击时才发 RSC 请求。
  // 此处 onPointerEnter/onFocus 触发 useRouter().prefetch:生产模式把目标路由 RSC 拉进
  // 客户端缓存(staleTimes.dynamic=30s),点击命中即瞬时切换;幂等,Next 内部去重。
  // 注:dev 模式 Next 16 有 cache-bypass-in-dev 机制,预取请求被显式绕过(实测 0 请求),
  // 本逻辑对 dev 无效果也无开销;dev 切换延迟是 Next 架构性下限(每次必走服务端往返)。
  const prefetchTarget = React.useCallback(() => {
    router.prefetch(item.href)
  }, [router, item.href])

  if (collapsed) {
    return (
      <Tooltip key={item.href} content={label} side="right">
        <Link
          href={item.href}
          ref={refCb}
          onClick={handleClick}
          onPointerEnter={prefetchTarget}
          onFocus={prefetchTarget}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          data-testid={`nav-${item.labelKey}`}
          className={className}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </Link>
      </Tooltip>
    )
  }

  // 保留 Next 默认视口预取(生产模式 prefetchRsc 缓存命中,点击瞬时;2026-09-04 实测
  // 悬停预取后点击 314ms→143ms,预取是"立马响应"的关键)。dev 模式 cache-bypass 使预取
  // 请求不缓存,但 Next 内部去重 + pingVisibleLinks 多数情况不重复发请求;悬停/聚焦
  // 再叠加 onPointerEnter 的 router.prefetch 精准预取。两者并存不冲突(Next 幂等去重)。
  return (
    <Link
      key={item.href}
      href={item.href}
      ref={refCb}
      onClick={handleClick}
      onPointerEnter={prefetchTarget}
      onFocus={prefetchTarget}
      aria-current={active ? 'page' : undefined}
      data-testid={`nav-${item.labelKey}`}
      className={className}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {/*
        文字 span 与 ExpandableNavItem 完全一致写法(min-w-0 whitespace-nowrap text-left):
        - 不用 flex-1:避免 span 被 blockify 后宽度 100%,被父级 text-align 继承居中
        - text-left:防御性显式声明,即使 NAV_ITEM_BASE_CLASS 已有 text-left,
          span 自身也声明一次,跨 a/button 元素类型永久一致
        - whitespace-nowrap:与 ExpandableNavItem 一致,防换行
        - min-w-0:防溢出
        根因(2026-07-19 三次修复):NavLink 是 <a>(默认 text-align:left),
        ExpandableNavItem 是 <button>(默认 text-align:center),两者 user agent 默认不同,
        即使 NAV_ITEM_BASE_CLASS 加了 text-left 仍可能因 HMR 缓存/特异性问题反复出现偏差。
        统一 span 写法是根治,跨元素类型永久一致。
      */}
      <span className="min-w-0 whitespace-nowrap text-left">{label}</span>
    </Link>
  )
})

export { NavLink }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
