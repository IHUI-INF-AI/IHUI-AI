<template>
  <div class="monitoring-dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('monitoring.activeTours') }}</div>
          <div class="stat-value">{{ performanceSnapshot.tour.activeCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('monitoring.completionRate') }}</div>
          <div class="stat-value">{{ performanceSnapshot.tour.completionRate.toFixed(1) }}%</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('monitoring.errorRate') }}</div>
          <div class="stat-value error">{{ performanceSnapshot.tour.errorRate.toFixed(1) }}%</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('monitoring.activeAlerts') }}</div>
          <div class="stat-value warning">{{ alertStats.firingAlerts }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('monitoring.performanceMonitor') }}</span>
              <el-button-group>
                <el-button size="small" @click="timeRange = '1h'" :type="timeRange === '1h' ? 'primary' : ''">{{ t('monitoring.timeRange.1h') }}</el-button>
                <el-button size="small" @click="timeRange = '24h'" :type="timeRange === '24h' ? 'primary' : ''">{{ t('monitoring.timeRange.24h') }}</el-button>
                <el-button size="small" @click="timeRange = '7d'" :type="timeRange === '7d' ? 'primary' : ''">{{ t('monitoring.timeRange.7d') }}</el-button>
              </el-button-group>
            </div>
          </template>
          <div ref="performanceChart" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>{{ t('monitoring.systemResources') }}</template>
          <div class="resource-item">
            <span>{{ t('monitoring.memoryUsage') }}</span>
            <el-progress :percentage="performanceSnapshot.memory.percentage" :status="performanceSnapshot.memory.percentage > 80 ? 'exception' : ''" />
          </div>
          <div class="resource-item">
            <span>{{ t('monitoring.cpuUsage') }}</span>
            <el-progress :percentage="performanceSnapshot.cpu.usage" :status="performanceSnapshot.cpu.usage > 80 ? 'exception' : ''" />
          </div>
          <div class="resource-item">
            <span>{{ t('monitoring.renderFps') }}</span>
            <el-progress :percentage="Math.min(100, performanceSnapshot.render.fps / 60 * 100)" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('monitoring.anomalyDetection') }}</span>
              <el-badge :value="unacknowledgedAnomalies.length" :hidden="unacknowledgedAnomalies.length === 0">
                <el-button size="small" @click="showAnomalyDialog = true">{{ t('monitoring.viewAll') }}</el-button>
              </el-badge>
            </div>
          </template>
          <el-table :data="recentAnomalies" max-height="300">
            <el-table-column prop="type" :label="t('monitoring.type')" width="100">
              <template #default="{ row }">
                <el-tag :type="getAnomalyTypeTag(row.type)">{{ t(`monitoring.anomalyTypes.${row.type}`) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="severity" :label="t('monitoring.severity')" width="100">
              <template #default="{ row }">
                <el-tag :type="getSeverityTag(row.severity)">{{ t(`monitoring.severityLevels.${row.severity}`) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="value" :label="t('monitoring.currentValue')" width="100">
              <template #default="{ row }">{{ row.value.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="expectedValue" :label="t('monitoring.expectedValue')" width="100">
              <template #default="{ row }">{{ row.expectedValue.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column :label="t('monitoring.acknowledge')" width="80">
              <template #default="{ row }">
                <el-button v-if="canManageAlerts" size="small" text @click="acknowledgeAnomaly(row.id)">{{ t('monitoring.acknowledge') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('monitoring.alertRules') }}</span>
              <el-button v-if="canManageAlerts" size="small" type="primary" @click="showRuleDialog = true">{{ t('monitoring.newRule') }}</el-button>
            </div>
          </template>
          <el-table :data="alertRules" max-height="300">
            <el-table-column prop="name" :label="t('monitoring.ruleName')" />
            <el-table-column prop="metric" :label="t('monitoring.monitorMetric')" width="120" />
            <el-table-column prop="severity" :label="t('monitoring.severityLevel')" width="80">
              <template #default="{ row }">
                <el-tag :type="getSeverityTag(row.severity)">{{ t(`monitoring.severityLevels.${row.severity}`) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="enabled" :label="t('monitoring.status')" width="80">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" @change="toggleRule(row)" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showRuleDialog" :title="t('monitoring.newRule')" width="500px">
      <el-form :model="newRule" label-width="80px">
        <el-form-item :label="t('monitoring.ruleName')">
          <el-input v-model="newRule.name" />
        </el-form-item>
        <el-form-item :label="t('monitoring.monitorMetric')">
          <el-select v-model="newRule.metric">
            <el-option :label="t('monitoring.metrics.tourStart')" value="tour_start" />
            <el-option :label="t('monitoring.metrics.tourComplete')" value="tour_complete" />
            <el-option :label="t('monitoring.metrics.tourError')" value="tour_error" />
            <el-option :label="t('monitoring.metrics.memoryUsage')" value="memory_usage" />
            <el-option :label="t('monitoring.metrics.cpuUsage')" value="cpu_usage" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('monitoring.condition')">
          <el-select v-model="newRule.operator" class="operator-select">
            <el-option :label="t('monitoring.operators.gt')" value="gt" />
            <el-option :label="t('monitoring.operators.lt')" value="lt" />
            <el-option :label="t('monitoring.operators.eq')" value="eq" />
          </el-select>
          <el-input-number v-model="newRule.threshold" class="threshold-input" />
        </el-form-item>
        <el-form-item :label="t('monitoring.severityLevel')">
          <el-select v-model="newRule.severity">
            <el-option :label="t('monitoring.severityLevels.info')" value="info" />
            <el-option :label="t('monitoring.severityLevels.warning')" value="warning" />
            <el-option :label="t('monitoring.severityLevels.critical')" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('monitoring.cooldownTime')">
          <el-input-number v-model="newRule.cooldown" :min="60" :step="60" />
          <span class="ml-10">{{ t('monitoring.seconds') }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRuleDialog = false">{{ t('monitoring.cancel') }}</el-button>
        <el-button type="primary" @click="createRule">{{ t('monitoring.create') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage } from 'element-plus'
import { loadEcharts } from '@/utils/echarts-lazy'
import type { ECharts } from '@/utils/echarts'
import { tourMonitoringService, type AnomalyDetection } from '@/services/tourMonitoringService'
import { tourAlertService, type AlertRule } from '@/services/tourAlertService'
import { useTourPermissions } from '@/composables/useTourPermissions'
import { monitoringWebSocket } from '@/utils/monitoring-websocket'
import { getUserToken } from '@/utils/request'
import { tourMonitoringI18n } from '@/locales/tour-i18n'
import { useDarkModeStore } from '@/stores/darkMode'

const t = (key: string) => {
  const keys = key.split('.')
  let result: any = tourMonitoringI18n
  for (const k of keys) {
    result = (result as Record<string, unknown>)?.[k]
  }
  return typeof result === 'string' ? result : key
}
const { canManageAlerts, canViewMonitoring } = useTourPermissions()
const darkModeStore = useDarkModeStore()

const timeRange = ref('1h')
const showRuleDialog = ref(false)
const showAnomalyDialog = ref(false)
const wsConnected = ref(false)

const performanceSnapshot = ref(tourMonitoringService.getPerformanceSnapshot())
const alertStats = ref(tourAlertService.getStats())
const alertRules = ref<AlertRule[]>([])
const anomalies = ref<AnomalyDetection[]>([])

const newRule = ref({
  name: '',
  metric: 'tour_error',
  operator: 'gt',
  threshold: 10,
  severity: 'warning' as const,
  cooldown: 300
})

const performanceChart = ref<HTMLElement>()
let chart: ECharts | null = null
let updateInterval: number | null = null

const recentAnomalies = computed(() => anomalies.value.slice(0, 5))
const unacknowledgedAnomalies = computed(() => anomalies.value.filter(a => !a.acknowledged))

const getAnomalyTypeTag = (type: string) => {
  const map: Record<string, string> = { spike: 'danger', drop: 'warning', trend_change: 'info', outlier: '' }
  return map[type] || ''
}

const getSeverityTag = (severity: string) => {
  const map: Record<string, string> = { info: 'info', warning: 'warning', critical: 'danger', low: '', medium: 'warning', high: 'danger' }
  return map[severity] || ''
}

const initChart = async () => {
  if (!performanceChart.value) return
  const echarts = await loadEcharts()
  chart = echarts.init(performanceChart.value)
  window.addEventListener('resize', handleResize)
  updateChart()
}

let resizeRafId: number | null = null
const handleResize = () => {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    chart?.resize()
  })
}

const updateChart = () => {
  if (!chart) return
  const duration = timeRange.value === '1h' ? 3600000 : timeRange.value === '24h' ? 86400000 : 604800000
  const series = tourMonitoringService.getMetricSeries('tour_complete', duration)

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: [t('monitoring.metrics.tourComplete'), t('monitoring.metrics.tourError'), t('monitoring.memoryUsage')] },
    xAxis: { type: 'time' },
    yAxis: [
      { type: 'value', name: 'count' },
      { type: 'value', name: '%', max: 100 }
    ],
    series: [
      {
        name: t('monitoring.metrics.tourComplete'),
        type: 'line',
        smooth: true,
        data: series[0]?.data.map(d => [d.timestamp, d.value]) || []
      },
      {
        name: t('monitoring.metrics.tourError'),
        type: 'line',
        smooth: true,
        data: tourMonitoringService.getMetricSeries('tour_error', duration)[0]?.data.map(d => [d.timestamp, d.value]) || []
      },
      {
        name: t('monitoring.memoryUsage'),
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: tourMonitoringService.getMetricSeries('memory_usage', duration)[0]?.data.map(d => [d.timestamp, d.value]) || []
      }
    ]
  }
  chart.setOption(option)
}

const refreshData = () => {
  performanceSnapshot.value = tourMonitoringService.getPerformanceSnapshot()
  alertStats.value = tourAlertService.getStats()
  alertRules.value = tourAlertService.getAllRules()
  anomalies.value = tourMonitoringService.getAnomalies()
  updateChart()
}

const createRule = () => {
  if (!newRule.value.name) {
    ElMessage.warning(t('monitoring.ruleName'))
    return
  }
  tourAlertService.createRule({
    name: newRule.value.name,
    description: '',
    metric: newRule.value.metric,
    condition: {
      operator: newRule.value.operator as 'gt' | 'lt',
      threshold: newRule.value.threshold,
      duration: 60000,
      aggregation: 'avg'
    },
    severity: newRule.value.severity,
    enabled: true,
    cooldown: newRule.value.cooldown * 1000,
    channels: [],
    labels: {}
  })
  showRuleDialog.value = false
  refreshData()
  ElMessage.success('ok')
}

const toggleRule = (rule: AlertRule) => {
  tourAlertService.updateRule(rule.id, { enabled: rule.enabled })
}

const acknowledgeAnomaly = (id: string) => {
  tourMonitoringService.acknowledgeAnomaly(id)
  refreshData()
  ElMessage.success('ok')
}

const initWebSocket = async () => {
  try {
    const wsUrl = import.meta.env.VITE_MONITORING_WS_URL
    if (!wsUrl) return

    monitoringWebSocket.setHandlers({
      onMetric: () => refreshData(),
      onAnomaly: () => refreshData(),
      onAlert: () => refreshData(),
      onSnapshot: () => refreshData(),
      onStatusChange: (status) => {
        wsConnected.value = status === 'connected'
      }
    })

    // JWT 鉴权: 传递 token
    const _jwtToken = getUserToken() || ''
    await monitoringWebSocket.connect(wsUrl, _jwtToken)
    wsConnected.value = true
  } catch {
    wsConnected.value = false
  }
}

// 监听暗色模式变化，重新渲染图表以更新颜色
watch(
  () => darkModeStore.isDarkMode,
  () => {
    if (chart) {
      updateChart()
    }
  }
)

onMounted(() => {
  if (!canViewMonitoring.value) return

  tourMonitoringService.startMonitoring()
  tourAlertService.startChecking()
  initChart()
  refreshData()
  initWebSocket()
  updateInterval = window.setInterval(refreshData, 5000)
})

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()
cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
cleanup.add(() => tourMonitoringService.stopMonitoring())
cleanup.add(() => tourAlertService.stopChecking())
cleanup.add(() => { if (updateInterval) { clearInterval(updateInterval); updateInterval = null } })
cleanup.add(() => window.removeEventListener('resize', handleResize))
cleanup.add(() => monitoringWebSocket.disconnect())
cleanup.add(() => chart?.dispose())
</script>

<style scoped>
.monitoring-dashboard {
  padding: 20px;
}

.stat-card {
  text-align: center;
}

.stat-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-top: 10px;
}

.stat-value.error {
  color: var(--color-danger-variant);
}

.stat-value.warning {
  color: var(--color-warning-variant);
}

.chart-container {
  height: 300px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resource-item {
  margin-bottom: 20px;
}

.resource-item span {
  display: block;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
}

.mt-20 {
  margin-top: 20px;
}

.ml-10 {
  margin-left: 10px;
}

.operator-select {
  width: 100px;
}

.threshold-input {
  width: 150px;
}
</style>
