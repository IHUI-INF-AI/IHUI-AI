<template>
  <div class="category-pie-chart">
    <div class="chart-header">
      <span class="chart-title">{{ t('edu.profile.categoryDistribution') }}</span>
    </div>
    <div v-if="hasData" ref="chartRef" class="chart-container"></div>
    <el-empty v-else :description="t('edu.profile.empty')" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import { useDarkModeStore } from '@/stores/darkMode'
import { useCleanup } from '@/composables/useCleanup'
import { THEME_INVARIANTS } from '@/styles/_theme-tokens'
import type { CategoryStat } from '@/api/edu/stats'

const props = defineProps<{
  data: CategoryStat[]
}>()

const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const isDark = computed(
  () => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark'
)
const cleanup = useCleanup()

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const hasData = computed(() => Array.isArray(props.data) && props.data.length > 0)

function buildOption(): echarts.EChartsOption {
  const palette = [
    THEME_INVARIANTS.ctaBgDark, '#16a34a', '#dc2626', '#ca8a04',
    '#9333ea', '#0891b2', '#db2777', '#65a30d',
  ]
  const textColor = isDark.value ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)'

  const seriesData = props.data.map((item: CategoryStat, idx: number) => ({
    name: item.category,
    value: item.minutes,
    itemStyle: { color: palette[idx % palette.length] },
  }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name?: string; value?: number; percent?: number }
        return `${p.name}<br/>${t('edu.profile.learningMinutes')}: ${p.value ?? 0} min (${p.percent ?? 0}%)`
      },
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      textStyle: { color: textColor, fontSize: 12 },
      itemWidth: 12,
      itemHeight: 12,
    },
    series: [
      {
        name: t('edu.profile.categoryDistribution'),
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          formatter: '{b}: {d}%',
          color: textColor,
          fontSize: 11,
        },
        labelLine: {
          show: true,
          lineStyle: { color: isDark.value ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' },
        },
        data: seriesData,
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
  () => [props.data, isDark.value],
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
  cleanup.addEventListener(window, 'resize', resizeChart)
  if (hasData.value) {
    nextTick(renderChart)
  }
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped lang="scss">
:where(.category-pie-chart) {
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
</style>
