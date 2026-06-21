<template>
  <div class="image-gen-jimeng">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('imageGen.jimeng.title') }}</span>
          <el-tag type="success" size="small">{{ t('imageGen.jimeng.tag') }}</el-tag>
        </div>
      </template>
      <div class="card-inner">
        <el-form :model="form" ref="formRef" label-width="120px">
          <el-form-item :label="t('imageGen.jimeng.form.prompt')" prop="prompt">
            <el-input
              v-model="form.prompt"
              type="textarea"
              :rows="4"
              :placeholder="t('imageGen.jimeng.form.promptPlaceholder')"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="generating || loading" @click="handleGenerate">
              {{ t('imageGen.jimeng.buttons.generate') }}
            </el-button>
          </el-form-item>
        </el-form>

        <div v-if="result" class="result">
          <div class="result-meta">
            <el-tag v-if="typeof result.total_tokens === 'number'" type="info" size="small">
              Tokens：{{ result.total_tokens }}
            </el-tag>
            <el-tag v-if="result.request_id" type="info" size="small">
              Request ID：{{ result.request_id }}
            </el-tag>
          </div>

          <el-image
            v-for="(url, idx) in (result.image_urls || [])"
            :key="`${url}-${idx}`"
            :src="url"
            :preview-src-list="result.image_urls || []"
            fit="contain"
            class="image-item"
          />
        </div>

        <div v-if="generating || loading" class="gen-loading" aria-live="polite" aria-busy="true">
          <div class="gen-loading__panel">
            <div class="gen-loading__spinner" />
            <div class="gen-loading__text">{{ t('imageGen.jimeng.messages.generating') || '生成中...' }}</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateJimeng4Image } from '@/api/services/aiGeneration.service'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()

const props = defineProps<{ userUuid: string }>()
const formRef = ref<FormInstance | null>(null)
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const generating = ref(false)
const result = ref<{
  image_urls?: string[]
  total_tokens?: number
  request_id?: string
} | null>(null)

const form = reactive({ prompt: '' })

const handleGenerate = async () => {
  if (!form.prompt) {
    ElMessage.warning(t('imageGen.jimeng.messages.promptRequired'))
    return
  }
  result.value = null
  generating.value = true
  try {
    const response = await executeApi(() =>
      generateJimeng4Image({
        prompt: form.prompt,
        user_uuid: props.userUuid,
      })
    )
    // executeApi 返回的是 Jimeng4ImageGenResponse | null（已提取 data）
    if (response && response.image_urls) {
      result.value = response
      ElMessage.success(t('imageGen.qwen.messages.generateSuccess'))
    }
  } finally {
    generating.value = false
  }
}
</script>

<style scoped lang="scss">
.image-gen-jimeng {
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

  .result {
    margin-top: 8px;
  }

  .result-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 12px 0;
  }

  .image-item {
    width: 100%;
    max-width: 100%;
    margin-bottom: 12px;
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
