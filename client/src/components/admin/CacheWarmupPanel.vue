<template>
  <div class="cache-warmup-panel">
    <div class="panel-header">
      <h3>{{ t('cacheDashboard.cacheWarmup') }}</h3>
      <div class="header-actions">
        <el-button size="small" type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          {{ t('cacheDashboard.newWarmupTask') }}
        </el-button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalTasks }}</div>
        <div class="stat-label">{{ t('cacheDashboard.totalTasks') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value success">{{ stats.completedTasks }}</div>
        <div class="stat-label">{{ t('cacheDashboard.completedTasks') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value danger">{{ stats.failedTasks }}</div>
        <div class="stat-label">{{ t('cacheDashboard.failedTasks') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalKeysLoaded }}</div>
        <div class="stat-label">{{ t('cacheDashboard.keysLoaded') }}</div>
      </div>
    </div>

    <div v-if="runningTask" class="running-task">
      <div class="task-info">
        <span class="task-name">{{ runningTask.name }}</span>
        <el-tag type="warning" size="small">{{ t('cacheDashboard.running') }}</el-tag>
      </div>
      <el-progress :percentage="runningTask.progress" :stroke-width="8" />
      <div class="task-progress">
        {{ runningTask.loadedKeys }} / {{ runningTask.totalKeys }} {{ t('cacheDashboard.keys') }}
      </div>
      <el-button size="small" type="danger" @click="cancelTask(runningTask.id)">
        {{ t('common.cancel') }}
      </el-button>
    </div>

    <div class="configs-section">
      <h4>{{ t('cacheDashboard.warmupConfigs') }}</h4>
      <div v-if="configs.length === 0" class="empty-state">
        <el-empty :description="t('cacheDashboard.noWarmupConfigs')" :image-size="60" />
      </div>
      <div v-else class="config-list">
        <div v-for="config in configs" :key="config.id" class="config-item">
          <div class="config-header">
            <div class="config-info">
              <span class="config-name">{{ config.name }}</span>
              <el-tag :type="config.priority === 'high' ? 'danger' : config.priority === 'normal' ? '' : 'info'" size="small">
                {{ config.priority }}
              </el-tag>
              <el-tag v-if="config.schedule.enabled" type="success" size="small">
                {{ t('cacheDashboard.scheduled') }}
              </el-tag>
            </div>
            <div class="config-actions">
              <el-switch v-model="config.enabled" size="small" @change="toggleConfig(config.id, config.enabled)" />
              <el-button size="small" text @click="runConfig(config.id)" :disabled="!!runningTask">
                <el-icon><VideoPlay /></el-icon>
              </el-button>
              <el-button size="small" text @click="editConfig(config)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button size="small" text type="danger" @click="deleteConfig(config.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="config-details">
            <span>{{ t('cacheDashboard.keyCount') }}: {{ config.keys.length }}</span>
            <span v-if="config.lastRun">{{ t('cacheDashboard.lastRun') }}: {{ formatTime(config.lastRun) }}</span>
            <span v-if="config.nextRun">{{ t('cacheDashboard.nextRun') }}: {{ formatTime(config.nextRun) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="history-section">
      <div class="section-header">
        <h4>{{ t('cacheDashboard.taskHistory') }}</h4>
        <el-button size="small" text @click="clearHistory">{{ t('common.clear') }}</el-button>
      </div>
      <div v-if="tasks.length === 0" class="empty-state">
        <el-empty :description="t('cacheDashboard.noTaskHistory')" :image-size="40" />
      </div>
      <div v-else class="task-list">
        <div v-for="task in tasks" :key="task.id" class="task-item" :class="task.status">
          <div class="task-info">
            <span class="task-name">{{ task.name }}</span>
            <el-tag :type="getTaskStatusType(task.status)" size="small">{{ task.status }}</el-tag>
          </div>
          <div class="task-meta">
            <span>{{ task.loadedKeys }}/{{ task.totalKeys }} {{ t('cacheDashboard.keys') }}</span>
            <span v-if="task.startTime">{{ formatTime(task.startTime) }}</span>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showCreateDialog" :title="editingConfig ? t('cacheDashboard.editWarmupConfig') : t('cacheDashboard.newWarmupTask')" width="600px" destroy-on-close>
      <el-form :model="formData" label-width="100px">
        <el-form-item :label="t('cacheDashboard.taskName')" required>
          <el-input v-model="formData.name" :placeholder="t('cacheDashboard.taskNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('cacheDashboard.description')">
          <el-input v-model="formData.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item :label="t('cacheDashboard.cacheKeys')" required>
          <el-input v-model="keysInput" type="textarea" :rows="4" :placeholder="t('cacheDashboard.keysPlaceholder')" />
          <div class="form-hint">{{ t('cacheDashboard.keysHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('cacheDashboard.priority')">
          <el-select v-model="formData.priority">
            <el-option value="low" :label="t('cacheDashboard.low')" />
            <el-option value="normal" :label="t('cacheDashboard.normal')" />
            <el-option value="high" :label="t('cacheDashboard.high')" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('cacheDashboard.schedule')">
          <el-switch v-model="formData.schedule.enabled" />
        </el-form-item>
        <el-form-item v-if="formData.schedule.enabled" :label="t('cacheDashboard.scheduleType')">
          <el-radio-group v-model="formData.schedule.type">
            <el-radio value="interval">{{ t('cacheDashboard.interval') }}</el-radio>
            <el-radio value="cron">Cron</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="formData.schedule.enabled && formData.schedule.type === 'interval'" :label="t('cacheDashboard.interval')">
          <el-input-number v-model="formData.schedule.interval" :min="1" />
          <span class="unit">{{ t('cacheDashboard.minutes') }}</span>
        </el-form-item>
        <el-form-item v-if="formData.schedule.enabled && formData.schedule.type === 'cron'" :label="'Cron'">
          <el-input v-model="formData.schedule.cron" placeholder="0 0 * * *" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialog">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveConfig">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, VideoPlay, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { cacheWarmupService, type WarmupConfig, type WarmupTask, type WarmupStats } from '@/services/CacheWarmupService'

const { t } = useI18n()

const configs = ref<WarmupConfig[]>([])
const tasks = ref<WarmupTask[]>([])
const runningTask = ref<WarmupTask | null>(null)
const stats = ref<WarmupStats>({
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  totalKeysLoaded: 0,
  avgLoadTime: 0,
  lastRunTime: null
})

const showCreateDialog = ref(false)
const editingConfig = ref<WarmupConfig | null>(null)
const keysInput = ref('')

const formData = reactive({
  name: '',
  description: '',
  keys: [] as string[],
  patterns: [] as string[],
  priority: 'normal' as 'low' | 'normal' | 'high',
  schedule: {
    enabled: false,
    type: 'interval' as 'interval' | 'cron',
    interval: 60,
    cron: ''
  }
})

const getTaskStatusType = (status: string): string => {
  const types: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return types[status] || 'info'
}

const loadData = () => {
  configs.value = cacheWarmupService.getConfigs()
  tasks.value = cacheWarmupService.getTasks()
  runningTask.value = cacheWarmupService.getRunningTask()
  stats.value = cacheWarmupService.getStats()
}

const toggleConfig = async (id: string, enabled: boolean) => {
  await cacheWarmupService.updateConfig(id, { enabled })
  loadData()
}

const runConfig = async (id: string) => {
  try {
    await cacheWarmupService.runWarmup(id)
    ElMessage.success(t('cacheDashboard.warmupStarted'))
    loadData()
  } catch (error) {
    ElMessage.error(String(error))
  }
}

const cancelTask = (taskId: string) => {
  cacheWarmupService.cancelWarmup(taskId)
  loadData()
}

const editConfig = (config: WarmupConfig) => {
  editingConfig.value = config
  formData.name = config.name
  formData.description = config.description
  formData.keys = [...config.keys]
  formData.patterns = [...config.patterns]
  formData.priority = config.priority
  formData.schedule = {
    enabled: config.schedule.enabled,
    type: config.schedule.type,
    interval: config.schedule.interval ?? 60,
    cron: config.schedule.cron ?? ''
  }
  keysInput.value = config.keys.join('\n')
  showCreateDialog.value = true
}

const deleteConfig = async (id: string) => {
  await cacheWarmupService.deleteConfig(id)
  loadData()
  ElMessage.success(t('cacheDashboard.configDeleted'))
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingConfig.value = null
  keysInput.value = ''
  formData.name = ''
  formData.description = ''
  formData.keys = []
  formData.patterns = []
  formData.priority = 'normal'
  formData.schedule = { enabled: false, type: 'interval', interval: 60, cron: '' }
}

const saveConfig = async () => {
  if (!formData.name) {
    ElMessage.warning(t('cacheDashboard.fillRequired'))
    return
  }

  formData.keys = keysInput.value.split('\n').map(k => k.trim()).filter(Boolean)

  if (formData.keys.length === 0) {
    ElMessage.warning(t('cacheDashboard.addKeys'))
    return
  }

  if (editingConfig.value) {
    await cacheWarmupService.updateConfig(editingConfig.value.id, {
      name: formData.name,
      description: formData.description,
      keys: formData.keys,
      patterns: formData.patterns,
      priority: formData.priority,
      schedule: formData.schedule
    })
    ElMessage.success(t('cacheDashboard.configUpdated'))
  } else {
    await cacheWarmupService.createConfig({
      name: formData.name,
      description: formData.description,
      keys: formData.keys,
      patterns: formData.patterns,
      priority: formData.priority,
      enabled: true,
      schedule: formData.schedule
    })
    ElMessage.success(t('cacheDashboard.configCreated'))
  }

  closeDialog()
  loadData()
}

const clearHistory = () => {
  cacheWarmupService.clearHistory()
  loadData()
}

let unsubscribe: (() => void) | null = null

onMounted(() => {
  loadData()
  unsubscribe = cacheWarmupService.subscribe(() => {
    loadData()
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.cache-warmup-panel {
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-value.success {
  color: var(--el-color-success);
}

.stat-value.danger {
  color: var(--el-color-danger);
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.running-task {
  background: var(--el-color-warning-light-9);
  border-radius: var(--global-border-radius);
  padding: 16px;
  margin-bottom: 20px;
}

.running-task .task-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.running-task .task-name {
  font-weight: 500;
}

.running-task .task-progress {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 8px 0 12px;
}

.configs-section h4,
.history-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  margin: 0;
}

.empty-state {
  padding: 20px;
  text-align: center;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-item {
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  padding: 12px;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-name {
  font-weight: 500;
}

.config-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-details {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-list {
  max-height: 200px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;
}

.task-item.completed {
  border-left: 3px solid var(--el-color-success);
}

.task-item.failed {
  border-left: 3px solid var(--el-color-danger);
}

.task-item.running {
  border-left: 3px solid var(--el-color-warning);
}

.task-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-name {
  font-size: 13px;
}

.task-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.form-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}

.unit {
  margin-left: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
