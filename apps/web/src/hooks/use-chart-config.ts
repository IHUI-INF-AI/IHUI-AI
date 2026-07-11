'use client'

import * as React from 'react'

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'radar' | 'scatter'

export interface ChartConfig {
  type: ChartType
  title?: string
  xKey?: string
  yKey?: string
  color?: string
  stacked?: boolean
  smooth?: boolean
  showLegend?: boolean
  showGrid?: boolean
  height?: number
}

export interface UseChartConfigReturn {
  config: ChartConfig
  update: (patch: Partial<ChartConfig>) => void
  setType: (type: ChartType) => void
  reset: () => void
}

const DEFAULT_CONFIG: ChartConfig = {
  type: 'line',
  showLegend: true,
  showGrid: true,
  smooth: true,
  height: 320,
  color: '#6366f1',
}

/** 图表配置 Hook，封装配置状态与更新方法 */
export function useChartConfig(initial?: Partial<ChartConfig>): UseChartConfigReturn {
  const [config, setConfig] = React.useState<ChartConfig>({ ...DEFAULT_CONFIG, ...initial })

  const update = React.useCallback((patch: Partial<ChartConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const setType = React.useCallback((type: ChartType) => {
    setConfig((prev) => ({ ...prev, type }))
  }, [])

  const reset = React.useCallback(() => {
    setConfig({ ...DEFAULT_CONFIG, ...initial })
  }, [initial])

  return { config, update, setType, reset }
}
