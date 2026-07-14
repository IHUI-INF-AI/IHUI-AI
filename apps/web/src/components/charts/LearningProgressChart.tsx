'use client'

import * as React from 'react'
import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'

export interface LearningProgressPoint {
  date: string
  lessons: number
  minutes: number
}

export interface LearningProgressChartProps {
  data?: LearningProgressPoint[]
  height?: number
}

const MOCK: LearningProgressPoint[] = [
  { date: '07-08', lessons: 12, minutes: 80 },
  { date: '07-09', lessons: 18, minutes: 110 },
  { date: '07-10', lessons: 9, minutes: 60 },
  { date: '07-11', lessons: 22, minutes: 150 },
  { date: '07-12', lessons: 15, minutes: 95 },
  { date: '07-13', lessons: 25, minutes: 180 },
  { date: '07-14', lessons: 30, minutes: 210 },
]

export function LearningProgressChart({ data = MOCK, height = 300 }: LearningProgressChartProps) {
  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['课时数', '学习时长'], top: 0 },
    grid: { left: 40, right: 40, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: data.map((d) => d.date), boundaryGap: false },
    yAxis: [
      { type: 'value', name: '课时' },
      { type: 'value', name: '分钟' },
    ],
    series: [
      {
        name: '课时数',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.lessons),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '学习时长',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: data.map((d) => d.minutes),
        itemStyle: { color: '#10b981' },
      },
    ],
  }
  return <EChart option={option} height={height} />
}
