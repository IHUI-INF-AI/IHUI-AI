<template>
  <div class="sync-settings-panel">
    <div class="settings-section">
      <h4>{{ t('themeSync.settings.encryption.title') }}</h4>
      <div class="encryption-status">
        <el-tag :type="encryptionEnabled ? 'success' : 'info'" size="small">
          {{ encryptionEnabled ? t('themeSync.settings.encryption.enabled') : t('themeSync.settings.encryption.disabled') }}
        </el-tag>
      </div>
      
      <div v-if="!encryptionEnabled" class="encryption-setup">
        <el-input
          v-model="encryptionPassword"
          type="password"
          :placeholder="t('themeSync.settings.encryption.setPassword')"
          show-password
        />
        <el-button type="primary" @click="setupEncryption" :disabled="!encryptionPassword">
          {{ t('themeSync.settings.encryption.enable') }}
        </el-button>
      </div>
      
      <div v-else class="encryption-actions">
        <el-button size="small" @click="disableEncryption">
          {{ t('themeSync.settings.encryption.disable') }}
        </el-button>
      </div>
    </div>

    <div class="settings-section">
      <h4>{{ t('themeSync.settings.devices.title') }}</h4>
      <div class="device-stats">
        <span>{{ t('themeSync.settings.devices.total') }}: {{ deviceStats.total }}</span>
        <span>{{ t('themeSync.settings.devices.active') }}: {{ deviceStats.active }}</span>
      </div>
      
      <div class="device-list">
        <div 
          v-for="device in devices" 
          :key="device.id"
          class="device-item"
          :class="{ current: device.isCurrentDevice }"
        >
          <div class="device-icon">
            <el-icon v-if="device.type === 'desktop'"><Monitor /></el-icon>
            <el-icon v-else-if="device.type === 'mobile'"><Iphone /></el-icon>
            <el-icon v-else-if="device.type === 'tablet'"><Grid /></el-icon>
            <el-icon v-else><QuestionFilled /></el-icon>
          </div>
          <div class="device-info">
            <span class="device-name">{{ device.name }}</span>
            <span class="device-time">{{ formatTime(device.lastSyncedAt) }}</span>
          </div>
          <el-tag v-if="device.isCurrentDevice" type="success" size="small">
            {{ t('themeSync.settings.devices.current') }}
          </el-tag>
          <el-button 
            v-else
            size="small" 
            text 
            type="danger"
            @click="removeDevice(device.id)"
          >
            {{ t('themeSync.settings.devices.remove') }}
          </el-button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h4>{{ t('themeSync.settings.performance.title') }}</h4>
      <div class="performance-stats">
        <div class="stat-card">
          <span class="stat-value">{{ performanceStats.totalOperations }}</span>
          <span class="stat-label">{{ t('themeSync.settings.performance.operations') }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ performanceStats.successRate.toFixed(1) }}%</span>
          <span class="stat-label">{{ t('themeSync.settings.performance.successRate') }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ formatDuration(performanceStats.averageDuration) }}</span>
          <span class="stat-label">{{ t('themeSync.settings.performance.avgDuration') }}</span>
        </div>
      </div>
      
      <div class="performance-actions">
        <el-button size="small" @click="showPerformanceReport">
          {{ t('themeSync.settings.performance.viewReport') }}
        </el-button>
        <el-button size="small" @click="exportPerformanceData">
          {{ t('themeSync.settings.performance.export') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, Iphone, Grid, QuestionFilled } from '@element-plus/icons-vue'
import { syncEncryptionService } from '@/utils/syncEncryption'
import { syncPerformanceMonitor, type SyncPerformanceStats } from '@/utils/syncPerformanceMonitor'
import { deviceSyncManager, type SyncDevice } from '@/utils/deviceSyncManager'

const { t } = useI18n()

const encryptionEnabled = ref(false)
const encryptionPassword = ref('')
const devices = ref<SyncDevice[]>([])
const performanceStats = ref<SyncPerformanceStats>({
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  averageDuration: 0,
  minDuration: 0,
  maxDuration: 0,
  averageDataSize: 0,
  totalDataTransferred: 0,
  successRate: 0
})

const deviceStats = computed(() => deviceSyncManager.getDeviceStats())

onMounted(() => {
  loadSettings()
})

function loadSettings(): void {
  encryptionEnabled.value = syncEncryptionService.hasKey()
  devices.value = deviceSyncManager.getDevices()
  performanceStats.value = syncPerformanceMonitor.getStats()
}

async function setupEncryption(): Promise<void> {
  if (!encryptionPassword.value) return
  
  try {
    await syncEncryptionService.setKey(encryptionPassword.value)
    localStorage.setItem('sync-encryption-key', encryptionPassword.value)
    encryptionEnabled.value = true
    encryptionPassword.value = ''
    ElMessage.success(t('themeSync.settings.encryption.setupSuccess'))
  } catch {
    ElMessage.error(t('themeSync.settings.encryption.setupFailed'))
  }
}

async function disableEncryption(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('themeSync.settings.encryption.disableConfirm'),
      t('themeSync.settings.encryption.disable'),
      { type: 'warning' }
    )
    
    syncEncryptionService.clearKey()
    localStorage.removeItem('sync-encryption-key')
    encryptionEnabled.value = false
    ElMessage.success(t('themeSync.settings.encryption.disabledSuccess'))
  } catch {
    // User cancelled
  }
}

async function removeDevice(deviceId: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('themeSync.settings.devices.removeConfirm'),
      t('themeSync.settings.devices.remove'),
      { type: 'warning' }
    )
    
    if (deviceSyncManager.removeDevice(deviceId)) {
      devices.value = deviceSyncManager.getDevices()
      ElMessage.success(t('themeSync.settings.devices.removeSuccess'))
    }
  } catch {
    // User cancelled
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp

  if (diff < 60000) {
    return t('themeSync.timeJustNow')
  }
  if (diff < 3600000) {
    return t('themeSync.timeMinutesAgo', { count: Math.floor(diff / 60000) })
  }
  if (diff < 86400000) {
    return t('themeSync.timeHoursAgo', { count: Math.floor(diff / 3600000) })
  }
  
  return date.toLocaleDateString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

function showPerformanceReport(): void {
  const report = syncPerformanceMonitor.generateReport()
  ElMessageBox.alert(report, t('themeSync.settings.performance.reportTitle'), {
    confirmButtonText: t('common.close'),
    customClass: 'performance-report-dialog'
  })
}

function exportPerformanceData(): void {
  const data = syncPerformanceMonitor.exportMetrics()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sync-performance.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  ElMessage.success(t('themeSync.settings.performance.exportSuccess'))
}
</script>

<style lang="scss" scoped>
.sync-settings-panel {
  padding: var(--spacing-md);
}

.settings-section {
  margin-bottom: var(--spacing-lg);
  
  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.encryption-status {
  margin-bottom: var(--spacing-sm);
}

.encryption-setup {
  display: flex;
  gap: var(--spacing-sm);
  
  .el-input {
    flex: 1;
  }
}

.encryption-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.device-stats {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.device-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius-sm);
  
  &.current {
    background: var(--el-color-primary-light-9);
  }
}

.device-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
}

.device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.device-time {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.performance-stats {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius-sm);
}

.stat-value {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.performance-actions {
  display: flex;
  gap: var(--spacing-sm);
}
</style>
