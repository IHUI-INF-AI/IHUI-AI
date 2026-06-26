<template>
  <div class="sync-history-panel">
    <div class="history-header">
      <h4>{{ t('themeSync.history.title') }}</h4>
      <div class="header-actions">
        <el-dropdown v-if="records.length > 0" trigger="click">
          <el-button size="small" text>
            {{ t('themeSync.history.export') }}
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="exportAsJSON">JSON</el-dropdown-item>
              <el-dropdown-item @click="exportAsCSV">CSV</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" text @click="clearHistory" :disabled="records.length === 0">
          {{ t('themeSync.history.clear') }}
        </el-button>
      </div>
    </div>

    <div class="history-stats" v-if="records.length > 0">
      <div class="stat-item">
        <span class="stat-value">{{ statsData.success }}</span>
        <span class="stat-label">{{ t('themeSync.history.success') }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ statsData.failed }}</span>
        <span class="stat-label">{{ t('themeSync.history.failed') }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ formatDuration(statsData.averageDuration) }}</span>
        <span class="stat-label">{{ t('themeSync.history.avgDuration') }}</span>
      </div>
    </div>

    <div class="history-list" v-if="records.length > 0">
      <TransitionGroup name="list">
        <div 
          v-for="record in displayedRecords" 
          :key="record.id"
          class="history-item"
          :class="`status-${record.status}`"
        >
          <div class="item-icon">
            <el-icon v-if="record.status === 'success'" class="success"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="record.status === 'failed'" class="failed"><CircleCloseFilled /></el-icon>
            <el-icon v-else class="cancelled"><RemoveFilled /></el-icon>
          </div>
          <div class="item-content">
            <div class="item-header">
              <span class="item-action">{{ getActionText(record.action) }}</span>
              <span class="item-time">{{ formatTime(record.timestamp) }}</span>
            </div>
            <div class="item-details">
              <span class="detail-item">
                <el-icon><Timer /></el-icon>
                {{ formatDuration(record.duration) }}
              </span>
              <span class="detail-item">
                <el-icon><Monitor /></el-icon>
                {{ record.deviceId.slice(0, 8) }}
              </span>
            </div>
            <div v-if="record.errorMessage" class="item-error">
              {{ record.errorMessage }}
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div v-else class="history-empty">
      <el-icon><Document /></el-icon>
      <span>{{ t('themeSync.history.empty') }}</span>
    </div>

    <div class="history-footer" v-if="records.length > pageSize">
      <el-button 
        v-if="!showAll" 
        size="small" 
        text 
        @click="showAll = true"
      >
        {{ t('themeSync.history.showAll', { count: records.length }) }}
      </el-button>
      <el-button 
        v-else 
        size="small" 
        text 
        @click="showAll = false"
      >
        {{ t('themeSync.history.showLess') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  CircleCheckFilled, 
  CircleCloseFilled, 
  RemoveFilled,
  Timer,
  Monitor,
  Document
} from '@element-plus/icons-vue'
import { themeSyncHistoryService, type SyncHistoryRecord } from '@/utils/themeSyncHistory'
import { ElMessageBox, ElMessage } from 'element-plus'

const { t } = useI18n()

const records = ref<SyncHistoryRecord[]>([])
const showAll = ref(false)
const pageSize = 5
const statsData = ref({
  total: 0,
  success: 0,
  failed: 0,
  cancelled: 0,
  averageDuration: 0
})

const displayedRecords = computed(() => {
  if (showAll.value) {
    return records.value
  }
  return records.value.slice(0, pageSize)
})

onMounted(async () => {
  try { await loadRecords() } catch (e) { console.error(e) }
})

async function loadRecords(): Promise<void> {
  records.value = await themeSyncHistoryService.getRecords()
  statsData.value = await themeSyncHistoryService.getStats()
}

function getActionText(action: SyncHistoryRecord['action']): string {
  const actions = {
    upload: t('themeSync.history.actionUpload'),
    download: t('themeSync.history.actionDownload'),
    conflict_resolved: t('themeSync.history.actionConflict')
  }
  return actions[action]
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
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

async function clearHistory(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('themeSync.history.clearConfirm'),
      t('themeSync.history.clear'),
      { type: 'warning' }
    )
    await themeSyncHistoryService.clearHistory()
    await loadRecords()
  } catch {
    // User cancelled
  }
}

async function exportAsJSON(): Promise<void> {
  try {
    const json = await themeSyncHistoryService.exportHistory()
    downloadFile(json, 'sync-history.json', 'application/json')
    ElMessage.success(t('themeSync.history.exportSuccess'))
  } catch {
    ElMessage.error(t('themeSync.history.exportFailed'))
  }
}

async function exportAsCSV(): Promise<void> {
  try {
    const csv = await themeSyncHistoryService.exportAsCSV()
    downloadFile(csv, 'sync-history.csv', 'text/csv')
    ElMessage.success(t('themeSync.history.exportSuccess'))
  } catch {
    ElMessage.error(t('themeSync.history.exportFailed'))
  }
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<style lang="scss" scoped>
.sync-history-panel {
  padding: var(--spacing-md);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);

  h4 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.history-stats {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  margin-bottom: var(--spacing-md);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
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

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.history-item {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius-sm);
  border-left: 3px solid transparent;

  &.status-success {
    border-left-color: var(--el-color-success);
  }

  &.status-failed {
    border-left-color: var(--el-color-danger);
  }

  &.status-cancelled {
    border-left-color: var(--el-color-warning);
  }
}

.item-icon {
  font-size: 18px;
  display: flex;
  align-items: center;

  .success {
    color: var(--el-color-success);
  }

  .failed {
    color: var(--el-color-danger);
  }

  .cancelled {
    color: var(--el-color-warning);
  }
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.item-action {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.item-time {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.item-details {
  display: flex;
  gap: var(--spacing-md);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.item-error {
  margin-top: var(--spacing-xs);
  padding: var(--spacing-xs);
  background: var(--el-color-danger-light-9);
  border-radius: var(--global-border-radius-sm);
  font-size: var(--font-size-xs);
  color: var(--el-color-danger);
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  color: var(--el-text-color-placeholder);

  .el-icon {
    font-size: 32px;
  }

  span {
    font-size: var(--font-size-sm);
  }
}

.history-footer {
  display: flex;
  justify-content: center;
  margin-top: var(--spacing-sm);
}

.list-enter-active,
.list-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
