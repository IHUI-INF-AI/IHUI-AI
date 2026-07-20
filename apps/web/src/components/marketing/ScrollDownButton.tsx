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
      className={`fixed bottom-8 left-1/2 z-sticky flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-md border bg-card/80 shadow-sm backdrop-blur transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-card hover:shadow-md hover:border-foreground/15 ${
        clicking ? 'scale-95' : ''
      }`}
    >
      <ChevronDown className="h-5 w-5 animate-subtle-bounce text-muted-foreground" />
    </button>
  )
}
