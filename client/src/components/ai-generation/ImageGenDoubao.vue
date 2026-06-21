<template>
  <div class="image-gen-doubao">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('imageGen.doubao.title') }}</span>
          <el-tag type="info" size="small">{{ t('imageGen.doubao.tag') }}</el-tag>
        </div>
      </template>
      <el-form :model="form" ref="formRef" label-width="120px">
        <el-form-item :label="t('imageGen.doubao.form.prompt')" prop="prompt">
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="4"
            :placeholder="t('imageGen.doubao.form.promptPlaceholder')"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleGenerate">
            {{ t('imageGen.doubao.buttons.generate') }}
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="result" class="result">
        <el-image :src="result.image_url" fit="contain" style="max-width: 100%" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateDoubaoImage } from '@/api/services/aiGeneration.service'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()

const props = defineProps<{ userUuid: string }>()
const formRef = ref<FormInstance | null>(null)
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const result = ref<{ image_url?: string } | null>(null)

const form = reactive({ prompt: '' })

const handleGenerate = async () => {
  if (!form.prompt) {
    ElMessage.warning(t('imageGen.doubao.messages.promptRequired'))
    return
  }
  const response = await executeApi(() => generateDoubaoImage({ prompt: form.prompt, user_uuid: props.userUuid }))
  // executeApi 返回的是 DoubaoImageGenResponse | null（已提取 data）
  if (response && response.image_url) {
    result.value = response
    ElMessage.success(t('imageGen.qwen.messages.generateSuccess'))
  }
}
</script>
