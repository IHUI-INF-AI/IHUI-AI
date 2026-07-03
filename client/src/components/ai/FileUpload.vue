<template>
  <div class="file-upload-container">
    <div v-if="uploadedFiles.length > 0" class="uploaded-files-preview">
      <div v-for="file in uploadedFiles" :key="file.id" class="file-preview-item">
        <div v-if="file.type?.startsWith('image/')" class="image-preview">
          <img :src="file.url" :alt="file.name" loading="lazy" />
          <div v-if="uploading" class="upload-progress-overlay">
            <div class="upload-progress-bar" :style="{ width: `${uploadProgress}%` }"></div>
            <span class="upload-progress-text">{{ Math.round(uploadProgress) }}%</span>
          </div>
          <ElButton
            class="remove-file-btn"
            circle
            size="small"
            @click="removeFile(index)"
            :disabled="uploading"
          >
            <ElIcon><Close /></ElIcon>
          </ElButton>
        </div>
        <div v-else-if="file.type?.startsWith('video/')" class="video-preview">
          <video :src="file.url" controls preload="none"></video>
          <div v-if="uploading" class="upload-progress-overlay">
            <div class="upload-progress-bar" :style="{ width: `${uploadProgress}%` }"></div>
            <span class="upload-progress-text">{{ Math.round(uploadProgress) }}%</span>
          </div>
          <ElButton
            class="remove-file-btn"
            circle
            size="small"
            @click="removeFile(index)"
            :disabled="uploading"
          >
            <ElIcon><Close /></ElIcon>
          </ElButton>
        </div>
      </div>
    </div>

    <div class="upload-actions">
      <ElUpload
        ref="uploadRef"
        :auto-upload="false"
        :show-file-list="false"
        :accept="acceptTypes"
        :on-change="handleFileChange"
        :disabled="uploading"
        multiple
      >
        <template #trigger>
          <ElButton :loading="uploading" :icon="uploading ? Loading : Picture">
            {{ uploading ? t('fileUpload.uploading') : t('fileUpload.selectImage') }}
          </ElButton>
        </template>
      </ElUpload>

      <ElUpload
        ref="videoUploadRef"
        :auto-upload="false"
        :show-file-list="false"
        accept="video/*"
        :on-change="handleVideoChange"
        :disabled="uploading"
        multiple
      >
        <template #trigger>
          <ElButton :loading="uploading" :icon="uploading ? Loading : VideoCamera">
            {{ uploading ? t('fileUpload.uploading') : t('fileUpload.selectVideo') }}
          </ElButton>
        </template>
      </ElUpload>

      <ElButton v-if="uploadedFiles.length > 0" @click="clearUploadedFiles" :icon="Delete">
        {{ t('fileUpload.clearFiles') }}
      </ElButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElUpload, ElIcon, ElMessage } from 'element-plus'
import { Picture, VideoCamera, Delete, Loading, Close } from '@element-plus/icons-vue'
import { useFileUpload } from '@/composables/useFileUpload'
import type { UploadFile } from 'element-plus'
import type { FileInfo } from '@/api/services/file.service'

const { t } = useI18n()

interface Props {
  acceptTypes?: string
  maxSize?: number
  maxCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  acceptTypes: 'image/*',
  maxSize: 10 * 1024 * 1024,
  maxCount: 9,
})

const emit = defineEmits<{
  uploadSuccess: [files: FileInfo[]]
  uploadError: [error: Error]
}>()

const { uploading, uploadProgress, uploadedFiles, upload, clearUploadedFiles } = useFileUpload()

const uploadRef = ref<HTMLElement | null>(null)
const videoUploadRef = ref<HTMLElement | null>(null)

const handleFileChange = async (file: UploadFile) => {
  if (!file.raw) return

  if (file.raw.size > props.maxSize) {
    ElMessage.error(t('fileUpload.imageSizeExceeded', { size: props.maxSize / 1024 / 1024 }))
    return
  }

  if (uploadedFiles.value.length >= props.maxCount) {
    ElMessage.error(t('fileUpload.maxFilesReached', { count: props.maxCount }))
    return
  }

  try {
    const result = await upload(file.raw, {
      maxFileSize: props.maxSize,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    })

    if (result) {
      emit('uploadSuccess', uploadedFiles.value)
    }
  } catch (error) {
    emit('uploadError', error as Error)
  }
}

const handleVideoChange = async (file: UploadFile) => {
  if (!file.raw) return

  if (file.raw.size > props.maxSize) {
    ElMessage.error(t('fileUpload.videoSizeExceeded', { size: props.maxSize / 1024 / 1024 }))
    return
  }

  if (uploadedFiles.value.length >= props.maxCount) {
    ElMessage.error(t('fileUpload.maxFilesReached', { count: props.maxCount }))
    return
  }

  try {
    const result = await upload(file.raw, {
      maxFileSize: props.maxSize,
      allowedTypes: ['video/mp4', 'video/webm', 'video/ogg'],
    })

    if (result) {
      emit('uploadSuccess', uploadedFiles.value)
    }
  } catch (error) {
    emit('uploadError', error as Error)
  }
}

const removeFile = (index: number) => {
  uploadedFiles.value.splice(index, 1)
}
</script>

<style scoped>
.file-upload-container {
  width: 100%;
}

.uploaded-files-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.file-preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.image-preview,
.video-preview {
  position: relative;
  width: 100%;
  height: 100%;
}

.image-preview img,
.video-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-progress-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-black-50);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--app-button-text-on-primary);
}

.upload-progress-bar {
  width: 80%;
  height: 4px;
  background: var(--color-white-30);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  margin-bottom: 8px;
}

.upload-progress-bar::after {
  content: '';
  display: block;
  height: 100%;
  background: var(--el-color-primary);
  transition: width 0.3s;
}

.upload-progress-text {
  font-size: 12px;
  font-weight: 500;
}

.remove-file-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: calc(var(--z-base) + 9);
  background: var(--color-black-60);
  border: none;
  color: var(--app-button-text-on-primary);
}

.remove-file-btn:hover {
  background: var(--color-black-80);
}

.upload-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.upload-actions .el-button {
  flex-shrink: 0;
}
</style>
