'use client'

import * as React from 'react'
import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'

export interface UserGrowthPoint {
  date: string
  total: number
  newCount: number
}

export interface UserGrowthChartProps {
  data?: UserGrowthPoint[]
  height?: number
}

const MOCK: UserGrowthPoint[] = [
  { date: '07-08', total: 1200, newCount: 45 },
  { date: '07-09', total: 1280, newCount: 80 },
  { date: '07-10', total: 1320, newCount: 40 },
  { date: '07-11', total: 1410, newCount: 90 },
  { date: '07-12', total: 1485, newCount: 75 },
  { date: '07-13', total: 1620, newCount: 135 },
  { date: '07-14', total: 1780, newCount: 160 },
]

export function UserGrowthChart({ data = MOCK, height = 300 }: UserGrowthChartProps) {
  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['累计用户', '新增用户'], top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: data.map((d) => d.date) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '累计用户',
        type: 'bar',
        data: data.map((d) => d.total),
        itemStyle: { color: '#3b82f6' },
        barGap: '10%',
      },
      {
        name: '新增用户',
        type: 'bar',
        data: data.map((d) => d.newCount),
        itemStyle: { color: '#10b981' },
      },
    ],
  }
  return <EChart option={option} height={height} />
}
