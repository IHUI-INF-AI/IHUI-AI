<template>
  <div class="enhanced-file-upload">
    <div 
      :class="['upload-zone', { 'drag-over': isDragOver, 'uploading': isUploading }]"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
      @click="triggerFileSelect"
    >
      <input 
        ref="fileInput" 
        type="file" 
        :accept="acceptTypes" 
        :multiple="multiple" 
        :webkitdirectory="folderMode"
        @change="onFileSelect" 
        hidden 
      />
      
      <div v-if="!isUploading" class="upload-content">
        <div class="upload-icon">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
          </svg>
        </div>
        <p class="upload-text">{{ uploadText }}</p>
        <p class="upload-hint">{{ hint }}</p>
        <div v-if="folderMode" class="folder-mode-badge">
          <el-tag size="small" type="info">{{ t('cmpEnhancedFileUpload.folderMode') }}</el-tag>
        </div>
      </div>
      
      <div v-else class="upload-progress">
        <el-progress 
          :type="batchFiles.length > 1 ? 'circle' : 'line'" 
          :percentage="overallProgress" 
          :status="uploadStatus"
        />
        <p class="progress-text">
          {{ batchFiles.length > 1 ? 
            t('cmpEnhancedFileUpload.uploadingProgress', { completed: completedCount, total: batchFiles.length }) : 
            currentFileName 
          }}
        </p>
        <el-button 
          v-if="canCancel" 
          size="small" 
          type="danger" 
          @click.stop="cancelUpload"
        >
          {{ t('cmpEnhancedFileUpload.cancel') }}
        </el-button>
      </div>
    </div>
    
    <div class="upload-options">
      <el-checkbox v-model="folderMode" :disabled="isUploading">
        <el-icon><FolderOpened /></el-icon>
        {{ t('cmpEnhancedFileUpload.folderUpload') }}
      </el-checkbox>
      <el-checkbox v-model="compressImages" :disabled="isUploading">
        <el-icon><Picture /></el-icon>
        {{ t('cmpEnhancedFileUpload.compressImage') }}
      </el-checkbox>
      <el-checkbox v-model="autoShare" :disabled="isUploading">
        <el-icon><Share /></el-icon>
        {{ t('cmpEnhancedFileUpload.autoShare') }}
      </el-checkbox>
    </div>
    
    <div v-if="pendingFiles.length > 0" class="pending-files">
      <div class="pending-header">
        <span>{{ t('cmpEnhancedFileUpload.pendingFiles') }} ({{ pendingFiles.length }})</span>
        <el-button size="small" @click="clearPending">{{ t('common.clear') }}</el-button>
      </div>
      <div class="file-list">
        <div v-for="file in pendingFiles" :key="file.id" class="file-item">
          <div class="file-preview">
            <img v-if="file.thumbnail" :src="file.thumbnail" alt="" />
            <el-icon v-else><Document /></el-icon>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
            <el-tag v-if="file.compressed" size="small" type="success">{{ t('cmpEnhancedFileUpload.compressed') }}</el-tag>
          </div>
          <el-button size="small" type="danger" @click="removePending(file.id)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
      <el-button type="primary" :loading="isUploading" @click="startUpload">
        {{ t('cmpEnhancedFileUpload.startUpload') }}
      </el-button>
    </div>
    
    <div v-if="uploadedFiles.length > 0" class="uploaded-files">
      <div class="uploaded-header">
        <span>{{ t('cmpEnhancedFileUpload.uploaded') }} ({{ uploadedFiles.length }})</span>
        <el-button size="small" @click="clearUploaded">{{ t('common.clear') }}</el-button>
      </div>
      <div class="file-list">
        <div v-for="file in uploadedFiles" :key="file.id" class="file-item uploaded">
          <div class="file-preview">
            <img v-if="file.thumbnail" :src="file.thumbnail" alt="" />
            <el-icon v-else><Document /></el-icon>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
            <el-tag v-if="file.shareUrl" size="small" type="info">
              <el-icon><Link /></el-icon> {{ t('cmpEnhancedFileUpload.shared') }}
            </el-tag>
          </div>
          <div class="file-actions">
            <el-button size="small" @click="previewFile(file)">{{ t('common.previewBtn') }}</el-button>
            <el-button size="small" @click="downloadFile(file)">{{ t('common.download') }}</el-button>
            <el-button size="small" @click="shareFile(file)">{{ t('common.share') }}</el-button>
          </div>
        </div>
      </div>
    </div>
    
    <el-dialog v-model="showPreview" :title="previewData?.name" width="80%" top="5vh">
      <UnifiedViewer v-if="previewData" :url="previewData.url" :file-name="previewData.name" />
    </el-dialog>
    
    <el-dialog v-model="showShare" :title="t('cmpEnhancedFileUpload.shareFile')" width="400px">
      <div v-if="shareData" class="share-dialog">
        <el-input v-model="shareData.url" readonly>
          <template #append>
            <el-button @click="copyShareUrl">{{ t('cmpEnhancedFileUpload.copy') }}</el-button>
          </template>
        </el-input>
        <div class="share-options">
          <el-form-item :label="t('cmpEnhancedFileUpload.validity')">
            <el-select v-model="shareData.expiresIn" style="width: 100%">
              <el-option :label="t('cmpEnhancedFileUpload.expire1Hour')" :value="3600000" />
              <el-option :label="t('cmpEnhancedFileUpload.expire1Day')" :value="86400000" />
              <el-option :label="t('cmpEnhancedFileUpload.expire7Days')" :value="604800000" />
              <el-option :label="t('cmpEnhancedFileUpload.expireForever')" :value="null" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('cmpEnhancedFileUpload.accessPassword')">
            <el-input v-model="shareData.password" :placeholder="t('cmpEnhancedFileUpload.passwordPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('cmpEnhancedFileUpload.maxDownloads')">
            <el-input-number v-model="shareData.maxDownloads" :min="0" :placeholder="t('cmpEnhancedFileUpload.maxDownloadsPlaceholder')" />
          </el-form-item>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  FolderOpened, Picture, Share, Document, Delete, Link 
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

import UnifiedViewer from './viewers/UnifiedViewer.vue'
import { 
  validateFileAsync, 
  formatFileSize, 
  isImageFile 
} from '@/utils/fileValidation'
import { compressImage, createThumbnail } from '@/utils/imageCompress'
import { useChunkUploader } from '@/utils/chunkUpload'
import { useFileShare } from '@/utils/fileShare'
import { useBatchUpload } from '@/utils/batchOperations'
import { processDroppedItems, flattenFileTree, isFolderUploadSupported } from '@/utils/folderUpload'
import { logger } from '@/utils/logger'

const { t } = useI18n()

interface Props {
  accept?: string[]
  maxSize?: number
  multiple?: boolean
  uploadUrl?: string
  chunkSize?: number
  concurrency?: number
  enableFolder?: boolean
  enableCompress?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  accept: () => ['*'],
  maxSize: 100 * 1024 * 1024,
  multiple: true,
  uploadUrl: '/api/upload',
  chunkSize: 5 * 1024 * 1024,
  concurrency: 3,
  enableFolder: false,
  enableCompress: true
})

const emit = defineEmits<{
  (e: 'upload', files: File[]): void
  (e: 'success', files: UploadedFileInfo[]): void
  (e: 'error', error: Error): void
}>()

interface PendingFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  thumbnail?: string
  compressed?: boolean
  originalSize?: number
}

interface UploadedFileInfo {
  id: string
  name: string
  size: number
  type: string
  url: string
  thumbnail?: string
  shareUrl?: string
}

const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadStatus = ref<'success' | 'warning' | 'exception' | undefined>()
const folderMode = ref(props.enableFolder)
const compressImages = ref(props.enableCompress)
const autoShare = ref(false)

const pendingFiles = ref<PendingFile[]>([])
const uploadedFiles = ref<UploadedFileInfo[]>([])
const batchFiles = ref<PendingFile[]>([])
const completedCount = ref(0)
const currentFileName = ref('')
const overallProgress = ref(0)
const canCancel = ref(true)

const showPreview = ref(false)
const previewData = ref<{ url: string; name: string } | null>(null)
const showShare = ref(false)
const shareData = ref<{
  fileId: string
  url: string
  expiresIn: number | null
  password: string
  maxDownloads: number | null
} | null>(null)

const _chunkUploader = useChunkUploader()
const fileShare = useFileShare()
const batchUpload = useBatchUpload()

const acceptTypes = computed(() => {
  if (props.accept.includes('*')) return ''
  return props.accept.join(',')
})

const uploadText = computed(() => {
  return folderMode.value ? t('cmpEnhancedFileUpload.clickSelectFolder') : t('cmpEnhancedFileUpload.clickSelectFile')
})

const hint = computed(() => {
  const sizeHint = `最大 ${formatSize(props.maxSize)}`
  if (props.accept.includes('*')) return sizeHint
  return `支持 ${props.accept.join(', ')} · ${sizeHint}`
})

function formatSize(bytes: number): string {
  return formatFileSize(bytes)
}

function triggerFileSelect() {
  fileInput.value?.click()
}

function onDragOver() {
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

async function onDrop(e: DragEvent) {
  isDragOver.value = false
  
  if (folderMode.value && e.dataTransfer?.items && isFolderUploadSupported()) {
    const tree = await processDroppedItems(e.dataTransfer.items)
    const files = flattenFileTree(tree)
    await processFiles(files)
  } else {
    const files = Array.from(e.dataTransfer?.files || [])
    await processFiles(files)
  }
}

async function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  await processFiles(files)
  target.value = ''
}

async function processFiles(files: File[]) {
  for (const file of files) {
    const validation = await validateFileAsync(file, {
      maxSize: props.maxSize,
      allowedTypes: props.accept
    })
    
    if (!validation.valid) {
      ElMessage.error(`${file.name}: ${validation.errors.join(', ')}`)
      continue
    }
    
    const pendingFile: PendingFile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file
    }
    
    if (isImageFile(file) && compressImages.value) {
      try {
        const compressed = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8
        })
        
        if (compressed.compressionRatio > 10) {
          pendingFile.file = new File([compressed.blob], file.name, { type: file.type })
          pendingFile.size = compressed.compressedSize
          pendingFile.compressed = true
          pendingFile.originalSize = compressed.originalSize
        }
        
        pendingFile.thumbnail = await createThumbnail(file, 60)
      } catch (e) {
        logger.error('Image compression failed:', e)
      }
    }
    
    pendingFiles.value.push(pendingFile)
  }
}

function removePending(id: string) {
  const index = pendingFiles.value.findIndex(f => f.id === id)
  if (index > -1) {
    pendingFiles.value.splice(index, 1)
  }
}

function clearPending() {
  pendingFiles.value = []
}

async function startUpload() {
  if (pendingFiles.value.length === 0) return
  
  isUploading.value = true
  uploadStatus.value = undefined
  batchFiles.value = [...pendingFiles.value]
  completedCount.value = 0
  overallProgress.value = 0
  pendingFiles.value = []
  
  try {
    const results = await batchUpload.uploadFiles(
      batchFiles.value.map(f => f.file),
      props.uploadUrl,
      {
        concurrency: props.concurrency,
        onProgress: (completed, total) => {
          completedCount.value = completed
          overallProgress.value = Math.round((completed / total) * 100)
          currentFileName.value = batchFiles.value[completed]?.name || ''
        }
      }
    )
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const original = batchFiles.value[i]
      
      const uploaded: UploadedFileInfo = {
        id: original.id,
        name: original.name,
        size: original.size,
        type: original.type,
        url: result.url,
        thumbnail: original.thumbnail
      }
      
      if (autoShare.value) {
        const share = await fileShare.createShare(original.id)
        uploaded.shareUrl = fileShare.getShareUrl(share.id)
      }
      
      uploadedFiles.value.push(uploaded)
    }
    
    uploadStatus.value = 'success'
    emit('success', uploadedFiles.value)
    ElMessage.success(`成功上传 ${results.length} 个文件`)
  } catch (error) {
    uploadStatus.value = 'exception'
    emit('error', error as Error)
    ElMessage.error(t('cmpEnhancedFileUpload.uploadFailed'))
  } finally {
    isUploading.value = false
    canCancel.value = true
  }
}

function cancelUpload() {
  batchUpload.cancel('all')
  canCancel.value = false
}

function previewFile(file: UploadedFileInfo) {
  previewData.value = { url: file.url, name: file.name }
  showPreview.value = true
}

function downloadFile(file: UploadedFileInfo) {
  const link = document.createElement('a')
  link.href = file.url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function shareFile(file: UploadedFileInfo) {
  shareData.value = {
    fileId: file.id,
    url: file.shareUrl || '',
    expiresIn: 604800000,
    password: '',
    maxDownloads: null
  }
  showShare.value = true
}

async function copyShareUrl() {
  if (shareData.value) {
    const success = await fileShare.copyToClipboard(shareData.value.url)
    if (success) {
      ElMessage.success(t('cmpEnhancedFileUpload.linkCopied'))
    }
  }
}

function clearUploaded() {
  uploadedFiles.value = []
}

defineExpose({
  pendingFiles,
  uploadedFiles,
  startUpload,
  cancelUpload,
  clearPending,
  clearUploaded
})
</script>

<style scoped>
.enhanced-file-upload {
  width: 100%;
}

.upload-zone {
  border: 2px dashed var(--el-border-color);
  border-radius: var(--global-border-radius);
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s ease, background-color 0.3s ease;
  background: var(--el-fill-color-light);
}

.upload-zone:hover {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background: var(--el-fill-color);
}

.upload-zone.drag-over {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.upload-zone.uploading {
  cursor: default;
  pointer-events: none;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.folder-mode-badge {
  margin-top: 8px;
}

.upload-progress {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.progress-text {
  color: var(--el-text-color-secondary);
}

.upload-options {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  justify-content: center;
}

.pending-files,
.uploaded-files {
  margin-top: 20px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.pending-header,
.uploaded-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
}

.file-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;
  gap: 12px;
}

.file-preview {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.file-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-preview .el-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
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

.share-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-options {
  margin-top: 16px;
}
</style>
