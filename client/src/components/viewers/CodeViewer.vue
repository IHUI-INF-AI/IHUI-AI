<template>
  <div class="code-viewer">
    <div class="code-header">
      <div class="file-info">
        <span class="file-icon">📜</span>
        <span class="file-name">{{ title || t('codeViewer.codeFile') }}</span>
        <span class="language-badge">{{ language }}</span>
      </div>
      <div class="code-actions">
        <button class="action-btn" @click="copyCode" :title="t('common.copy')">
          {{ copied ? t('codeViewer.copied') : t('codeViewer.copy') }}
        </button>
        <button class="action-btn" @click="toggleWrap" :class="{ active: wrapLines }" :title="t('common.lineWrap')">
          {{ t('codeViewer.wrap') }}
        </button>
        <button class="action-btn" @click="downloadCode" :title="t('codeViewer.download')">⬇ {{ t('codeViewer.download') }}</button>
      </div>
    </div>
    
    <div class="code-container" ref="containerRef">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>{{ t('viewerCodeViewer.loading') }}</span>
      </div>
      
      <div v-else-if="error" class="error-state">
        <span class="error-icon">⚠️</span>
        <span>{{ t('viewerCodeViewer.codeLoadFailed') }}</span>
        <a :href="src" download class="download-link">{{ t('codeViewer.downloadView') }}</a>
      </div>
      
      <div v-else class="code-content">
        <div class="line-numbers">
          <span v-for="n in lineCount" :key="n" class="line-number">{{ n }}</span>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="code-block" :class="{ 'wrap-lines': wrapLines }"><code :class="`language-${language}`" v-html="highlightedCode"></code></pre>
      </div>
    </div>
    
    <div class="code-footer">
      <span class="code-stats">
        {{ lineCount }} 行 · {{ charCount }} 字符 · {{ fileSize }}
      </span>
      <span class="encoding-info">UTF-8</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed, watch } from 'vue'
import { getCodeLanguage } from '@/utils/fileTypes'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()

const props = defineProps<{
  src: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'loaded', code: string): void
  (e: 'error', error: Error): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const code = ref('')
const loading = ref(true)
const error = ref(false)
const copied = ref(false)
const wrapLines = ref(true)

let abortController: AbortController | null = null
// 复制状态重置定时器
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

const cleanup = useCleanup()

const language = computed(() => {
  return getCodeLanguage(props.title || props.src)
})

const lineCount = computed(() => {
  return code.value.split('\n').length
})

const charCount = computed(() => {
  return code.value.length
})

const fileSize = computed(() => {
  const bytes = new Blob([code.value]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const highlightedCode = computed(() => {
  return escapeHtml(code.value)
})

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const loadCode = async () => {
  loading.value = true
  error.value = false

  try {
    abortController = cleanup.addAbortController()
    const response = await fetch(props.src, { signal: abortController.signal })
    if (!response.ok) throw new Error(t('viewerCodeViewer.loadFailed'))

    code.value = await response.text()
    emit('loaded', code.value)
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    error.value = true
    emit('error', e as Error)
  } finally {
    loading.value = false
  }
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    if (copyResetTimer !== null) clearTimeout(copyResetTimer)
    copyResetTimer = cleanup.addTimer(() => {
      copied.value = false
    }, 2000)
  } catch (e) {
      logger.error('Copy failed:', e)
  }
}

const toggleWrap = () => {
  wrapLines.value = !wrapLines.value
}

const downloadCode = () => {
  const link = document.createElement('a')
  link.href = props.src
  link.download = props.title || 'code.txt'
  link.click()
}

watch(() => props.src, loadCode, { immediate: true })
</script>

<style scoped>
.code-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-gray-1e1e1e);
  color: var(--color-neutral-300);
  font-family: var(--font-family-mono);
}

.code-header {
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
  font-size: 18px;
}

.file-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.language-badge {
  padding: 2px 8px;
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  color: var(--el-color-primary-light-3);
}

.code-actions {
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
  color: var(--el-color-primary-light-3);
  font-size: 13px;
  transition: background-color 0.2s, color 0.2s;
}

.action-btn:hover {
  background: var(--el-fill-color);
}

.action-btn.active {
  background: var(--el-color-primary);
  color: var(--el-button-text-color);
}

.code-container {
  flex: 1;
  overflow: auto;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: var(--el-color-primary-light-3);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--el-border-color);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
}

.download-link {
  padding: 10px 24px;
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  color: var(--el-button-text-color);
  text-decoration: none;
  font-size: 14px;
}

.code-content {
  display: flex;
  min-height: 100%;
}

.line-numbers {
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  background: var(--el-bg-color);
  border-right: var(--unified-border);
  user-select: none;
  text-align: right;
}

.line-number {
  padding: 0 12px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  line-height: 1.6;
}

.code-block {
  flex: 1;
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  background: transparent;
}

.code-block.wrap-lines {
  white-space: pre-wrap;
  word-break: break-word;
}

.code-block:not(.wrap-lines) {
  white-space: pre;
}

.code-block code {
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}

.code-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--el-bg-color);
  border-top: var(--unified-border);
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

@media (width <= 768px) {
  .code-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .line-numbers {
    display: none;
  }
  
  .code-block {
    padding: 12px;
  }
}
</style>
