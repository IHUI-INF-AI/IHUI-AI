<template>
  <div class="gray-release-page">
    <ElRow :gutter="20">
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ activeReleases.length }}</div>
          <div class="metric-label">{{ t('grayRelease.ongoing') }}</div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ completedReleases.length }}</div>
          <div class="metric-label">{{ t('grayRelease.completed') }}</div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ totalExposedUsers }}</div>
          <div class="metric-label">{{ t('grayRelease.exposed') }}</div>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard class="metric-card">
          <div class="metric-value">{{ avgCompletionRate.toFixed(1) }}%</div>
          <div class="metric-label">{{ t('grayRelease.avgCompletion') }}</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElCard class="section-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('grayRelease.releaseList') }}</span>
          <ElButton type="primary" @click="showCreateDialog">{{ t('adminGrayRelease.createRelease') }}</ElButton>
        </div>
      </template>
      <ElTable :data="releases" stripe>
        <ElTableColumn prop="config.tourId" :label="t('adminCommon.label.tourId')" width="180" />
        <ElTableColumn prop="config.tourVersion" :label="t('adminCommon.label.version')" width="100" />
        <ElTableColumn :label="t('adminCommon.label.progress')" width="200">
          <template #default="{ row }">
            <ElProgress 
              :percentage="row.status.currentPercentage" 
              :status="getProgressStatus(row.status.status)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.status')" width="100">
          <template #default="{ row }">
            <ElTag :type="getStatusType(row.status.status)">
              {{ getStatusText(row.status.status) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.exposureCompletion')" width="120">
          <template #default="{ row }">
            {{ row.status.metrics.exposedUsers }} / {{ row.status.metrics.completedUsers }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.errorRate')" width="100">
          <template #default="{ row }">
            <span :class="{ 'error-high': getErrorRate(row) > 5 }">
              {{ getErrorRate(row).toFixed(2) }}%
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.actions')" width="280">
          <template #default="{ row }">
            <ElButtonGroup>
              <ElButton 
                v-if="row.status.status === 'pending'" 
                size="small" 
                type="success"
                @click="startRelease(row.id)"
              >{{ t('grayRelease.start') }}</ElButton>
              <ElButton 
                v-if="row.status.status === 'running'" 
                size="small"
                @click="pauseRelease(row.id)"
              >{{ t('grayRelease.pause') }}</ElButton>
              <ElButton 
                v-if="row.status.status === 'paused'" 
                size="small" 
                type="primary"
                @click="resumeRelease(row.id)"
              >{{ t('grayRelease.resume') }}</ElButton>
              <ElButton 
                v-if="row.status.status === 'running'" 
                size="small" 
                type="success"
                @click="promoteRelease(row.id)"
              >{{ t('grayRelease.promote') }}</ElButton>
              <ElButton 
                v-if="['running', 'paused'].includes(row.status.status)" 
                size="small" 
                type="danger"
                @click="rollbackRelease(row.id)"
              >{{ t('grayRelease.rollback') }}</ElButton>
              <ElButton 
                size="small"
                @click="showDetailDialog(row)"
              >{{ t('grayRelease.detail') }}</ElButton>
            </ElButtonGroup>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog v-model="createDialogVisible" :title="t('adminCommon.title.createGrayRelease')" width="600px">
      <ElForm :model="createForm" label-width="100px">
        <ElFormItem :label="t('adminCommon.label.tourId')" required>
          <ElInput v-model="createForm.tourId" :placeholder="t('grayRelease.enterGuidId')" />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.versionNumber')" required>
          <ElInput v-model="createForm.tourVersion" :placeholder="t('adminCommon.placeholder.versionNumber')" />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.releaseRatio')" required>
          <ElSlider v-model="createForm.rolloutPercentage" :min="1" :max="100" show-input />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.releaseStrategy')">
          <ElSelect v-model="createForm.strategyType" style="width: 100%">
            <ElOption :label="t('adminCommon.label.byPercentage')" value="percentage" />
            <ElOption :label="t('adminCommon.label.byUserGroup')" value="user_group" />
            <ElOption :label="t('adminCommon.label.byRegion')" value="region" />
            <ElOption :label="t('adminCommon.label.byDevice')" value="device" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.autoPromote')">
          <ElSwitch v-model="createForm.autoPromote" />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.completionThreshold')">
          <ElInputNumber v-model="createForm.completionThreshold" :min="0" :max="100" :step="5" />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.errorThreshold')">
          <ElInputNumber v-model="createForm.errorThreshold" :min="0" :max="100" :step="1" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="createDialogVisible = false">{{ t('common.cancel') }}</ElButton>
        <ElButton type="primary" @click="createRelease">{{ t('common.create') }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="detailDialogVisible" :title="t('adminCommon.title.releaseDetail')" width="800px">
      <template v-if="selectedRelease">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem :label="t('adminCommon.label.tourId')">{{ selectedRelease.config.tourId }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.version')">{{ selectedRelease.config.tourVersion }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.status')">
            <ElTag :type="getStatusType(selectedRelease.status.status)">
              {{ getStatusText(selectedRelease.status.status) }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.currentPhase')">{{ selectedRelease.status.currentPhase }} / {{ selectedRelease.status.totalPhases }}</ElDescriptionsItem>
        </ElDescriptions>

        <ElDivider content-position="left">{{ t('grayRelease.phaseProgress') }}</ElDivider>
        <ElSteps :active="selectedRelease.status.currentPhase" finish-status="success">
          <ElStep 
            v-for="phase in selectedRelease.status.phases" 
            :key="phase.phase"
            :title="`${phase.percentage}%`"
            :status="getPhaseStatus(phase.status)"
          />
        </ElSteps>

        <ElDivider content-position="left">{{ t('grayRelease.metrics') }}</ElDivider>
        <ElRow :gutter="20">
          <ElCol :span="6">
            <ElStatistic :title="t('adminCommon.title.exposedUsers')" :value="selectedRelease.status.metrics.exposedUsers" />
          </ElCol>
          <ElCol :span="6">
            <ElStatistic :title="t('adminCommon.title.completedUsers')" :value="selectedRelease.status.metrics.completedUsers" />
          </ElCol>
          <ElCol :span="6">
            <ElStatistic :title="t('adminCommon.title.errorCount')" :value="selectedRelease.status.metrics.errorCount" />
          </ElCol>
          <ElCol :span="6">
            <ElStatistic :title="t('adminCommon.title.satisfaction')" :value="selectedRelease.status.metrics.satisfactionScore" :suffix="t('adminCommon.label.scoreUnit')" />
          </ElCol>
        </ElRow>

        <ElDivider content-position="left">{{ t('grayRelease.alerts') }}</ElDivider>
        <ElTable :data="selectedRelease.status.alerts" max-height="200">
          <ElTableColumn :label="t('adminCommon.label.type')" width="100">
            <template #default="{ row }">
              <ElTag :type="row.type === 'critical' ? 'danger' : row.type === 'warning' ? 'warning' : 'info'">
                {{ row.type }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="message" :label="t('adminCommon.label.message')" />
          <ElTableColumn :label="t('adminCommon.label.time')" width="180">
            <template #default="{ row }">
              {{ formatTime(row.timestamp) }}
            </template>
          </ElTableColumn>
          <ElTableColumn :label="t('adminCommon.label.status')" width="100">
            <template #default="{ row }">
              <ElTag :type="row.acknowledged ? 'success' : 'warning'">
                {{ row.acknowledged ? t('adminCommon.label.acknowledged') : t('adminCommon.label.unacknowledged') }}
              </ElTag>
            </template>
          </ElTableColumn>
        </ElTable>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tourGrayReleaseService, type GrayReleaseRecord } from '@/services/tourGrayReleaseService'
import { formatDateTime as formatTime } from '@/utils/format'

const releases = ref<GrayReleaseRecord[]>([])
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const selectedRelease = ref<GrayReleaseRecord | null>(null)

const createForm = ref({
  tourId: '',
  tourVersion: '1.0.0',
  rolloutPercentage: 100,
  strategyType: 'percentage' as const,
  autoPromote: true,
  completionThreshold: 70,
  errorThreshold: 5
})

const activeReleases = computed(() => 
  releases.value.filter(r => r.status.status === 'running')
)

const completedReleases = computed(() => 
  releases.value.filter(r => r.status.status === 'completed')
)

const totalExposedUsers = computed(() => 
  releases.value.reduce((sum, r) => sum + r.status.metrics.exposedUsers, 0)
)

const avgCompletionRate = computed(() => {
  const total = releases.value.reduce((sum, r) => {
    if (r.status.metrics.exposedUsers > 0) {
      return sum + (r.status.metrics.completedUsers / r.status.metrics.exposedUsers) * 100
    }
    return sum
  }, 0)
  return releases.value.length > 0 ? total / releases.value.length : 0
})

const loadReleases = () => {
  releases.value = tourGrayReleaseService.getAllReleases()
}

const showCreateDialog = () => {
  createForm.value = {
    tourId: '',
    tourVersion: '1.0.0',
    rolloutPercentage: 100,
    strategyType: 'percentage',
    autoPromote: true,
    completionThreshold: 70,
    errorThreshold: 5
  }
  createDialogVisible.value = true
}

const createRelease = () => {
  if (!createForm.value.tourId) {
    ElMessage.warning(t('grayRelease.enterTourId'))
    return
  }

  try {
    tourGrayReleaseService.createRelease({
      tourId: createForm.value.tourId,
      tourVersion: createForm.value.tourVersion,
      strategy: {
        type: createForm.value.strategyType,
        rules: []
      },
      rolloutPercentage: createForm.value.rolloutPercentage,
      targetGroups: [],
      startDate: Date.now(),
      autoPromote: createForm.value.autoPromote,
      promoteThreshold: {
        completionRate: createForm.value.completionThreshold / 100,
        errorRate: createForm.value.errorThreshold / 100,
        userSatisfaction: 3.5,
        minSampleSize: 100
      },
      monitoring: {
        metrics: ['completionRate', 'errorRate', 'satisfactionScore'],
        alertThresholds: [
          { metric: 'errorRate', operator: 'gt', value: createForm.value.errorThreshold / 100, severity: 'critical' }
        ],
        checkInterval: 60
      }
    })
    ElMessage.success(t('grayRelease.createSuccess'))
    createDialogVisible.value = false
    loadReleases()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

const startRelease = (id: string) => {
  if (tourGrayReleaseService.startRelease(id)) {
    ElMessage.success(t('grayRelease.releaseStarted'))
    loadReleases()
  }
}

const pauseRelease = (id: string) => {
  if (tourGrayReleaseService.pauseRelease(id)) {
    ElMessage.success(t('grayRelease.releasePaused'))
    loadReleases()
  }
}

const resumeRelease = (id: string) => {
  if (tourGrayReleaseService.resumeRelease(id)) {
    ElMessage.success(t('grayRelease.releaseResumed'))
    loadReleases()
  }
}

const promoteRelease = (id: string) => {
  if (tourGrayReleaseService.promoteRelease(id)) {
    ElMessage.success(t('grayRelease.nextPhase'))
    loadReleases()
  } else {
    ElMessage.warning(t('grayRelease.notReachedThreshold'))
  }
}

const rollbackRelease = (id: string) => {
  ElMessageBox.prompt(t('grayRelease.rollbackReason'), t('grayRelease.confirmRollback'), {
    confirmButtonText: t('adminGrayRelease.confirmRollback'),
    cancelButtonText: t('common.cancel'),
    inputPattern: /.+/,
    inputErrorMessage: t('adminGrayRelease.enterRollbackReason')
  }).then((result: { value: string }) => {
    if (tourGrayReleaseService.rollbackRelease(id, result.value)) {
      ElMessage.success(t('grayRelease.releaseRolledBack'))
      loadReleases()
    }
  }).catch(() => {})
}

const showDetailDialog = (record: GrayReleaseRecord) => {
  selectedRelease.value = record
  detailDialogVisible.value = true
}

const getProgressStatus = (status: string) => {
  if (status === 'completed') return 'success'
  if (status === 'rolled_back') return 'exception'
  return undefined
}

const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    pending: 'info',
    running: 'primary',
    paused: 'warning',
    completed: 'success',
    rolled_back: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: t('adminCommon.label.statusPending'),
    running: t('adminCommon.label.statusRunning'),
    paused: t('adminCommon.label.statusPaused'),
    completed: t('adminCommon.label.statusCompleted'),
    rolled_back: t('adminCommon.label.statusRolledBack')
  }
  return texts[status] || status
}

const getPhaseStatus = (status: string) => {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'process'
  return 'wait'
}

const getErrorRate = (record: GrayReleaseRecord) => {
  if (record.status.metrics.exposedUsers === 0) return 0
  return (record.status.metrics.errorCount / record.status.metrics.exposedUsers) * 100
}

onMounted(() => {
  loadReleases()
})
</script>

<style scoped>
.gray-release-page {
  padding: 20px;
}

.metric-card {
  text-align: center;
}

.metric-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--el-color-primary);
}

.metric-label {
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-top: 8px;
}

.section-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-high {
  color: var(--el-color-danger);
  font-weight: bold;
}
</style>
