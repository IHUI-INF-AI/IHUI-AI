<template>
  <div class="backend-health">
    <el-card class="status-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('adminCommon.backendHealth.title') }}</span>
          <div class="header-actions">
            <el-switch v-model="autoRefresh" :active-text="t('adminCommon.backendHealth.autoRefresh')" @change="toggleAutoRefresh" />
            <el-button size="small" :loading="loading" @click="fetchHealth">{{ t('adminCommon.backendHealth.refresh') }}</el-button>
          </div>
        </div>
      </template>
      <div v-loading="loading">
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.overallStatus') }}</div>
              <el-tag :type="statusTagType" size="large">{{ statusText }}</el-tag>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.uptime') }}</div>
              <div class="stat-value">{{ formattedUptime }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.database') }}</div>
              <el-tag :type="dbOk ? 'success' : 'danger'" size="large">{{ dbOk ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</el-tag>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.redis') }}</div>
              <el-tag :type="redisOk ? 'success' : 'danger'" size="large">{{ redisOk ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</el-tag>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-card>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card>
          <template #header>{{ t('adminCommon.backendHealth.databaseEngines') }}</template>
          <div v-loading="loading" class="engine-list">
            <div v-for="(eng, idx) in dbEngines" :key="idx" class="engine-item">
              <span class="engine-name">engine{{ Number(idx) + 1 }}</span>
              <el-tag :type="eng.ok ? 'success' : 'danger'" size="small">{{ eng.ok ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</el-tag>
              <span class="engine-msg">{{ eng.msg }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>{{ t('adminCommon.backendHealth.redisInfo') }}</template>
          <div v-loading="loading" class="redis-info">
            <div class="info-row">
              <span class="info-label">{{ t('adminCommon.backendHealth.status') }}</span>
              <el-tag :type="redisOk ? 'success' : 'danger'" size="small">{{ redisOk ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</el-tag>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('adminCommon.backendHealth.message') }}</span>
              <span class="info-value">{{ redisMsg }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="mt-20">
      <template #header>
        <div class="card-header">
          <span>{{ t('adminCommon.backendHealth.trendChart') }}</span>
          <div class="header-actions">
            <span class="history-tip">{{ t('adminCommon.backendHealth.historyPoints', { n: history.length }) }}</span>
            <el-button v-if="history.length" size="small" class="export-csv-btn" @click="exportCsv">{{ t('adminCommon.backendHealth.exportCsv') }}</el-button>
            <el-button v-if="history.length" size="small" class="clear-history-btn" @click="clearHistory">{{ t('adminCommon.backendHealth.clearHistory') }}</el-button>
          </div>
        </div>
      </template>
      <div v-if="history.length === 0" class="empty-history">
        {{ t('adminCommon.backendHealth.historyEmpty') }}
      </div>
      <div v-else ref="chartRef" class="trend-chart"></div>
      <div v-if="lastUpdateAt" class="last-update">
        {{ t('adminCommon.backendHealth.lastUpdate') }}: {{ lastUpdateAt }}
      </div>
    </el-card>

    <el-card class="mt-20">
      <template #header>{{ t('adminCommon.backendHealth.rawData') }}</template>
      <pre class="raw-data">{{ JSON.stringify(healthData, null, 2) }}</pre>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { loadEcharts } from '@/utils/echarts-lazy'
import type { ECharts } from '@/utils/echarts'
import { useCleanup } from '@/composables/useCleanup'
import { getUserToken } from '@/utils/request'
import { useDarkModeStore } from '@/stores/darkMode'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()

interface EngineStatus { ok: boolean; msg: string }
interface HealthData {
  status: string
  uptime_s: number
  db: { ok: boolean; engine1?: EngineStatus; engine2?: EngineStatus; engine3?: EngineStatus } & Record<string, unknown>
  redis: { ok: boolean; msg?: string } & Record<string, unknown>
}
interface HistoryPoint { ts: number; latency: number; status: string; dbOk: boolean; redisOk: boolean }

const healthData = ref<HealthData | null>(null)
const loading = ref(false)
const autoRefresh = ref(false)
const history = ref<HistoryPoint[]>([])
const lastUpdateAt = ref('')
let timer: number | null = null
const chartRef = ref<HTMLElement>()
let chart: ECharts | null = null

const MAX_HISTORY = 60

const statusTagType = computed(() => {
  if (!healthData.value) return 'info'
  if (healthData.value.status === 'ok') return 'success'
  if (healthData.value.status === 'degraded') return 'warning'
  return 'danger'
})

const statusText = computed(() => {
  if (!healthData.value) return '-'
  if (healthData.value.status === 'ok') return t('adminCommon.backendHealth.healthy')
  if (healthData.value.status === 'degraded') return t('adminCommon.backendHealth.degraded')
  return t('adminCommon.backendHealth.unhealthy')
})

const formattedUptime = computed(() => {
  if (!healthData.value) return '-'
  const s = healthData.value.uptime_s
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
})

const dbOk = computed(() => healthData.value?.db?.ok ?? false)
const redisOk = computed(() => healthData.value?.redis?.ok ?? false)
const redisMsg = computed(() => healthData.value?.redis?.msg ?? '-')

const dbEngines = computed<EngineStatus[]>(() => {
  if (!healthData.value?.db) return []
  const arr: EngineStatus[] = []
  for (let i = 1; i <= 3; i++) {
    const e = healthData.value.db[`engine${i}`] as EngineStatus | undefined
    if (e && typeof e === 'object' && typeof e.ok === 'boolean') arr.push(e)
  }
  return arr
})

const formatTime = (ts: number) => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const fetchHealth = async () => {
  const t0 = performance.now()
  loading.value = true
  try {
    const token = getUserToken()
    const res = await fetch('/health', {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    })
    const data = await res.json()
    healthData.value = data
    const latency = Math.round(performance.now() - t0)
    history.value.push({
      ts: Date.now(),
      latency,
      status: data.status,
      dbOk: data.db?.ok ?? false,
      redisOk: data.redis?.ok ?? false,
    })
    if (history.value.length > MAX_HISTORY) history.value = history.value.slice(-MAX_HISTORY)
    lastUpdateAt.value = formatTime(Date.now())
  } catch (e) {
    healthData.value = { status: 'unhealthy', uptime_s: 0, db: { ok: false }, redis: { ok: false, msg: String(e) } }
    history.value.push({
      ts: Date.now(),
      latency: Math.round(performance.now() - t0),
      status: 'unhealthy',
      dbOk: false,
      redisOk: false,
    })
    if (history.value.length > MAX_HISTORY) history.value = history.value.slice(-MAX_HISTORY)
    lastUpdateAt.value = formatTime(Date.now())
  } finally {
    loading.value = false
  }
}

const toggleAutoRefresh = (val: boolean) => {
  if (val) {
    timer = window.setInterval(fetchHealth, 30000)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const clearHistory = () => {
  history.value = []
}

const exportCsv = () => {
  if (!history.value.length) {
    ElMessage.warning(t('adminCommon.backendHealth.exportEmpty'))
    return
  }
  // CSV 表头 (BOM 让 Excel 正确识别 UTF-8)
  const header = '时间,状态,响应时间(ms),数据库,Redis'
  // 字段转义: 包含逗号/引号/换行的值用双引号包裹, 内部引号双写
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = history.value.map(p => [
    new Date(p.ts).toISOString(),
    p.status,
    p.latency,
    p.dbOk ? 'ok' : 'fail',
    p.redisOk ? 'ok' : 'fail',
  ].map(esc).join(','))
  // 顺序: 新 → 旧
  const csv = '\ufeff' + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `backend-health-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const renderChart = async () => {
  if (!chartRef.value || history.value.length === 0) return
  if (!chart) {
    const echarts = await loadEcharts()
    chart = echarts.init(chartRef.value)
    window.addEventListener('resize', handleResize)
  }
  const isDark = darkModeStore.isDarkMode
  const getVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const bgColor = getVar('--el-bg-color') || 'var(--el-bg-color)'
  const borderColor = getVar('--el-border-color') || 'var(--el-border-color)'
  const textPrimary = getVar('--el-text-color-primary') || 'var(--el-text-color-primary)'
  const successColor = getVar('--el-color-success') || 'var(--el-color-success)'
  const warningColor = getVar('--el-color-warning') || 'var(--el-color-warning)'
  const dangerColor = getVar('--el-color-danger') || 'var(--el-color-danger)'
  const primaryColor = getVar('--el-color-primary') || 'var(--el-color-primary)'
  const xs = history.value.map(p => formatTime(p.ts))
  const ys = history.value.map(p => p.latency)
  const abnormalIdx: number[] = []
  history.value.forEach((p, i) => { if (p.status !== 'ok') abnormalIdx.push(i) })
  chart.setOption({
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: bgColor,
      borderColor: borderColor,
      textStyle: { color: textPrimary, fontSize: 13 },
      formatter: (params: unknown) => {
        const arr = params as Array<{ dataIndex: number }>
        const idx = arr[0]?.dataIndex
        const p = history.value[idx]
        if (!p) return ''
        const statusColor = p.status === 'ok' ? successColor
          : p.status === 'degraded' ? warningColor
          : dangerColor
        const dbColor = p.dbOk ? successColor : dangerColor
        const redisColor = p.redisOk ? successColor : dangerColor
        return `
          <div style="line-height:1.6">
            <div style="font-weight:bold;margin-bottom:4px">${formatTime(p.ts)}</div>
            <div>响应时间: <b>${p.latency} ms</b></div>
            <div>总状态: <span style="color:${statusColor}">${p.status}</span></div>
            <div>DB: <span style="color:${dbColor}">${p.dbOk ? '✓ ok' : '✗ fail'}</span></div>
            <div>Redis: <span style="color:${redisColor}">${p.redisOk ? '✓ ok' : '✗ fail'}</span></div>
          </div>
        `
      },
    },
    xAxis: { type: 'category', data: xs, axisLabel: { rotate: xs.length > 10 ? 30 : 0 } },
    yAxis: { type: 'value', name: t('adminCommon.backendHealth.responseTime') },
    series: [{
      name: t('adminCommon.backendHealth.responseTime'),
      type: 'line',
      data: ys,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: primaryColor, width: 2 },
      itemStyle: { color: primaryColor },
      areaStyle: { color: primaryColor + (isDark ? '1a' : '26') },
      markPoint: {
        data: abnormalIdx.map(i => ({ coord: [xs[i], ys[i]], itemStyle: { color: dangerColor } })),
        symbol: 'pin',
        symbolSize: 28,
        label: { formatter: '!', color: bgColor, fontWeight: 'bold' },
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: warningColor, type: 'dashed' },
        data: [{ yAxis: 1000, name: '1s' }],
      },
    }],
  })
}

const handleResize = () => {
  if (resizeRafId) cancelAnimationFrame(resizeRafId)
  resizeRafId = requestAnimationFrame(() => chart?.resize())
}
let resizeRafId: number | null = null

watch(history, () => {
  nextTick(() => renderChart())
}, { deep: true })

// 监听暗色模式变化，重新渲染图表以更新颜色
watch(
  () => darkModeStore.isDarkMode,
  () => {
    if (chart) {
      renderChart()
    }
  }
)

onMounted(() => {
  fetchHealth()
  nextTick(() => renderChart())
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (timer) clearInterval(timer) })
cleanup.add(() => { if (chart) { chart.dispose(); chart = null } })
cleanup.add(() => window.removeEventListener('resize', handleResize))
</script>

<style scoped>
.backend-health { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-actions { display: flex; align-items: center; gap: 12px; }
.stat-item { text-align: center; }
.stat-label { font-size: 14px; color: var(--el-text-color-primary); margin-bottom: 10px; }
.stat-value { font-size: 24px; font-weight: bold; }
.engine-list { display: flex; flex-direction: column; gap: 12px; }
.engine-item { display: flex; align-items: center; gap: 12px; }
.engine-name { font-weight: bold; min-width: 70px; }
.engine-msg { color: var(--el-text-color-secondary); font-size: 13px; }
.redis-info { display: flex; flex-direction: column; gap: 12px; }
.info-row { display: flex; align-items: center; gap: 12px; }
.info-label { min-width: 70px; color: var(--el-text-color-secondary); }
.info-value { color: var(--el-text-color-primary); }
.trend-chart { width: 100%; height: 320px; }
.empty-history { padding: 60px 0; text-align: center; color: var(--el-text-color-secondary); }
.history-tip { font-size: 13px; color: var(--el-text-color-secondary); }
.last-update { padding-top: 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.raw-data { background: var(--el-fill-color-light); padding: 12px; border-radius: var(--global-border-radius); font-size: 13px; overflow-x: auto; }
.mt-20 { margin-top: 20px; }
</style>
