<template>
  <div class="error-dashboard">
    <div class="flex flex-wrap gap-5 stats-row">
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.total }}</div>
            <div class="stat-label">{{ t('errorDashboard.totalErrors') }}</div>
          </div>
          <WarningFilled class="h-4 w-4 stat-icon error" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.today }}</div>
            <div class="stat-label">{{ t('errorDashboard.todayErrors') }}</div>
          </div>
          <CircleCloseFilled class="h-4 w-4 stat-icon warning" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.resolved }}</div>
            <div class="stat-label">{{ t('errorDashboard.resolved') }}</div>
          </div>
          <CircleCheckFilled class="h-4 w-4 stat-icon success" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ errorStats.rate }}%</div>
            <div class="stat-label">{{ t('errorDashboard.errorRate') }}</div>
          </div>
          <DataAnalysis class="h-4 w-4 stat-icon info" />
        </Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-5">
      <div class="w-2/3">
        <Card class="chart-card"><CardHeader>
            <div class="card-header">
              <span>{{ t('errorDashboard.trend') }}</span>
                <Radio v-model="chartRange" value="24h">{{ t('errorDashboard.h24') }}</Radio>
                <Radio v-model="chartRange" value="7d">{{ t('errorDashboard.d7') }}</Radio>
                <Radio v-model="chartRange" value="30d">{{ t('errorDashboard.d30') }}</Radio>
            </div>
          </CardHeader><CardContent class="p-5">
                    <div ref="trendChartRef" class="chart-container"></div>
        </CardContent></Card>
      </div>
      <div class="w-1/3">
        <Card class="chart-card"><CardHeader>
            <span>t('errorDashboard.typeDistribution')</span>
          </CardHeader><CardContent class="p-5">
                    <div ref="typeChartRef" class="chart-container"></div>
        </CardContent></Card>
      </div>
    </div>

    <Card class="table-card"><CardHeader>
        <div class="card-header">
          <span>t('errorDashboard.recentErrors')</span>
          <Button variant="default" size="sm" @click="refreshErrors">{{ t('common.refresh') }}</Button>
        </div>
      </CardHeader><CardContent class="p-5">
            <Table class="w-full">
        <TableHeader>
          <TableRow>
            <TableHead class="w-[150px]">{{ t('adminCommon.label.errorType') }}</TableHead>
            <TableHead>{{ t('adminCommon.label.errorMessage') }}</TableHead>
            <TableHead class="w-[200px]">{{ t('adminCommon.label.page') }}</TableHead>
            <TableHead class="w-[180px]">{{ t('adminCommon.label.time') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('adminCommon.label.level') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('adminCommon.label.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in recentErrors" :key="row.id ?? index">
            <TableCell>{{ row.name }}</TableCell>
            <TableCell class="max-w-[400px] truncate" :title="row.message">{{ row.message }}</TableCell>
            <TableCell class="max-w-[300px] truncate" :title="row.url">{{ row.url }}</TableCell>
            <TableCell>{{ formatTime(row.timestamp) }}</TableCell>
            <TableCell>
              <Tag :type="getLevelType(row.level)">{{ row.level }}</Tag>
            </TableCell>
            <TableCell>
              <Button variant="link" size="sm" @click="viewDetail(row)">{{ t('adminCommon.label.detail') }}</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent></Card>

    <Dialog v-model="detailVisible" width="600px">
      <DialogHeader>
        <DialogTitle>{{ t('adminCommon.title.errorDetail') }}</DialogTitle>
      </DialogHeader>
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
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { WarningFilled, CircleCloseFilled, CircleCheckFilled, DataAnalysis } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import type { ECharts } from 'echarts'
import { formatDateTime as _formatTime } from '@/utils/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Radio } from '@/components/ui/radio'
import { Tag } from '@/components/ui/tag'

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

const initTrendChart = (): void => {
  if (!trendChartRef.value) return

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

const initTypeChart = (): void => {
  if (!typeChartRef.value) return

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
  color: hsl(var(--foreground));
}

.stat-label {
  font-size: 14px;
  color: hsl(var(--muted-foreground));
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
  background: hsl(var(--muted));
  padding: 12px;
  border-radius: var(--global-border-radius);
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
