<template>
  <div class="image-gen-qwen">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('imageGen.qwen.title') }}</span>
          <el-tag type="primary" size="small">{{ t('imageGen.qwen.tag') }}</el-tag>
        </div>
      </template>

      <div class="card-inner">
        <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
          <el-form-item :label="t('imageGen.qwen.form.model')" prop="modelId">
            <el-select
              v-model="form.modelId"
              :placeholder="t('imageGen.qwen.form.modelPlaceholder')"
              style="width: 100%"
            >
              <el-option
                v-for="m in imageModels"
                :key="m.id"
                :label="m.displayName || m.name"
                :value="m.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item :label="t('imageGen.qwen.form.prompt')" prop="prompt">
            <el-input
              v-model="form.prompt"
              type="textarea"
              :rows="4"
              :placeholder="t('imageGen.qwen.form.promptPlaceholder')"
              maxlength="1000"
              show-word-limit
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="generating || loading" @click="handleGenerate" size="large">
              <el-icon><Mic /></el-icon>
              {{ t('imageGen.qwen.buttons.generate') }}
            </el-button>
            <el-button @click="handleReset">{{ t('imageGen.qwen.buttons.reset') }}</el-button>
          </el-form-item>
        </el-form>

        <!-- 生成结果 -->
        <div v-if="result" class="result-section">
          <el-divider>{{ t('imageGen.qwen.result') }}</el-divider>
          <div class="result-meta">
            <el-tag v-if="typeof result.total_tokens === 'number'" type="info" size="small">
              Tokens：{{ result.total_tokens }}
            </el-tag>
            <el-tag v-if="result.request_id" type="info" size="small">
              Request ID：{{ result.request_id }}
            </el-tag>
          </div>
          <div class="image-result">
            <el-image
              :src="result.image_url"
              :preview-src-list="result.image_url ? [result.image_url] : []"
              fit="contain"
              style="max-width: 100%; max-height: 600px"
            />
            <div class="result-actions">
              <el-button @click="handleDownload">{{ t('imageGen.qwen.buttons.download') }}</el-button>
              <el-button @click="handleCopyUrl">{{ t('imageGen.qwen.buttons.copyUrl') }}</el-button>
            </div>
          </div>
        </div>

        <div v-if="generating || loading" class="gen-loading" aria-live="polite" aria-busy="true">
          <div class="gen-loading__panel">
            <div class="gen-loading__spinner" />
            <div class="gen-loading__text">{{ t('imageGen.qwen.messages.generating') || '生成中...' }}</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
// 使用正确的图标，Magic图标不存在，使用Mic图标替代
import { Mic } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { getAvailableModels, type AIModelInfo } from '@/api/models'
import type { FormInstance } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useApiError } from '@/composables/useApiError'
import type { ApiResponse } from '@/types'

const props = defineProps<{
  userUuid: string
}>()

const { t } = useI18n()
const formRef = ref<FormInstance | null>(null)
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const generating = ref(false)
const imageModels = ref<AIModelInfo[]>([])
const result = ref<{ image_url?: string; total_tokens?: number; request_id?: string } | null>(null)

const form = reactive({
  modelId: '',
  prompt: '',
})

const selectedModel = computed(() =>
  imageModels.value.find(m => m.id === form.modelId) as (AIModelInfo & { remark?: string; quest_type?: string }) | undefined
)

const rules = {
  modelId: [{ required: true, message: t('imageGen.qwen.messages.modelRequired'), trigger: 'change' }],
  prompt: [{ required: true, message: t('imageGen.qwen.messages.promptRequired'), trigger: 'blur' }],
}

onMounted(async () => {
  try {
    const resp = await getAvailableModels()
    const all = resp.success && Array.isArray(resp.data) ? resp.data : []
    imageModels.value = all.filter(m => {
      const provider = (m.provider || '').toLowerCase()
      const name = (m.name || '').toLowerCase()
      const displayName = (m.displayName || '').toLowerCase()
      return m.supportsImages === true && (
        provider.includes('qwen') ||
        provider.includes('dashscope') ||
        name.includes('qwen') ||
        displayName.includes('通义') ||
        displayName.includes('万相')
      )
    })
    if (!form.modelId && imageModels.value.length > 0) {
      form.modelId = imageModels.value[0].id
    }
  } catch (e) { console.error(e) }
})

const handleGenerate = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      result.value = null
      generating.value = true
      try {
        const model = selectedModel.value
        if (!model?.remark) {
          throw new Error(
            t('imageGen.qwen.messages.modelRemarkMissing') ||
              t('aiGenImageGenQwen.qwenRemarkMissing')
          )
        }

        const questType = (model.quest_type || '').toLowerCase().trim()
        if (questType === 'ws' || questType === 'websocket' || questType === 'web_socket') {
          throw new Error(
            t('imageGen.qwen.messages.wsNotSupported') ||
              t('aiGenImageGenQwen.websocketNotSupport')
          )
        }

        const path = model.remark.startsWith('/') ? model.remark : `/${model.remark}`
        const resp = await executeApi(() =>
          (request as { post: (url: string, data?: any) => Promise<ApiResponse<unknown>> }).post(path, {
            prompt: form.prompt,
            user_uuid: props.userUuid,
          })
        ) as unknown as {
          data?: { image_url?: string; total_tokens?: number; request_id?: string; image_urls?: string[] }
          image_url?: string
          image_urls?: string[]
          total_tokens?: number
          request_id?: string
        } | null

        if (resp) {
          const payload = resp.data ?? resp
          const imageUrl =
            payload.image_url ||
            (Array.isArray(payload.image_urls) && payload.image_urls.length > 0
              ? payload.image_urls[0]
              : undefined)
          if (imageUrl) {
            result.value = {
              image_url: imageUrl,
              total_tokens: payload.total_tokens,
              request_id: payload.request_id,
            }
            ElMessage.success(t('imageGen.qwen.messages.generateSuccess'))
          }
        }
      } finally {
        generating.value = false
      }
    }
  })
}

const handleReset = () => {
  formRef.value?.resetFields()
  result.value = null
}

const handleDownload = () => {
  if (result.value?.image_url) {
    window.open(result.value.image_url, '_blank')
  }
}

const handleCopyUrl = async () => {
  if (result.value?.image_url) {
    await navigator.clipboard.writeText(result.value.image_url)
    ElMessage.success(t('imageGen.qwen.messages.copySuccess'))
  }
}
</script>

<style scoped lang="scss">
.image-gen-qwen {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }

  .card-inner {
    position: relative;
    min-height: 120px;
  }

  .result-section {
    margin-top: 24px;
  }

  .result-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .image-result {
    text-align: center;

    .result-actions {
      margin-top: 16px;
      display: flex;
      gap: 12px;
      justify-content: center;
    }
  }

  .gen-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-white-75);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    pointer-events: all;
  }

  :global(html.dark) .gen-loading {
    background: var(--color-black-55);
  }

  .gen-loading__panel {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
  }

  .gen-loading__spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--el-border-color);
    border-top-color: var(--el-color-primary);
    animation: gen-spin 0.9s linear infinite;
    flex: 0 0 auto;
  }

  .gen-loading__text {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  @keyframes gen-spin {
    to {
      transform: rotate(360deg);
    }
  }
}
</style>
