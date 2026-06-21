<template>
  <el-dialog
    v-model="visible"
    :title="t('themeSync.conflict.title')"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <div class="conflict-content">
      <div class="conflict-warning">
        <el-icon class="warning-icon"><WarningFilled /></el-icon>
        <p>{{ t('themeSync.conflict.description') }}</p>
      </div>

      <div class="conflict-options">
        <div 
          class="conflict-option" 
          :class="{ selected: selectedResolution === 'local' }"
          @click="selectedResolution = 'local'"
        >
          <div class="option-header">
            <el-radio :value="'local'" :model-value="selectedResolution" />
            <span class="option-title">{{ t('themeSync.conflict.keepLocal') }}</span>
          </div>
          <div class="option-info">
            <span class="info-item">
              <el-icon><Clock /></el-icon>
              {{ formatTime(localData?.updatedAt) }}
            </span>
            <span class="info-item">
              <el-icon><Monitor /></el-icon>
              {{ t('themeSync.conflict.thisDevice') }}
            </span>
          </div>
        </div>

        <div 
          class="conflict-option" 
          :class="{ selected: selectedResolution === 'cloud' }"
          @click="selectedResolution = 'cloud'"
        >
          <div class="option-header">
            <el-radio :value="'cloud'" :model-value="selectedResolution" />
            <span class="option-title">{{ t('themeSync.conflict.useCloud') }}</span>
          </div>
          <div class="option-info">
            <span class="info-item">
              <el-icon><Clock /></el-icon>
              {{ formatTime(cloudData?.updatedAt) }}
            </span>
            <span class="info-item">
              <el-icon><Cloudy /></el-icon>
              {{ t('themeSync.conflict.cloudBackup') }}
            </span>
          </div>
        </div>

        <div 
          class="conflict-option" 
          :class="{ selected: selectedResolution === 'merge' }"
          @click="selectedResolution = 'merge'"
        >
          <div class="option-header">
            <el-radio :value="'merge'" :model-value="selectedResolution" />
            <span class="option-title">{{ t('themeSync.conflict.merge') }}</span>
          </div>
          <div class="option-info">
            <span class="info-item">
              {{ t('themeSync.conflict.mergeDesc') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-checkbox v-model="rememberChoice">
          {{ t('themeSync.conflict.rememberChoice') }}
        </el-checkbox>
        <div class="footer-actions">
          <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm">
            {{ t('themeSync.conflict.confirm') }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { WarningFilled, Clock, Monitor, Cloudy } from '@element-plus/icons-vue'
import type { SyncConflictData, ConflictResolution } from '@/utils/themeSyncConflict'
import { formatDateTime as _formatTime } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  localData: SyncConflictData['localData'] | null
  cloudData: SyncConflictData['cloudData'] | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'resolve': [resolution: ConflictResolution, remember: boolean]
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const selectedResolution = ref<ConflictResolution>('cloud')
const rememberChoice = ref(false)

watch(() => props.modelValue, (val) => {
  if (val) {
    selectedResolution.value = 'cloud'
    rememberChoice.value = false
  }
})

function formatTime(timestamp: number | undefined): string {
  return timestamp ? _formatTime(timestamp) : ''
}

function handleCancel(): void {
  visible.value = false
}

function handleConfirm(): void {
  emit('resolve', selectedResolution.value, rememberChoice.value)
  visible.value = false
}
</script>

<style lang="scss" scoped>
.conflict-content {
  padding: var(--spacing-sm) 0;
}

.conflict-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--el-color-warning-light-9);
  border-radius: var(--global-border-radius);
  margin-bottom: var(--spacing-md);

  .warning-icon {
    font-size: 24px;
    color: var(--el-color-warning);
    flex-shrink: 0;
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }
}

.conflict-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.conflict-option {
  padding: var(--spacing-md);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-fill-color-lighter);
  }

  &.selected {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.option-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.option-title {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.option-info {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-left: calc(var(--spacing-md) + var(--spacing-sm));
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-actions {
  display: flex;
  gap: var(--spacing-sm);
}
</style>
