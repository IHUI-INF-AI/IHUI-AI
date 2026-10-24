// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Loader2 } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { cn } from '@/lib/utils'
import { chartText } from '@ihui/design-tokens'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export interface EChartProps {
  option: EChartsOption
  className?: string
  height?: number | string
  loading?: boolean
  /**
   * true = 走 setOption 增量合并(notMerge=false)。高频轮询的看板用它保住过渡动画:
   * 默认 notMerge 会在每次轮询时重建实例,入场动画从头重播(实测大屏每 20s 整片重画)。
   * 默认 false 保持既有调用方行为不变。
   */
  merge?: boolean
  /** 供读屏使用的图表名称:canvas 内容不可读,至少让容器有一个语义标签。 */
  ariaLabel?: string
}

export function EChart({
  option,
  className,
  height = 300,
  loading,
  merge = false,
  ariaLabel,
}: EChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const textColor = chartText(isDark)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  // 工作区侧栏开合(容器查询换列)不会触发 window resize,而 echarts-for-react 只监听 window
  // ⇒ 卡片宽已变、画布仍是旧尺寸。把容器尺寸变化翻译成一次 window resize(经 rAF 合并)。
  React.useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [loading])

  const themedOption = React.useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      textStyle: isDark ? { color: textColor } : undefined,
      ...option,
    }),
    [option, isDark, textColor],
  )

  const heightStyle = typeof height === 'number' ? `${height}px` : height

  if (loading) {
    return (
      <div
        ref={wrapRef}
        className={cn('flex items-center justify-center text-muted-foreground', className)}
        style={{ height: heightStyle }}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      className={cn('w-full', className)}
      style={{ height: heightStyle }}
    >
      <ReactECharts
        option={themedOption}
        notMerge={!merge}
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
