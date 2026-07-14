'use client'

import * as React from 'react'
import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'

export interface ConversionFunnelStage {
  name: string
  value: number
}

export interface ConversionFunnelChartProps {
  data?: ConversionFunnelStage[]
  height?: number
}

const MOCK: ConversionFunnelStage[] = [
  { name: '访问', value: 12000 },
  { name: '注册', value: 5400 },
  { name: '激活', value: 3200 },
  { name: '付费', value: 680 },
]

export function ConversionFunnelChart({ data = MOCK, height = 300 }: ConversionFunnelChartProps) {
  const option: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { top: 0 },
    series: [
      {
        type: 'funnel',
        left: '10%',
        right: '10%',
        top: 40,
        bottom: 20,
        width: '80%',
        minSize: '30%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: { show: true, position: 'inside' },
        labelLine: { show: false },
        data: data.map((s) => ({ name: s.name, value: s.value })),
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
        color: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'],
      },
    ],
  }
  return <EChart option={option} height={height} />
}
