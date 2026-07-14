'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Loader2 } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { cn } from '@/lib/utils'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export interface EChartProps {
  option: EChartsOption
  className?: string
  height?: number | string
  loading?: boolean
}

const darkTextStyle = { color: '#94a3b8' }

export function EChart({ option, className, height = 300, loading }: EChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const themedOption = React.useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      textStyle: isDark ? darkTextStyle : undefined,
      ...option,
    }),
    [option, isDark],
  )

  const heightStyle = typeof height === 'number' ? `${height}px` : height

  if (loading) {
    return (
      <div
        className={cn('flex items-center justify-center text-muted-foreground', className)}
        style={{ height: heightStyle }}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} style={{ height: heightStyle }}>
      <ReactECharts
        option={themedOption}
        notMerge
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
