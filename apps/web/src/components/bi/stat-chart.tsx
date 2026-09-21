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

// ECharts canvas 渲染不支持 CSS var(),色板统一从 @ihui/design-tokens 的
// chart-colors.ts 唯一真相源导入(对应 tokens.css --chart-1..8 / --chart-text / --chart-axis)。
import { CHART_PALETTE, chartText, chartAxis, chartBg } from '@ihui/design-tokens'

export function StatChart({
  type,
  data,
  height = 280,
  loading,
  title,
  className,
  colors = CHART_PALETTE.slice(),
}: StatChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const textColor = chartText(isDark)
  const axisColor = chartAxis(isDark)
  const bgColor = chartBg(isDark)

  const option = React.useMemo<EChartsOption>(() => {
    const labels = data.map((d) => d.label)
    const values = data.map((d) => d.value)

    if (type === 'pie') {
      return {
        backgroundColor: 'transparent',
        textStyle: { color: textColor },
        title: title
          ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontWeight: 600 } }
          : undefined,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, type: 'scroll' },
        series: [
          {
            name: '占比',
            type: 'pie',
            radius: ['38%', '68%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: bgColor, borderWidth: 2 },
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
        textStyle: { color: textColor },
        title: title
          ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontWeight: 600 } }
          : undefined,
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 40, right: 16, top: title ? 40 : 16, bottom: 30, containLabel: true },
        xAxis: {
          type: 'category',
          data: labels,
          axisLine: { lineStyle: { color: axisColor } },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: axisColor } },
        },
        series: [
          {
            type: 'bar',
            data: values.map((v, i) => ({
              value: v,
              itemStyle: { color: colors[i % colors.length] },
            })),
            barMaxWidth: 36,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          },
        ],
      }
    }

    // line + area 共用折线图
    return {
      backgroundColor: 'transparent',
      textStyle: { color: textColor },
      title: title
        ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontWeight: 600 } }
        : undefined,
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 16, top: title ? 40 : 16, bottom: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisColor } },
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: axisColor } } },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: values,
          lineStyle: { color: colors[0], width: 2 },
          itemStyle: { color: colors[0] },
          areaStyle:
            type === 'area'
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
  }, [type, data, title, colors, axisColor, bgColor, textColor])

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
