<template>
  <div class="oauth-audit-dashboard">
    <!-- 顶部统计卡片 -->
    <div class="flex flex-wrap gap-5 stats-row">
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">总事件数 (近 {{ stats.days }} 天)</div>
          </div>
          <DataAnalysis class="h-4 w-4 stat-icon primary" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ totalSuccess }}</div>
            <div class="stat-label">成功事件</div>
          </div>
          <CircleCheckFilled class="h-4 w-4 stat-icon success" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ totalFailure }}</div>
            <div class="stat-label">失败事件</div>
          </div>
          <CircleCloseFilled class="h-4 w-4 stat-icon danger" />
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-content">
            <div class="stat-value">{{ stats.by_event.length }}</div>
            <div class="stat-label">事件类型数</div>
          </div>
          <WarningFilled class="h-4 w-4 stat-icon warning" />
        </Card>
      </div>
    </div>

    <!-- 范围切换 -->
    <div class="toolbar">
      <span class="title">OAuth 审计日志趋势</span>
      <span class="range-group">
        <Radio v-model="daysRange" :value="7" @change="loadStats">近 7 天</Radio>
        <Radio v-model="daysRange" :value="30" @change="loadStats">近 30 天</Radio>
        <Radio v-model="daysRange" :value="90" @change="loadStats">近 90 天</Radio>
      </span>
      <Button variant="default" size="sm" @click="loadStats">刷新</Button>
    </div>

    <!-- 趋势图 + 事件分布 -->
    <div class="flex flex-wrap gap-5">
      <div class="w-2/3">
        <Card class="chart-card"><CardHeader>
            <span>按日趋势</span>
          </CardHeader><CardContent class="p-5">
                    <div ref="trendChartRef" class="chart-container"></div>
        </CardContent></Card>
      </div>
      <div class="w-1/3">
        <Card class="chart-card"><CardHeader>
            <span>事件类型分布</span>
          </CardHeader><CardContent class="p-5">
                    <div ref="eventChartRef" class="chart-container"></div>
        </CardContent></Card>
      </div>
    </div>

    <!-- 事件明细 + Top Client -->
    <div class="flex flex-wrap gap-5">
      <div style="width: calc(14/24 * 100%)">
        <Card class="chart-card"><CardHeader>
            <span>按事件类型统计 (成功/失败)</span>
          </CardHeader><CardContent class="p-5">
                    <div ref="eventBarChartRef" class="chart-container"></div>
        </CardContent></Card>
      </div>
      <div style="width: calc(10/24 * 100%)">
        <Card class="chart-card"><CardHeader>
            <span>Top 10 应用 (按事件数)</span>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[50px]">#</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead class="w-[100px]">事件数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in stats.by_client" :key="row.client_id ?? index">
                <TableCell>{{ index + 1 }}</TableCell>
                <TableCell><span class="client-id-cell">{{ row.client_id }}</span></TableCell>
                <TableCell><Tag type="warning" size="small">{{ row.count }}</Tag></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import {
  DataAnalysis,
  CircleCheckFilled,
  CircleCloseFilled,
  WarningFilled,
} from '@/lib/lucide-fallback'
import echarts from '@/utils/echarts'
import type { ECharts } from 'echarts'
import { getOAuthAuditLogStats, type AuditLogStats } from '@/api/admin-oauth-audit-stats'
import { useCleanup } from '@/composables/useCleanup'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Radio } from '@/components/ui/radio'
import { Tag } from '@/components/ui/tag'

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const loading = ref(false)
const daysRange = ref(30)
const stats = ref<AuditLogStats>({
  days: 30,
  start: '',
  end: '',
  total: 0,
  by_event: [],
  by_day: [],
  by_client: [],
})

const totalSuccess = computed(() =>
  stats.value.by_event.reduce((sum, x) => sum + x.success, 0)
)
const totalFailure = computed(() =>
  stats.value.by_event.reduce((sum, x) => sum + x.failure, 0)
)

const trendChartRef = ref<HTMLElement>()
const eventChartRef = ref<HTMLElement>()
const eventBarChartRef = ref<HTMLElement>()
let trendChart: ECharts | null = null
let eventChart: ECharts | null = null
let eventBarChart: ECharts | null = null
let resizeRafId: number | null = null
const cleanup = useCleanup()

const EVENT_NAME_MAP: Record<string, string> = {
  app_create: '创建应用',
  app_delete: '删除应用',
  app_reset_secret: '重置密钥',
  authorize_grant: '授权签发',
  authorize_deny: '拒绝授权',
  token_issue: '换发 Token',
  token_refresh: '刷新 Token',
  protected_access: '受保护访问',
}

function eventLabel(ev: string): string {
  return EVENT_NAME_MAP[ev] || ev
}

async function loadStats() {
  loading.value = true
  try {
    const res = await getOAuthAuditLogStats({ days: daysRange.value })
    if (res.success && res.data) {
      stats.value = res.data
      await nextTick()
      renderTrendChart()
      renderEventChart()
      renderEventBarChart()
    }
  } catch (e) {
    console.error('loadStats error', e)
  } finally {
    loading.value = false
  }
}

function renderTrendChart() {
  if (!trendChartRef.value) return
  if (!trendChart) trendChart = echarts.init(trendChartRef.value)

  const data = stats.value.by_day
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'line',
        data: data.map((d) => d.count),
        smooth: true,
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: cssVar('--el-color-primary') || '#409eff' },
      },
    ],
  })
}

function renderEventChart() {
  if (!eventChartRef.value) return
  if (!eventChart) eventChart = echarts.init(eventChartRef.value)

  const data = stats.value.by_event.map((e) => ({
    name: eventLabel(e.event),
    value: e.total,
  }))
  eventChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data,
        label: { show: false },
        emphasis: { label: { show: true, fontWeight: 'bold' } },
      },
    ],
  })
}

function renderEventBarChart() {
  if (!eventBarChartRef.value) return
  if (!eventBarChart) eventBarChart = echarts.init(eventBarChartRef.value)

  const data = stats.value.by_event
  eventBarChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['成功', '失败'], bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: data.map((d) => eventLabel(d.event)),
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        name: '成功',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.success),
        itemStyle: { color: cssVar('--el-color-success') || '#67c23a' },
      },
      {
        name: '失败',
        type: 'bar',
        stack: 'total',
        data: data.map((d) => d.failure),
        itemStyle: { color: cssVar('--el-color-danger') || '#f56c6c' },
      },
    ],
  })
}

function handleResize() {
  if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
  resizeRafId = requestAnimationFrame(() => {
    trendChart?.resize()
    eventChart?.resize()
    eventBarChart?.resize()
  })
}

cleanup.add(() => {
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
})

onMounted(() => {
  loadStats()
  cleanup.addEventListener(window, 'resize', handleResize)
})

onBeforeUnmount(() => {
  trendChart?.dispose()
  eventChart?.dispose()
  eventBarChart?.dispose()
})

watch(daysRange, () => loadStats())
</script>

<style scoped>
.oauth-audit-dashboard {
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
  font-size: 13px;
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

.stat-icon.primary { color: hsl(var(--primary)); }
.stat-icon.success { color: hsl(var(--success)); }
.stat-icon.danger { color: hsl(var(--destructive)); }
.stat-icon.warning { color: hsl(var(--warning)); }

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.toolbar .title {
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.toolbar .range-group {
  margin-left: auto;
}

.chart-card {
  margin-bottom: 20px;
}

.chart-container {
  width: 100%;
  height: 320px;
}

.client-id-cell {
  font-family: monospace;
  font-size: 12px;
}
</style>
