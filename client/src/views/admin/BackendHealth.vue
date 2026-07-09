<template>
  <div class="backend-health">
    <Card class="status-card"><CardHeader>
        <div class="card-header">
          <span>{{ t('adminCommon.backendHealth.title') }}</span>
          <div class="header-actions">
            <Switch v-model="autoRefresh" @change="toggleAutoRefresh" />
            <Button variant="outline" size="sm" @click="fetchHealth">{{ t('adminCommon.backendHealth.refresh') }}</Button>
          </div>
        </div>
      </CardHeader><CardContent class="p-5">
            <div v-loading="loading">
        <div class="flex flex-wrap gap-5">
          <div class="w-1/4">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.overallStatus') }}</div>
              <Tag :type="statusTagType" size="large">{{ statusText }}</Tag>
            </div>
          </div>
          <div class="w-1/4">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.uptime') }}</div>
              <div class="stat-value">{{ formattedUptime }}</div>
            </div>
          </div>
          <div class="w-1/4">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.database') }}</div>
              <Tag :type="dbOk ? 'success' : 'danger'" size="large">{{ dbOk ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</Tag>
            </div>
          </div>
          <div class="w-1/4">
            <div class="stat-item">
              <div class="stat-label">{{ t('adminCommon.backendHealth.redis') }}</div>
              <Tag :type="redisOk ? 'success' : 'danger'" size="large">{{ redisOk ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</Tag>
            </div>
          </div>
        </div>
      </div>
    </CardContent></Card>

    <div class="flex flex-wrap gap-5 mt-20">
      <div class="w-1/2">
        <Card><CardHeader><CardTitle>{{ t('adminCommon.backendHealth.databaseEngines') }}</CardTitle></CardHeader><CardContent class="p-5">
                    <div v-loading="loading" class="engine-list">
            <div v-for="(eng, idx) in dbEngines" :key="idx" class="engine-item">
              <span class="engine-name">engine{{ Number(idx) + 1 }}</span>
              <Tag :type="eng.ok ? 'success' : 'danger'" size="small">{{ eng.ok ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</Tag>
              <span class="engine-msg">{{ eng.msg }}</span>
            </div>
          </div>
        </CardContent></Card>
      </div>
      <div class="w-1/2">
        <Card><CardHeader><CardTitle>{{ t('adminCommon.backendHealth.redisInfo') }}</CardTitle></CardHeader><CardContent class="p-5">
                    <div v-loading="loading" class="redis-info">
            <div class="info-row">
              <span class="info-label">{{ t('adminCommon.backendHealth.status') }}</span>
              <Tag :type="redisOk ? 'success' : 'danger'" size="small">{{ redisOk ? t('adminCommon.backendHealth.normal') : t('adminCommon.backendHealth.abnormal') }}</Tag>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('adminCommon.backendHealth.message') }}</span>
              <span class="info-value">{{ redisMsg }}</span>
            </div>
          </div>
        </CardContent></Card>
      </div>
    </div>

    <Card class="mt-20"><CardHeader>
        <div class="card-header">
          <span>{{ t('adminCommon.backendHealth.trendChart') }}</span>
          <div class="header-actions">
            <span class="history-tip">{{ t('adminCommon.backendHealth.historyPoints', { n: history.length }) }}</span>
            <Button v-if="history.length" variant="outline" size="sm" className="export-csv-btn" @click="exportCsv">{{ t('adminCommon.backendHealth.exportCsv') }}</Button>
            <Button v-if="history.length" variant="outline" size="sm" className="clear-history-btn" @click="clearHistory">{{ t('adminCommon.backendHealth.clearHistory') }}</Button>
          </div>
        </div>
      </CardHeader><CardContent class="p-5">
            <div v-if="history.length === 0" class="empty-history">
        {{ t('adminCommon.backendHealth.historyEmpty') }}
      </div>
      <div v-else ref="chartRef" class="trend-chart"></div>
      <div v-if="lastUpdateAt" class="last-update">
        {{ t('adminCommon.backendHealth.lastUpdate') }}: {{ lastUpdateAt }}
      </div>
    </CardContent></Card>

    <Card class="mt-20"><CardHeader><CardTitle>{{ t('adminCommon.backendHealth.rawData') }}</CardTitle></CardHeader><CardContent class="p-5">
            <pre class="raw-data">{{ JSON.stringify(healthData, null, 2) }}</pre>
    </CardContent></Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import echarts from '@/utils/echarts'
import { useCleanup } from '@/composables/useCleanup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Button from '@/components/ui/Button.vue'
import { Tag } from '@/components/ui/tag'
import { Switch } from '@/components/ui/switch'

const { t } = useI18n()

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
let chart: echarts.ECharts | null = null

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
    const res = await fetch('/health')
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
  // CSV 表头 (BOM �?Excel 正确识别 UTF-8)
  const header = '时间,状�?响应时间(ms),数据�?Redis'
  // 字段转义: 包含逗号/引号/换行的值用双引号包�? 内部引号双写
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
  // 顺序: �?�?�?
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

const renderChart = () => {
  if (!chartRef.value || history.value.length === 0) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
    window.addEventListener('resize', handleResize)
  }
  const xs = history.value.map(p => formatTime(p.ts))
  const ys = history.value.map(p => p.latency)
  const abnormalIdx: number[] = []
  history.value.forEach((p, i) => { if (p.status !== 'ok') abnormalIdx.push(i) })
  chart.setOption({
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(50,50,50,0.9)',
      borderColor: getComputedStyle(document.documentElement).getPropertyValue('--el-border-color').trim() || '#333',
      textStyle: { color: getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color').trim() || '#fff', fontSize: 13 },
      formatter: (params: unknown) => {
        const arr = params as Array<{ dataIndex: number }>
        const idx = arr[0]?.dataIndex
        const p = history.value[idx]
        if (!p) return ''
        const statusColor = p.status === 'ok' ? getComputedStyle(document.documentElement).getPropertyValue('--el-color-success').trim() || '#67c23a'
          : p.status === 'degraded' ? getComputedStyle(document.documentElement).getPropertyValue('--el-color-warning').trim() || '#e6a23c'
          : getComputedStyle(document.documentElement).getPropertyValue('--el-color-danger').trim() || '#f56c6c'
        const dbColor = p.dbOk ? (getComputedStyle(document.documentElement).getPropertyValue('--el-color-success').trim() || '#67c23a') : (getComputedStyle(document.documentElement).getPropertyValue('--el-color-danger').trim() || '#f56c6c')
        const redisColor = p.redisOk ? (getComputedStyle(document.documentElement).getPropertyValue('--el-color-success').trim() || '#67c23a') : (getComputedStyle(document.documentElement).getPropertyValue('--el-color-danger').trim() || '#f56c6c')
        return `
          <div style="line-height:1.6">
            <div style="font-weight:bold;margin-bottom:4px">${formatTime(p.ts)}</div>
            <div>响应时间: <b>${p.latency} ms</b></div>
            <div>总状�? <span style="color:${statusColor}">${p.status}</span></div>
            <div>DB: <span style="color:${dbColor}">${p.dbOk ? '�?ok' : '�?fail'}</span></div>
            <div>Redis: <span style="color:${redisColor}">${p.redisOk ? '�?ok' : '�?fail'}</span></div>
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
      lineStyle: { color: getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim() || '#409eff', width: 2 },
      itemStyle: { color: getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim() || '#409eff' },
      areaStyle: { color: 'rgba(64,158,255,0.15)' },
      markPoint: {
        data: abnormalIdx.map(i => ({ coord: [xs[i], ys[i]], itemStyle: { color: getComputedStyle(document.documentElement).getPropertyValue('--el-color-danger').trim() || '#f56c6c' } })),
        symbol: 'pin',
        symbolSize: 28,
        label: { formatter: '!', color: getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color').trim() || '#fff', fontWeight: 'bold' },
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: getComputedStyle(document.documentElement).getPropertyValue('--el-color-warning').trim() || '#e6a23c', type: 'dashed' },
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
