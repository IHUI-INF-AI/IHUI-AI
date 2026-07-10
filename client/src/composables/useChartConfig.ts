import { computed } from 'vue'
import type { ComputedRef } from 'vue'

export interface ChartColors {
  primary: string
  barColor: string
  lineColor: string
  textColor: string
  splitLineColor: string
  [key: string]: string
}

export function useChartConfig() {
  const baseConfig = computed(() => ({
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
    },
  }))

  const mergeConfig = (custom: Record<string, any>) => {
    return { ...baseConfig.value, ...custom }
  }

  const getChartColors = computed<ChartColors>(() => ({
    primary: '#5470c6',
    barColor: '#5470c6',
    lineColor: '#91cc75',
    textColor: '#333',
    splitLineColor: '#eee',
  }))

  const getBaseChartOption = (colors?: ChartColors | string[]) => {
    return {
      ...baseConfig.value,
      color: Array.isArray(colors) ? colors : getChartColors.value.primary,
    }
  }

  const getXAxisConfig = (colors?: ChartColors | string[], data?: any[], name?: string) => {
    return {
      type: 'category' as const,
      data: data || [],
      name: name || '',
      axisLabel: { interval: 0 },
    }
  }

  const getYAxisConfig = (colors?: ChartColors | string[], name?: string) => {
    return {
      type: 'value' as const,
      name: name || '',
    }
  }

  return { baseConfig, mergeConfig, getChartColors, getBaseChartOption, getXAxisConfig, getYAxisConfig }
}
