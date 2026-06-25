<template>
  <div class="evidence-uploader">
    <!-- 已上传文件列表 -->
    <div v-if="files.length > 0" class="evidence-list">
      <div
        v-for="(file, idx) in files"
        :key="file.id || idx"
        class="evidence-card"
      >
        <div class="evidence-thumb">
          <span class="evidence-icon">{{ getFileIcon(file.filename) }}</span>
        </div>
        <div class="evidence-body">
          <div class="evidence-name">{{ file.filename }}</div>
          <div class="evidence-meta">
            <span class="evidence-size">{{ formatSize(file.size) }}</span>
            <span v-if="file.uploaded_at" class="evidence-time">
              {{ formatTime(file.uploaded_at) }}
            </span>
          </div>
        </div>
        <button
          v-if="!readonly"
          class="evidence-remove"
          @click="removeAt(idx)"
          aria-label="删除"
        >×</button>
      </div>
    </div>

    <!-- 上传控件 -->
    <div v-if="!readonly" class="upload-zone">
      <input
        ref="fileInput"
        type="file"
        multiple
        :accept="accept"
        class="file-input-hidden"
        @change="onFileChange"
      />
      <div
        class="upload-drop"
        :class="{ dragging: isDragging, uploading: uploading }"
        @click="trigger"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <div v-if="uploading" class="upload-progress">
          <div class="spinner"></div>
          <span>{{ t('evidenceUploader.uploading', { progress }) }}</span>
        </div>
        <div v-else class="upload-prompt">
          <div class="upload-icon">↑</div>
          <div class="upload-text">{{ t('evidenceUploader.clickOrDrag') }}</div>
          <div class="upload-hint">
            支持 {{ acceptDescription }}, 单次最多 {{ maxFiles }} 个
          </div>
        </div>
      </div>
      <div v-if="error" class="upload-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { formatDateTime as formatTime } from '@/utils/format'

interface Evidence {
  id?: string
  filename: string
  size: number
  uploaded_at?: string
  description?: string
  stored_path?: string
}

interface Props {
  modelValue: Evidence[]
  refundId?: string
  readonly?: boolean
  maxFiles?: number
  maxSize?: number
}

const { t } = useI18n()
const props = withDefaults(defineProps<Props>(), {
  maxFiles: 10,
  maxSize: 10 * 1024 * 1024,
  readonly: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: Evidence[]): void
  (e: 'uploaded', files: Evidence[]): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const uploading = ref(false)
const progress = ref(0)
const error = ref<string | null>(null)
const cleanup = useCleanup()

// 当前上传中的 XHR 引用，用于组件卸载时中断
let currentXhr: XMLHttpRequest | null = null
cleanup.add(() => currentXhr?.abort())

const files = computed(() => props.modelValue)
const accept = 'image/*,application/pdf'
const acceptDescription = '图片 / PDF'

const fileIconMap: Record<string, string> = {
  pdf: '📄',
  zip: '📦',
  rar: '📦',
  default: '📎',
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return fileIconMap.pdf
  if (['zip', 'rar', '7z'].includes(ext)) return fileIconMap.zip
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return '🖼'
  return fileIconMap.default
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function trigger() {
  fileInput.value?.click()
}

function validateFiles(list: File[]): string | null {
  if (list.length === 0) return '未选择文件'
  if (list.length + files.value.length > props.maxFiles) {
    return `最多上传 ${props.maxFiles} 个文件`
  }
  for (const f of list) {
    if (f.size > props.maxSize) {
      return `文件 ${f.name} 超过 ${formatSize(props.maxSize)}`
    }
  }
  return null
}

async function uploadFiles(list: File[]) {
  if (!props.refundId) {
    // 离线模式: 直接加入列表
    const local = list.map((f) => ({
      id: Math.random().toString(36).slice(2, 10),
      filename: f.name,
      size: f.size,
      uploaded_at: new Date().toISOString(),
    }))
    emit('update:modelValue', [...files.value, ...local])
    emit('uploaded', local)
    return
  }

  uploading.value = true
  progress.value = 0
  try {
    const form = new FormData()
    for (const f of list) form.append('files', f)
    const xhr = new XMLHttpRequest()
    currentXhr = xhr
    xhr.open('POST', `/api/v1/refunds/${props.refundId}/evidence/batch`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        progress.value = Math.round((e.loaded / e.total) * 100)
      }
    }
    const result: any = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)) } catch (e) { reject(e) }
      }
      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.send(form)
    })
    if (result?.code === 0) {
      const uploaded = result.data?.uploaded || []
      emit('update:modelValue', [...files.value, ...uploaded])
      emit('uploaded', uploaded)
    } else {
      error.value = result?.message || '上传失败'
    }
  } catch (e: any) {
    if (e instanceof Error && e.name === 'AbortError') return
    error.value = e?.message || '上传失败'
  } finally {
    currentXhr = null
    uploading.value = false
    progress.value = 0
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const list = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!list.length) return
  const err = validateFiles(list)
  if (err) { error.value = err; return }
  error.value = null
  await uploadFiles(list)
}

async function onDrop(e: DragEvent) {
  isDragging.value = false
  const dt = e.dataTransfer
  if (!dt) return
  const list = Array.from(dt.files)
  if (!list.length) return
  const err = validateFiles(list)
  if (err) { error.value = err; return }
  error.value = null
  await uploadFiles(list)
}

function removeAt(idx: number) {
  const next = files.value.slice()
  next.splice(idx, 1)
  emit('update:modelValue', next)
}
</script>

<style scoped lang="scss">
@use './../styles/variables' as v;

v.$text-secondary: var(--el-text-color-secondary);
v.$text-primary: var(--el-text-color-primary);

.evidence-uploader {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.evidence-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.evidence-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-black-3);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
}

.evidence-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  flex-shrink: 0;
}

.evidence-icon {
  font-size: 20px;
}

.evidence-body {
  flex: 1;
  min-width: 0;
}

.evidence-name {
  font-size: 13px;
  color: v.$text-primary;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: v.$text-secondary;
  margin-top: 2px;
}

.evidence-remove {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: v.$text-secondary;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: var(--el-color-danger);
    color: var(--el-bg-color);
  }
}

.upload-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-input-hidden {
  display: none;
}

.upload-drop {
  border: 2px dashed var(--el-border-color);
  border-radius: var(--global-border-radius);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--el-bg-color);

  &:hover,
  &.dragging {
    border-color: v.$primary-color;
    background: var(--color-blue-1890ff-04);
  }
}

.upload-icon {
  font-size: 28px;
  color: v.$primary-color;
  margin-bottom: 6px;
}

.upload-text {
  font-size: 14px;
  font-weight: 700;
  color: v.$text-primary;
  margin-bottom: 4px;
}

.upload-hint {
  font-size: 12px;
  color: v.$text-secondary;
}

.upload-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 13px;
  color: v.$text-primary;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--el-border-color);
  border-top-color: v.$primary-color;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.upload-error {
  font-size: 12px;
  color: var(--el-color-danger);
  padding: 6px 10px;
  background: var(--el-color-danger-light-9);
  border-radius: var(--global-border-radius);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
