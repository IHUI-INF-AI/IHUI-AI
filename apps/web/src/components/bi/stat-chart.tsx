'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Loader2 } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { cn } from '@/lib/utils'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

/**
 * StatChart — BI 仪表盘通用 ECharts 包装
 *
 * 提供 4 种图表类型(line / bar / pie / area)的统一 API,
 * 自动适配 dark mode 文字色,SSR-safe(dynamic import 关闭 ssr)。
 */

export type StatChartType = 'line' | 'bar' | 'pie' | 'area'

export interface StatChartPoint {
  label: string
  value: number
  /** pie 图可指定 series 名,默认 'value' */
  group?: string
}

export interface StatChartProps {
  type: StatChartType
  data: StatChartPoint[]
  height?: number
  loading?: boolean
  /** 标题(可选) */
  title?: string
  className?: string
  /** 自定义 series 颜色(可选) */
  colors?: string[]
}

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const darkTextStyle = { color: '#94a3b8' }
const lightTextStyle = { color: '#475569' }

export function StatChart({
  type,
  data,
  height = 280,
  loading,
  title,
  className,
  colors = PALETTE,
}: StatChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const option = React.useMemo<EChartsOption>(() => {
    const labels = data.map((d) => d.label)
    const values = data.map((d) => d.value)

    if (type === 'pie') {
      return {
        backgroundColor: 'transparent',
        textStyle: isDark ? darkTextStyle : lightTextStyle,
        title: title ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontWeight: 600 } } : undefined,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, type: 'scroll' },
        series: [
          {
            name: '占比',
            type: 'pie',
            radius: ['38%', '68%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: isDark ? '#0f172a' : '#fff', borderWidth: 2 },
            label: { formatter: '{b}\n{d}%', fontSize: 11 },
            data: data.map((d, i) => ({
              name: d.label,
              value: d.value,
              itemStyle: { color: colors[i % colors.length] },
            })),
          },
        ],
      }
    }

    if (type === 'bar') {
      return {
        backgroundColor: 'transparent',
        textStyle: isDark ? darkTextStyle : lightTextStyle,
        title: title ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontWeight: 600 } } : undefined,
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 40, right: 16, top: title ? 40 : 16, bottom: 30, containLabel: true },
        xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#e2e8f0' } } },
        series: [
          {
            type: 'bar',
            data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i % colors.length] } })),
            barMaxWidth: 36,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          },
        ],
      }
    }

    // line + area 共用折线图
    return {
      backgroundColor: 'transparent',
      textStyle: isDark ? darkTextStyle : lightTextStyle,
      title: title ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontWeight: 600 } } : undefined,
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 16, top: title ? 40 : 16, bottom: 30, containLabel: true },
      xAxis: { type: 'category', data: labels, boundaryGap: false, axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#e2e8f0' } } },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: values,
          lineStyle: { color: colors[0], width: 2 },
          itemStyle: { color: colors[0] },
          areaStyle: type === 'area'
            ? {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${colors[0]}55` },
                    { offset: 1, color: `${colors[0]}00` },
                  ],
                },
              }
            : undefined,
        },
      ],
    }
  }, [type, data, isDark, title, colors])

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

  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center text-sm text-muted-foreground', className)}
        style={{ height: heightStyle }}
      >
        暂无数据
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} style={{ height: heightStyle }}>
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
