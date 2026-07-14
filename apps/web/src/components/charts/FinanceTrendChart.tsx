'use client'

import * as React from 'react'
import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'

export interface FinanceTrendPoint {
  date: string
  income: number
  expense: number
}

export interface FinanceTrendChartProps {
  data?: FinanceTrendPoint[]
  height?: number
}

const MOCK: FinanceTrendPoint[] = [
  { date: '07-01', income: 4200, expense: 1800 },
  { date: '07-03', income: 5300, expense: 2200 },
  { date: '07-05', income: 3800, expense: 1500 },
  { date: '07-07', income: 6100, expense: 2600 },
  { date: '07-09', income: 4800, expense: 1900 },
  { date: '07-11', income: 7200, expense: 3100 },
  { date: '07-13', income: 8400, expense: 3400 },
]

export function FinanceTrendChart({ data = MOCK, height = 300 }: FinanceTrendChartProps) {
  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'], top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: data.map((d) => d.date), boundaryGap: false },
    yAxis: { type: 'value', name: '元' },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.income),
        itemStyle: { color: '#10b981' },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.expense),
        itemStyle: { color: '#ef4444' },
        areaStyle: { opacity: 0.1 },
      },
    ],
  }
  return <EChart option={option} height={height} />
}
