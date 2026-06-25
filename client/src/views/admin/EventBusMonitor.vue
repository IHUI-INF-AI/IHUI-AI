<template>
  <div class="event-bus-page">
    <ElRow :gutter="20">
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ stats.totalEvents }}</div>
          <div class="metric-label">t('eventBus.totalEvents')</div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ stats.activeSubscriptions }}</div>
          <div class="metric-label">t('eventBus.activeSubs')</div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ stats.eventsProcessed }}</div>
          <div class="metric-label">t('eventBus.processed')</div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ stats.errorsCount }}</div>
          <div class="metric-label">t('eventBus.errors')</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="20" class="section-row">
      <ElCol :span="12">
        <ElCard>
          <template #header>
            <div class="card-header">
              <span>t('eventBus.typeDist')</span>
            </div>
          </template>
          <div ref="chartRef" class="chart-container"></div>
        </ElCard>
      </ElCol>
      <ElCol :span="12">
        <ElCard>
          <template #header>
            <div class="card-header">
              <span>t('eventBus.subManage')</span>
              <ElButton size="small" type="danger" @click="clearAllSubscriptions">{{ t('eventBus.clearAll') }}</ElButton>
            </div>
          </template>
          <ElTable :data="subscriptions" max-height="300">
            <ElTableColumn prop="id" :label="t('adminCommon.label.subscriptionId')" width="180" show-overflow-tooltip />
            <ElTableColumn :label="t('adminCommon.label.eventType')" width="120">
              <template #default="{ row }">
                <ElTag size="small">{{ formatEventType(row.eventType) }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="t('adminCommon.label.status')" width="80">
              <template #default="{ row }">
                <ElTag :type="row.active ? 'success' : 'info'" size="small">
                  {{ row.active ? t('adminCommon.label.active') : t('adminCommon.label.paused') }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="t('adminCommon.label.callCount')" width="100">
              <template #default="{ row }">
                {{ row.callCount }}
              </template>
            </ElTableColumn>
            <ElTableColumn :label="t('adminCommon.label.actions')" width="150">
              <template #default="{ row }">
                <ElButtonGroup>
                  <ElButton
                    size="small"
                    :type="row.active ? 'warning' : 'success'"
                    @click="toggleSubscription(row.id)"
                  >
                    {{ row.active ? t('adminCommon.label.pause') : t('adminCommon.label.resume') }}
                  </ElButton>
                  <ElButton size="small" type="danger" @click="removeSubscription(row.id)">{{ t('common.delete') }}</ElButton>
                </ElButtonGroup>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElCard class="section-card">
      <template #header>
        <div class="card-header">
          <span>t('eventBus.history')</span>
          <div>
            <ElSelect v-model="filterType" :placeholder="t('adminCommon.placeholder.filterType')" clearable style="width: 150px; margin-right: 10px">
              <ElOption :label="t('adminCommon.label.all')" value="" />
              <ElOption v-for="type in eventTypes" :key="type" :label="type" :value="type" />
            </ElSelect>
            <ElButton size="small" @click="loadHistory">{{ t('common.refresh') }}</ElButton>
            <ElButton size="small" type="danger" @click="clearHistory">{{ t('common.clear') }}</ElButton>
          </div>
        </div>
      </template>
      <ElTable :data="filteredHistory" max-height="400">
        <ElTableColumn :label="t('adminCommon.label.eventId')" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.event.id }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.type')" width="150">
          <template #default="{ row }">
            <ElTag size="small">{{ row.event.type }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.tourId')" width="150">
          <template #default="{ row }">
            {{ row.event.tourId || '-' }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.stepId')" width="150">
          <template #default="{ row }">
            {{ row.event.stepId || '-' }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.status')" width="80">
          <template #default="{ row }">
            <ElTag :type="row.processed ? 'success' : 'danger'" size="small">
              {{ row.processed ? t('adminCommon.label.success') : t('adminCommon.label.failed') }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.processingTime')" width="100">
          <template #default="{ row }">
            {{ row.processingTime.toFixed(2) }}ms
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.subscriberCount')" width="100">
          <template #default="{ row }">
            {{ row.subscribersNotified }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.time')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.event.timestamp) }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.actions')" width="100">
          <template #default="{ row }">
            <ElButton size="small" @click="showEventDetail(row)">{{ t('adminCommon.label.detail') }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElCard class="section-card">
      <template #header>
        <div class="card-header">
          <span>t('eventBus.testSend')</span>
        </div>
      </template>
      <ElForm :model="testForm" inline>
        <ElFormItem :label="t('adminCommon.label.eventType')">
          <ElSelect v-model="testForm.type" style="width: 180px">
            <ElOption v-for="type in eventTypes" :key="type" :label="type" :value="type" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.tourId')">
          <ElInput v-model="testForm.tourId" :placeholder="t('adminCommon.placeholder.optional')" style="width: 150px" />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.stepId')">
          <ElInput v-model="testForm.stepId" :placeholder="t('adminCommon.placeholder.optional')" style="width: 150px" />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" @click="sendTestEvent">{{ t('eventBus.sendEvent') }}</ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElDialog v-model="detailDialogVisible" :title="t('adminCommon.title.eventDetail')" width="600px">
      <template v-if="selectedEvent">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem :label="t('adminCommon.label.eventId')">{{ selectedEvent.event.id }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.type')">{{ selectedEvent.event.type }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.tourId')">{{ selectedEvent.event.tourId || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.stepId')">{{ selectedEvent.event.stepId || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.userId')">{{ selectedEvent.event.userId || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.sessionId')">{{ selectedEvent.event.sessionId || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.processingStatus')">
            <ElTag :type="selectedEvent.processed ? 'success' : 'danger'">
              {{ selectedEvent.processed ? t('adminCommon.label.success') : t('adminCommon.label.failed') }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.processingTime')">{{ selectedEvent.processingTime.toFixed(2) }}ms</ElDescriptionsItem>
        </ElDescriptions>

        <ElDivider content-position="left">t('eventBus.eventData')</ElDivider>
        <pre class="code-block">{{ JSON.stringify(selectedEvent.event.data, null, 2) }}</pre>

        <ElDivider content-position="left">t('eventBus.metadata')</ElDivider>
        <pre class="code-block">{{ JSON.stringify(selectedEvent.event.metadata, null, 2) }}</pre>

        <template v-if="selectedEvent.errors.length > 0">
          <ElDivider content-position="left">t('eventBus.errorInfo')</ElDivider>
          <div class="error-list">
            <ElAlert 
              v-for="(error, index) in selectedEvent.errors" 
              :key="index"
              :title="error"
              type="error"
              show-icon
              class="error-item"
            />
          </div>
        </template>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { loadEcharts } from '@/utils/echarts-lazy'
import type { ECharts } from '@/utils/echarts'
import { tourEventBus, type TourEventType, type EventHistoryEntry, type EventBusStats } from '@/services/tourEventBus'
import { formatDateTime as formatTime } from '@/utils/format'
import { useDarkModeStore } from '@/stores/darkMode'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()

const chartRef = ref<HTMLElement>()
let chart: ECharts | null = null
const cleanup = useCleanup()
cleanup.add(() => chart?.dispose())

const stats = ref<EventBusStats>({
  totalEvents: 0,
  eventsByType: {},
  totalSubscriptions: 0,
  activeSubscriptions: 0,
  eventsProcessed: 0,
  errorsCount: 0,
  averageProcessingTime: 0
})

const subscriptions = ref<Array<{
  id: string
  eventType: TourEventType | TourEventType[] | '*'
  active: boolean
  callCount: number
}>>([])

const history = ref<EventHistoryEntry[]>([])
const filterType = ref('')
const detailDialogVisible = ref(false)
const selectedEvent = ref<EventHistoryEntry | null>(null)

const testForm = ref({
  type: 'tour:start' as TourEventType,
  tourId: '',
  stepId: ''
})

const eventTypes: TourEventType[] = [
  'tour:start', 'tour:complete', 'tour:skip', 'tour:pause', 'tour:resume', 'tour:exit', 'tour:error',
  'step:start', 'step:complete', 'step:skip', 'step:error', 'step:retry',
  'action:click', 'action:input', 'action:scroll', 'action:hover', 'action:focus',
  'trigger:activated', 'trigger:deactivated',
  'visibility:show', 'visibility:hide',
  'progress:update', 'metric:record', 'user:feedback',
  'system:warning', 'system:error', 'custom'
]

const filteredHistory = computed(() => {
  if (!filterType.value) return history.value
  return history.value.filter(h => h.event.type === filterType.value)
})

const loadStats = () => {
  stats.value = tourEventBus.getStats()
}

const loadSubscriptions = () => {
  subscriptions.value = tourEventBus.getActiveSubscriptions()
}

const loadHistory = () => {
  history.value = tourEventBus.getHistory(100)
  loadStats()
  updateChart()
}

const updateChart = async () => {
  if (!chart) return

  const data = Object.entries(stats.value.eventsByType).map(([name, value]) => ({
    name,
    value
  }))

  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      data,
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' }
      }
    }]
  })
}

const toggleSubscription = (id: string) => {
  const sub = subscriptions.value.find(s => s.id === id)
  if (sub) {
    if (sub.active) {
      tourEventBus.pauseSubscription(id)
    } else {
      tourEventBus.resumeSubscription(id)
    }
    loadSubscriptions()
  }
}

const removeSubscription = (id: string) => {
  tourEventBus.unsubscribe(id)
  ElMessage.success(t('admin.eventBus.subscriptionDeleted'))
  loadSubscriptions()
}

const clearAllSubscriptions = () => {
  ElMessageBox.confirm(t('admin.eventBus.confirmClearAll'), t('common.ok'), { type: 'warning' }).then(() => {
    tourEventBus.unsubscribeAll()
    ElMessage.success(t('admin.eventBus.allSubscriptionsCleared'))
    loadSubscriptions()
  }).catch(() => {})
}

const clearHistory = () => {
  ElMessageBox.confirm(t('admin.eventBus.confirmClearHistory'), t('common.ok'), { type: 'warning' }).then(() => {
    tourEventBus.clearHistory()
    ElMessage.success(t('admin.eventBus.historyCleared'))
    loadHistory()
  }).catch(() => {})
}

const sendTestEvent = () => {
  const data: Record<string, unknown> = {}
  if (testForm.value.tourId) data.tourId = testForm.value.tourId
  if (testForm.value.stepId) data.stepId = testForm.value.stepId

  tourEventBus.emit(testForm.value.type, data)
  ElMessage.success(t('admin.eventBus.eventSent'))
  loadHistory()
}

const showEventDetail = (event: EventHistoryEntry) => {
  selectedEvent.value = event
  detailDialogVisible.value = true
}

const formatEventType = (type: TourEventType | TourEventType[] | '*') => {
  if (type === '*') return t('adminCommon.label.all')
  if (Array.isArray(type)) return type.join(', ')
  return type
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

onMounted(async () => {
  if (chartRef.value) {
    const echarts = await loadEcharts()
    chart = echarts.init(chartRef.value)
    await updateChart()
  }
  loadStats()
  loadSubscriptions()
  loadHistory()

  cleanup.addInterval(() => {
    loadStats()
    loadSubscriptions()
  }, 5000)
})
</script>

<style scoped>
.event-bus-page {
  padding: var(--spacing-lg);
}

.metric-card {
  text-align: center;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.metric-label {
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-top: 8px;
}

.section-row {
  margin-top: 20px;
}

.section-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  height: 250px;
}

.code-block {
  background: var(--color-gray-f5f7fa);
  padding: var(--grid-gap);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  overflow-x: auto;
  max-height: 200px;
}

.error-list {
  max-height: 200px;
  overflow-y: auto;
}

.error-item {
  margin-bottom: 10px;
}
</style>
