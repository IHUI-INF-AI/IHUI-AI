<template>
  <div class="theme-sync-indicator">
    <div class="sync-header">
      <div class="sync-status" :class="statusClass">
        <el-icon class="status-icon" :class="{ rotating: isSyncing }">
          <component :is="statusIcon" />
        </el-icon>
        <span class="status-text">{{ statusText }}</span>
      </div>
      <div class="sync-actions">
        <el-button 
          v-if="isSyncing"
          size="small" 
          type="danger"
          @click="handleCancel"
        >
          {{ t('themeSync.cancel') }}
        </el-button>
        <el-button 
          v-else
          size="small" 
          @click="handleSync"
        >
          {{ t('themeSync.syncNow') }}
        </el-button>
      </div>
    </div>

    <Transition name="slide">
      <div v-if="isSyncing" class="sync-progress">
        <el-progress 
          :percentage="syncProgress" 
          :stroke-width="6"
          :show-text="true"
        />
        <span class="progress-text">{{ progressText }}</span>
      </div>
    </Transition>

    <div class="sync-info" v-if="lastSyncTime && !isSyncing">
      <span class="info-label">{{ t('themeSync.lastSync') }}:</span>
      <span class="info-value">{{ formatTime(lastSyncTime) }}</span>
    </div>

    <Transition name="slide">
      <div v-if="offlineQueueCount > 0" class="offline-queue">
        <el-icon><Connection /></el-icon>
        <span>{{ t('themeSync.offlineQueue', { count: offlineQueueCount }) }}</span>
        <el-button size="small" text @click="processOfflineQueue">
          {{ t('themeSync.processQueue') }}
        </el-button>
      </div>
    </Transition>

    <Transition name="slide">
      <div v-if="!isOnline" class="offline-banner">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ t('themeSync.offlineMode') }}</span>
      </div>
    </Transition>

    <div class="sync-settings">
      <div class="setting-item">
        <span class="setting-label">{{ t('themeSync.autoSync') }}</span>
        <el-switch v-model="autoSync" @change="onAutoSyncChange" />
      </div>
      <div class="setting-item" v-if="autoSync">
        <span class="setting-label">{{ t('themeSync.syncInterval') }}</span>
        <el-select v-model="syncInterval" size="small" @change="onIntervalChange">
          <el-option :label="t('themeSync.intervals.hourly')" value="hourly" />
          <el-option :label="t('themeSync.intervals.daily')" value="daily" />
          <el-option :label="t('themeSync.intervals.weekly')" value="weekly" />
        </el-select>
      </div>
      <div class="setting-item">
        <span class="setting-label">
          <el-icon class="label-icon"><Bell /></el-icon>
          {{ t('themeSync.notifications') }}
        </span>
        <el-switch v-model="enableNotifications" @change="onNotificationChange" />
      </div>
    </div>

    <Transition name="fade">
      <div v-if="showError" class="sync-error">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ errorMessage }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  Loading,
  CircleCheckFilled,
  CircleCloseFilled,
  WarningFilled,
  Connection,
  Bell
} from '@element-plus/icons-vue'
import { themeCloudSync, type CloudSyncStatus } from '@/utils/themeCloudSync'
import { themeOfflineSyncService } from '@/utils/themeOfflineSync'
import { notificationService } from '@/utils/notificationService'
import { useDarkModeStore } from '@/stores/darkMode'
import { useAuthStore } from '@/stores/auth'
import { useCleanup } from '@/composables/useCleanup'

type SyncStatus = 'syncing' | 'synced' | 'error' | 'idle'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const authStore = useAuthStore()

const status = ref<SyncStatus>('idle')
const lastSyncTime = ref<Date | null>(null)
const autoSync = ref(true)
const syncInterval = ref('daily')
const errorMessage = ref('')
const showError = ref(false)
const syncProgress = ref(0)
const isCancelled = ref(false)
const isOnline = ref(navigator.onLine)
const offlineQueueCount = ref(0)
const enableNotifications = ref(true)

let syncTimer: ReturnType<typeof setInterval> | null = null
let progressTimer: ReturnType<typeof setInterval> | null = null
let unsubscribe: (() => void) | null = null
// 进度重置定时器引用，用于组件卸载时清理
let progressResetTimer: ReturnType<typeof setTimeout> | null = null

const isSyncing = computed(() => status.value === 'syncing')

const statusClass = computed(() => ({
  'status-syncing': status.value === 'syncing',
  'status-synced': status.value === 'synced',
  'status-error': status.value === 'error',
  'status-idle': status.value === 'idle'
}))

const statusIcon = computed(() => {
  const icons = {
    syncing: Loading,
    synced: CircleCheckFilled,
    error: CircleCloseFilled,
    idle: CircleCheckFilled
  }
  return icons[status.value]
})

const statusText = computed(() => {
  const texts = {
    syncing: t('themeSync.status.syncing'),
    synced: t('themeSync.status.synced'),
    error: t('themeSync.status.error'),
    idle: t('themeSync.status.idle')
  }
  return texts[status.value]
})

const progressText = computed(() => {
  if (syncProgress.value < 30) {
    return t('themeSync.progress.preparing')
  } else if (syncProgress.value < 60) {
    return t('themeSync.progress.uploading')
  } else if (syncProgress.value < 90) {
    return t('themeSync.progress.finalizing')
  }
  return t('themeSync.progress.completing')
})

onMounted(async () => {
  loadSettings()
  loadLastSyncTime()
  subscribeToCloudSync()
  setupNetworkListeners()
  updateOfflineQueueCount()
  try { await notificationService.init() } catch (e) { console.error(e) }
  
  if (autoSync.value) {
    startAutoSync()
  }
})

const cleanup = useCleanup()
cleanup.add(() => {
  stopAutoSync()
  stopProgressTimer()
  removeNetworkListeners()
  if (unsubscribe) {
    unsubscribe()
  }
  if (progressResetTimer) {
    clearTimeout(progressResetTimer)
    progressResetTimer = null
  }
})

function setupNetworkListeners(): void {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

function removeNetworkListeners(): void {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
}

function handleOnline(): void {
  isOnline.value = true
  updateOfflineQueueCount()
}

async function handleOffline(): Promise<void> {
  isOnline.value = false
  if (enableNotifications.value) {
    await notificationService.showOfflineMode()
  }
}

function updateOfflineQueueCount(): void {
  offlineQueueCount.value = themeOfflineSyncService.getQueueLength()
}

function processOfflineQueue(): void {
  if (!isOnline.value) {
    ElMessage.warning(t('themeSync.offlineCannotProcess'))
    return
  }
  themeOfflineSyncService.processQueue()
  updateOfflineQueueCount()
}

function subscribeToCloudSync(): void {
  unsubscribe = themeCloudSync.subscribe((cloudStatus: CloudSyncStatus) => {
    if (cloudStatus.isSyncing) {
      status.value = 'syncing'
    } else if (cloudStatus.error) {
      status.value = 'error'
      errorMessage.value = cloudStatus.error
      showError.value = true
    } else if (cloudStatus.lastSyncedAt) {
      status.value = 'synced'
      lastSyncTime.value = new Date(cloudStatus.lastSyncedAt)
    }
  })
  
  const cloudStatus = themeCloudSync.getStatus()
  if (cloudStatus.lastSyncedAt) {
    lastSyncTime.value = new Date(cloudStatus.lastSyncedAt)
  }
}

function loadSettings(): void {
  const savedAutoSync = localStorage.getItem('theme-sync-auto')
  const savedInterval = localStorage.getItem('theme-sync-interval')
  const savedNotifications = localStorage.getItem('theme-sync-notifications')
  
  if (savedAutoSync !== null) {
    autoSync.value = savedAutoSync === 'true'
  }
  if (savedInterval) {
    syncInterval.value = savedInterval
  }
  if (savedNotifications !== null) {
    enableNotifications.value = savedNotifications === 'true'
  }
}

function loadLastSyncTime(): void {
  const saved = localStorage.getItem('theme-sync-last-time')
  if (saved) {
    lastSyncTime.value = new Date(saved)
  }
}

function saveLastSyncTime(): void {
  localStorage.setItem('theme-sync-last-time', new Date().toISOString())
}

function onAutoSyncChange(value: boolean): void {
  localStorage.setItem('theme-sync-auto', String(value))
  
  if (value) {
    startAutoSync()
  } else {
    stopAutoSync()
  }
}

function onIntervalChange(value: string): void {
  localStorage.setItem('theme-sync-interval', value)
  
  if (autoSync.value) {
    stopAutoSync()
    startAutoSync()
  }
}

function onNotificationChange(value: boolean): void {
  localStorage.setItem('theme-sync-notifications', String(value))
  
  if (value && notificationService.getPermission() !== 'granted') {
    notificationService.requestPermission()
  }
}

function getIntervalMs(): number {
  const intervals = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000
  }
  return intervals[syncInterval.value as keyof typeof intervals] || intervals.daily
}

function startAutoSync(): void {
  stopAutoSync()
  syncTimer = setInterval(() => {
    handleSync()
  }, getIntervalMs())
}

function stopAutoSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

function startProgressTimer(): void {
  stopProgressTimer()
  syncProgress.value = 0
  isCancelled.value = false
  
  progressTimer = setInterval(() => {
    if (isCancelled.value) {
      stopProgressTimer()
      return
    }
    
    if (syncProgress.value < 95) {
      const increment = Math.random() * 10 + 2
      syncProgress.value = Math.min(95, syncProgress.value + increment)
    }
  }, 300)
}

function stopProgressTimer(): void {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

function handleCancel(): void {
  isCancelled.value = true
  stopProgressTimer()
  status.value = 'idle'
  syncProgress.value = 0
  ElMessage.info(t('themeSync.cancelled'))
}

async function handleSync(): Promise<void> {
  if (status.value === 'syncing') return
  
  const userId = authStore.user?.id || ''
  if (!userId) {
    ElMessage.warning(t('themeSync.loginRequired'))
    return
  }
  
  status.value = 'syncing'
  showError.value = false
  startProgressTimer()
  
  try {
    const themeMode = darkModeStore.mode
    const success = await themeCloudSync.syncToCloud(userId, themeMode, [], null)
    
    if (isCancelled.value) return
    
    stopProgressTimer()
    
    if (success) {
      syncProgress.value = 100
      status.value = 'synced'
      lastSyncTime.value = new Date()
      saveLastSyncTime()
      ElMessage.success(t('themeSync.syncSuccess'))
      
      if (enableNotifications.value) {
        await notificationService.showSyncSuccess(themeMode)
      }
      
      progressResetTimer = setTimeout(() => {
        syncProgress.value = 0
      }, 1000)
    } else {
      throw new Error('Sync failed')
    }
  } catch {
    if (isCancelled.value) return
    
    stopProgressTimer()
    status.value = 'error'
    errorMessage.value = t('themeSync.syncFailed')
    showError.value = true
    syncProgress.value = 0
    
    if (enableNotifications.value) {
      await notificationService.showSyncFailed(errorMessage.value)
    }
  }
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) {
    return t('themeSync.timeJustNow')
  }
  
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return t('themeSync.timeMinutesAgo', { count: minutes })
  }
  
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return t('themeSync.timeHoursAgo', { count: hours })
  }
  
  const days = Math.floor(diff / 86400000)
  return t('themeSync.timeDaysAgo', { count: days })
}
</script>

<style lang="scss" scoped>
.theme-sync-indicator {
  padding: var(--spacing-md);
}

.sync-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.sync-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.status-icon {
  font-size: 18px;
  
  &.rotating {
    animation: rotate 1s linear infinite;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-syncing .status-icon {
  color: var(--el-color-primary);
}

.status-synced .status-icon {
  color: var(--el-color-success);
}

.status-error .status-icon {
  color: var(--el-color-danger);
}

.status-idle .status-icon {
  color: var(--el-text-color-placeholder);
}

.status-text {
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.sync-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.sync-progress {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius-sm);
}

.progress-text {
  display: block;
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
  text-align: center;
}

.sync-info {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius-sm);
}

.info-label {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-primary);
}

.sync-settings {
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  padding: var(--spacing-sm);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) 0;

  &:not(:last-child) {
    border-bottom: var(--unified-border-bottom);
    padding-bottom: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }
}

.setting-label {
  font-size: var(--font-size-sm);
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.label-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.sync-error {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--el-color-danger-light-9);
  border-radius: var(--global-border-radius-sm);
  color: var(--el-color-danger);
  font-size: var(--font-size-xs);
}

.offline-queue {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--el-color-info-light-9);
  border-radius: var(--global-border-radius-sm);
  color: var(--el-color-info);
  font-size: var(--font-size-xs);

  .el-button {
    margin-left: auto;
  }
}

.offline-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--el-color-warning-light-9);
  border-radius: var(--global-border-radius-sm);
  color: var(--el-color-warning);
  font-size: var(--font-size-xs);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  
}
</style>
