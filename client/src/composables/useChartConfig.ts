import { computed } from 'vue'
import { useDarkModeStore } from '@/stores/darkMode'

/**
 * 从 CSS 变量读取颜色值
 */
const getCSSVariable = (varName: string): string => {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''
}

/**
 * 图表颜色配置接口
 */
export interface ChartColors {
  textColor: string
  axisColor: string
  gridColor: string
  splitLineColor: string
  backgroundColor: string
  tooltipBg: string
  tooltipBorder: string
  barColor: string
  lineColor: string
  areaColor: string
  primaryColor?: string
  primaryLight3?: string
  primaryLight5?: string
  lineColors?: string[]
}

export interface ChartOption {
  backgroundColor: string
  textStyle: {
    color: string
  }
  tooltip: {
    trigger: string
    backgroundColor: string
    borderColor: string
    textStyle: {
      color: string
    }
  }
  grid: {
    left: string
    right: string
    top: string
    bottom: string
    containLabel: boolean
  }
}

export interface XAxisConfig {
  type: string
  data: string[]
  name: string
  axisLine: {
    lineStyle: {
      color: string
    }
  }
  axisLabel: {
    color: string
    rotate?: number
  }
  axisTick: {
    lineStyle: {
      color: string
    }
  }
  splitLine: {
    show: boolean
  }
}

export interface YAxisConfig {
  type: string
  name: string
  axisLine: {
    lineStyle: {
      color: string
    }
  }
  axisLabel: {
    color: string
  }
  axisTick: {
    lineStyle: {
      color: string
    }
  }
  splitLine: {
    lineStyle: {
      color: string
      type: string
    }
  }
}

/**
 * 获取图表颜色配置的 composable
 * 统一管理所有图表组件的颜色配置，支持暗色模式
 */
export function useChartConfig() {
  const darkModeStore = useDarkModeStore()

  /**
   * 根据暗色模式获取图表颜色配置（从 CSS 变量读取）
   */
  const getChartColors = computed((): ChartColors => {
    const isDark = darkModeStore.isDarkMode

    // 从 CSS 变量读取颜色，如果读取失败则使用后备值
    const textColor = getCSSVariable('--el-text-color-primary') || (isDark ? 'var(--color-text-muted)' : 'var(--el-text-color-primary)')
    const axisColor = getCSSVariable('--el-text-color-secondary') || (isDark ? 'var(--el-text-color-primary)' : 'var(--el-text-color-primary)')
    const gridColor = getCSSVariable('--grid-color') || (isDark ? 'var(--color-gray-333)' : 'var(--color-text-muted)')
    const splitLineColor = getCSSVariable('--el-border-color-lighter') || (isDark ? 'var(--el-text-color-primary)' : 'var(--color-gray-e5e7eb)')
    const bgColor = getCSSVariable('--el-bg-color') || (isDark ? 'var(--color-dark-bg-3)' : 'var(--color-neutral-100)')
    const borderColor = getCSSVariable('--el-border-color') || (isDark ? 'var(--color-gray-333)' : 'var(--color-gray-e5e7eb)')
    const primaryColor = getCSSVariable('--el-color-primary') || (isDark ? 'var(--el-bg-color)' : 'var(--el-text-color-primary)')
    const primaryLight3 =
      getCSSVariable('--el-color-primary-light-3') || (isDark ? 'var(--color-gray-ccc)' : 'var(--color-gray-333)')
    const primaryLight5 =
      getCSSVariable('--el-color-primary-light-5') || (isDark ? 'var(--color-gray-999)' : 'var(--color-gray-666)')

    return {
      textColor,
      axisColor,
      gridColor,
      splitLineColor,
      backgroundColor: 'transparent',
      tooltipBg: bgColor,
      tooltipBorder: borderColor,
      barColor: isDark ? 'var(--el-text-color-primary)' : 'var(--el-text-color-primary)',
      lineColor: isDark ? 'var(--color-emerald-500)' : 'var(--el-text-color-primary)',
      areaColor: isDark ? 'var(--color-emerald-10b981-20)' : 'color-mix(in srgb, var(--el-color-primary) 10%, transparent)',
      primaryColor,
      primaryLight3,
      primaryLight5,
      lineColors: [primaryColor, primaryLight3, primaryLight5],
    }
  })

  /**
   * 获取基础图表配置（tooltip, grid, axis等）
   */
  const getBaseChartOption = (colors: ChartColors): ChartOption => {
    return {
      backgroundColor: colors.backgroundColor,
      textStyle: {
        color: colors.textColor,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        textStyle: {
          color: colors.textColor,
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '10%',
        bottom: '10%',
        containLabel: true,
      },
    }
  }

  const getXAxisConfig = (
    colors: ChartColors,
    data: string[],
    name?: string,
    rotate?: number
  ): XAxisConfig => {
    return {
      type: 'category',
      data,
      name: name || '',
      axisLine: {
        lineStyle: {
          color: colors.axisColor,
        },
      },
      axisLabel: {
        color: colors.textColor,
        rotate,
      },
      axisTick: {
        lineStyle: {
          color: colors.axisColor,
        },
      },
      splitLine: {
        show: false,
      },
    }
  }

  const getYAxisConfig = (colors: ChartColors, name?: string): YAxisConfig => {
    return {
      type: 'value',
      name: name || '',
      axisLine: {
        lineStyle: {
          color: colors.axisColor,
        },
      },
      axisLabel: {
        color: colors.textColor,
      },
      axisTick: {
        lineStyle: {
          color: colors.axisColor,
        },
      },
      splitLine: {
        lineStyle: {
          color: colors.splitLineColor,
          type: 'dashed',
        },
      },
    }
  }

  return {
    getChartColors,
    getBaseChartOption,
    getXAxisConfig,
    getYAxisConfig,
  }
}
