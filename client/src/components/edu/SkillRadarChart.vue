<template>
  <div class="skill-radar-chart">
    <div class="chart-header">
      <span class="chart-title">{{ t('edu.profile.skillRadar') }}</span>
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
import type { SkillRadarStat } from '@/api/edu/stats'

const props = defineProps<{
  data: SkillRadarStat[]
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
  const lineColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--el-color-primary')
    .trim() || THEME_INVARIANTS.ctaBgDark
  const textColor = isDark.value ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)'
  const splitAreaColor = isDark.value
    ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']
    : ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.05)']
  const splitLineColor = isDark.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  const indicators = props.data.map((item: SkillRadarStat) => ({
    name: item.skill,
    max: 100,
  }))
  const values = props.data.map((item: SkillRadarStat) => item.score)

  return {
    tooltip: {
      trigger: 'item',
    },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      radius: '65%',
      center: ['50%', '52%'],
      axisName: {
        color: textColor,
        fontSize: 12,
      },
      splitArea: {
        areaStyle: {
          color: splitAreaColor,
        },
      },
      splitLine: {
        lineStyle: { color: splitLineColor },
      },
      axisLine: {
        lineStyle: { color: splitLineColor },
      },
    },
    series: [
      {
        name: t('edu.profile.skillRadar'),
        type: 'radar',
        data: [
          {
            value: values,
            name: t('edu.profile.skillRadar'),
            areaStyle: { color: 'rgba(37, 99, 235, 0.25)' },
            lineStyle: { color: lineColor, width: 2 },
            itemStyle: { color: lineColor },
          },
        ],
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
:where(.skill-radar-chart) {
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
