<template>
  <div class="image-gen-i2i">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('imageGen.i2i.title') }}</span>
          <el-tag type="success" size="small">{{ t('imageGen.i2i.tag') }}</el-tag>
        </div>
      </template>

      <div class="card-inner">
        <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
          <el-form-item :label="t('imageGen.i2i.form.referenceImage')" prop="images">
            <el-upload v-model:file-list="fileList" :auto-upload="false" :limit="1" accept="image/*"
              :on-change="handleFileChange" :on-remove="handleFileRemove">
              <el-button>{{ t('imageGen.i2i.form.selectImage') }}</el-button>
              <template #tip>
                <div class="el-upload__tip">{{ t('imageGen.i2i.form.uploadTip') }}</div>
              </template>
            </el-upload>
          </el-form-item>

          <el-form-item :label="t('imageGen.i2i.form.prompt')" prop="prompt">
            <el-input v-model="form.prompt" type="textarea" :rows="4"
              :placeholder="t('imageGen.i2i.form.promptPlaceholder')" maxlength="1000" show-word-limit />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="generating || loading" @click="handleGenerate" size="large">
              <el-icon>
                <Mic />
              </el-icon>
              {{ t('imageGen.i2i.buttons.generate') }}
            </el-button>
            <el-button @click="handleReset">{{ t('imageGen.i2i.buttons.reset') }}</el-button>
          </el-form-item>
        </el-form>

        <div v-if="result" class="result-section">
          <el-divider>{{ t('imageGen.i2i.result') }}</el-divider>
          <div class="result-meta">
            <el-tag v-if="typeof result.total_tokens === 'number'" type="info" size="small">
              Tokens：{{ result.total_tokens }}
            </el-tag>
            <el-tag v-if="result.request_id" type="info" size="small">
              Request ID：{{ result.request_id }}
            </el-tag>
          </div>

          <div class="image-grid" v-if="(result.image_urls || []).length">
            <el-image v-for="(url, idx) in (result.image_urls || [])" :key="`${url}-${idx}`" :src="url"
              :preview-src-list="result.image_urls || []" fit="contain" class="image-item" />
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
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
// 使用正确的图标，Magic图标不存在，使用Mic图标替代
import { Mic } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { generateDashScopeImageToImage } from '@/api/services/aiGeneration.service'
import { uploadFormFile } from '@/api/file-upload'
import type { FormInstance } from 'element-plus'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()

const props = defineProps<{
  userUuid: string
  /** 会话 ID，可选，用于与聊天记录串联 */
  chatId?: string | number
  /** 自定义参数（如 negative_prompt 等），从大模型配置 variables 透传 */
  zidingyican?: Array<{ name: string; desc?: string; value: unknown }>
}>()

const formRef = ref<FormInstance | null>(null)
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const generating = ref(false)
const fileList = ref<UploadFile[]>([])
const imageUrl = ref('')
const result = ref<{ image_urls?: string[]; total_tokens?: number; request_id?: string } | null>(null)

const form = reactive({
  prompt: '',
})

const rules = {
  images: [{ required: true, message: t('imageGen.i2i.messages.imageRequired'), trigger: 'change' }],
  prompt: [{ required: true, message: t('imageGen.qwen.messages.promptRequired'), trigger: 'blur' }],
}

const handleFileChange = async (file: UploadFile) => {
  if (file.raw) {
    try {
      const uploadResponse = await uploadFormFile(file.raw)
      if (uploadResponse.success && uploadResponse.data?.url) {
        imageUrl.value = uploadResponse.data.url
      }
    } catch (_error) {
      ElMessage.error(t('imageGen.i2i.messages.uploadFailed'))
    }
  }
}

const handleFileRemove = () => {
  imageUrl.value = ''
}

const handleGenerate = async () => {
  if (!formRef.value || !imageUrl.value) {
    ElMessage.warning(t('imageGen.i2i.messages.uploadFirst'))
    return
  }
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      result.value = null
      generating.value = true
      try {
        const response = await executeApi(() =>
          generateDashScopeImageToImage({
            images: imageUrl.value ? [imageUrl.value] : [],
            prompt: form.prompt,
            user_uuid: props.userUuid,
            ...(props.chatId ? { chat_id: String(props.chatId) } : {}),
            ...(props.zidingyican && props.zidingyican.length > 0
              ? { zidingyican: props.zidingyican }
              : {}),
          })
        )
        // executeApi 返回的是 DashScopeImageToImageResponse | null（已提取 data）
        if (response && response.image_urls) {
          result.value = response
          ElMessage.success(t('imageGen.qwen.messages.generateSuccess'))
        }
      } finally {
        generating.value = false
      }
    }
  })
}

const handleReset = () => {
  formRef.value?.resetFields()
  fileList.value = []
  imageUrl.value = ''
  result.value = null
}
</script>

<style scoped lang="scss">
.image-gen-i2i {
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

  .result-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .image-item {
    width: 100%;
    height: 220px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color-blank);
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
