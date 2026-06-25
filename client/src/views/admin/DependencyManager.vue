<template>
  <div class="dependency-page">
    <ElRow :gutter="20">
      <ElCol :span="8">
        <ElCard class="metric-card">
          <div class="metric-value">{{ configuredTours.length }}</div>
          <div class="metric-label">{{ t('dependency.configuredTours') }}</div>
        </ElCard>
      </ElCol>
      <ElCol :span="8">
        <ElCard class="metric-card">
          <div class="metric-value">{{ activeSessions.length }}</div>
          <div class="metric-label">{{ t('dependency.activeSessions') }}</div>
        </ElCard>
      </ElCol>
      <ElCol :span="8">
        <ElCard class="metric-card">
          <div class="metric-value">{{ avgCompletionRate.toFixed(1) }}%</div>
          <div class="metric-label">{{ t('dependency.avgCompletionRate') }}</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElCard class="section-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('dependency.dependencyConfig') }}</span>
          <ElButton type="primary" @click="showCreateDialog">{{ t('adminDependencyManager.newConfig') }}</ElButton>
        </div>
      </template>
      <ElTable :data="configs" stripe>
        <ElTableColumn prop="tourId" :label="t('adminCommon.label.tourId')" width="200" />
        <ElTableColumn :label="t('adminCommon.label.executionMode')" width="120">
          <template #default="{ row }">
            <ElTag>{{ getModeText(row.executionMode) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.stepCount')" width="100">
          <template #default="{ row }">
            {{ row.dependencies.length }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.timeout')" width="100">
          <template #default="{ row }">
            {{ row.timeout }}s
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.retryStrategy')" width="150">
          <template #default="{ row }">
            {{ t('dependency.maxRetriesPrefix') }}{{ row.retryPolicy.maxRetries }}{{ t('dependency.timesSuffix') }}, {{ t('dependency.intervalPrefix') }}{{ row.retryPolicy.retryDelay }}ms
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.actions')" width="200">
          <template #default="{ row }">
            <ElButtonGroup>
              <ElButton size="small" @click="editConfig(row)">{{ t('common.edit') }}</ElButton>
              <ElButton size="small" type="danger" @click="deleteConfig(row.tourId)">{{ t('dependency.delete') }}</ElButton>
            </ElButtonGroup>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElCard class="section-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('dependency.activeSessions') }}</span>
          <ElButton @click="clearCompletedSessions">{{ t('dependency.clearCompleted') }}</ElButton>
        </div>
      </template>
      <ElTable :data="activeSessions" stripe max-height="300">
        <ElTableColumn prop="tourId" :label="t('adminCommon.label.tourId')" width="180" />
        <ElTableColumn prop="userId" :label="t('adminCommon.label.userId')" width="150" />
        <ElTableColumn :label="t('adminCommon.label.progress')" width="150">
          <template #default="{ row }">
            {{ row.completedSteps.length }} / {{ getTotalSteps(row.tourId) }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.status')" width="100">
          <template #default="{ row }">
            <ElTag :type="row.failedSteps.length > 0 ? 'danger' : 'success'">
              {{ row.failedSteps.length > 0 ? t('adminCommon.label.abnormal') : t('adminCommon.label.normal') }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.startTime')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.startTime) }}
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('adminCommon.label.actions')" width="150">
          <template #default="{ row }">
            <ElButton size="small" @click="showSessionDetail(row)">{{ t('adminCommon.label.detail') }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog v-model="createDialogVisible" :title="editingConfig ? t('dependency.editConfig') : t('dependency.newConfig')" width="700px">
      <ElForm :model="configForm" label-width="100px">
        <ElFormItem :label="t('adminCommon.label.tourId')" required>
          <ElInput v-model="configForm.tourId" :disabled="!!editingConfig" :placeholder="t('dependency.enterTourId')" />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.executionMode')">
          <ElSelect v-model="configForm.executionMode" style="width: 100%">
            <ElOption :label="t('adminCommon.label.sequential')" value="sequential" />
            <ElOption :label="t('adminCommon.label.parallel')" value="parallel" />
            <ElOption :label="t('adminCommon.label.conditional')" value="conditional" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.timeout')">
          <ElInputNumber v-model="configForm.timeout" :min="10" :max="3600" />
          <span style="margin-left: 10px">{{ t('dependency.seconds') }}</span>
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.maxRetry')">
          <ElInputNumber v-model="configForm.maxRetries" :min="0" :max="10" />
        </ElFormItem>
        <ElFormItem :label="t('adminCommon.label.retryInterval')">
          <ElInputNumber v-model="configForm.retryDelay" :min="100" :max="10000" :step="100" />
          <span style="margin-left: 10px">{{ t('dependency.milliseconds') }}</span>
        </ElFormItem>

        <ElDivider content-position="left">{{ t('dependency.stepDependencies') }}</ElDivider>
        <div class="dependency-list">
          <div v-for="(dep, index) in configForm.dependencies" :key="index" class="dependency-item">
            <ElRow :gutter="10">
              <ElCol :span="8">
                <ElInput v-model="dep.stepId" :placeholder="t('adminCommon.label.stepId')" />
              </ElCol>
              <ElCol :span="10">
                <ElSelect v-model="dep.dependsOn" multiple :placeholder="t('adminCommon.placeholder.dependsOn')" style="width: 100%">
                  <ElOption
                    v-for="step in getAvailableSteps(dep.stepId)"
                    :key="step"
                    :label="step"
                    :value="step"
                  />
                </ElSelect>
              </ElCol>
              <ElCol :span="4">
                <ElSwitch v-model="dep.required" :active-text="t('dependency.required')" :inactive-text="t('dependency.optional')" />
              </ElCol>
              <ElCol :span="2">
                <ElButton type="danger" size="small" @click="removeDependency(index)">{{ t('common.delete') }}</ElButton>
              </ElCol>
            </ElRow>
          </div>
          <ElButton type="primary" plain @click="addDependency">{{ t('dependency.addStep') }}</ElButton>
        </div>
      </ElForm>
      <template #footer>
        <ElButton @click="createDialogVisible = false">{{ t('common.cancel') }}</ElButton>
        <ElButton type="primary" @click="saveConfig">{{ t('common.save') }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="sessionDialogVisible" :title="t('adminCommon.title.sessionDetail')" width="600px">
      <template v-if="selectedSession">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem :label="t('adminCommon.label.sessionId')">{{ selectedSession.sessionId }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.userId')">{{ selectedSession.userId }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.tourId')">{{ selectedSession.tourId }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="t('adminCommon.label.startTime')">{{ formatTime(selectedSession.startTime) }}</ElDescriptionsItem>
        </ElDescriptions>

        <ElDivider content-position="left">{{ t('dependency.executionStatus') }}</ElDivider>
        <ElRow :gutter="20">
          <ElCol :span="8">
            <ElStatistic :title="t('adminCommon.title.completed')" :value="selectedSession.completedSteps.length" />
          </ElCol>
          <ElCol :span="8">
            <ElStatistic :title="t('adminCommon.title.skipped')" :value="selectedSession.skippedSteps.length" />
          </ElCol>
          <ElCol :span="8">
            <ElStatistic :title="t('adminCommon.title.failed')" :value="selectedSession.failedSteps.length" />
          </ElCol>
        </ElRow>

        <ElDivider content-position="left">{{ t('dependency.failedSteps') }}</ElDivider>
        <ElTable :data="selectedSession.failedSteps" max-height="200">
          <ElTableColumn prop="stepId" :label="t('adminCommon.label.stepId')" width="150" />
          <ElTableColumn prop="error" :label="t('adminCommon.label.errorInfo')" />
          <ElTableColumn :label="t('adminCommon.label.retryCount')" width="100">
            <template #default="{ row }">
              {{ row.retryCount }}
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
import { formatDateTime as formatTime } from '@/utils/format'
import { 
  tourDependencyService, 
  type DependencyConfig, 
  type ExecutionContext 
} from '@/services/tourDependencyService'

const configs = ref<DependencyConfig[]>([])
const sessions = ref<ExecutionContext[]>([])
const createDialogVisible = ref(false)
const sessionDialogVisible = ref(false)
const editingConfig = ref<DependencyConfig | null>(null)
const selectedSession = ref<ExecutionContext | null>(null)

const configForm = ref({
  tourId: '',
  executionMode: 'sequential' as 'sequential' | 'parallel' | 'conditional',
  timeout: 300,
  maxRetries: 3,
  retryDelay: 1000,
  dependencies: [] as Array<{ stepId: string; dependsOn: string[]; required: boolean }>
})

const configuredTours = computed(() => configs.value)

const activeSessions = computed(() => sessions.value)

const avgCompletionRate = computed(() => {
  if (sessions.value.length === 0) return 0
  const total = sessions.value.reduce((sum, s) => {
    const config = configs.value.find(c => c.tourId === s.tourId)
    if (config && config.dependencies.length > 0) {
      return sum + (s.completedSteps.length / config.dependencies.length) * 100
    }
    return sum
  }, 0)
  return total / sessions.value.length
})

const loadData = () => {
  configs.value = []
  sessions.value = []
}

const showCreateDialog = () => {
  editingConfig.value = null
  configForm.value = {
    tourId: '',
    executionMode: 'sequential',
    timeout: 300,
    maxRetries: 3,
    retryDelay: 1000,
    dependencies: []
  }
  createDialogVisible.value = true
}

const editConfig = (config: DependencyConfig) => {
  editingConfig.value = config
  configForm.value = {
    tourId: config.tourId,
    executionMode: config.executionMode,
    timeout: config.timeout,
    maxRetries: config.retryPolicy.maxRetries,
    retryDelay: config.retryPolicy.retryDelay,
    dependencies: config.dependencies.map(d => ({
      stepId: d.stepId,
      dependsOn: [...d.dependsOn],
      required: d.required
    }))
  }
  createDialogVisible.value = true
}

const saveConfig = () => {
  if (!configForm.value.tourId) {
    ElMessage.warning(t('adminDependencyManager.enterTourId'))
    return
  }

  if (configForm.value.dependencies.length === 0) {
    ElMessage.warning(t('dependency.addStep'))
    return
  }

  const config: DependencyConfig = {
    tourId: configForm.value.tourId,
    executionMode: configForm.value.executionMode,
    timeout: configForm.value.timeout,
    retryPolicy: {
      maxRetries: configForm.value.maxRetries,
      retryDelay: configForm.value.retryDelay,
      backoffMultiplier: 2,
      retryOn: ['timeout', 'error']
    },
    dependencies: configForm.value.dependencies.map(d => ({
      stepId: d.stepId,
      dependsOn: d.dependsOn,
      required: d.required,
      priority: 0
    })),
    skipConditions: []
  }

  const validation = tourDependencyService.validateDependencies(config)
  if (!validation.valid) {
    ElMessage.error(validation.errors.map(e => e.message).join(', '))
    return
  }

  tourDependencyService.configureDependency(config)
  ElMessage.success(t('dependency.saveSuccess'))
  createDialogVisible.value = false
  loadData()
}

const deleteConfig = (_tourId: string) => {
  ElMessageBox.confirm(t('adminDependencyManager.confirmDeleteConfig'), t('dependency.confirmDeleteAction'), {
    type: 'warning'
  }).then(() => {
    ElMessage.success(t('dependency.deleteSuccess'))
    loadData()
  }).catch(() => {})
}

const addDependency = () => {
  configForm.value.dependencies.push({
    stepId: '',
    dependsOn: [],
    required: true
  })
}

const removeDependency = (index: number) => {
  configForm.value.dependencies.splice(index, 1)
}

const getAvailableSteps = (currentStepId: string) => {
  return configForm.value.dependencies
    .filter(d => d.stepId && d.stepId !== currentStepId)
    .map(d => d.stepId)
}

const getTotalSteps = (tourId: string) => {
  const config = configs.value.find(c => c.tourId === tourId)
  return config?.dependencies.length || 0
}

const showSessionDetail = (session: ExecutionContext) => {
  selectedSession.value = session
  sessionDialogVisible.value = true
}

const clearCompletedSessions = () => {
  ElMessage.success(t('dependency.cleared'))
  loadData()
}

const getModeText = (mode: string) => {
  const texts: Record<string, string> = {
    sequential: t('dependency.modeSequential'),
    parallel: t('dependency.modeParallel'),
    conditional: t('dependency.modeConditional')
  }
  return texts[mode] || mode
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.dependency-page {
  padding: 20px;
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

.section-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dependency-list {
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 15px;
}

.dependency-item {
  margin-bottom: 10px;
}
</style>
