'use client'

import * as React from 'react'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'

/**
 * 进入视口时触发入场动画的包装组件。
 *
 * 用法:
 *   <RevealOnView delay={0.05}>...</RevealOnView>
 *   <RevealOnView as="li" delay={0.1} className="...">...</RevealOnView>
 *
 * 实现:
 * - 默认 opacity-0 + translate-y-2(轻微下沉)
 * - IntersectionObserver 触发后切换为 opacity-100 + translate-y-0
 * - 过渡用 600ms cubic-bezier(0.16,1,0.3,1) ease-out(expo-like)
 * - 一次性触发(intersecting 后不再撤销,避免滚动来回闪烁)
 * - 支持 prefers-reduced-motion(直接 opacity-100 无过渡)
 *
 * 设计原则:
 * - 包装元素不改 box 几何,只用 className 控制透明度 + transform
 * - 不强制 display / flex,沿用子元素布局
 */
export interface RevealOnViewProps {
  children: React.ReactNode
  /** 延迟(秒),用于卡片交错入场(staggered) */
  delay?: number
  /** 渲染标签,默认 div */
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  /** 视口阈值,默认 0.15(元素 15% 可见即触发) */
  threshold?: number
  /** 一次性触发还是每次进出视口都触发,默认 true(一次性) */
  once?: boolean
}

export function RevealOnView({
  children,
  delay = 0,
  as = 'div',
  className = '',
  threshold = 0.15,
  once = true,
}: RevealOnViewProps) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLElement>({
    threshold,
    rootMargin: '0px 0px -10% 0px',
  })
  const [revealed, setRevealed] = React.useState(false)

  React.useEffect(() => {
    if (isIntersecting && once) setRevealed(true)
    if (!once) setRevealed(isIntersecting)
  }, [isIntersecting, once])

  const base =
    'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100'
  const state = revealed
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-2'

  return React.createElement(
    as,
    {
      ref,
      className: `${base} ${state} ${className}`,
      style: { transitionDelay: `${delay}s` },
    },
    children,
  )
}
