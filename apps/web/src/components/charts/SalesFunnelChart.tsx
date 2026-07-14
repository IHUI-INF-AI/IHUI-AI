'use client'

import * as React from 'react'
import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'

export interface SalesFunnelStage {
  name: string
  value: number
}

export interface SalesFunnelChartProps {
  data?: SalesFunnelStage[]
  height?: number
}

const MOCK: SalesFunnelStage[] = [
  { name: '访问', value: 5000 },
  { name: '咨询', value: 2800 },
  { name: '试用', value: 1500 },
  { name: '下单', value: 800 },
  { name: '复购', value: 320 },
]

export function SalesFunnelChart({ data = MOCK, height = 300 }: SalesFunnelChartProps) {
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
        data: data.map((s) => ({ name: s.name, value: s.value })),
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
      },
    ],
  }
  return <EChart option={option} height={height} />
}
