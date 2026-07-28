'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ScrollDownButtonProps {
  /** 当前页索引(0-based) */
  current: number
  /** 总页数 */
  total: number
  /** 点击跳转下一页 */
  onNext: () => void
}

/**
 * 底部向下滚动按钮
 * - subtle-bounce 微弹动画提示
 * - 最后一页自动隐藏
 * - 移动端 (sm-) 隐藏,避免与底部 home indicator 冲突与触屏误点
 * - 点击节流 400ms,防重复触发
 * - prefers-reduced-motion:本地显式关闭动画(globals.css 也有全局兜底)
 */
export function ScrollDownButton({ current, total, onNext }: ScrollDownButtonProps) {
  const t = useTranslations('marketing.scrollDown')
  const visible = current < total - 1
  const [clicking, setClicking] = React.useState(false)
  // 2026-07-28 升级:保存 setTimeout ref,卸载时清理,避免对已卸载组件 setState
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!visible) return null

  const handleClick = () => {
    if (clicking) return
    setClicking(true)
    onNext()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setClicking(false), 400)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('label')}
      // 2026-07-20 改:从整个视口居中(left-1/2)改为右侧工作区居中
      // - 公式:left = 50% + (sidebar + ai-panel) / 2 - 10px (半按钮宽度)
      // - --sidebar-width:sidebar.tsx 同步,折叠态 60px / 展开态 ~260px
      // - --ai-panel-width:ai-side-panel.tsx 同步,关闭 0 / 打开 width+8
      // - 用 inline style 而非 left-1/2 + -translate-x-1/2,
      //   避免 hover:-translate-y-1 / scale-95 覆盖 transform 导致按钮右移 10px
      // 2026-07-28 升级:bottom-4 → bottom-6 (16px → 24px) 避开 iOS home indicator;
      //   增 focus-visible 焦点环(无障碍 + 暗色模式可见);
      //   加 hidden sm:flex,移动端隐藏(避免触屏误点 + 视觉拥挤)
      style={{
        left: 'calc(50% + (var(--sidebar-width, 0px) + var(--ai-panel-width, 0px)) / 2 - 10px)',
      }}
      className={`fixed bottom-6 z-sticky hidden h-5 w-5 items-center justify-center rounded-md border bg-card/80 shadow-sm backdrop-blur transition-[right,background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-1 hover:bg-card hover:border-foreground/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex motion-reduce:animate-none ${
        clicking ? 'scale-95' : ''
      }`}
    >
      <ChevronDown className="h-5 w-5 animate-subtle-bounce text-muted-foreground motion-reduce:animate-none" />
    </button>
  )
}
