<template>
  <div class="monitoring-dashboard">
    <div class="flex flex-wrap gap-5">
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('monitoring.activeTours') }}</div>
          <div class="stat-value">{{ performanceSnapshot.tour.activeCount }}</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('monitoring.completionRate') }}</div>
          <div class="stat-value">{{ performanceSnapshot.tour.completionRate.toFixed(1) }}%</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('monitoring.errorRate') }}</div>
          <div class="stat-value error">{{ performanceSnapshot.tour.errorRate.toFixed(1) }}%</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('monitoring.activeAlerts') }}</div>
          <div class="stat-value warning">{{ alertStats.firingAlerts }}</div>
        </Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-5 mt-20">
      <div class="w-2/3">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('monitoring.performanceMonitor') }}</span>
              <div class="flex gap-2">
                <Button size="sm" :variant="timeRange === '1h' ? 'default' : 'outline'" @click="timeRange = '1h'">{{ t('monitoring.timeRange.1h') }}</Button>
                <Button size="sm" :variant="timeRange === '24h' ? 'default' : 'outline'" @click="timeRange = '24h'">{{ t('monitoring.timeRange.24h') }}</Button>
                <Button size="sm" :variant="timeRange === '7d' ? 'default' : 'outline'" @click="timeRange = '7d'">{{ t('monitoring.timeRange.7d') }}</Button>
              </div>
            </div>
          </CardHeader><CardContent class="p-5">
                    <div ref="performanceChart" class="chart-container"></div>
        </CardContent></Card>
      </div>
      <div class="w-1/3">
        <Card><CardHeader><CardTitle>{{ t('monitoring.systemResources') }}</CardTitle></CardHeader><CardContent class="p-5">
                    <div class="resource-item">
            <span>{{ t('monitoring.memoryUsage') }}</span>
            <div class="w-full bg-muted rounded-full h-2"><div class="h-2 rounded-full" :class="performanceSnapshot.memory.percentage > 80 ? 'bg-red-500' : 'bg-primary'" :style="{ width: performanceSnapshot.memory.percentage + '%' }"></div></div>
          </div>
          <div class="resource-item">
            <span>{{ t('monitoring.cpuUsage') }}</span>
            <div class="w-full bg-muted rounded-full h-2"><div class="h-2 rounded-full" :class="performanceSnapshot.cpu.usage > 80 ? 'bg-red-500' : 'bg-primary'" :style="{ width: performanceSnapshot.cpu.usage + '%' }"></div></div>
          </div>
          <div class="resource-item">
            <span>{{ t('monitoring.renderFps') }}</span>
            <div class="w-full bg-muted rounded-full h-2"><div class="bg-primary h-2 rounded-full" :style="{ width: Math.min(100, performanceSnapshot.render.fps / 60 * 100) + '%' }"></div></div>
          </div>
        </CardContent></Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-5 mt-20">
      <div class="w-1/2">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('monitoring.anomalyDetection') }}</span>
              <span class="relative inline-flex">
                <Button variant="outline" size="sm" @click="showAnomalyDialog = true">{{ t('monitoring.viewAll') }}</Button>
                <span v-if="unacknowledgedAnomalies.length > 0" class="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">{{ unacknowledgedAnomalies.length }}</span>
              </span>
            </div>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[100px]">{{ t('monitoring.type') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('monitoring.severity') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('monitoring.currentValue') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('monitoring.expectedValue') }}</TableHead>
                <TableHead class="w-[80px]">{{ t('monitoring.acknowledge') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in recentAnomalies" :key="row.id ?? index">
                <TableCell>
                  <Tag :type="getAnomalyTypeTag(row.type)">{{ t(`monitoring.anomalyTypes.${row.type}`) }}</Tag>
                </TableCell>
                <TableCell>
                  <Tag :type="getSeverityTag(row.severity)">{{ t(`monitoring.severityLevels.${row.severity}`) }}</Tag>
                </TableCell>
                <TableCell>{{ row.value.toFixed(2) }}</TableCell>
                <TableCell>{{ row.expectedValue.toFixed(2) }}</TableCell>
                <TableCell>
                  <Button v-if="canManageAlerts" variant="ghost" size="sm" @click="acknowledgeAnomaly(row.id)">{{ t('monitoring.acknowledge') }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
      <div class="w-1/2">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('monitoring.alertRules') }}</span>
              <Button v-if="canManageAlerts" variant="default" size="sm" @click="showRuleDialog = true">{{ t('monitoring.newRule') }}</Button>
            </div>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('monitoring.ruleName') }}</TableHead>
                <TableHead class="w-[120px]">{{ t('monitoring.monitorMetric') }}</TableHead>
                <TableHead class="w-[80px]">{{ t('monitoring.severityLevel') }}</TableHead>
                <TableHead class="w-[80px]">{{ t('monitoring.status') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in alertRules" :key="row.id ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.metric }}</TableCell>
                <TableCell>
                  <Tag :type="getSeverityTag(row.severity)">{{ t(`monitoring.severityLevels.${row.severity}`) }}</Tag>
                </TableCell>
                <TableCell>
                  <Switch v-model="row.enabled" @change="toggleRule(row)" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>

    <Dialog v-model="showRuleDialog" width="500px">
      <DialogHeader>
        <DialogTitle>{{ t('monitoring.newRule') }}</DialogTitle>
      </DialogHeader>
      <form @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('monitoring.ruleName') }}</label>
          <div class="flex-1">
            <Input v-model="newRule.name" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('monitoring.monitorMetric') }}</label>
          <div class="flex-1">
            <Select v-model="newRule.metric">
              <SelectOption :label="t('monitoring.metrics.tourStart')" value="tour_start" />
              <SelectOption :label="t('monitoring.metrics.tourComplete')" value="tour_complete" />
              <SelectOption :label="t('monitoring.metrics.tourError')" value="tour_error" />
              <SelectOption :label="t('monitoring.metrics.memoryUsage')" value="memory_usage" />
              <SelectOption :label="t('monitoring.metrics.cpuUsage')" value="cpu_usage" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('monitoring.condition') }}</label>
          <div class="flex-1">
            <Select v-model="newRule.operator" style="width: 100px">
              <SelectOption :label="t('monitoring.operators.gt')" value="gt" />
              <SelectOption :label="t('monitoring.operators.lt')" value="lt" />
              <SelectOption :label="t('monitoring.operators.eq')" value="eq" />
            </Select>
            <el-input-number v-model="newRule.threshold" style="width: 150px" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('monitoring.severityLevel') }}</label>
          <div class="flex-1">
            <Select v-model="newRule.severity">
              <SelectOption :label="t('monitoring.severityLevels.info')" value="info" />
              <SelectOption :label="t('monitoring.severityLevels.warning')" value="warning" />
              <SelectOption :label="t('monitoring.severityLevels.critical')" value="critical" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('monitoring.cooldownTime') }}</label>
          <div class="flex-1">
            <el-input-number v-model="newRule.cooldown" :min="60" :step="60" />
            <span class="ml-10">{{ t('monitoring.seconds') }}</span>
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showRuleDialog = false">{{ t('monitoring.cancel') }}</Button>
        <Button variant="default" @click="createRule">{{ t('monitoring.create') }}</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage } from 'element-plus'
import echarts from '@/utils/echarts'
import { tourMonitoringService, type AnomalyDetection } from '@/services/tourMonitoringService'
import { tourAlertService, type AlertRule } from '@/services/tourAlertService'
import { useTourPermissions } from '@/composables/useTourPermissions'
import { monitoringWebSocket } from '@/utils/monitoring-websocket'
import { getUserToken } from '@/utils/request'
import { tourMonitoringI18n } from '@/locales/tour-i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Tag } from '@/components/ui/tag'
import { Switch } from '@/components/ui/switch'
import { Select, SelectOption } from '@/components/ui/select'

const t = (key: string) => {
  const keys = key.split('.')
  let result: unknown = tourMonitoringI18n
  for (const k of keys) {
    result = (result as Record<string, unknown>)?.[k]
  }
  return typeof result === 'string' ? result : key
}
const { canManageAlerts, canViewMonitoring } = useTourPermissions()

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
let chart: echarts.ECharts | null = null
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

const initChart = () => {
  if (!performanceChart.value) return
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

    // JWT 鉴权: 传�?token
    const _jwtToken = getUserToken() || ''
    await monitoringWebSocket.connect(wsUrl, _jwtToken)
    wsConnected.value = true
  } catch {
    wsConnected.value = false
  }
}

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
  font-weight: bold;
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
  color: var(--color-gray-606266);
}

.mt-20 {
  margin-top: 20px;
}

.ml-10 {
  margin-left: 10px;
}
</style>
