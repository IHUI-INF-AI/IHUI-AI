<template>
  <div class="theme-settings-panel">
    <div class="panel-header">
      <h2>{{ t('themeSettings.title') }}</h2>
      <el-input
        v-model="searchQuery"
        :placeholder="t('themeSettings.search')"
        prefix-icon="Search"
        clearable
        class="search-input"
      />
    </div>

    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane :label="t('themeSettings.tabs.basic')" name="basic">
        <div class="tab-content">
          <div class="setting-section">
            <h3>{{ t('themeSettings.basic.currentTheme') }}</h3>
            <div class="theme-grid">
              <div
                v-for="mode in themeModes"
                :key="mode.value"
                class="theme-card"
                :class="{ active: currentThemeMode === mode.value }"
                @click="setThemeMode(mode.value)"
              >
                <div class="theme-preview" :class="mode.value">
                  <div class="preview-header"></div>
                  <div class="preview-body">
                    <div class="preview-sidebar"></div>
                    <div class="preview-content"></div>
                  </div>
                </div>
                <span class="theme-name">{{ mode.label }}</span>
                <el-icon v-if="currentThemeMode === mode.value" class="check-icon"><Check /></el-icon>
              </div>
            </div>
          </div>

          <div class="setting-section">
            <h3>{{ t('themeSettings.basic.quickActions') }}</h3>
            <div class="quick-actions">
              <el-button @click="toggleDarkMode">
                <el-icon><Moon /></el-icon>
                {{ t('themeSettings.basic.toggleDark') }}
              </el-button>
              <el-button @click="resetToDefault">
                <el-icon><RefreshRight /></el-icon>
                {{ t('themeSettings.basic.reset') }}
              </el-button>
              <el-button @click="showPreviewDialog = true">
                <el-icon><View /></el-icon>
                {{ t('themeSettings.basic.preview') }}
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('themeSettings.tabs.presets')" name="presets">
        <div class="tab-content">
          <ThemePresetPanel />
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('themeSettings.tabs.schedule')" name="schedule">
        <div class="tab-content">
          <div class="setting-section">
            <div class="section-header">
              <h3>{{ t('themeSettings.schedule.title') }}</h3>
              <el-switch v-model="scheduleEnabled" @change="toggleScheduleEnabled" />
            </div>

            <div class="schedule-list">
              <div
                v-for="schedule in schedules"
                :key="schedule.id"
                class="schedule-item"
              >
                <div class="schedule-info">
                  <span class="schedule-label">{{ schedule.label }}</span>
                  <span class="schedule-time">{{ schedule.time }}</span>
                  <span class="schedule-mode">{{ getModeLabel(schedule.mode) }}</span>
                </div>
                <div class="schedule-actions">
                  <el-switch v-model="schedule.enabled" @change="updateSchedule(schedule)" />
                  <el-button text size="small" @click="editSchedule(schedule)">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <el-button text size="small" type="danger" @click="deleteSchedule(schedule.id)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>

            <el-button type="primary" @click="showAddScheduleDialog = true">
              <el-icon><Plus /></el-icon>
              {{ t('themeSettings.schedule.add') }}
            </el-button>

            <div v-if="nextSchedule" class="next-schedule">
              {{ t('themeSettings.schedule.nextSwitch') }}: {{ nextSchedule.schedule.label }}
              ({{ formatTimeUntil(nextSchedule.timeUntil) }})
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('themeSettings.tabs.sync')" name="sync">
        <div class="tab-content">
          <div class="setting-section">
            <h3>{{ t('themeSettings.sync.title') }}</h3>

            <div class="sync-status">
              <el-icon :class="{ syncing: syncStatus.isSyncing }">
                <Loading v-if="syncStatus.isSyncing" />
                <CircleCheck v-else-if="syncStatus.lastSyncedAt" />
                <Warning v-else />
              </el-icon>
              <span v-if="syncStatus.isSyncing">{{ t('themeSettings.sync.syncing') }}</span>
              <span v-else-if="syncStatus.lastSyncedAt">
                {{ t('themeSettings.sync.lastSynced') }}: {{ formatTime(syncStatus.lastSyncedAt) }}
              </span>
              <span v-else>{{ t('themeSettings.sync.notSynced') }}</span>
            </div>

            <div class="sync-actions">
              <el-button type="primary" @click="syncToCloud" :loading="syncStatus.isSyncing">
                <el-icon><Upload /></el-icon>
                {{ t('themeSettings.sync.upload') }}
              </el-button>
              <el-button @click="syncFromCloud" :loading="syncStatus.isSyncing">
                <el-icon><Download /></el-icon>
                {{ t('themeSettings.sync.download') }}
              </el-button>
            </div>

            <div v-if="syncStatus.error" class="sync-error">
              <el-icon><WarningFilled /></el-icon>
              {{ syncStatus.error }}
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('themeSettings.tabs.advanced')" name="advanced">
        <div class="tab-content">
          <div class="setting-section">
            <h3>{{ t('themeSettings.advanced.importExport') }}</h3>
            <div class="import-export-actions">
              <el-select v-model="exportFormat" style="width: 120px">
                <el-option value="json" label="JSON" />
                <el-option value="yaml" label="YAML" />
                <el-option value="toml" label="TOML" />
              </el-select>
              <el-button @click="exportTheme">
                <el-icon><Download /></el-icon>
                {{ t('themeSettings.advanced.export') }}
              </el-button>
              <el-upload
                :show-file-list="false"
                :before-upload="importTheme"
                accept=".json,.yaml,.yml,.toml"
              >
                <el-button>
                  <el-icon><Upload /></el-icon>
                  {{ t('themeSettings.advanced.import') }}
                </el-button>
              </el-upload>
            </div>
          </div>

          <div class="setting-section">
            <h3>{{ t('themeSettings.advanced.debug') }}</h3>
            <div class="debug-actions">
              <el-button @click="showDebugInfo = !showDebugInfo">
                <el-icon><Tools /></el-icon>
                {{ showDebugInfo ? t('themeSettings.advanced.hideDebug') : t('themeSettings.advanced.showDebug') }}
              </el-button>
              <el-button @click="exportDebugReport">
                <el-icon><Document /></el-icon>
                {{ t('themeSettings.advanced.exportReport') }}
              </el-button>
            </div>
            <div v-if="showDebugInfo" class="debug-info">
              <pre>{{ debugInfo }}</pre>
            </div>
          </div>

          <div class="setting-section">
            <h3>{{ t('themeSettings.advanced.accessibility') }}</h3>
            <div class="a11y-settings">
              <div class="a11y-item">
                <span>{{ t('themeSettings.advanced.announceChanges') }}</span>
                <el-switch v-model="a11yConfig.announceChanges" />
              </div>
              <div class="a11y-item">
                <span>{{ t('themeSettings.advanced.keyboardNav') }}</span>
                <el-switch v-model="a11yConfig.enableKeyboardNavigation" />
              </div>
              <div class="a11y-item">
                <span>{{ t('themeSettings.advanced.voiceControl') }}</span>
                <el-switch v-model="a11yConfig.enableVoiceControl" @change="toggleVoiceControl" />
              </div>
              <div class="a11y-item">
                <span>{{ t('themeSettings.advanced.focusIndicator') }}</span>
                <el-select v-model="a11yConfig.focusIndicator" style="width: 150px">
                  <el-option value="default" :label="t('themeSettings.advanced.focusDefault')" />
                  <el-option value="high-contrast" :label="t('themeSettings.advanced.focusHighContrast')" />
                  <el-option value="large" :label="t('themeSettings.advanced.focusLarge')" />
                </el-select>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showAddScheduleDialog" :title="t('themeSettings.schedule.add')" width="400px">
      <el-form :model="newSchedule" label-width="80px">
        <el-form-item :label="t('themeSettings.schedule.label')">
          <el-input v-model="newSchedule.label" />
        </el-form-item>
        <el-form-item :label="t('themeSettings.schedule.time')">
          <el-time-select v-model="newSchedule.time" />
        </el-form-item>
        <el-form-item :label="t('themeSettings.schedule.mode')">
          <el-select v-model="newSchedule.mode">
            <el-option v-for="mode in themeModes" :key="mode.value" :value="mode.value" :label="mode.label" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('themeSettings.schedule.days')">
          <el-checkbox-group v-model="newSchedule.days">
            <el-checkbox v-for="day in weekDays" :key="day.value" :value="day.value">{{ day.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddScheduleDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="addSchedule">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPreviewDialog" :title="t('themeSettings.basic.preview')" width="600px">
      <ThemePreview @close="showPreviewDialog = false" @apply="applyPreview" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Check, Moon, RefreshRight, View, Edit, Delete, Plus, Upload, Download, Tools, Document, Loading, CircleCheck, Warning, WarningFilled } from '@element-plus/icons-vue'
import { useDarkModeStore, type ThemeMode } from '@/stores/darkMode'
import { themePresetManager } from '@/utils/themePreset'
import { themeScheduledSwitch, type ScheduledSwitch } from '@/utils/themeScheduledSwitch'
import { themeCloudSync } from '@/utils/themeCloudSync'
import { themeImportExport } from '@/utils/themeImportExport'
import { themeDebug } from '@/utils/themeDebug'
import { themeAccessibility } from '@/utils/themeAccessibility'
import ThemePresetPanel from './ThemePresetPanel.vue'
import ThemePreview from './ThemePreview.vue'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const cleanup = useCleanup()

const searchQuery = ref('')
const activeTab = ref('basic')
const showPreviewDialog = ref(false)
const showDebugInfo = ref(false)
const showAddScheduleDialog = ref(false)
const exportFormat = ref<'json' | 'yaml' | 'toml'>('json')

const currentThemeMode = computed(() => darkModeStore.themeMode)

const themeModes = computed(() => [
  { value: 'light' as ThemeMode, label: t('themeToggle.lightMode') },
  { value: 'dark' as ThemeMode, label: t('themeToggle.darkMode') },
  { value: 'auto' as ThemeMode, label: t('themeToggle.autoMode') },
  { value: 'high-contrast-light' as ThemeMode, label: t('themeToggle.highContrastLight') },
  { value: 'high-contrast-dark' as ThemeMode, label: t('themeToggle.highContrastDark') }
])

const weekDays = computed(() => [
  { value: 0, label: t('common.sunday') },
  { value: 1, label: t('common.monday') },
  { value: 2, label: t('common.tuesday') },
  { value: 3, label: t('common.wednesday') },
  { value: 4, label: t('common.thursday') },
  { value: 5, label: t('common.friday') },
  { value: 6, label: t('common.saturday') }
])

const scheduleEnabled = ref(themeScheduledSwitch.isEnabled())
const schedules = ref<ScheduledSwitch[]>([])
const nextSchedule = ref<{ schedule: ScheduledSwitch; timeUntil: number } | null>(null)

const syncStatus = ref({
  isSyncing: false,
  lastSyncedAt: null as number | null,
  error: null as string | null,
  hasLocalChanges: false
})

const a11yConfig = ref(themeAccessibility.getConfig())

const debugInfo = ref('')

const newSchedule = ref({
  label: '',
  time: '08:00',
  mode: 'light' as ThemeMode,
  days: [0, 1, 2, 3, 4, 5, 6]
})

const setThemeMode = (mode: ThemeMode) => {
  darkModeStore.setThemeMode(mode, 'user', true)
  themeAccessibility.announceThemeChange(mode)
}

const toggleDarkMode = () => {
  darkModeStore.toggleDarkMode()
}

const resetToDefault = () => {
  darkModeStore.setThemeMode('auto', 'user', true)
  themePresetManager.resetToDefaults()
  themeScheduledSwitch.resetToDefaults()
  ElMessage.success(t('themeSettings.basic.resetSuccess'))
}

const getModeLabel = (mode: ThemeMode): string => {
  return themeModes.value.find(m => m.value === mode)?.label || mode
}

const toggleScheduleEnabled = (enabled: boolean) => {
  themeScheduledSwitch.setEnabled(enabled)
}

const updateSchedule = (schedule: ScheduledSwitch) => {
  themeScheduledSwitch.updateSchedule(schedule.id, { enabled: schedule.enabled })
}

const editSchedule = (schedule: ScheduledSwitch) => {
  newSchedule.value = {
    label: schedule.label,
    time: schedule.time,
    mode: schedule.mode,
    days: [...schedule.days]
  }
  showAddScheduleDialog.value = true
}

const deleteSchedule = (id: string) => {
  themeScheduledSwitch.deleteSchedule(id)
  schedules.value = themeScheduledSwitch.getSchedules()
}

const addSchedule = () => {
  themeScheduledSwitch.addSchedule({
    label: newSchedule.value.label,
    time: newSchedule.value.time,
    mode: newSchedule.value.mode,
    days: newSchedule.value.days,
    enabled: true
  })
  schedules.value = themeScheduledSwitch.getSchedules()
  showAddScheduleDialog.value = false
  newSchedule.value = { label: '', time: '08:00', mode: 'light', days: [0, 1, 2, 3, 4, 5, 6] }
}

const formatTimeUntil = (minutes: number): string => {
  return themeScheduledSwitch.formatTimeUntil(minutes)
}

const syncToCloud = async () => {
  const presets = themePresetManager.getPresets()
  const activePresetId = themePresetManager.getActivePresetId()
  await themeCloudSync.syncToCloud('', currentThemeMode.value, presets, activePresetId)
}

const syncFromCloud = async () => {
  const data = await themeCloudSync.syncFromCloud('')
  if (data) {
    darkModeStore.setThemeMode(data.themeMode as ThemeMode, 'user', true)
    ElMessage.success(t('themeSettings.sync.syncSuccess'))
  }
}

const exportTheme = () => {
  const presets = themePresetManager.getPresets()
  const schedules = themeScheduledSwitch.getSchedules()
  const content = themeImportExport.exportThemePackage(
    currentThemeMode.value,
    presets,
    themePresetManager.getActivePresetId(),
    schedules,
    {},
    { format: exportFormat.value }
  )
  themeImportExport.downloadThemePackage(content, 'theme-package', exportFormat.value)
  ElMessage.success(t('themeSettings.advanced.exportSuccess'))
}

const importTheme = async (file: File) => {
  try {
    const content = await themeImportExport.readThemeFile(file)
    const result = themeImportExport.importThemePackage(content)
    if (result.success) {
      ElMessage.success(t('themeSettings.advanced.importSuccess', {
        presets: result.imported.presets,
        schedules: result.imported.schedules
      }))
    } else {
      ElMessage.error(result.errors.join(', '))
    }
    return false
  } catch {
    ElMessage.error(t('common.errors.importFailed'))
    return false
  }
}

const exportDebugReport = () => {
  const report = themeDebug.exportDebugReport(currentThemeMode.value)
  const blob = new Blob([report], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'theme-debug-report.json'
  a.click()
  URL.revokeObjectURL(url)
}

const toggleVoiceControl = (enabled: boolean) => {
  if (enabled) {
    themeAccessibility.startVoiceControl()
  } else {
    themeAccessibility.stopVoiceControl()
  }
}

const applyPreview = (mode: ThemeMode) => {
  setThemeMode(mode)
  showPreviewDialog.value = false
}

let unsubscribeSync: (() => void) | null = null

onMounted(() => {
  schedules.value = themeScheduledSwitch.getSchedules()
  nextSchedule.value = themeScheduledSwitch.getNextScheduledSwitch()

  unsubscribeSync = themeCloudSync.subscribe((status) => {
    syncStatus.value = status
  })
  cleanup.add(() => unsubscribeSync?.())

  const unsubscribeSchedule = themeScheduledSwitch.subscribe((schedule) => {
    darkModeStore.setThemeMode(schedule.mode, 'user', true)
    themeAccessibility.announceThemeChange(schedule.mode)
  })
  cleanup.add(() => unsubscribeSchedule?.())
  themeScheduledSwitch.startChecking()
  cleanup.add(themeScheduledSwitch.stopChecking)

  themeAccessibility.initAnnouncer()
})
</script>

<style scoped>
.theme-settings-panel {
  padding: 24px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.search-input {
  width: 250px;
}

.settings-tabs {
  margin-top: 16px;
}

.tab-content {
  padding: 16px 0;
}

.setting-section {
  margin-bottom: 32px;
}

.setting-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.theme-card {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: var(--global-border-radius);
  padding: 12px;
  transition: border-color 0.2s ease;
  position: relative;
}

.theme-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.theme-card.active {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

.theme-preview {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.theme-preview.light { background: var(--el-bg-color); border: var(--unified-border); }
.theme-preview.dark { background: var(--color-dark-bg-2); }
.theme-preview.auto { background: linear-gradient(135deg, var(--el-bg-color) 50%, var(--color-dark-bg-2) 50%); }
.theme-preview.high-contrast-light { background: var(--el-bg-color); border: 2px solid var(--el-text-color-primary); }
.theme-preview.high-contrast-dark { background: var(--el-text-color-primary); border: 2px solid var(--el-bg-color); }

.preview-header {
  height: 20%;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
}

.preview-body {
  flex: 1;
  display: flex;
}

.preview-sidebar {
  width: 25%;
  background: color-mix(in srgb, var(--el-border-color) 10%, transparent);
}

.preview-content {
  flex: 1;
  background: color-mix(in srgb, var(--el-border-color) 5%, transparent);
}

.theme-name {
  display: block;
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.check-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--el-color-primary);
}

.quick-actions {
  display: flex;
  gap: 12px;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.schedule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.schedule-info {
  display: flex;
  gap: 16px;
}

.schedule-label {
  font-weight: 500;
}

.schedule-time {
  color: var(--el-text-color-secondary);
}

.schedule-mode {
  color: var(--el-color-primary);
}

.schedule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.next-schedule {
  margin-top: 16px;
  padding: 12px;
  background: var(--el-color-primary-light-9);
  border-radius: var(--global-border-radius);
  color: var(--el-color-primary);
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.sync-status .syncing {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sync-actions {
  display: flex;
  gap: 12px;
}

.sync-error {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-color-danger-light-9);
  border-radius: var(--global-border-radius);
  color: var(--el-color-danger);
  display: flex;
  align-items: center;
  gap: 8px;
}

.import-export-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.debug-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.debug-info {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  overflow: auto;
  max-height: 400px;
}

.debug-info pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
}

.a11y-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.a11y-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (width <= 768px) {
  .theme-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .quick-actions {
    flex-wrap: wrap;
  }
}

@media (width <= 480px) {
  .theme-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
