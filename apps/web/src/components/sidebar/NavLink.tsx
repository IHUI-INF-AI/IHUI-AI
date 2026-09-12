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
import { useOptimisticNavStore } from '@/stores/navigation'
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
  // 乐观高亮(2026-09-13):订阅 store,但**只返回布尔值**。
  // 语义:导航进行中(store.href 非 null)完全以目标 href 为准 —— 命中的项高亮,
  // 未命中的项一律不高亮(从而让旧的激活项立刻熄灭);不在导航中则回落到真实 active。
  // 这样一次点击只会有"旧激活项"和"新目标项"两个叶子的选择器结果翻转,
  // 其余 95 个 NavLink 选择器输出不变 → zustand 不通知 → 零重渲染。
  // 绝不可写成 `useOptimisticNavStore((s) => s.href)`:那会让全部订阅者每次都变化。
  const isActive = useOptimisticNavStore((s) => (s.href === null ? active : s.href === item.href))
  const className = cn(
    NAV_ITEM_BASE_CLASS,
    isActive
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

  // 悬停/聚焦即显式**全量**预取(2026-09-12 路由瞬切终版):
  // dev 下 Next 默认禁用客户端预取,scripts/unlock-dev-prefetch.mjs 已在启动前解除
  // 两处硬编码守卫(createPrefetchURL / <Link> hover),本处调用因此真实发出 RSC 请求。
  // 但默认策略是 PPR(partial):link.js getFetchStrategyFromPrefetchIntent 把 auto 解析为
  // FetchStrategy.PPR,cache.js upgradeToPendingSegment 只对 Full 置 isPartial=false,
  // 于是 ppr-navigations.js:729 `doesSegmentNeedDynamicRequest = isCachedRscPartial`
  // 仍会在点击时放行一次 dynamic 请求(实测点击 420ms + 1 条新 RSC)。
  // 显式传 kind:'full' → FetchStrategy.Full → 缓存条目 isPartial=false,
  // 点击时命中完整缓存、零请求、瞬时切换。幂等,Next 内部按 cacheKey 去重。
  // 注:Next 的 PrefetchKind 是**字符串枚举**(TS 标称类型),字面量 'full' 不能直接赋给
  // 枚举类型,故断言为 prefetch 第二参类型;运行时值仍是 'full'。
  const prefetchTarget = React.useCallback(() => {
    router.prefetch(item.href, { kind: 'full' } as Parameters<typeof router.prefetch>[1])
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
          aria-current={isActive ? 'page' : undefined}
          data-testid={`nav-${item.labelKey}`}
          className={className}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </Link>
      </Tooltip>
    )
  }

  // <Link> 自身仍保留默认视口预取。<Link> 的 auto 策略经 links.js/ link.js 解析为 PPR,
  // 且 dev 下 links.js onLinkVisibilityChanged 有 `NODE_ENV !== 'production'` 早退
  // (instance.isVisible 恒 false → rescheduleLinkPrefetch 直接 return),故 <Link> 自身的
  // 视口/悬停预取在 dev 下不生效 —— 上面的 onPointerEnter/onFocus → router.prefetch(full)
  // 才是 dev 下的实际预取路径。生产环境两者都生效,互为补充。
  return (
    <Link
      key={item.href}
      href={item.href}
      ref={refCb}
      onClick={handleClick}
      onPointerEnter={prefetchTarget}
      onFocus={prefetchTarget}
      aria-current={isActive ? 'page' : undefined}
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
