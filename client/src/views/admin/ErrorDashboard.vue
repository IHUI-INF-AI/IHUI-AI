<template>
  <div class="error-dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.total }}</div>
            <div class="stat-label">{{ t('errorDashboard.totalErrors') }}</div>
          </div>
          <el-icon class="stat-icon error"><WarningFilled /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.today }}</div>
            <div class="stat-label">{{ t('errorDashboard.todayErrors') }}</div>
          </div>
          <el-icon class="stat-icon warning"><CircleCloseFilled /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.resolved }}</div>
            <div class="stat-label">{{ t('errorDashboard.resolved') }}</div>
          </div>
          <el-icon class="stat-icon success"><CircleCheckFilled /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.rate }}%</div>
            <div class="stat-label">{{ t('errorDashboard.errorRate') }}</div>
          </div>
          <el-icon class="stat-icon info"><DataAnalysis /></el-icon>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('errorDashboard.trend') }}</span>
              <el-radio-group v-model="chartRange" size="small">
                <el-radio-button label="24h">{{ t('errorDashboard.h24') }}</el-radio-button>
                <el-radio-button label="7d">{{ t('errorDashboard.d7') }}</el-radio-button>
                <el-radio-button label="30d">{{ t('errorDashboard.d30') }}</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <span>t('errorDashboard.typeDistribution')</span>
          </template>
          <div ref="typeChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>t('errorDashboard.recentErrors')</span>
          <el-button type="primary" size="small" @click="refreshErrors">{{ t('common.refresh') }}</el-button>
        </div>
      </template>
      <el-table :data="recentErrors" stripe style="width: 100%">
        <el-table-column prop="name" :label="t('adminCommon.label.errorType')" width="150" />
        <el-table-column prop="message" :label="t('adminCommon.label.errorMessage')" show-overflow-tooltip />
        <el-table-column prop="url" :label="t('adminCommon.label.page')" width="200" show-overflow-tooltip />
        <el-table-column prop="timestamp" :label="t('adminCommon.label.time')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="level" :label="t('adminCommon.label.level')" width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.level)">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('adminCommon.label.actions')" width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">{{ t('adminCommon.label.detail') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailVisible" :title="t('adminCommon.title.errorDetail')" width="600px">
      <el-descriptions :column="1" border>
        <el-descriptions-item :label="t('adminCommon.label.errorId')">{{ currentError?.id }}</el-descriptions-item>
        <el-descriptions-item :label="t('adminCommon.label.errorType')">{{ currentError?.name }}</el-descriptions-item>
        <el-descriptions-item :label="t('adminCommon.label.errorMessage')">{{ currentError?.message }}</el-descriptions-item>
        <el-descriptions-item :label="t('adminCommon.label.pageUrl')">{{ currentError?.url }}</el-descriptions-item>
        <el-descriptions-item :label="t('adminCommon.label.occurrenceTime')">{{ formatTime(currentError?.timestamp) }}</el-descriptions-item>
        <el-descriptions-item :label="t('adminCommon.label.userAgent')">{{ currentError?.userAgent }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="currentError?.stack" class="stack-section">
        <h4>{{ t('errorDashboard.stackInfo') }}</h4>
        <pre class="stack-content">{{ currentError.stack }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { WarningFilled, CircleCloseFilled, CircleCheckFilled, DataAnalysis } from '@element-plus/icons-vue'
import { loadEcharts } from '@/utils/echarts-lazy'
import type { ECharts } from '@/utils/echarts'
import { formatDateTime as _formatTime } from '@/utils/format'
import { useDarkModeStore } from '@/stores/darkMode'

const darkModeStore = useDarkModeStore()

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

interface ErrorRecord {
  id: string
  name: string
  message: string
  stack?: string
  url: string
  userAgent: string
  timestamp: number
  level: 'error' | 'warning' | 'info'
}

interface ErrorStats {
  total: number
  today: number
  resolved: number
  rate: number
}

const errorStats = ref<ErrorStats>({
  total: 1256,
  today: 23,
  resolved: 1180,
  rate: 2.3,
})

const recentErrors = ref<ErrorRecord[]>([
  { id: '1', name: 'TypeError', message: "Cannot read property 'map' of undefined", url: '/dashboard', timestamp: Date.now() - 3600000, level: 'error', userAgent: navigator.userAgent },
  { id: '2', name: 'NetworkError', message: 'Failed to fetch', url: '/api/data', timestamp: Date.now() - 7200000, level: 'warning', userAgent: navigator.userAgent },
  { id: '3', name: 'SyntaxError', message: 'Unexpected token', url: '/settings', timestamp: Date.now() - 10800000, level: 'error', userAgent: navigator.userAgent },
])

const chartRange = ref('24h')
const detailVisible = ref(false)
const currentError = ref<ErrorRecord | null>(null)

const trendChartRef = ref<HTMLElement>()
const typeChartRef = ref<HTMLElement>()
let trendChart: ECharts | null = null
let typeChart: ECharts | null = null

const formatTime = (timestamp?: number): string => {
  return timestamp ? _formatTime(timestamp) : '-'
}

const getLevelType = (level: string): string => {
  const types: Record<string, string> = { error: 'danger', warning: 'warning', info: 'info' }
  return types[level] || 'info'
}

const viewDetail = (error: ErrorRecord): void => {
  currentError.value = error
  detailVisible.value = true
}

const refreshErrors = (): void => {
  // 刷新错误列表
}

const initTrendChart = async (): Promise<void> => {
  if (!trendChartRef.value) return
  const echarts = await loadEcharts()

  trendChart = echarts.init(trendChartRef.value)
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  const data = Array.from({ length: 24 }, () => Math.floor(Math.random() * 20))

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: hours },
    yAxis: { type: 'value' },
    series: [{
      type: 'line',
      data,
      smooth: true,
      areaStyle: { opacity: 0.3 },
      itemStyle: { color: cssVar('--el-color-danger') },
    }],
  })
}

const initTypeChart = async (): Promise<void> => {
  if (!typeChartRef.value) return
  const echarts = await loadEcharts()

  typeChart = echarts.init(typeChartRef.value)
  typeChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: 45, name: 'TypeError', itemStyle: { color: cssVar('--el-color-danger') } },
        { value: 25, name: 'NetworkError', itemStyle: { color: cssVar('--el-color-warning') } },
        { value: 15, name: 'SyntaxError', itemStyle: { color: cssVar('--el-text-color-primary') } },
        { value: 10, name: 'ReferenceError', itemStyle: { color: cssVar('--el-color-primary') } },
        { value: 5, name: t('errorDashboard.other'), itemStyle: { color: cssVar('--el-color-success') } },
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
    typeChart?.resize()
  })
}

watch(chartRange, () => {
  initTrendChart()
})

// 监听暗色模式变化，重新渲染所有图表以更新颜色
watch(
  () => darkModeStore.isDarkMode,
  () => {
    if (trendChart || typeChart) {
      initTrendChart()
      initTypeChart()
    }
  }
)

onMounted(() => {
  initTrendChart()
  initTypeChart()
  window.addEventListener('resize', handleResize)
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
cleanup.add(() => trendChart?.dispose())
cleanup.add(() => typeChart?.dispose())
cleanup.add(() => window.removeEventListener('resize', handleResize))
</script>

<style scoped>
.error-dashboard {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  position: relative;
  overflow: hidden;
}

.stat-content {
  position: relative;
  z-index: var(--z-base);
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.stat-icon {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 48px;
  opacity: 0.2;
}

.stat-icon.error { color: var(--color-danger-variant); }
.stat-icon.warning { color: var(--color-warning-variant); }
.stat-icon.success { color: var(--color-success); }
.stat-icon.info { color: var(--color-primary); }

.chart-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  height: 300px;
}

.table-card {
  margin-bottom: 20px;
}

.stack-section {
  margin-top: 20px;
}

.stack-content {
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: var(--global-border-radius);
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
