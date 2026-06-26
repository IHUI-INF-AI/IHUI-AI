<template>
  <div class="ip-whitelist">
    <div class="whitelist-header">
      <h3 class="whitelist-title">{{ t('settings.ipWhitelist.title') }}</h3>
      <p class="whitelist-desc">{{ t('settings.ipWhitelist.description') }}</p>
    </div>

    <div class="whitelist-config">
      <div class="config-item">
        <span class="config-label">{{ t('settings.ipWhitelist.enableWhitelist') }}</span>
        <el-switch v-model="config.enabled" @change="updateConfig" />
      </div>
      <div class="config-item">
        <span class="config-label">{{ t('settings.ipWhitelist.strictMode') }}</span>
        <el-switch v-model="config.strictMode" @change="updateConfig" :disabled="!config.enabled" />
        <span class="config-hint">{{ t('settings.ipWhitelist.strictModeHint') }}</span>
      </div>
    </div>

    <div class="whitelist-add">
      <el-input
        v-model="newIP"
        :placeholder="t('settings.ipWhitelist.ipPlaceholder')"
        style="width: 200px"
      />
      <el-input
        v-model="newLabel"
        :placeholder="t('settings.ipWhitelist.labelPlaceholder')"
        style="width: 150px"
      />
      <el-button type="primary" @click="handleAdd" :disabled="!newIP">
        {{ t('common.add') }}
      </el-button>
    </div>

    <div class="whitelist-list">
      <div v-if="whitelist.length === 0" class="no-entries">
        {{ t('settings.ipWhitelist.noEntries') }}
      </div>
      <div v-else class="entry-list">
        <div v-for="entry in whitelist" :key="entry.id" class="entry-item">
          <div class="entry-info">
            <span class="entry-ip">{{ entry.ip }}</span>
            <span class="entry-label">{{ entry.label }}</span>
          </div>
          <div class="entry-meta">
            <span class="entry-date">{{ formatDate(entry.createdAt) }}</span>
            <el-button type="danger" text size="small" @click="handleRemove(entry.id)">
              {{ t('common.delete') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="whitelist-actions">
      <el-button text @click="handleExport">{{ t('settings.ipWhitelist.export') }}</el-button>
      <el-button text @click="handleImport">{{ t('settings.ipWhitelist.import') }}</el-button>
      <el-button text type="danger" @click="handleClear">{{ t('settings.ipWhitelist.clear') }}</el-button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { IPWhitelistService, type IPWhitelistEntry, type IPWhitelistConfig } from '@/utils/ipWhitelistService'
import { formatTime } from '@/utils/format'

const { t } = useI18n()

const config = ref<IPWhitelistConfig>({ enabled: false, strictMode: false })
const whitelist = ref<IPWhitelistEntry[]>([])
const newIP = ref('')
const newLabel = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const formatDate = (timestamp: number) => formatTime(timestamp, 'YYYY-MM-DD')

const loadConfig = () => {
  config.value = IPWhitelistService.getConfig()
}

const loadWhitelist = () => {
  whitelist.value = IPWhitelistService.getWhitelist()
}

const updateConfig = () => {
  IPWhitelistService.updateConfig(config.value)
}

const handleAdd = () => {
  if (!newIP.value) return

  const entry = IPWhitelistService.addEntry(newIP.value, newLabel.value || newIP.value)
  if (entry) {
    loadWhitelist()
    newIP.value = ''
    newLabel.value = ''
    ElMessage.success(t('settings.ipWhitelist.addSuccess'))
  } else {
    ElMessage.error(t('settings.ipWhitelist.addFailed'))
  }
}

const handleRemove = async (entryId: string) => {
  try {
    await ElMessageBox.confirm(
      t('settings.ipWhitelist.removeConfirm'),
      t('common.confirm'),
      { type: 'warning' }
    )

    IPWhitelistService.removeEntry(entryId)
    loadWhitelist()
    ElMessage.success(t('settings.ipWhitelist.removeSuccess'))
  } catch {
    // 用户取消
  }
}

const handleExport = () => {
  const json = IPWhitelistService.exportWhitelist()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ip-whitelist-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const handleImport = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    const success = IPWhitelistService.importWhitelist(content)
    if (success) {
      loadWhitelist()
      ElMessage.success(t('settings.ipWhitelist.importSuccess'))
    } else {
      ElMessage.error(t('settings.ipWhitelist.importFailed'))
    }
  }
  reader.readAsText(file)

  // 重置 input
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const handleClear = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.ipWhitelist.clearConfirm'),
      t('common.confirm'),
      { type: 'warning' }
    )

    IPWhitelistService.clearWhitelist()
    loadWhitelist()
    ElMessage.success(t('settings.ipWhitelist.clearSuccess'))
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadConfig()
  loadWhitelist()
})
</script>

<style scoped lang="scss">
.ip-whitelist {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.whitelist-header {
  margin-bottom: 20px;

  .whitelist-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .whitelist-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.whitelist-config {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  margin-bottom: 20px;

  .config-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }

    .config-label {
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    .config-hint {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
}

.whitelist-add {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.whitelist-list {
  min-height: 100px;
  margin-bottom: 20px;
}

.no-entries {
  padding: 40px;
  text-align: center;
  color: var(--el-text-color-placeholder);
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);

  .entry-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .entry-ip {
      font-family: var(--font-family-mono);
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    .entry-label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: 12px;

    .entry-date {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }
}

.whitelist-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
