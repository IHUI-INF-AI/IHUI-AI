<template>
  <div class="learning-trend-chart">
    <div class="chart-header">
      <span class="chart-title">{{ t('edu.profile.learningTrend') }}</span>
      <el-radio-group v-model="range" size="small" class="range-group">
        <el-radio-button :label="7">{{ t('edu.profile.range7Days') }}</el-radio-button>
        <el-radio-button :label="30">{{ t('edu.profile.range30Days') }}</el-radio-button>
        <el-radio-button :label="90">{{ t('edu.profile.range90Days') }}</el-radio-button>
      </el-radio-group>
    </div>
    <div v-if="hasData" ref="chartRef" class="chart-container"></div>
    <el-empty v-else :description="t('edu.profile.noLearningData')" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import { useDarkModeStore } from '@/stores/darkMode'

interface TrendPoint {
  date: string
  minutes: number
}

const props = defineProps<{
  data: TrendPoint[]
}>()

const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const isDark = computed(
  () => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark'
)

const range = ref<7 | 30 | 90>(30)
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const hasData = computed(() => Array.isArray(props.data) && props.data.length > 0)

const filteredData = computed<TrendPoint[]>(() => {
  if (!hasData.value) return []
  const sorted = [...props.data].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.slice(-range.value)
})

function buildOption(): echarts.EChartsOption {
  const data = filteredData.value
  const dates = data.map(d => d.date)
  const minutes = data.map(d => d.minutes)

  const lineColor = '#2563eb'
  const axisColor = isDark.value ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'
  const splitLineColor = isDark.value
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.08)'

  return {
    grid: { left: 40, right: 16, top: 16, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        const val = (p as { value?: number })?.value ?? 0
        const axis = (p as { axisValue?: string })?.axisValue ?? ''
        return `${axis}<br/>${t('edu.profile.learningMinutes')}: ${val} min`
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: splitLineColor } },
      axisLabel: { color: axisColor, fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 11 },
      splitLine: { lineStyle: { color: splitLineColor } },
    },
    series: [
      {
        name: t('edu.profile.learningMinutes'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: minutes,
        lineStyle: { color: lineColor, width: 2 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(37, 99, 235, 0.35)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.02)' },
          ]),
        },
      },
    ],
  }
}

function renderChart() {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  chart.setOption(buildOption(), true)
}

function resizeChart() {
  chart?.resize()
}

watch(
  () => [props.data, range.value, isDark.value],
  async () => {
    await nextTick()
    if (hasData.value) {
      renderChart()
    } else if (chart) {
      chart.dispose()
      chart = null
    }
  },
  { deep: true }
)

onMounted(() => {
  window.addEventListener('resize', resizeChart)
  if (hasData.value) {
    nextTick(renderChart)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped lang="scss">
:where(.learning-trend-chart) {
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  padding: 16px;

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .chart-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .chart-container {
    width: 100%;
    height: 280px;
  }
}

// 暗色模式下范围切换按钮组显式使用品牌蓝
:where(html.dark) .range-group {
  :deep(.el-radio-button__inner) {
    border-color: var(--color-white-30);
    color: var(--el-text-color-regular);
    background-color: transparent;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: #2563eb;
    border-color: #2563eb;
    color: #fff;
    box-shadow: -1px 0 0 0 #2563eb;
  }
}
</style>
