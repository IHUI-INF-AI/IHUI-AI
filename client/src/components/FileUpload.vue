<template>
  <div class="file-upload" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
    <div :class="['upload-area', { 'drag-over': isDragOver, 'uploading': isUploading }]">
      <input ref="fileInput" type="file" :accept="acceptTypes" :multiple="multiple" @change="onFileSelect" hidden />

      <div v-if="!isUploading" class="upload-prompt" @click="triggerFileSelect">
        <div class="upload-icon">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
          </svg>
        </div>
        <p class="upload-text">{{ $t('file.upload.dragDrop') }}</p>
        <p class="upload-hint">{{ acceptHint }}</p>
      </div>

      <div v-else class="upload-progress">
        <el-progress type="circle" :percentage="uploadProgress" :status="uploadStatus" />
        <p class="progress-text">{{ uploadFileName }}</p>
      </div>
    </div>

    <div v-if="uploadedFiles.length > 0" class="uploaded-files">
      <div v-for="file in uploadedFiles" :key="file.id" class="uploaded-file">
        <div class="file-icon">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
        </div>
        <div class="file-info">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
        </div>
        <div class="file-actions">
          <el-button size="small" @click="previewFile(file)">{{ $t('file.preview') }}</el-button>
          <el-button size="small" type="danger" @click="removeFile(file)">{{ $t('file.remove') }}</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="showPreview" :title="previewFile?.name" width="80%" top="5vh">
      <UnifiedViewer v-if="previewFileData" :url="previewFileData.url" :file-name="previewFileData.name" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage } from 'element-plus'
import UnifiedViewer from './viewers/UnifiedViewer.vue'
import { formatFileSize } from '@/utils/format'

interface Props {
  accept?: string[]
  maxSize?: number
  multiple?: boolean
  autoUpload?: boolean
  uploadUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  accept: () => ['*'],
  maxSize: 50 * 1024 * 1024,
  multiple: false,
  autoUpload: true,
  uploadUrl: '/api/upload'
})

import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'upload', files: File[]): void
  (e: 'success', response: Record<string, unknown>): void
  (e: 'error', error: Error): void
}>()

const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref<'success' | 'warning' | 'exception' | undefined>()
const uploadFileName = ref('')
const uploadedFiles = ref<UploadedFile[]>([])
const showPreview = ref(false)
const previewFileData = ref<{ url: string; name: string } | null>(null)

// 当前正在上传的 XHR 引用，用于组件卸载时中止
let currentXhr: XMLHttpRequest | null = null
// 上传状态重置定时器引用，用于组件卸载时清理
let uploadResetTimer: ReturnType<typeof setTimeout> | null = null
const cleanup = useCleanup()
cleanup.add(() => {
  if (currentXhr) {
    try {
      currentXhr.abort()
    } catch {
      // 忽略 abort 异常
    }
    currentXhr = null
  }
  if (uploadResetTimer) {
    clearTimeout(uploadResetTimer)
    uploadResetTimer = null
  }
})

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  file?: File
}

const acceptTypes = computed(() => {
  if (props.accept.includes('*')) return ''
  return props.accept.join(',')
})

const acceptHint = computed(() => {
  if (props.accept.includes('*')) {
    return t('fileUpload.supportAllSize', { size: formatFileSize(props.maxSize) })
  }
  return t('fileUpload.supportFormat', { formats: props.accept.join(', '), size: formatFileSize(props.maxSize) })
})

function triggerFileSelect() {
  fileInput.value?.click()
}

function onDragOver() {
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  handleFiles(files)
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  handleFiles(files)
  target.value = ''
}

function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > props.maxSize) {
    return { valid: false, error: t('fileUpload.sizeExceeded', { size: formatFileSize(props.maxSize) }) }
  }

  if (!props.accept.includes('*')) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const mimeType = file.type
    const isAccepted = props.accept.some((type: string) =>
      type.toLowerCase() === ext ||
      type.toLowerCase() === mimeType ||
      (type.includes('*') && mimeType.startsWith(type.replace('*', '')))
    )
    if (!isAccepted) {
      return { valid: false, error: t('fileUpload.unsupportedType', { ext }) }
    }
  }

  return { valid: true }
}

async function handleFiles(files: File[]) {
  if (files.length === 0) return

  const validFiles: File[] = []

  for (const file of files) {
    const validation = validateFile(file)
    if (validation.valid) {
      validFiles.push(file)
    } else {
      ElMessage.error(`${file.name}: ${validation.error}`)
    }
  }

  if (validFiles.length === 0) return

  emit('upload', validFiles)

  if (props.autoUpload) {
    await uploadFiles(validFiles)
  } else {
    for (const file of validFiles) {
      uploadedFiles.value.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        file
      })
    }
  }
}

async function uploadFiles(files: File[]) {
  isUploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = undefined

  const formData = new FormData()
  files.forEach((file, index) => {
    formData.append(`file${index}`, file)
  })

  try {
    uploadFileName.value = files.length === 1 ? files[0].name : `${files.length} 个文件`

    const xhr = new XMLHttpRequest()
    currentXhr = xhr

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    })

    xhr.addEventListener('load', () => {
      currentXhr = null
      if (xhr.status >= 200 && xhr.status < 300) {
        uploadStatus.value = 'success'
        let response: { url?: string } = {}
        try {
          response = JSON.parse(xhr.responseText)
        } catch {
          uploadStatus.value = 'exception'
          emit('error', new Error('Invalid response format'))
          ElMessage.error(t('fileUpload.uploadFailed'))
          return
        }

        for (const file of files) {
          uploadedFiles.value.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
            url: response.url || URL.createObjectURL(file)
          })
        }

        emit('success', response)
        ElMessage.success(t('fileUpload.uploadSuccess'))
      } else {
        uploadStatus.value = 'exception'
        emit('error', new Error(xhr.statusText))
        ElMessage.error(t('fileUpload.uploadFailed'))
      }

      uploadResetTimer = setTimeout(() => {
        isUploading.value = false
      }, 1000)
    })

    xhr.addEventListener('error', () => {
      currentXhr = null
      uploadStatus.value = 'exception'
      emit('error', new Error(t('fileUpload.networkError')))
      ElMessage.error(t('fileUpload.networkError'))
      isUploading.value = false
    })

    xhr.addEventListener('abort', () => {
      currentXhr = null
      uploadStatus.value = 'exception'
      isUploading.value = false
    })

    xhr.open('POST', props.uploadUrl)
    xhr.send(formData)

  } catch (error) {
    uploadStatus.value = 'exception'
    emit('error', error as Error)
    ElMessage.error(t('cmpFileUpload.uploadFailed'))
    isUploading.value = false
  }
}

function previewFile(file: UploadedFile) {
  previewFileData.value = { url: file.url, name: file.name }
  showPreview.value = true
}

function removeFile(file: UploadedFile) {
  const index = uploadedFiles.value.findIndex(f => f.id === file.id)
  if (index > -1) {
    if (file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url)
    }
    uploadedFiles.value.splice(index, 1)
  }
}

defineExpose({
  uploadedFiles,
  uploadFiles,
  clearFiles: () => {
    uploadedFiles.value.forEach(f => {
      if (f.url.startsWith('blob:')) URL.revokeObjectURL(f.url)
    })
    uploadedFiles.value = []
  }
})
</script>

<style scoped>
.file-upload {
  width: 100%;
}

.upload-area {
  border: 2px dashed var(--el-border-color);
  border-radius: var(--global-border-radius);
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--el-fill-color-light);
}

.upload-area:hover {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background: var(--el-fill-color);
}

.upload-area.drag-over {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.upload-area.uploading {
  cursor: default;
}

.upload-icon {
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.upload-progress {
  padding: 20px;
}

.progress-text {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}

.uploaded-files {
  margin-top: 20px;
}

.uploaded-file {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;
}

.file-icon {
  color: var(--el-color-primary);
  margin-right: 12px;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  display: block;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.file-actions {
  display: flex;
  gap: 8px;
}
</style>
