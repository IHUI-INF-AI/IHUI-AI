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
 * - 点击跳转下一页
 */
export function ScrollDownButton({ current, total, onNext }: ScrollDownButtonProps) {
  const t = useTranslations('marketing.scrollDown')
  const visible = current < total - 1
  const [clicking, setClicking] = React.useState(false)

  if (!visible) return null

  const handleClick = () => {
    if (clicking) return
    setClicking(true)
    onNext()
    window.setTimeout(() => setClicking(false), 400)
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
      style={{
        left: 'calc(50% + (var(--sidebar-width, 0px) + var(--ai-panel-width, 0px)) / 2 - 10px)',
      }}
      className={`fixed bottom-4 z-sticky flex h-5 w-5 items-center justify-center rounded-md border bg-card/80 shadow-sm backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-card hover:shadow-md hover:border-foreground/15 ${
        clicking ? 'scale-95' : ''
      }`}
    >
      <ChevronDown className="h-5 w-5 animate-subtle-bounce text-muted-foreground" />
    </button>
  )
}
