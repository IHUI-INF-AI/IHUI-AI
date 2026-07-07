<template>
  <div class="model-manager page-container">
    <!-- Header -->
    <div class="mm-header">
      <div class="mm-header__left">
        <h1 class="mm-header__title">{{ t('models.providerManage') }}</h1>
        <p class="mm-header__subtitle">{{ t('models.providerManageSubtitle') }}</p>
      </div>
      <div class="mm-header__right">
        <el-button @click="handleRefresh" :loading="loading">
          <RefreshIcon class="btn-icon" />
          {{ t('common.refresh') }}
        </el-button>
      </div>
    </div>

    <!-- Three-column layout -->
    <div class="mm-layout">
      <!-- Middle: Provider List Panel -->
      <div class="mm-layout__list">
        <ProviderListPanel
          :builtin-providers="builtinProviderList"
          :custom-providers="customProviders"
          :selected-code="selectedBuiltinCode"
          :selected-id="selectedProviderId"
          :enabled-codes="enabledCodes"
          @select="handleSelectBuiltin"
          @select-custom="handleSelectCustom"
          @add="handleAddCustom"
        />
      </div>

      <!-- Right: Provider Config Panel -->
      <div class="mm-layout__config">
        <ProviderConfigPanel
          :provider="selectedProvider"
          :is-creating="isCreating"
          :api-formats="apiFormats"
          :saving="saving"
          :test-state="testState"
          :test-result="testResult"
          :is-testing="isTesting"
          :has-result="hasResult"
          :success-message="successMessage"
          :error-message="errorMessage"
          @save="handleSave"
          @test="handleTest"
          @toggle="handleToggle"
          @delete="handleDelete"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { RefreshIcon } from '@/lib/lucide-fallback'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import ProviderListPanel from './models/ProviderListPanel.vue'
import ProviderConfigPanel from './models/ProviderConfigPanel.vue'
import { useModelTest } from '@/composables/useModelTest'
import {
  getModelProviders,
  createModelProvider,
  updateModelProvider,
  deleteModelProvider,
  toggleModelProvider,
  getApiFormats,
  MODEL_PROVIDERS,
  type ModelProviderConfig,
  type ApiFormatInfo,
  type ApiFormatType,
} from '@/api/models'

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()
const { confirmDelete } = useConfirmDialog()

// --- State ---
const loading = ref(false)
const saving = ref(false)
const customProviders = ref<ModelProviderConfig[]>([])
const apiFormats = ref<ApiFormatInfo[]>([])

const selectedBuiltinCode = ref<string | null>(null)
const selectedProviderId = ref<number | string | null>(null)
const isCreating = ref(false)

// Built-in providers from MODEL_PROVIDERS constant
const builtinProviderList = computed(() => {
  return Object.entries(MODEL_PROVIDERS)
    .filter(([code]) => code !== 'custom')
    .map(([code, info]) => ({
      code,
      name: info.name,
      icon: info.icon,
    }))
})

const enabledCodes = computed(() => {
  const codes = new Set<string>()
  customProviders.value.forEach((p) => {
    if (p.enabled) codes.add(p.providerCode)
  })
  return codes
})

// Currently selected provider (for config panel)
const selectedProvider = computed<ModelProviderConfig | null>(() => {
  if (isCreating.value) return null
  if (selectedProviderId.value) {
    return customProviders.value.find((p) => p.id === selectedProviderId.value) || null
  }
  // For built-in selection, find matching custom provider config
  if (selectedBuiltinCode.value) {
    return (
      customProviders.value.find((p) => p.providerCode === selectedBuiltinCode.value) || null
    )
  }
  return null
})

// --- Test composable ---
const {
  testState,
  testResult,
  isTesting,
  hasResult,
  runTest,
  resetTest,
  getErrorMessage,
  getSuccessMessage,
} = useModelTest()

const successMessage = computed(() => {
  if (!testResult.value) return ''
  return getSuccessMessage(testResult.value)
})

const errorMessage = computed(() => {
  if (!testResult.value) return ''
  return getErrorMessage(testResult.value)
})

// --- Data loading ---
async function loadProviders() {
  loading.value = true
  try {
    const res = await getModelProviders({ pageSize: 200 })
    if (res.success) {
      customProviders.value = res.data.list
    } else {
      showError(res.message)
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : t('common.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function loadApiFormats() {
  try {
    const res = await getApiFormats()
    if (res.success && res.data) {
      apiFormats.value = res.data
    }
  } catch {
    // Fallback to default formats
    apiFormats.value = [
      {
        value: 'openai_chat',
        label: 'OpenAI Chat Completions',
        endpoint: '/v1/chat/completions',
        description: 'OpenAI-compatible chat API',
      },
      {
        value: 'anthropic_messages',
        label: 'Anthropic Messages',
        endpoint: '/v1/messages',
        description: 'Anthropic Claude native Messages API',
      },
      {
        value: 'openai_responses',
        label: 'OpenAI Responses',
        endpoint: '/v1/responses',
        description: 'OpenAI Responses API',
      },
    ]
  }
}

// --- Handlers ---
function handleSelectBuiltin(code: string) {
  selectedBuiltinCode.value = code
  selectedProviderId.value = null
  isCreating.value = false
  resetTest()
  // If there's already a config for this builtin provider, select it
  const existing = customProviders.value.find((p) => p.providerCode === code)
  if (existing) {
    selectedProviderId.value = existing.id
  }
}

function handleSelectCustom(id: number | string) {
  selectedProviderId.value = id
  selectedBuiltinCode.value = null
  isCreating.value = false
  resetTest()
}

function handleAddCustom() {
  isCreating.value = true
  selectedProviderId.value = null
  selectedBuiltinCode.value = null
  resetTest()
}

async function handleSave(data: {
  name: string
  baseUrl: string
  apiFormat: ApiFormatType
  apiKey: string
  modelIdForTest: string
}) {
  saving.value = true
  try {
    if (isCreating.value) {
      // Create new provider
      const res = await createModelProvider({
        name: data.name,
        providerCode: 'custom',
        baseUrl: data.baseUrl,
        apiFormat: data.apiFormat,
        apiKey: data.apiKey,
        modelIdForTest: data.modelIdForTest,
        enabled: true,
      })
      if (res.success) {
        showSuccess(t('models.saveSuccess'))
        isCreating.value = false
        await loadProviders()
        if (res.data?.id) {
          selectedProviderId.value = res.data.id
        }
      } else {
        showError(res.message)
      }
    } else if (selectedProvider.value) {
      // Update existing provider
      const updateData: Record<string, unknown> = {
        name: data.name,
        baseUrl: data.baseUrl,
        apiFormat: data.apiFormat,
        modelIdForTest: data.modelIdForTest,
      }
      // Only send apiKey if user entered a new one
      if (data.apiKey) {
        updateData.apiKey = data.apiKey
      }
      const res = await updateModelProvider(selectedProvider.value.id, updateData)
      if (res.success) {
        showSuccess(t('models.saveSuccess'))
        await loadProviders()
      } else {
        showError(res.message)
      }
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : t('common.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function handleTest(data: {
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormatType
  modelIdForTest: string
}) {
  // If we have a saved provider with an API key, and user didn't enter a new key,
  // test the saved provider by ID (so the backend can use the stored key)
  if (
    selectedProvider.value &&
    selectedProvider.value.hasApiKey &&
    !data.apiKey
  ) {
    await runTest({
      providerId: selectedProvider.value.id,
      apiFormat: data.apiFormat,
      mode: 'chat',
    })
  } else {
    // Ad-hoc test with provided credentials
    await runTest({
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      apiFormat: data.apiFormat,
      modelIdForTest: data.modelIdForTest,
      mode: 'chat',
    })
  }
}

async function handleToggle(id: number | string, enabled: boolean) {
  try {
    const res = await toggleModelProvider(id, enabled)
    if (res.success) {
      showSuccess(enabled ? t('models.enableSuccess') : t('models.disableSuccess'))
      await loadProviders()
    } else {
      showError(res.message)
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : t('common.operationFailed'))
  }
}

async function handleDelete(id: number | string) {
  const confirmed = await confirmDelete(t('models.deleteConfirm'))
  if (!confirmed) return
  try {
    const res = await deleteModelProvider(id)
    if (res.success) {
      showSuccess(t('models.deleteSuccess'))
      selectedProviderId.value = null
      await loadProviders()
    } else {
      showError(res.message)
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : t('common.deleteFailed'))
  }
}

function handleRefresh() {
  loadProviders()
}

// Reset test when selection changes
watch([selectedProviderId, selectedBuiltinCode, isCreating], () => {
  resetTest()
})

// --- Lifecycle ---
onMounted(() => {
  loadProviders()
  loadApiFormats()
})
</script>

<style scoped lang="scss">
.model-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--spacing-md);
}

.mm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);

  &__left {
    flex: 1;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--app-text-primary);
    line-height: 1.3;
  }

  &__subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--app-text-secondary);
    line-height: 1.4;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
}

.btn-icon {
  width: 16px;
  height: 16px;
  margin-right: 4px;
}

.mm-layout {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  min-height: 0;

  &__list {
    width: 300px;
    flex-shrink: 0;
    border-radius: var(--global-border-radius);
    border-width: 1px;
    border-style: solid;
    border-color: var(--border-unified-color);
    background-color: var(--app-surface-2);
    overflow: hidden;
  }

  &__config {
    flex: 1;
    min-width: 0;
    border-radius: var(--global-border-radius);
    border-width: 1px;
    border-style: solid;
    border-color: var(--border-unified-color);
    background-color: var(--app-surface-2);
    overflow: hidden;
  }
}

@media (max-width: 768px) {
  .mm-layout {
    flex-direction: column;

    &__list {
      width: 100%;
      max-height: 240px;
    }
  }
}
</style>
