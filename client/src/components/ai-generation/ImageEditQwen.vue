<template>
  <div class="image-edit-qwen">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('imageGen.edit.title') }}</span>
          <el-tag type="warning" size="small">{{ t('imageGen.edit.tag') }}</el-tag>
        </div>
      </template>

      <el-alert
        :title="t('imageGen.edit.alertTitle')"
        :description="t('imageGen.edit.alertDesc')"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      />

      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item :label="t('imageGen.edit.form.image')" prop="image">
          <el-upload
            v-model:file-list="fileList"
            :auto-upload="false"
            :limit="1"
            accept="image/*"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
          >
            <el-button>{{ t('imageGen.edit.form.selectImage') }}</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item :label="t('imageGen.edit.form.text')" prop="text">
          <el-input
            v-model="form.text"
            type="textarea"
            :rows="4"
            :placeholder="t('imageGen.edit.form.textPlaceholder')"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleEdit" size="large">
            <el-icon><Edit /></el-icon>
            {{ t('imageGen.edit.buttons.edit') }}
          </el-button>
          <el-button @click="handleReset">{{ t('imageGen.edit.buttons.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <div v-if="result" class="result-section">
        <el-divider>{{ t('imageGen.edit.result') }}</el-divider>
        <div class="image-result">
          <el-image
            :src="result.image_url"
            :preview-src-list="[result.image_url]"
            fit="contain"
            style="max-width: 100%; max-height: 600px"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { editDashScopeImage } from '@/api/services/aiGeneration.service'
import { uploadFormFile } from '@/api/file-upload'
import type { FormInstance } from 'element-plus'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()

const props = defineProps<{
  userUuid: string
}>()

const formRef = ref<FormInstance | null>(null)
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const fileList = ref<UploadFile[]>([])
const imageUrl = ref('')
const result = ref<{ image_url?: string } | null>(null)

const form = reactive({
  text: '',
})

const rules = {
  image: [{ required: true, message: t('imageGen.edit.messages.imageRequired'), trigger: 'change' }],
  text: [{ required: true, message: t('imageGen.edit.messages.textRequired'), trigger: 'blur' }],
}

const handleFileChange = async (file: UploadFile) => {
  if (file.raw) {
    try {
      const uploadResponse = await uploadFormFile(file.raw)
      if (uploadResponse.success && uploadResponse.data?.url) {
        imageUrl.value = uploadResponse.data.url
      }
    } catch (error) {
      logger.error('Image file upload failed:', error)
      ElMessage.error(t('imageGen.edit.messages.uploadFailed'))
    }
  }
}

const handleFileRemove = () => {
  imageUrl.value = ''
}

const handleEdit = async () => {
  if (!formRef.value || !imageUrl.value) {
    ElMessage.warning(t('imageGen.edit.messages.uploadFirst'))
    return
  }
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      const response = await executeApi(() => editDashScopeImage({
        messages: [
          {
            role: 'user',
            content: [{ image: imageUrl.value }, { text: form.text }],
          },
        ],
        user_uuid: props.userUuid,
      }))
      // executeApi 返回的是 DashScopeImageEditResponse | null（已提取 data）
      if (response && response.image_url) {
        result.value = response
        ElMessage.success(t('imageGen.edit.messages.editSuccess'))
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
.image-edit-qwen {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }
}
</style>
