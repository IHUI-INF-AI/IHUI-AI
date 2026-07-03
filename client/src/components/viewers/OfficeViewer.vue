<template>
  <div class="office-viewer">
    <div class="office-header">
      <div class="file-info">
        <span class="file-icon">{{ fileIcon }}</span>
        <span class="file-name">{{ title || t('viewerOfficeViewer.officeDoc') }}</span>
        <span class="file-type">{{ fileTypeLabel }}</span>
      </div>
      <div class="office-actions">
        <button class="action-btn" @click="zoomOut" :disabled="scale <= 50" title="缩小" aria-label="缩小">−</button>
        <span class="scale-display">{{ scale }}%</span>
        <button class="action-btn" @click="zoomIn" :disabled="scale >= 200" :title="t('officeViewer.zoomIn')" :aria-label="t('officeViewer.zoomIn')">+</button>
        <button class="action-btn" @click="resetZoom" title="重置" aria-label="重置">⟲</button>
        <a :href="src" download class="action-btn download-btn" title="下载">{{ t('officeViewer.download') }}</a>
        <button class="action-btn" @click="openInOffice" title="在Office Online中打开">
          {{ t('officeViewer.openOnline') }}
        </button>
      </div>
    </div>
    
    <div class="office-container" ref="containerRef">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>{ t('viewerOfficeViewer.loadingDoc') }</span>
        <span class="loading-hint">{ t('viewerOfficeViewer.largeDocHint') }</span>
      </div>
      
      <div v-else-if="error" class="error-state">
        <span class="error-icon">⚠️</span>
        <span>{ t('viewerOfficeViewer.docLoadFailed') }</span>
        <span class="error-hint">{ t('viewerOfficeViewer.tryDownload') }</span>
        <div class="error-actions">
          <a :href="src" download class="download-link">{{ t('officeViewer.downloadDoc') }}</a>
          <button class="retry-btn" @click="retryLoad">{{ t('common.retry') }}</button>
        </div>
      </div>
      
      <iframe
        v-else-if="useOfficeOnline"
        ref="iframeRef"
        :src="officeOnlineUrl"
        class="office-iframe"
        frameborder="0"
        allowfullscreen
        @load="onIframeLoad"
      ></iframe>
      
      <div v-else class="fallback-viewer" :style="{ transform: `scale(${scale / 100})` }">
        <div class="fallback-content">
          <div class="fallback-icon">{{ fileIcon }}</div>
          <div class="fallback-title">{{ title }}</div>
          <div class="fallback-message">
            此文档类型需要下载后查看
          </div>
          <a :href="src" download class="download-btn">
            ⬇ 下载文档
          </a>
          <div class="fallback-hint">
            推荐使用 Microsoft Office 或 WPS 打开
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted, watch } from 'vue'
import { getFileType } from '@/utils/fileTypes'

const { t } = useI18n()

const props = defineProps<{
  src: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', error: Error): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const loading = ref(true)
const error = ref(false)
const scale = ref(100)
const useOfficeOnline = ref(true)

const fileType = computed(() => getFileType(props.title || props.src))

const fileIcon = computed(() => {
  switch (fileType.value.category) {
    case 'document': return '📝'
    case 'spreadsheet': return '📊'
    case 'presentation': return '📽️'
    default: return '📄'
  }
})

const fileTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    document: 'Word 文档',
    spreadsheet: 'Excel 表格',
    presentation: 'PowerPoint 演示'
  }
  return labels[fileType.value.category] || t('viewerOfficeViewer.officeDoc')
})

const officeOnlineUrl = computed(() => {
  const encodedUrl = encodeURIComponent(props.src)
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`
})

const zoomIn = () => {
  scale.value = Math.min(200, scale.value + 10)
}

const zoomOut = () => {
  scale.value = Math.max(50, scale.value - 10)
}

const resetZoom = () => {
  scale.value = 100
}

const openInOffice = () => {
  const encodedUrl = encodeURIComponent(props.src)
  window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`, '_blank')
}

const onIframeLoad = () => {
  loading.value = false
  emit('loaded')
}

const retryLoad = () => {
  error.value = false
  loading.value = true
  
  if (iframeRef.value) {
    iframeRef.value.src = officeOnlineUrl.value
  }
}

const checkUrl = () => {
  try {
    const url = new URL(props.src)
    const isHttps = url.protocol === 'https:'
    const isPublic = !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')
    
    useOfficeOnline.value = isHttps && isPublic
    
    if (!useOfficeOnline.value) {
      loading.value = false
    }
  } catch {
    useOfficeOnline.value = false
    loading.value = false
  }
}

watch(() => props.src, checkLoad, { immediate: true })

function checkLoad() {
  loading.value = true
  error.value = false
  checkUrl()
}

onMounted(() => {
  checkLoad()
})
</script>

<style scoped>
.office-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-neutral-100);
}

.office-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 24px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.file-type {
  padding: 2px 8px;
  background: var(--el-color-primary-light-9);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  color: var(--el-color-primary);
}

.office-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: var(--color-neutral-100);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scale-display {
  min-width: 50px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.download-btn {
  text-decoration: none;
}

.office-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.loading-state,
.error-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-text-muted);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-hint,
.error-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.error-icon {
  font-size: 48px;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.download-link,
.retry-btn {
  padding: 10px 24px;
  border-radius: var(--global-border-radius);
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.download-link {
  background: var(--el-color-primary);
  color: var(--app-button-text-on-primary);
}

.download-link:hover {
  background: var(--el-color-primary);
}

.retry-btn {
  background: var(--color-neutral-100);
  border: var(--unified-border);
  color: var(--el-text-color-secondary);
}

.retry-btn:hover {
  background: var(--color-text-muted);
}

.office-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.fallback-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
}

.fallback-content {
  text-align: center;
  padding: 40px;
}

.fallback-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.fallback-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.fallback-message {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 24px;
}

.fallback-content .download-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: var(--el-color-primary);
  color: var(--app-button-text-on-primary);
  border-radius: var(--global-border-radius);
  text-decoration: none;
  font-size: 16px;
  transition: background 0.2s;
}

.fallback-content .download-btn:hover {
  background: var(--el-color-primary);
}

.fallback-hint {
  margin-top: 16px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

@media (width <= 768px) {
  .office-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .file-info {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .office-actions {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
