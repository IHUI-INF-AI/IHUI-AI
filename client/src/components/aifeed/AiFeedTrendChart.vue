<!--
  AI 动态趋势图组件
  用 ECharts 6 展示某条目近 N 天的排名/热度曲线 + 趋势标签
  遵守项目设计 token: --global-border-radius, --unified-border, --app-*, 无 box-shadow
-->
<template>
  <div class="trend-chart-wrap">
    <div v-if="loading" class="trend-chart-loading">
      <el-skeleton :rows="4" animated />
    </div>
    <template v-else-if="chartData">
      <div class="trend-chart-header">
        <div class="trend-title">{{ chartData.item?.title }}</div>
        <div class="trend-tags">
          <span
            v-for="(sig, w) in chartData.trends"
            :key="w"
            class="trend-badge"
            :style="{ color: trendColor(sig.trend_tag), borderColor: trendColor(sig.trend_tag) }"
          >
            {{ w }}{{ t('newsCenter.aggregator.growthRate').replace('率', '') }}:
            {{ sig.growth_pct !== null ? (sig.growth_pct > 0 ? '+' : '') + sig.growth_pct.toFixed(1) + '%' : '-' }}
            · {{ trendLabel(sig.trend_tag) }}
          </span>
        </div>
      </div>
      <div ref="chartRef" class="trend-chart-canvas"></div>
    </template>
    <div v-else class="trend-chart-empty">
      {{ t('newsCenter.aggregator.loadFailed') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import echarts, { type ECharts } from '@/utils/echarts'
import { useDarkModeStore } from '@/stores/darkMode'
import { useAiFeed } from '@/composables/useAiFeed'

const props = defineProps<{ itemId: number; window?: number }>()
const { t } = useI18n()
const { loadTrendChart, trendLabel, trendColor } = useAiFeed()

const chartRef = ref<HTMLDivElement | null>(null)
const chartData = ref<any>(null)
const loading = ref(true)
let chart: ECharts | null = null
const darkModeStore = useDarkModeStore()

async function loadChart() {
  loading.value = true
  chartData.value = await loadTrendChart(props.itemId, props.window ?? 14)
  loading.value = false
  if (chartData.value) {
    setTimeout(renderChart, 50)
  }
}

function renderChart() {
  if (!chartRef.value || !chartData.value) return
  const isDark = darkModeStore.isDarkMode
  const textColor = isDark ? '#e5eaf3' : '#1a1a1a'
  const axisColor = isDark ? '#a3a6ad' : '#525252'
  const splitColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  if (!chart) {
    chart = echarts.init(chartRef.value)
  }

  const dates = chartData.value.dates || []
  const hotValues = chartData.value.hot_values || []
  const ranks = (chartData.value.ranks || []).map((r: number | null) => (r === null ? null : r))

  // 双 Y 轴: 左热度, 右排名(反转, 1 在顶部)
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1a1a1a' : '#fff',
      borderColor: isDark ? '#2e2e2e' : '#e9e9e9',
      textStyle: { color: textColor },
    },
    legend: {
      data: [t('newsCenter.aggregator.hotValue'), t('newsCenter.aggregator.rank')],
      textStyle: { color: textColor },
      top: 0,
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: t('newsCenter.aggregator.hotValue'),
        nameTextStyle: { color: axisColor },
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: splitColor } },
      },
      {
        type: 'value',
        name: t('newsCenter.aggregator.rank'),
        nameTextStyle: { color: axisColor },
        inverse: true,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: axisColor },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: t('newsCenter.aggregator.hotValue'),
        type: 'line',
        data: hotValues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#2563eb' },
        itemStyle: { color: '#2563eb' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(37,99,235,0.25)' },
            { offset: 1, color: 'rgba(37,99,235,0.02)' },
          ]),
        },
      },
      {
        name: t('newsCenter.aggregator.rank'),
        type: 'line',
        yAxisIndex: 1,
        data: ranks,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#16a34a', type: 'dashed' },
        itemStyle: { color: '#16a34a' },
      },
    ],
  })
  chart.resize()
}

function handleResize() {
  chart?.resize()
}

watch(() => darkModeStore.isDarkMode, () => {
  if (chartData.value) renderChart()
})

onMounted(() => {
  loadChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped lang="scss">
.trend-chart-wrap {
  padding: 16px;
  background: var(--app-surface-2, var(--el-bg-color));
  border: var(--unified-border, 1px solid #e9e9e9);
  border-radius: var(--global-border-radius, 8px);
}

.trend-chart-loading {
  padding: 8px;
}

.trend-chart-header {
  margin-bottom: 12px;
}

.trend-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary, #1a1a1a);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.trend-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.trend-badge {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: var(--global-border-radius, 8px);
  font-weight: 500;
}

.trend-chart-canvas {
  width: 100%;
  height: 240px;
}

.trend-chart-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--app-text-muted, #8c8c8c);
  font-size: 13px;
}

html.dark {
  .trend-chart-wrap {
    background: var(--app-surface-2, #161617);
  }
}
</style>
