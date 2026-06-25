<template>
  <div class="vision-analysis">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('visionAnalysis.title') }}</span>
          <el-tag type="primary" size="small">{{ t('visionAnalysis.tag') }}</el-tag>
        </div>
      </template>
      <el-form :model="form" ref="formRef" label-width="120px">
        <el-form-item :label="t('visionAnalysis.form.upload')" prop="images">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept="image/*"
            :on-change="handleImageUpload"
          >
            <el-button>{{ t('visionAnalysis.form.selectImage') }}</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item :label="t('visionAnalysis.form.prompt')" prop="prompt">
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="4"
            :placeholder="t('visionAnalysis.form.promptPlaceholder')"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleAnalyze">{{ t('visionAnalysis.buttons.analyze') }}</el-button>
        </el-form-item>
      </el-form>
      <div v-if="result" class="result">
        <el-divider>{{ t('visionAnalysis.result.title') }}</el-divider>
        <div class="analysis-content">
          <p v-if="result.reasoning" class="reasoning">
            <strong>{{ t('visionAnalysis.result.reasoning') }}</strong>
            {{ result.reasoning }}
          </p>
          <p v-if="result.answer" class="answer">
            <strong>{{ t('visionAnalysis.result.answer') }}</strong>
            {{ result.answer }}
          </p>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { chatDashScopeVision } from '@/api/services/aiGeneration.service'
import { ElMessage } from 'element-plus'
import type { UploadFile, FormInstance } from 'element-plus'
import { uploadFormFile } from '@/api/file/file-upload'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()

const props = defineProps<{ userUuid: string }>()
const formRef = ref<FormInstance | null>(null)
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const imageUrl = ref('')
const result = ref<{ reasoning?: string; answer?: string } | null>(null)

const form = reactive({
  prompt: '',
})

const handleImageUpload = async (file: UploadFile) => {
  if (file.raw) {
    try {
      const uploadResponse = await uploadFormFile(file.raw)
      if (uploadResponse.success && uploadResponse.data?.url) {
        imageUrl.value = uploadResponse.data.url
      }
    } catch (_error) {
      ElMessage.error(t('visionAnalysis.messages.uploadFailed'))
    }
  }
}

const handleAnalyze = async () => {
  if (!imageUrl.value || !form.prompt) {
    ElMessage.warning(t('visionAnalysis.messages.uploadAndPromptRequired'))
    return
  }
  const response = await executeApi(() => chatDashScopeVision({
    images: imageUrl.value,
    prompt: form.prompt,
    user_uuid: props.userUuid,
  }))
  // executeApi 返回的是 DashScopeVisionResponse | null（已提取 data）
  if (response) {
    result.value = response
    ElMessage.success(t('visionAnalysis.messages.analyzeSuccess'))
  }
}
</script>

<style scoped lang="scss">
.analysis-content {
  .reasoning,
  .answer {
    line-height: 1.8;
    margin-bottom: 16px;
    white-space: pre-wrap;
  }
}
</style>
