<template>
  <div class="theme-preset-panel">
    <div class="preset-header">
      <h3>{{ t('themePreset.title') }}</h3>
      <div class="preset-actions">
        <el-button size="small" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          {{ t('themePreset.create') }}
        </el-button>
        <el-dropdown trigger="click" @command="handleExportImport">
          <el-button size="small">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">{{ t('themePreset.export') }}</el-dropdown-item>
              <el-dropdown-item command="import">{{ t('themePreset.import') }}</el-dropdown-item>
              <el-dropdown-item divided command="reset">{{ t('themePreset.reset') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="preset-list">
      <div
        v-for="preset in presets"
        :key="preset.id"
        class="preset-item"
        :class="{ active: activePresetId === preset.id }"
        @click="applyPreset(preset.id)"
      >
        <div class="preset-info">
          <span class="preset-name">{{ preset.name }}</span>
          <span class="preset-mode">{{ getModeLabel(preset.mode) }}</span>
        </div>
        <div class="preset-actions" v-if="!preset.isDefault">
          <el-button
            text
            size="small"
            @click.stop="editPreset(preset)"
          >
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button
            text
            size="small"
            @click.stop="duplicatePreset(preset.id)"
          >
            <el-icon><CopyDocument /></el-icon>
          </el-button>
          <el-button
            text
            size="small"
            type="danger"
            @click.stop="deletePreset(preset.id)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <el-icon v-if="activePresetId === preset.id" class="active-icon"><Check /></el-icon>
      </div>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      :title="editingPreset ? t('themePreset.edit') : t('themePreset.create')"
      width="400px"
    >
      <el-form :model="presetForm" label-width="80px">
        <el-form-item :label="t('themePreset.name')">
          <el-input v-model="presetForm.name" />
        </el-form-item>
        <el-form-item :label="t('themePreset.mode')">
          <el-select v-model="presetForm.mode">
            <el-option value="light" :label="t('themeToggle.lightMode')" />
            <el-option value="dark" :label="t('themeToggle.darkMode')" />
            <el-option value="auto" :label="t('themeToggle.autoMode')" />
            <el-option value="high-contrast-light" :label="t('themeToggle.highContrastLight')" />
            <el-option value="high-contrast-dark" :label="t('themeToggle.highContrastDark')" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeCreateDialog">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="savePreset">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <input
      ref="importInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleImportFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, CopyDocument, Check, MoreFilled } from '@element-plus/icons-vue'
import { themePresetManager, type ThemePreset } from '@/utils/themePreset'
import { useDarkModeStore, type ThemeMode } from '@/stores/darkMode'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()

const presets = ref<ThemePreset[]>([])
const activePresetId = ref<string | null>(null)
const showCreateDialog = ref(false)
const editingPreset = ref<ThemePreset | null>(null)
const importInput = ref<HTMLInputElement | null>(null)

const presetForm = ref({
  name: '',
  mode: 'light' as ThemeMode
})

const getModeLabel = (mode: ThemeMode): string => {
  const labels: Record<ThemeMode, string> = {
    'light': t('themeToggle.lightMode'),
    'dark': t('themeToggle.darkMode'),
    'auto': t('themeToggle.autoMode'),
    'high-contrast-light': t('themeToggle.highContrastLight'),
    'high-contrast-dark': t('themeToggle.highContrastDark')
  }
  return labels[mode]
}

const updatePresets = (newPresets: ThemePreset[], newActiveId: string | null) => {
  presets.value = newPresets
  activePresetId.value = newActiveId
}

const applyPreset = (id: string) => {
  const preset = themePresetManager.getPreset(id)
  if (preset) {
    darkModeStore.setThemeMode(preset.mode, 'user', true)
    themePresetManager.setActivePreset(id)
    ElMessage.success(t('themePreset.applied', { name: preset.name }))
  }
}

const editPreset = (preset: ThemePreset) => {
  editingPreset.value = preset
  presetForm.value = {
    name: preset.name,
    mode: preset.mode
  }
  showCreateDialog.value = true
}

const duplicatePreset = (id: string) => {
  const newPreset = themePresetManager.duplicatePreset(id)
  if (newPreset) {
    ElMessage.success(t('themePreset.duplicated'))
  }
}

const deletePreset = async (id: string) => {
  try {
    await ElMessageBox.confirm(t('themePreset.deleteConfirm'), t('common.warning'), {
      type: 'warning'
    })
    if (themePresetManager.deletePreset(id)) {
      ElMessage.success(t('themePreset.deleted'))
    }
  } catch {
    // User cancelled the delete confirmation
  }
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
  editingPreset.value = null
  presetForm.value = { name: '', mode: 'light' }
}

const savePreset = () => {
  if (!presetForm.value.name.trim()) {
    ElMessage.warning(t('themePreset.nameRequired'))
    return
  }

  if (editingPreset.value) {
    themePresetManager.updatePreset(editingPreset.value.id, {
      name: presetForm.value.name,
      mode: presetForm.value.mode
    })
    ElMessage.success(t('themePreset.updated'))
  } else {
    themePresetManager.createPreset(presetForm.value.name, presetForm.value.mode)
    ElMessage.success(t('themePreset.created'))
  }

  closeCreateDialog()
}

const handleExportImport = (command: string) => {
  if (command === 'export') {
    const json = themePresetManager.exportPresets()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'theme-presets.json'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(t('themePreset.exported'))
  } else if (command === 'import') {
    importInput.value?.click()
  } else if (command === 'reset') {
    ElMessageBox.confirm(t('themePreset.resetConfirm'), t('common.warning'), {
      type: 'warning'
    }).then(() => {
      themePresetManager.resetToDefaults()
      ElMessage.success(t('themePreset.resetSuccess'))
    }).catch(() => { /* 用户取消操作，无需处理 */ })
  }
}

const handleImportFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const json = e.target?.result as string
    const result = themePresetManager.importPresets(json)
    if (result.success) {
      ElMessage.success(t('themePreset.imported', { count: result.imported }))
    } else {
      ElMessage.error(result.error || t('themePreset.importFailed'))
    }
  }
  reader.readAsText(file)
  ;(event.target as HTMLInputElement).value = ''
}

let unsubscribe: (() => void) | null = null

onMounted(() => {
  presets.value = themePresetManager.getPresets()
  activePresetId.value = themePresetManager.getActivePresetId()
  unsubscribe = themePresetManager.subscribe(updatePresets)
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.theme-preset-panel {
  padding: 16px;
}

.preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.preset-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.preset-actions {
  display: flex;
  gap: 8px;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, border-width 0.2s ease;
}

.preset-item:hover {
  background: var(--el-fill-color);
}

.preset-item.active {
  background: var(--el-color-primary-light-9);
  border: var(--unified-border);
}

.preset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.preset-mode {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.active-icon {
  color: var(--el-color-primary);
  font-size: 18px;
}
</style>
