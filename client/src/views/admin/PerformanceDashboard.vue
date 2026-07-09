<template>
  <div class="performance-dashboard">
    <div class="flex flex-wrap gap-5 stats-row">
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value" :class="getScoreClass(lcpScore)">{{ lcpScore }}ms</div>
            <div class="stat-label">{{ t('performance.lcp') }}</div>
          </div>
          <el-progress :percentage="getScorePercentage(lcpScore, 'LCP')" :color="getScoreColor(lcpScore, 'LCP')" :show-text="false" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value" :class="getScoreClass(fidScore)">{{ fidScore }}ms</div>
            <div class="stat-label">{{ t('performance.fid') }}</div>
          </div>
          <el-progress :percentage="getScorePercentage(fidScore, 'FID')" :color="getScoreColor(fidScore, 'FID')" :show-text="false" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value" :class="getScoreClass(clsScore)">{{ clsScore.toFixed(3) }}</div>
            <div class="stat-label">{{ t('performance.cls') }}</div>
          </div>
          <el-progress :percentage="getScorePercentage(clsScore, 'CLS')" :color="getScoreColor(clsScore, 'CLS')" :show-text="false" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value" :class="getScoreClass(ttfbScore)">{{ ttfbScore }}ms</div>
            <div class="stat-label">{{ t('performance.ttfb') }}</div>
          </div>
          <el-progress :percentage="getScorePercentage(ttfbScore, 'TTFB')" :color="getScoreColor(ttfbScore, 'TTFB')" :show-text="false" />
        </Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-5">
      <div class="w-full">
        <Card class="chart-card"><CardHeader>
            <div class="card-header">
              <span>{{ t('performance.trend') }}</span>
              <div class="flex gap-4">
                <Radio v-model="timeRange" value="1h">{{ t('performance.h1') }}</Radio>
                <Radio v-model="timeRange" value="24h">{{ t('performance.h24') }}</Radio>
                <Radio v-model="timeRange" value="7d">{{ t('performance.d7') }}</Radio>
              </div>
            </div>
          </CardHeader><CardContent class="p-5">
                    <div ref="trendChartRef" class="chart-container"></div>
        </CardContent></Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-5">
      <div class="w-1/2">
        <Card class="chart-card"><CardHeader>
            <span>{{ t('performance.loadDist') }}</span>
          </CardHeader><CardContent class="p-5">
                    <div ref="distributionChartRef" class="chart-container-small"></div>
        </CardContent></Card>
      </div>
      <div class="w-1/2">
        <Card class="chart-card"><CardHeader>
            <span>{{ t('performance.scoreDist') }}</span>
          </CardHeader><CardContent class="p-5">
                    <div ref="scoreChartRef" class="chart-container-small"></div>
        </CardContent></Card>
      </div>
    </div>

    <Card class="alert-card"><CardHeader>
        <div class="card-header">
          <span>{{ t('performance.alerts') }}</span>
          <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white alert-badge">{{ alertCount > 99 ? '99+' : alertCount }}</span>
        </div>
      </CardHeader><CardContent class="p-5">
            <el-timeline>
        <el-timeline-item v-for="alert in alerts" :key="alert.id" :type="alert.level === 'critical' ? 'danger' : 'warning'" :timestamp="formatTime(alert.timestamp)">
          <div class="alert-content">
            <strong>{{ alert.metric }}</strong>: {{ alert.value }}ms
            <Tag :type="alert.level === 'critical' ? 'danger' : 'warning'" size="small">{{ alert.level === 'critical' ? '严重' : '警告' }}</Tag>
          </div>
        </el-timeline-item>
      </el-timeline>
    </CardContent></Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import echarts from '@/utils/echarts'
import type { ECharts } from 'echarts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Radio } from '@/components/ui/radio'
import { Tag } from '@/components/ui/tag'

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

interface PerformanceAlert {
  id: string
  metric: string
  value: number
  level: 'warning' | 'critical'
  timestamp: number
}

const lcpScore = ref(1850)
const fidScore = ref(45)
const clsScore = ref(0.08)
const ttfbScore = ref(420)
const timeRange = ref('24h')
const alertCount = ref(3)

const alerts = ref<PerformanceAlert[]>([
  { id: '1', metric: 'LCP', value: 4200, level: 'critical', timestamp: Date.now() - 1800000 },
  { id: '2', metric: 'FID', value: 180, level: 'warning', timestamp: Date.now() - 3600000 },
  { id: '3', metric: 'CLS', value: 0.28, level: 'warning', timestamp: Date.now() - 7200000 },
])

const trendChartRef = ref<HTMLElement>()
const distributionChartRef = ref<HTMLElement>()
const scoreChartRef = ref<HTMLElement>()
let trendChart: ECharts | null = null
let distributionChart: ECharts | null = null
let scoreChart: ECharts | null = null

const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
}

const getScoreColor = (value: number, metric: string): string => {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS]
  if (!threshold) return 'var(--color-success)'
  if (value <= threshold.good) return 'var(--color-success)'
  if (value <= threshold.poor) return 'var(--color-warning-variant)'
  return 'var(--color-danger-variant)'
}

const getScoreClass = (_value: number): string => {
  return 'score-good'
}

const getScorePercentage = (value: number, metric: string): number => {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS]
  if (!threshold) return 100
  return Math.min(100, (value / threshold.poor) * 100)
}

const initTrendChart = (): void => {
  if (!trendChartRef.value) return

  trendChart = echarts.init(trendChartRef.value)
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['LCP', 'FID', 'CLS', 'TTFB'], bottom: 0 },
    xAxis: { type: 'category', data: hours, boundaryGap: false },
    yAxis: [
      { type: 'value', name: 'ms', position: 'left' },
      { type: 'value', name: 'CLS', position: 'right', max: 0.5 },
    ],
    series: [
      { name: 'LCP', type: 'line', data: Array.from({ length: 24 }, () => 2000 + Math.random() * 1000), smooth: true },
      { name: 'FID', type: 'line', data: Array.from({ length: 24 }, () => 50 + Math.random() * 100), smooth: true },
      { name: 'TTFB', type: 'line', data: Array.from({ length: 24 }, () => 400 + Math.random() * 400), smooth: true },
      { name: 'CLS', type: 'line', yAxisIndex: 1, data: Array.from({ length: 24 }, () => Math.random() * 0.2), smooth: true },
    ],
  })
}

const initDistributionChart = (): void => {
  if (!distributionChartRef.value) return

  distributionChart = echarts.init(distributionChartRef.value)
  distributionChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['0-1s', '1-2s', '2-3s', '3-5s', '>5s'] },
    yAxis: { type: 'value', name: '页面数' },
    series: [{
      type: 'bar',
      data: [120, 350, 280, 95, 25],
      itemStyle: {
        color: (params: { dataIndex: number }) => {
          const colors = ['var(--color-success)', 'var(--color-success)', 'var(--color-warning-variant)', 'var(--color-warning-variant)', 'var(--color-danger-variant)']
          return colors[params.dataIndex]
        },
      },
    }],
  })
}

const initScoreChart = (): void => {
  if (!scoreChartRef.value) return

  scoreChart = echarts.init(scoreChartRef.value)
  scoreChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['50%', '70%'],
      label: { show: true, formatter: '{b}: {c}' },
      data: [
        { value: 65, name: '良好', itemStyle: { color: cssVar('--el-color-success') } },
        { value: 25, name: '需改进', itemStyle: { color: cssVar('--el-color-warning') } },
        { value: 10, name: '较差', itemStyle: { color: cssVar('--el-color-danger') } },
      ],
    }],
  })
}

let resizeRafId: number | null = null
const handleResize = (): void => {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    trendChart?.resize()
    distributionChart?.resize()
    scoreChart?.resize()
  })
}

watch(timeRange, () => {
  initTrendChart()
})

onMounted(() => {
  initTrendChart()
  initDistributionChart()
  initScoreChart()
  window.addEventListener('resize', handleResize)
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
cleanup.add(() => trendChart?.dispose())
cleanup.add(() => distributionChart?.dispose())
cleanup.add(() => scoreChart?.dispose())
cleanup.add(() => window.removeEventListener('resize', handleResize))
</script>

<style scoped>
.performance-dashboard {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  padding: 16px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-value.score-good { color: var(--color-success); }
.stat-value.score-warning { color: var(--color-warning-variant); }
.stat-value.score-poor { color: var(--color-danger-variant); }

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.chart-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  height: 350px;
}

.chart-container-small {
  height: 250px;
}

.alert-card {
  margin-bottom: 20px;
}

.alert-badge {
  margin-left: 8px;
}

.alert-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
