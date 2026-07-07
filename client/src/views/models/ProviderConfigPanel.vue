<template>
  <div class="provider-config-panel">
    <!-- Empty state -->
    <div v-if="!provider && !isCreating" class="empty-state">
      <Plug class="empty-icon" />
      <p class="empty-text">{{ t('models.selectProvider') }}</p>
    </div>

    <!-- Config form -->
    <div v-else class="config-content">
      <!-- Header: name + enabled badge + actions -->
      <div class="config-header">
        <div class="config-header__left">
          <h2 class="config-header__name">{{ form.name || t('models.newProvider') }}</h2>
          <span
            v-if="form.enabled"
            class="enabled-badge"
          >
            {{ t('models.enabled') }}
          </span>
        </div>
        <div class="config-header__actions">
          <button
            v-if="provider && !isCreating"
            class="header-btn"
            @click="$emit('toggle', provider.id, !form.enabled)"
          >
            {{ form.enabled ? t('models.disable') : t('models.enable') }}
          </button>
          <button
            v-if="provider && !isCreating && !provider.isBuiltin"
            class="header-btn header-btn--danger"
            @click="$emit('delete', provider.id)"
          >
            <Trash class="btn-icon" />
          </button>
        </div>
      </div>

      <!-- Test result banner -->
      <TestResultBanner
        v-if="hasResult"
        :test-state="testState"
        :test-result="testResult"
        :success-message="successMessage"
        :error-message="errorMessage"
        @close="$emit('resetTest')"
      />

      <!-- Form fields -->
      <div class="form-section">
        <!-- Provider name -->
        <div class="form-field">
          <label class="form-label">{{ t('models.providerName') }}</label>
          <el-input
            v-model="form.name"
            :placeholder="t('models.providerNamePlaceholder')"
            class="form-input"
          />
        </div>

        <!-- Base URL -->
        <div class="form-field">
          <label class="form-label">
            {{ t('models.baseUrl') }}
            <span class="form-label__hint">{{ t('models.baseUrlHint') }}</span>
          </label>
          <el-input
            v-model="form.baseUrl"
            :placeholder="baseUrlPlaceholder"
            class="form-input"
          >
            <template #prefix>
              <Server class="input-prefix-icon" />
            </template>
          </el-input>
        </div>

        <!-- API Format -->
        <div class="form-field">
          <label class="form-label">{{ t('models.apiFormat') }}</label>
          <el-select
            v-model="form.apiFormat"
            class="form-select"
            :placeholder="t('models.apiFormatPlaceholder')"
          >
            <el-option
              v-for="fmt in apiFormats"
              :key="fmt.value"
              :label="`${fmt.label} (${fmt.endpoint})`"
              :value="fmt.value"
            />
          </el-select>
          <p v-if="currentFormatDesc" class="form-hint">{{ currentFormatDesc }}</p>
        </div>

        <!-- API Key -->
        <div class="form-field">
          <label class="form-label">
            {{ t('models.apiKey') }}
            <span v-if="provider?.hasApiKey" class="form-label__hint">
              ({{ t('models.apiKeyMasked') }}: {{ provider.apiKey }})
            </span>
          </label>
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="provider?.hasApiKey ? t('models.apiKeyKeepPlaceholder') : t('models.apiKeyPlaceholder')"
            class="form-input"
          >
            <template #prefix>
              <KeyIcon class="input-prefix-icon" />
            </template>
          </el-input>
        </div>

        <!-- Test model ID -->
        <div class="form-field">
          <label class="form-label">{{ t('models.testModelId') }}</label>
          <el-input
            v-model="form.modelIdForTest"
            :placeholder="t('models.testModelIdPlaceholder')"
            class="form-input"
          >
            <template #prefix>
              <CpuIcon class="input-prefix-icon" />
            </template>
          </el-input>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="action-bar">
        <el-button
          type="primary"
          :loading="isTesting"
          class="test-btn"
          @click="handleTest"
        >
          <Zap v-if="!isTesting" class="btn-icon btn-icon--left" />
          {{ isTesting ? t('models.testing') : t('models.testModel') }}
        </el-button>
        <el-button
          :loading="saving"
          :disabled="isTesting"
          class="save-btn"
          @click="handleSave"
        >
          {{ t('common.save') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  Plug, Server, KeyIcon, CpuIcon, Zap, Trash,
} from '@/lib/lucide-fallback'
import TestResultBanner from './TestResultBanner.vue'
import {
  type ModelProviderConfig,
  type ApiFormatInfo,
  type ApiFormatType,
} from '@/api/models'
import type { TestState, ModelTestResult } from '@/composables/useModelTest'

const props = defineProps<{
  provider: ModelProviderConfig | null
  isCreating: boolean
  apiFormats: ApiFormatInfo[]
  saving: boolean
  testState: TestState
  testResult: ModelTestResult | null
  isTesting: boolean
  hasResult: boolean
  successMessage: string
  errorMessage: string
}>()

const emit = defineEmits<{
  save: [data: { name: string; baseUrl: string; apiFormat: ApiFormatType; apiKey: string; modelIdForTest: string }]
  test: [data: { baseUrl: string; apiKey: string; apiFormat: ApiFormatType; modelIdForTest: string }]
  toggle: [id: number | string, enabled: boolean]
  delete: [id: number | string]
  resetTest: []
}>()

const { t } = useI18n()

const form = reactive({
  name: '',
  baseUrl: '',
  apiFormat: 'openai_chat' as ApiFormatType,
  apiKey: '',
  modelIdForTest: '',
})

// Sync form from provider
watch(
  () => props.provider,
  (p) => {
    if (p) {
      form.name = p.name
      form.baseUrl = p.baseUrl
      form.apiFormat = p.apiFormat
      form.apiKey = '' // Never pre-fill the actual key
      form.modelIdForTest = p.modelIdForTest || ''
    }
  },
  { immediate: true }
)

const baseUrlPlaceholder = computed(() => {
  if (form.apiFormat === 'anthropic_messages') {
    return 'https://api.anthropic.com'
  }
  return 'https://api.openai.com/v1'
})

const currentFormatDesc = computed(() => {
  const fmt = props.apiFormats.find((f) => f.value === form.apiFormat)
  return fmt?.description || ''
})

function handleTest() {
  emit('test', {
    baseUrl: form.baseUrl,
    apiKey: form.apiKey,
    apiFormat: form.apiFormat,
    modelIdForTest: form.modelIdForTest,
  })
}

function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning(t('models.providerNameRequired'))
    return
  }
  if (!form.baseUrl.trim()) {
    ElMessage.warning(t('models.baseUrlRequired'))
    return
  }
  emit('save', {
    name: form.name,
    baseUrl: form.baseUrl,
    apiFormat: form.apiFormat,
    apiKey: form.apiKey,
    modelIdForTest: form.modelIdForTest,
  })
}
</script>

<style scoped lang="scss">
.provider-config-panel {
  height: 100%;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--spacing-sm);

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--app-text-muted);
  }

  .empty-text {
    font-size: 14px;
    color: var(--app-text-muted);
  }
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);

  &__left {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  &__name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--app-text-primary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
}

.enabled-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background-color: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--global-border-radius);
  border-width: 1px;
  border-style: solid;
  border-color: var(--border-unified-color);
  background-color: var(--app-surface-2);
  font-size: 13px;
  color: var(--app-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;

  .btn-icon {
    width: 14px;
    height: 14px;
  }

  &:hover {
    border-color: var(--border-unified-color-hover);
  }

  &--danger {
    color: var(--el-color-danger);

    &:hover {
      border-color: var(--el-color-danger);
    }
  }
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text-secondary);

  &__hint {
    font-size: 12px;
    font-weight: 400;
    color: var(--app-text-muted);
  }
}

.form-hint {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.4;
}

.input-prefix-icon {
  width: 16px;
  height: 16px;
  color: var(--app-text-muted);
}

.action-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--app-divider);
}

.test-btn {
  .btn-icon {
    width: 16px;
    height: 16px;

    &--left {
      margin-right: 4px;
    }
  }
}

.save-btn {
  margin-left: auto;
}
</style>
