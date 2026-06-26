<template>
  <div class="unified-viewer">
    <div class="viewer-header">
      <div class="file-info">
        <span class="file-icon">{{ fileInfo.icon }}</span>
        <span class="file-name">{{ displayTitle }}</span>
        <span class="file-type-badge" :class="fileInfo.category">{{ categoryLabel }}</span>
      </div>
      <div class="viewer-actions">
        <button v-if="canPreview" class="action-btn" @click="toggleFullscreen" :title="t('unifiedViewer.fullscreen')" aria-label="全屏">
          ⛶
        </button>
        <a :href="src" :download="title" class="action-btn" :title="t('unifiedViewer.download')">⬇</a>
        <button class="action-btn" @click="openInNewTab" :title="t('unifiedViewer.openInNewTab')" aria-label="在新标签页打开">🔗</button>
      </div>
    </div>
    
    <div class="viewer-content" ref="contentRef">
      <ImageViewer
        v-if="fileInfo.category === 'image'"
        :src="src"
        :title="title"
        @loaded="onLoaded"
        @error="onError"
      />
      
      <MediaViewer
        v-else-if="fileInfo.category === 'video' || fileInfo.category === 'audio'"
        :src="src"
        :title="title"
        @loaded="onLoaded"
        @error="onError"
      />
      
      <CodeViewer
        v-else-if="fileInfo.category === 'code'"
        :src="src"
        :title="title"
        @loaded="onLoaded"
        @error="onError"
      />
      
      <MarkdownViewer
        v-else-if="fileInfo.category === 'markdown'"
        :src="src"
        :title="title"
        @loaded="onLoaded"
        @error="onError"
      />
      
      <OfficeViewer
        v-else-if="isOfficeFile"
        :src="src"
        :title="title"
        @loaded="onLoaded"
        @error="onError"
      />
      
      <Model3DViewer
        v-else-if="fileInfo.category === 'model3d'"
        :src="src"
        :title="title"
        @loaded="onLoaded"
        @error="onError"
      />
      
      <div v-else-if="fileInfo.category === 'cad'" class="cad-viewer">
        <div class="cad-content">
          <div class="cad-icon">📐</div>
          <div class="cad-title">{{ title }}</div>
          <div class="cad-message">{{ t('unifiedViewer.cadFile') }}</div>
          <div class="cad-info">
            <div class="info-item">
              <span class="info-label">{{ t('unifiedViewer.format') }}</span>
              <span class="info-value">{{ fileInfo.extension.toUpperCase() }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('unifiedViewer.type') }}</span>
              <span class="info-value">{{ fileInfo.mimeType }}</span>
            </div>
          </div>
          <a :href="src" :download="title" class="download-btn">⬇ {{ t('unifiedViewer.downloadView') }}</a>
          <div class="cad-hint">{{ t('unifiedViewer.cadHint') }}</div>
        </div>
      </div>
      
      <div v-else-if="fileInfo.category === 'archive'" class="archive-viewer">
        <div class="archive-content">
          <div class="archive-icon">📦</div>
          <div class="archive-title">{{ title }}</div>
          <div class="archive-message">{{ t('unifiedViewer.archiveFile') }}</div>
          <div class="archive-info">
            <div class="info-item">
              <span class="info-label">{{ t('unifiedViewer.type') }}</span>
              <span class="info-value">{{ fileInfo.extension.toUpperCase() }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">MIME</span>
              <span class="info-value">{{ fileInfo.mimeType }}</span>
            </div>
          </div>
          <a :href="src" :download="title" class="download-btn">⬇ {{ t('unifiedViewer.downloadExtract') }}</a>
        </div>
      </div>
      
      <div v-else-if="fileInfo.category === 'text'" class="text-viewer">
        <div class="text-content" v-if="textContent">
          <pre>{{ textContent }}</pre>
        </div>
        <div v-else class="loading-state">
          <div class="loading-spinner"></div>
          <span>{{ t('unifiedViewer.loading') }}</span>
        </div>
      </div>
      
      <div v-else class="unknown-viewer">
        <div class="unknown-content">
          <div class="unknown-icon">📄</div>
          <div class="unknown-title">{{ title }}</div>
          <div class="unknown-message">{{ t('unifiedViewer.notSupport') }}</div>
          <div class="unknown-info">
            <div class="info-item">
              <span class="info-label">{{ t('unifiedViewer.extension') }}</span>
              <span class="info-value">{{ fileInfo.extension || t('unifiedViewer.unknown') }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('unifiedViewer.mimeType') }}</span>
              <span class="info-value">{{ fileInfo.mimeType }}</span>
            </div>
          </div>
          <a :href="src" :download="title" class="download-btn">⬇ {{ t('unifiedViewer.downloadFile') }}</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'
import { getFileType, type FileCategory } from '@/utils/fileTypes'
import ImageViewer from './ImageViewer.vue'
import MediaViewer from './MediaViewer.vue'
import CodeViewer from './CodeViewer.vue'
import MarkdownViewer from './MarkdownViewer.vue'
import OfficeViewer from './OfficeViewer.vue'
import Model3DViewer from './Model3DViewer.vue'

const { t } = useI18n()
const cleanup = useCleanup()

const props = defineProps<{
  src: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', error: Error): void
}>()

const contentRef = ref<HTMLElement | null>(null)
const textContent = ref('')

let abortController: AbortController | null = null
cleanup.add(() => abortController?.abort())

const fileInfo = computed(() => getFileType(props.title || props.src))

const displayTitle = computed(() => {
  return props.title || props.src.split('/').pop() || t('unifiedViewer.file')
})

const isOfficeFile = computed(() => {
  return ['document', 'spreadsheet', 'presentation'].includes(fileInfo.value.category)
})

const canPreview = computed(() => {
  return fileInfo.value.previewable
})

const categoryLabel = computed(() => {
  const labels: Record<FileCategory, string> = {
    pdf: 'PDF',
    document: t('unifiedViewer.catDocument'),
    spreadsheet: t('unifiedViewer.catSpreadsheet'),
    presentation: t('unifiedViewer.catPresentation'),
    image: t('unifiedViewer.catImage'),
    video: t('unifiedViewer.catVideo'),
    audio: t('unifiedViewer.catAudio'),
    code: t('unifiedViewer.catCode'),
    markdown: 'Markdown',
    text: t('unifiedViewer.catText'),
    archive: t('unifiedViewer.catArchive'),
    model3d: t('unifiedViewer.catModel3d'),
    cad: t('unifiedViewer.catCad'),
    unknown: t('unifiedViewer.unknown')
  }
  return labels[fileInfo.value.category]
})

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    contentRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const openInNewTab = () => {
  window.open(props.src, '_blank')
}

const onLoaded = () => {
  emit('loaded')
}

const onError = (error: Error) => {
  emit('error', error)
}

const loadTextContent = async () => {
  if (fileInfo.value.category !== 'text') return

  try {
    abortController = new AbortController()
    const response = await fetch(props.src, { signal: abortController.signal })
    textContent.value = await response.text()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    emit('error', e as Error)
  }
}

watch(() => props.src, loadTextContent, { immediate: true })
</script>

<style scoped>
.unified-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-neutral-100);
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
  flex-shrink: 0;
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
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-type-badge {
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  font-size: 12px;
  font-weight: 500;
}

.file-type-badge.pdf { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.file-type-badge.document { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.file-type-badge.spreadsheet { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.file-type-badge.presentation { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.file-type-badge.image { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.file-type-badge.video { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.file-type-badge.audio { background: var(--el-color-info-light-9); color: var(--el-color-info); }
.file-type-badge.code { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.file-type-badge.markdown { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.file-type-badge.text { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }
.file-type-badge.archive { background: var(--el-text-color-primary); color: var(--el-text-color-primary); }
.file-type-badge.model3d { background: var(--el-text-color-primary); color: var(--el-text-color-primary); }
.file-type-badge.cad { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.file-type-badge.unknown { background: var(--el-fill-color-light); color: var(--el-text-color-placeholder); }

.viewer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  text-decoration: none;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: var(--color-neutral-100);
}

.viewer-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.archive-viewer,
.cad-viewer,
.unknown-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-lighter);
}

.archive-content,
.cad-content,
.unknown-content {
  text-align: center;
  padding: 40px;
}

.archive-icon,
.cad-icon,
.unknown-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.archive-title,
.cad-title,
.unknown-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.archive-message,
.cad-message,
.unknown-message {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 24px;
}

.archive-info,
.cad-info,
.unknown-info {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.info-value {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-family: var(--font-family-mono);
}

.download-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  text-decoration: none;
  font-size: 16px;
  transition: background 0.2s;
}

.download-btn:hover {
  background: var(--el-color-primary);
}

.cad-hint {
  margin-top: 16px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.text-viewer {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--el-bg-color);
}

.text-content {
  padding: 24px;
}

.text-content pre {
  margin: 0;
  font-family: var(--font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: var(--el-text-color-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--el-text-color-placeholder);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (width <= 768px) {
  .viewer-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .file-info {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .file-name {
    max-width: 200px;
  }
  
  .archive-info,
  .unknown-info {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
