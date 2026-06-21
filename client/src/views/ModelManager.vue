<template>
  <div class="model-manager page-container">
    <!-- 头部 -->
    <div class="header">
      <div>
        <h1 class="title">{{ t('models.title') }}</h1>
        <p class="subtitle">{{ t('models.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('models.searchModel')"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>
        <el-select
          v-model="filterProvider"
          clearable
          :placeholder="t('models.filterProviderPlaceholder')"
          class="provider-select"
          @change="handleSearch"
        >
          <el-option
            v-for="provider in providerOptions"
            :key="provider"
            :label="provider"
            :value="provider"
          />
        </el-select>
        <el-switch v-model="onlyEnabled" :active-text="t('models.onlyEnabled')" />
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          {{ t('models.addModel') }}
        </el-button>
      </div>
    </div>

    <!-- 模型列表 -->
    <el-card class="model-card" shadow="never">
      <el-empty
        v-if="!loading && models.length === 0"
        :description="t('models.noModelData')"
        :image-size="120"
      />
      <el-table v-else :data="models" v-loading="loading" border style="width: 100%">
        <el-table-column prop="name" :label="t('models.modelName')" min-width="160">
          <template #default="{ row }">
            <div class="model-name-cell">
              <span class="model-display-name">{{ row.name }}</span>
              <span class="model-id">({{ row.modelId }})</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="provider" :label="t('models.provider')" width="120" />
        <el-table-column prop="type" :label="t('models.type')" width="120" />
        <el-table-column :label="t('models.capabilities')" min-width="160">
          <template #default="{ row }">
            <el-tag
              v-for="cap in row.capabilities || []"
              :key="cap"
              size="small"
              type="info"
              class="cap-tag"
            >
              {{ cap }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" :label="t('models.status')" width="120">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? t('common.enabled') : t('common.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="usageCount" :label="t('models.usageCount')" width="120">
          <template #default="{ row }">
            {{ row.usageCount ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="t('common.operation')" fixed="right" width="320">
          <template #default="{ row }">
            <el-button link size="small" @click="handleEdit(row)">
              {{ t('common.edit') }}
            </el-button>
            <el-button link size="small" type="primary" @click="handleToggle(row)">
              {{ row.enabled ? t('models.disable') : t('models.enable') }}
            </el-button>
            <el-button link size="small" type="success" @click="handleTest(row)">
              {{ t('models.test') }}
            </el-button>
            <el-button link size="small" type="warning" @click="handleShowApiInfo(row)">
              {{ t('models.apiAccess') }}
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">
              {{ t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </el-card>

    <!-- 创建/编辑模型对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editingModel ? t('models.editModel') : t('models.addModel')"
      width="640px"
    >
      <el-form ref="formRef" :model="formModel" :rules="rules" label-width="120px">
        <el-form-item :label="t('models.modelName')" prop="name">
          <el-input v-model="formModel.name" />
        </el-form-item>
        <el-form-item :label="t('models.modelId')" prop="modelId">
          <el-input v-model="formModel.modelId" />
        </el-form-item>
        <el-form-item :label="t('models.provider')" prop="provider">
          <el-input v-model="formModel.provider" />
        </el-form-item>
        <el-form-item :label="t('models.type')" prop="type">
          <el-select v-model="formModel.type" filterable>
            <el-option v-for="type in modelTypes" :key="type" :label="type" :value="type" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('models.description')" prop="description">
          <el-input v-model="formModel.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('models.capabilities')" prop="capabilities">
          <el-select v-model="formModel.capabilities" multiple filterable>
            <el-option v-for="cap in capabilityOptions" :key="cap" :label="cap" :value="cap" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('models.enabled')" prop="enabled">
          <el-switch v-model="formModel.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editDialogVisible = false">
            {{ t('common.cancel') }}
          </el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">
            {{ t('common.save') }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- API对接信息对话框 -->
    <el-dialog
      v-model="apiInfoDialogVisible"
      :title="t('models.apiAccessTitle')"
      width="800px"
      class="api-info-dialog"
    >
      <template v-if="selectedModelForApi">
        <el-alert
          :title="t('models.apiAccessTip')"
          type="info"
          :closable="false"
          show-icon
          class="api-alert"
        />

        <el-descriptions :column="2" border class="api-descriptions">
          <el-descriptions-item :label="t('models.modelName')">
            {{ selectedModelForApi.name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('models.modelId')">
            <code>{{ selectedModelForApi.modelId }}</code>
          </el-descriptions-item>
          <el-descriptions-item :label="t('models.provider')">
            {{ selectedModelForApi.provider }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('models.type')">
            {{ selectedModelForApi.type }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>{{ t('models.apiEndpoints') }}</el-divider>

        <div class="api-endpoints">
          <div class="endpoint-item">
            <div class="endpoint-header">
              <span class="endpoint-label">OpenAI {{ t('models.compatible') }}</span>
              <el-tag type="success" size="small">{{ t('models.recommended') }}</el-tag>
            </div>
            <div class="endpoint-url">
              <code>{{ apiBaseUrl }}/v1/chat/completions</code>
              <el-button link size="small" @click="copyToClipboard(`${apiBaseUrl}/v1/chat/completions`)">
                {{ t('common.copy') }}
              </el-button>
            </div>
          </div>
          <div class="endpoint-item">
            <div class="endpoint-header">
              <span class="endpoint-label">Anthropic {{ t('models.compatible') }}</span>
            </div>
            <div class="endpoint-url">
              <code>{{ apiBaseUrl }}/v1/messages</code>
              <el-button link size="small" @click="copyToClipboard(`${apiBaseUrl}/v1/messages`)">
                {{ t('common.copy') }}
              </el-button>
            </div>
          </div>
        </div>

        <el-divider>{{ t('models.codeExample') }}</el-divider>

        <el-tabs v-model="codeExampleTab" class="code-tabs">
          <el-tab-pane label="cURL" name="curl">
            <div class="code-block">
              <pre><code>{{ generateCurlExample(selectedModelForApi) }}</code></pre>
              <el-button
                class="copy-btn"
                size="small"
                @click="copyToClipboard(generateCurlExample(selectedModelForApi))"
              >
                {{ t('common.copy') }}
              </el-button>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Python" name="python">
            <div class="code-block">
              <pre><code>{{ generatePythonExample(selectedModelForApi) }}</code></pre>
              <el-button
                class="copy-btn"
                size="small"
                @click="copyToClipboard(generatePythonExample(selectedModelForApi))"
              >
                {{ t('common.copy') }}
              </el-button>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Node.js" name="nodejs">
            <div class="code-block">
              <pre><code>{{ generateNodejsExample(selectedModelForApi) }}</code></pre>
              <el-button
                class="copy-btn"
                size="small"
                @click="copyToClipboard(generateNodejsExample(selectedModelForApi))"
              >
                {{ t('common.copy') }}
              </el-button>
            </div>
          </el-tab-pane>
        </el-tabs>

        <el-divider>{{ t('models.quickActions') }}</el-divider>

        <div class="quick-actions">
          <el-button type="primary" @click="goToApiTokens">
            <el-icon><Key /></el-icon>
            {{ t('models.manageApiTokens') }}
          </el-button>
          <el-button @click="goToApiDocs">
            <el-icon><Document /></el-icon>
            {{ t('models.viewApiDocs') }}
          </el-button>
          <el-button @click="goToApiStats">
            <el-icon><DataAnalysis /></el-icon>
            {{ t('models.viewUsageStats') }}
          </el-button>
        </div>
      </template>

      <template #footer>
        <el-button @click="apiInfoDialogVisible = false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { type FormInstance, type FormRules, ElMessage } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { usePageState } from '@/composables/usePageState'
import { ApiErrorType } from '@/utils/errorHandler'
import { Plus, Key, Document, DataAnalysis } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import {
  getModelsList,
  createModel,
  updateModel,
  deleteModel,
  testModel,
  type AIModel,
  type ModelType,
} from '@/api/models'

const { t } = useI18n()
const router = useRouter()
const { handleResult, showError: showErrorMsg, showWarning } = useOperationFeedback()
const { confirmDelete } = useConfirmDialog()
const { loading, error: pageError } = usePageState()
const saving = ref(false)
const models = ref<AIModel[]>([])
const searchKeyword = ref('')
const filterProvider = ref<string | undefined>(undefined)
const onlyEnabled = ref(true)

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const providerOptions = computed(() => {
  const set = new Set<string>()
  models.value.forEach(m => {
    if (m.provider) set.add(m.provider)
  })
  return Array.from(set).sort()
})

const capabilityOptions = ['chat', 'image', 'audio', 'video']
const modelTypes: ModelType[] = [
  'openai',
  'anthropic',
  'google',
  'coze',
  'dashscope',
  'baidu',
  'alibaba',
  'tencent',
  'doubao',
  'zhipu',
  'moonshot',
  'custom',
]

// 对话框 & 表单
const editDialogVisible = ref(false)
const editingModel = ref<AIModel | null>(null)
const formRef = ref<FormInstance | null>(null)
const formModel = reactive<Partial<AIModel>>({
  name: '',
  modelId: '',
  provider: '',
  type: 'talk',
  description: '',
  capabilities: ['chat'],
  enabled: true,
})

const rules: FormRules = {
  name: [{ required: true, message: t('models.pleaseEnterModelName'), trigger: 'blur' }],
  modelId: [{ required: true, message: t('models.pleaseEnterModelId'), trigger: 'blur' }],
  provider: [{ required: true, message: t('models.pleaseEnterProvider'), trigger: 'blur' }],
  type: [{ required: true, message: t('models.pleaseSelectType'), trigger: 'change' }],
}

const loadModels = async () => {
  loading.value = true
  pageError.value = null
  try {
    const res = await getModelsList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      enabled: onlyEnabled.value ? true : undefined,
    })
    if (res.code === 200 && res.success && res.data) {
      let list = res.data.list || []
      if (searchKeyword.value) {
        const kw = searchKeyword.value.toLowerCase()
        list = list.filter(
          m => m.name.toLowerCase().includes(kw) || m.modelId.toLowerCase().includes(kw)
        )
      }
      if (filterProvider.value) {
        list = list.filter(m => m.provider === filterProvider.value)
      }
      models.value = list
      pagination.total = res.data.pagination?.total ?? list.length
    } else {
      models.value = []
      pagination.total = 0
      const errorMsg = res.message || t('models.loadModelsFailed')
      pageError.value = {
        type: ApiErrorType.BUSINESS,
        code: res.code,
        message: errorMsg,
      }
      if (res.message) {
        showWarning(res.message)
      }
    }
  } catch (error: any) {
    models.value = []
    pagination.total = 0
    const errorMsg =
      (error instanceof Error ? error.message : String(error)) || t('models.loadModelsFailed')
    pageError.value = {
      type: ApiErrorType.UNKNOWN,
      code: 500,
      message: errorMsg,
      originalError: error,
    }
    showErrorMsg(errorMsg)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadModels()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadModels()
}

const handlePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadModels()
}

const resetFormModel = () => {
  formModel.id = undefined
  formModel.name = ''
  formModel.modelId = ''
  formModel.provider = ''
  formModel.type = 'talk'
  formModel.description = ''
  formModel.capabilities = ['chat']
  formModel.enabled = true
}

const handleCreate = () => {
  editingModel.value = null
  resetFormModel()
  editDialogVisible.value = true
}

const handleEdit = (row: AIModel) => {
  editingModel.value = row
  formModel.id = row.id
  formModel.name = row.name
  formModel.modelId = row.modelId
  formModel.provider = row.provider
  formModel.type = row.type
  formModel.description = row.description
  formModel.capabilities = [...(row.capabilities || [])]
  formModel.enabled = row.enabled
  editDialogVisible.value = true
}

const handleSave = () => {
  if (!formRef.value) return
  formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      const payload: Partial<AIModel> = {
        name: formModel.name?.trim() || '',
        modelId: formModel.modelId?.trim() || '',
        provider: formModel.provider?.trim() || '',
        type: formModel.type,
        description: formModel.description,
        capabilities: formModel.capabilities || [],
        enabled: !!formModel.enabled,
      }
      let _res
      if (editingModel.value) {
        _res = await updateModel(editingModel.value.id, payload)
      } else {
        _res = await createModel(payload)
      }
      await handleResult(
        editingModel.value ? updateModel(editingModel.value.id, payload) : createModel(payload),
        {
          successMessage: t('common.success'),
          errorMessage: t('common.failed'),
          onSuccess: () => {
            editDialogVisible.value = false
            loadModels()
          },
        }
      )
    } catch (error: any) {
      showErrorMsg((error instanceof Error ? error.message : String(error)) || t('common.failed'))
    } finally {
      saving.value = false
    }
  })
}

const handleDelete = async (row: AIModel) => {
  const confirmed = await confirmDelete(row.name || t('common.item'))
  if (!confirmed) return

  await handleResult(deleteModel(row.id), {
    successMessage: t('common.deleteSuccess'),
    errorMessage: t('common.failed'),
    onSuccess: () => {
      loadModels()
    },
  })
}

const handleToggle = async (row: AIModel) => {
  const target = !row.enabled
  await handleResult(updateModel(row.id, { enabled: target }), {
    successMessage: target ? t('models.enableSuccess') : t('models.disableSuccess'),
    errorMessage: t('common.failed'),
    onSuccess: () => {
      loadModels()
    },
  })
}

const handleTest = async (row: AIModel) => {
  await handleResult(testModel(row.id), {
    successMessage: (data?: any) => {
      const message = (data as Record<string, unknown>)?.message as string
      return message || t('models.testSuccess')
    },
    errorMessage: (data?: any) => {
      const message = (data as Record<string, unknown>)?.message as string
      return message || t('models.testFailed')
    },
  })
}

// API对接相关
const apiInfoDialogVisible = ref(false)
const selectedModelForApi = ref<AIModel | null>(null)
const codeExampleTab = ref('curl')
const apiBaseUrl = computed(() => window.location.origin)

const handleShowApiInfo = (row: AIModel) => {
  selectedModelForApi.value = row
  apiInfoDialogVisible.value = true
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('common.copySuccess'))
  } catch {
    ElMessage.error(t('common.copyFailed'))
  }
}

const generateCurlExample = (model: AIModel): string => {
  return `curl ${apiBaseUrl.value}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "${model.modelId}",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'`
}

const generatePythonExample = (model: AIModel): string => {
  return `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="${apiBaseUrl.value}/v1"
)

response = client.chat.completions.create(
    model="${model.modelId}",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)`
}

const generateNodejsExample = (model: AIModel): string => {
  return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'YOUR_API_KEY',
  baseURL: '${apiBaseUrl.value}/v1'
});

async function main() {
  const response = await client.chat.completions.create({
    model: '${model.modelId}',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ]
  });
  
  logger.debug(response.choices[0].message.content);
}

main();`
}

const goToApiTokens = () => {
  apiInfoDialogVisible.value = false
  router.push('/api-tokens')
}

const goToApiDocs = () => {
  apiInfoDialogVisible.value = false
  router.push('/api-docs')
}

const goToApiStats = () => {
  apiInfoDialogVisible.value = false
  router.push('/api-usage')
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped lang="scss">
.model-manager {
  width: 100%;
  margin: 0 auto;
  padding: 20px;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 16px;

    .title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 4px;
    }

    .subtitle {
      margin: 0;
      color: var(--el-text-color-regular);
      font-size: 14px;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;

    .search-input {
      width: 260px;
    }

    .provider-select {
      width: 180px;
    }
  }

  .model-card {
    margin-top: 8px;
  }

  .model-name-cell {
    display: flex;
    flex-direction: column;

    .model-display-name {
      font-weight: 600;
    }

    .model-id {
      font-size: 12px;
      color: var(--el-text-color-regular);
    }
  }

  .cap-tag {
    margin-right: 4px;
    margin-bottom: 2px;
  }

  .pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}

@media (width <= 768px) {
  .model-manager {
    padding: 12px;

    .header {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-actions {
      flex-wrap: wrap;

      .search-input,
      .provider-select {
        width: 100%;
      }
    }
  }
}

// API对接对话框样式
.api-info-dialog {
  .api-alert {
    margin-bottom: 20px;
  }

  .api-descriptions {
    margin-bottom: 16px;

    code {
      background: var(--el-fill-color-light);
      padding: 2px 8px;
      border-radius: var(--global-border-radius);
      font-family: var(--font-family-mono);
    }
  }

  .api-endpoints {
    .endpoint-item {
      padding: 16px;
      background: var(--el-fill-color-lighter);
      border-radius: var(--global-border-radius);
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .endpoint-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .endpoint-label {
          font-weight: 600;
          color: var(--el-text-color-primary);
        }
      }

      .endpoint-url {
        display: flex;
        align-items: center;
        gap: 12px;

        code {
          flex: 1;
          background: var(--el-bg-color);
          padding: 8px 12px;
          border-radius: var(--global-border-radius);
          font-family: var(--font-family-mono);
          font-size: 13px;
          color: var(--el-color-primary);
          border: var(--unified-border);
        }
      }
    }
  }

  .code-tabs {
    .code-block {
      position: relative;
      background: var(--color-gray-1e1e1e);
      border-radius: var(--global-border-radius);
      overflow: hidden;

      pre {
        margin: 0;
        padding: 16px;
        overflow-x: auto;

        code {
          font-family: var(--font-family-mono);
          font-size: 13px;
          line-height: 1.6;
          color: var(--color-neutral-300);
          white-space: pre;
        }
      }

      .copy-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: var(--color-white-10);
        color: var(--el-bg-color);
        border: none;

        &:hover {
          background: var(--color-white-20);
        }
      }
    }
  }

  .quick-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;

    .el-button {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
}
</style>
