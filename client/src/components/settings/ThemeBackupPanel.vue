<template>
  <div class="theme-backup-panel">
    <div class="panel-header">
      <h3>{{ t('themeBackup.title') }}</h3>
      <div class="header-actions">
        <el-button size="small" @click="createManualBackup" :loading="isCreating">
          {{ t('themeBackup.createBackup') }}
        </el-button>
        <el-button size="small" @click="showImportDialog = true">
          {{ t('themeBackup.import') }}
        </el-button>
      </div>
    </div>

    <div class="backup-config">
      <div class="config-item">
        <span class="config-label">{{ t('themeBackup.autoBackup') }}</span>
        <el-switch v-model="config.enabled" @change="updateConfig" />
      </div>
      <div class="config-item" v-if="config.enabled">
        <span class="config-label">{{ t('themeBackup.interval') }}</span>
        <el-select v-model="config.interval" size="small" @change="updateConfig">
          <el-option :label="t('themeBackup.intervals.hourly')" :value="3600000" />
          <el-option :label="t('themeBackup.intervals.daily')" :value="86400000" />
          <el-option :label="t('themeBackup.intervals.weekly')" :value="604800000" />
        </el-select>
      </div>
      <div class="config-item">
        <span class="config-label">{{ t('themeBackup.maxBackups') }}</span>
        <el-input-number v-model="config.maxBackups" :min="1" :max="50" size="small" @change="updateConfig" />
      </div>
    </div>

    <div class="backup-stats" v-if="backups.length > 0">
      <span>{{ t('themeBackup.totalBackups') }}: {{ backups.length }}</span>
      <span>{{ t('themeBackup.storageSize') }}: {{ formatSize(storageSize) }}</span>
    </div>

    <div class="backup-list" v-if="backups.length > 0">
      <div class="backup-item" v-for="backup in backups" :key="backup.id">
        <div class="backup-info">
          <span class="backup-name">{{ backup.name }}</span>
          <span class="backup-time">{{ formatTime(backup.timestamp) }}</span>
          <el-tag v-if="backup.auto" size="small" type="info">{{ t('themeBackup.auto') }}</el-tag>
        </div>
        <div class="backup-actions">
          <el-button size="small" @click="restoreBackup(backup.id)" :loading="restoringId === backup.id">
            {{ t('themeBackup.restore') }}
          </el-button>
          <el-button size="small" @click="exportBackup(backup.id)">
            {{ t('themeBackup.export') }}
          </el-button>
          <el-button size="small" type="danger" @click="confirmDelete(backup.id)">
            {{ t('themeBackup.delete') }}
          </el-button>
        </div>
      </div>
    </div>

    <el-empty v-else :description="t('themeBackup.noBackups')" />

    <el-dialog v-model="showImportDialog" :title="t('themeBackup.import')" width="500px">
      <el-input
        v-model="importJson"
        type="textarea"
        :rows="10"
        :placeholder="t('themeBackup.importPlaceholder')"
      />
      <template #footer>
        <el-button @click="showImportDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="importBackup" :disabled="!importJson">
          {{ t('themeBackup.import') }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDeleteDialog" :title="t('themeBackup.confirmDelete')" width="400px">
      <p>{{ t('themeBackup.deleteWarning') }}</p>
      <template #footer>
        <el-button @click="showDeleteDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="danger" @click="deleteBackup">
          {{ t('themeBackup.delete') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { themeBackupManager, type ThemeBackup, type ThemeBackupConfig } from '@/utils/themeBackup'

const { t } = useI18n()

const backups = ref<ThemeBackup[]>([])
const config = reactive<ThemeBackupConfig>({
  enabled: true,
  interval: 86400000,
  maxBackups: 10,
  includePresets: true,
  includeSchedules: true,
  includeShortcuts: true,
  includeTransition: true
})

const storageSize = ref(0)
const isCreating = ref(false)
const restoringId = ref<string | null>(null)
const showImportDialog = ref(false)
const showDeleteDialog = ref(false)
const deleteTargetId = ref<string | null>(null)
const importJson = ref('')

let unsubscribe: (() => void) | null = null

onMounted(() => {
  loadBackups()
  loadConfig()
  unsubscribe = themeBackupManager.onChange(() => {
    loadBackups()
  })
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

function loadBackups(): void {
  backups.value = themeBackupManager.getBackups()
  storageSize.value = themeBackupManager.getStorageSize()
}

function loadConfig(): void {
  const savedConfig = themeBackupManager.getConfig()
  Object.assign(config, savedConfig)
}

function updateConfig(): void {
  themeBackupManager.setConfig(config)
}

async function createManualBackup(): Promise<void> {
  isCreating.value = true
  try {
    themeBackupManager.createBackup(t('themeBackup.manualBackup'), false)
    ElMessage.success(t('themeBackup.backupCreated'))
    loadBackups()
  } finally {
    isCreating.value = false
  }
}

async function restoreBackup(backupId: string): Promise<void> {
  restoringId.value = backupId
  try {
    const success = themeBackupManager.restoreBackup(backupId)
    if (success) {
      ElMessage.success(t('themeBackup.backupRestored'))
      window.location.reload()
    } else {
      ElMessage.error(t('themeBackup.restoreFailed'))
    }
  } finally {
    restoringId.value = null
  }
}

function exportBackup(backupId: string): void {
  const json = themeBackupManager.exportBackup(backupId)
  if (json) {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `theme-backup-${backupId}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(t('themeBackup.exportSuccess'))
  }
}

function importBackup(): void {
  const backup = themeBackupManager.importBackup(importJson.value)
  if (backup) {
    ElMessage.success(t('themeBackup.importSuccess'))
    showImportDialog.value = false
    importJson.value = ''
    loadBackups()
  } else {
    ElMessage.error(t('themeBackup.importFailed'))
  }
}

function confirmDelete(backupId: string): void {
  deleteTargetId.value = backupId
  showDeleteDialog.value = true
}

function deleteBackup(): void {
  if (deleteTargetId.value) {
    themeBackupManager.deleteBackup(deleteTargetId.value)
    ElMessage.success(t('themeBackup.backupDeleted'))
    showDeleteDialog.value = false
    deleteTargetId.value = null
    loadBackups()
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style lang="scss" scoped>
.theme-backup-panel {
  padding: var(--spacing-md);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);

  h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    color: var(--el-text-color-primary);
  }
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.backup-config {
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;

  &:not(:last-child) {
    border-bottom: var(--unified-border-bottom);
  }
}

.config-label {
  font-size: var(--font-size-sm);
  color: var(--el-text-color-regular);
}

.backup-stats {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--el-text-color-secondary);
}

.backup-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.backup-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.backup-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.backup-time {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.backup-actions {
  display: flex;
  gap: var(--spacing-xs);
}
</style>
