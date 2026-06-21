<template>
  <div class="model-3d-gen-hunyuan">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('model3dGen.title') }}</span>
          <el-tag type="primary" size="small">{{ t('model3dGen.tag') }}</el-tag>
        </div>
      </template>
      <el-tabs v-model="activeMode">
        <el-tab-pane :label="t('model3dGen.tabs.text')" name="text">
          <el-form :model="textForm" ref="textFormRef" label-width="120px">
            <el-form-item :label="t('model3dGen.form.prompt')" prop="prompt">
              <el-input
                v-model="textForm.prompt"
                type="textarea"
                :rows="4"
                :placeholder="t('model3dGen.form.promptPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('model3dGen.form.format')">
              <el-select v-model="textForm.format">
                <el-option label="OBJ" value="OBJ" />
                <el-option label="GLB" value="GLB" />
                <el-option label="STL" value="STL" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="textLoading" @click="handleTextGenerate">
                {{ t('model3dGen.buttons.generate') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane :label="t('model3dGen.tabs.image')" name="image">
          <el-form :model="imageForm" ref="imageFormRef" label-width="120px">
            <el-form-item :label="t('model3dGen.form.uploadImage')">
              <el-upload
                :auto-upload="false"
                :limit="1"
                accept="image/*"
                :on-change="handleImageUpload"
              >
                <el-button>{{ t('visionAnalysis.form.selectImage') }}</el-button>
              </el-upload>
            </el-form-item>
            <el-form-item :label="t('model3dGen.form.format')">
              <el-select v-model="imageForm.format">
                <el-option label="OBJ" value="OBJ" />
                <el-option label="GLB" value="GLB" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="imageLoading" @click="handleImageGenerate">
                {{ t('model3dGen.buttons.generate') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <div v-if="jobId" class="job-status">
        <el-alert :title="t('videoGen.kling.messages.taskId', { taskId: jobId })" type="info" />
        <el-button @click="checkJobStatus" style="margin-top: 12px">{{ t('videoGen.kling.buttons.checkStatus') }}</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { submitHunyuan3DTask, queryHunyuan3DStatus } from '@/api/services/aiGeneration.service'
import { ElMessage } from 'element-plus'
import type { UploadFile, FormInstance } from 'element-plus'

const { t } = useI18n()

const props = defineProps<{ userUuid: string }>()
const activeMode = ref('text')
const textFormRef = ref<FormInstance | null>(null)
const imageFormRef = ref<FormInstance | null>(null)
const textLoading = ref(false)
const imageLoading = ref(false)
const imageUrl = ref('')
const jobId = ref('')

const textForm = reactive({
  prompt: '',
  format: 'OBJ',
})

const imageForm = reactive({
  format: 'OBJ',
})

const handleImageUpload = async (file: UploadFile) => {
  if (file.raw) {
    const reader = new FileReader()
    reader.onload = e => {
      imageUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(file.raw)
  }
}

const handleTextGenerate = async () => {
  if (!textForm.prompt) {
    ElMessage.warning(t('model3dGen.messages.promptRequired'))
    return
  }
  textLoading.value = true
  try {
    const response = await submitHunyuan3DTask({
      Prompt: textForm.prompt,
      ResultFormat: textForm.format,
      user_uuid: props.userUuid,
    })
    if (response.success && response.data?.job_id) {
      jobId.value = response.data.job_id
      ElMessage.success(t('videoGen.kling.messages.taskSubmitted'))
    }
  } catch (_error) {
    ElMessage.error(t('model3dGen.messages.generateFailed'))
  } finally {
    textLoading.value = false
  }
}

const handleImageGenerate = async () => {
  if (!imageUrl.value) {
    ElMessage.warning(t('visionAnalysis.messages.uploadAndPromptRequired'))
    return
  }
  imageLoading.value = true
  try {
    const response = await submitHunyuan3DTask({
      ImageBase64: imageUrl.value.split(',')[1],
      ResultFormat: imageForm.format,
      user_uuid: props.userUuid,
    })
    if (response.success && response.data?.job_id) {
      jobId.value = response.data.job_id
      ElMessage.success(t('videoGen.kling.messages.taskSubmitted'))
    }
  } catch (_error) {
    ElMessage.error(t('model3dGen.messages.generateFailed'))
  } finally {
    imageLoading.value = false
  }
}

const checkJobStatus = async () => {
  if (!jobId.value) return
  try {
    const response = await queryHunyuan3DStatus(jobId.value)
    if (response.success) {
      ElMessage.info(t('videoGen.oneClick.messages.status', { status: response.data?.status }))
      if (response.data?.result_url) {
        ElMessage.success(t('videoGen.qwen.messages.generateSuccess'))
      }
    }
  } catch (_error) {
    ElMessage.error(t('videoGen.oneClick.messages.checkFailed'))
  }
}
</script>
