<template>
  <div class="oauth-audit-dashboard">
    <!-- 顶部统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">总事件数 (近 {{ stats.days }} 天)</div>
          </div>
          <el-icon class="stat-icon primary"><DataAnalysis /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ totalSuccess }}</div>
            <div class="stat-label">成功事件</div>
          </div>
          <el-icon class="stat-icon success"><CircleCheckFilled /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ totalFailure }}</div>
            <div class="stat-label">失败事件</div>
          </div>
          <el-icon class="stat-icon danger"><CircleCloseFilled /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.by_event.length }}</div>
            <div class="stat-label">事件类型数</div>
          </div>
          <el-icon class="stat-icon warning"><WarningFilled /></el-icon>
        </el-card>
      </el-col>
    </el-row>

    <!-- 范围切换 -->
    <div class="toolbar">
      <span class="title">OAuth 审计日志趋势</span>
      <el-radio-group v-model="daysRange" size="small" @change="loadStats">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
        <el-radio-button :value="90">近 90 天</el-radio-button>
      </el-radio-group>
      <el-button type="primary" size="small" :loading="loading" @click="loadStats">刷新</el-button>
    </div>

    <!-- 趋势图 + 事件分布 -->
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <span>按日趋势</span>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <span>事件类型分布</span>
          </template>
          <div ref="eventChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 事件明细 + Top Client -->
    <el-row :gutter="20">
      <el-col :span="14">
        <el-card class="chart-card">
          <template #header>
            <span>按事件类型统计 (成功/失败)</span>
          </template>
          <div ref="eventBarChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card class="chart-card">
          <template #header>
            <span>Top 10 应用 (按事件数)</span>
          </template>
          <el-table
            :data="stats.by_client"
            stripe
            style="width: 100%"
            empty-text="暂无数据"
          >
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="client_id" label="Client ID" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="client-id-cell">{{ row.client_id }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="事件数" width="100" sortable>
              <template #default="{ row }">
                <el-tag type="warning" size="small">{{ row.count }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import {
  DataAnalysis,
  CircleCheckFilled,
  CircleCloseFilled,
  WarningFilled,
} from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import type { ECharts } from 'echarts'
import { getOAuthAuditLogStats, type AuditLogStats } from '@/api/admin-oauth-audit-stats'

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

onMounted(() => {
  loadStats()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
  trendChart?.dispose()
  eventChart?.dispose()
  eventBarChart?.dispose()
  window.removeEventListener('resize', handleResize)
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
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 13px;
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

.stat-icon.primary { color: var(--el-color-primary); }
.stat-icon.success { color: var(--el-color-success); }
.stat-icon.danger { color: var(--el-color-danger); }
.stat-icon.warning { color: var(--el-color-warning); }

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.toolbar .title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.toolbar .el-radio-group {
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
