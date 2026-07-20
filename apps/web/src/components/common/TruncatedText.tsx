'use client'

/**
 * TruncatedText — 把"溢出省略 + hover 显示完整内容"模式统一封装。
 *
 * 替代历史上散落的 `<td className="truncate" title={value}>` 写法(浏览器原生 tooltip
 * 样式与项目 Tooltip 不一致),改用项目统一的 Radix Tooltip 包裹:
 *   - 文本溢出才显示 tooltip(不溢出则不显示,避免冗余)
 *   - 样式与 <Tooltip> 一致:bg-popover 灰底 + border + Arrow + fade/zoom 动画
 *
 * 用法:
 *   <TruncatedText value={item.title} className="max-w-[200px]" />
 *   <TruncatedText value={c.value} mono />
 */
import * as React from 'react'
import { Tooltip } from '@/components/feedback/Tooltip'
import { cn } from '@/lib/utils'

interface TruncatedTextProps {
  /** 完整文本(显示 + tooltip) */
  value: React.ReactNode
  /** 容器额外 className,通常含 max-w-* / truncate */
  className?: string
  /** 等宽字体(代码 / 配置值等) */
  mono?: boolean
  /** tooltip 方向,默认 top */
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function TruncatedText({
  value,
  className,
  mono,
  side = 'top',
}: TruncatedTextProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [truncated, setTruncated] = React.useState(false)

  // 文本内容或尺寸变化时重算
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setTruncated(el.scrollWidth > el.clientWidth)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    if (ro) ro.observe(el)
    return () => ro?.disconnect()
  }, [value])

  const inner = (
    <div
      ref={ref}
      className={cn(
        'truncate',
        mono && 'font-mono',
        className,
      )}
    >
      {value}
    </div>
  )

  if (!truncated) return inner

  return (
    <Tooltip content={value} side={side}>
      {inner}
    </Tooltip>
  )
}

export type { TruncatedTextProps }
