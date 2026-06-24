<template>
  <div class="markdown-viewer">
    <div class="md-header">
      <div class="md-title">
        <span class="md-icon">📑</span>
        <span>{{ title || t('markdown.defaultTitle') }}</span>
      </div>
      <div class="md-actions">
        <button class="action-btn" @click="toggleView" :title="t('markdown.switchView')">
          {{ viewMode === 'preview' ? '📝 ' + t('markdown.edit') : '👁️ ' + t('markdown.preview') }}
        </button>
        <button class="action-btn" @click="toggleToc" :class="{ active: showToc }" :title="t('markdown.toc')">
          📋 {{ t('markdown.toc') }}
        </button>
        <button class="action-btn" @click="copyContent" :title="t('markdown.copy')">
          {{ copied ? '✓ ' + t('markdown.copied') : '📋 ' + t('markdown.copy') }}
        </button>
        <a :href="src" download class="action-btn download-btn" :title="t('markdown.download')">⬇ {{ t('markdown.download') }}</a>
      </div>
    </div>
    
    <div class="md-container">
      <div v-if="showToc && headings.length > 0" class="md-toc">
        <div class="toc-title">{{ t('markdown.toc') }}</div>
        <ul class="toc-list">
          <li
            v-for="heading in headings"
            :key="heading.id"
            :class="`toc-item toc-level-${heading.level}`"
            @click="scrollToHeading(heading.id)"
          >
            {{ heading.text }}
          </li>
        </ul>
      </div>
      
      <div class="md-content" :class="{ 'with-toc': showToc && headings.length > 0 }">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>{{ t('markdown.loading') }}</span>
        </div>
        
        <div v-else-if="error" class="error-state">
          <span class="error-icon">⚠️</span>
          <span>{{ t('markdown.loadFailed') }}</span>
          <a :href="src" download class="download-link">{{ t('markdown.downloadToView') }}</a>
        </div>
        
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else-if="viewMode === 'preview'" class="md-preview prose" v-html="renderedContent"></div>
        
        <textarea
          v-else
          v-model="rawContent"
          class="md-editor"
          spellcheck="false"
        ></textarea>
      </div>
    </div>
    
    <div class="md-footer">
      <span class="md-stats">{{ wordCount }} {{ t('markdownViewer.chars') }} · {{ lineCount }} {{ t('markdownViewer.lines') }}</span>
      <span class="md-mode">{{ viewMode === 'preview' ? t('markdownViewer.previewMode') : t('markdownViewer.editMode') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()

const props = defineProps<{
  src: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'loaded', content: string): void
  (e: 'error', error: Error): void
}>()

const rawContent = ref('')
const loading = ref(true)
const error = ref(false)
const copied = ref(false)
const viewMode = ref<'preview' | 'edit'>('preview')
const showToc = ref(true)

let abortController: AbortController | null = null
// 复制状态重置定时器
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

const cleanup = useCleanup()

interface Heading {
  id: string
  text: string
  level: number
}

const headings = ref<Heading[]>([])

const wordCount = computed(() => {
  return rawContent.value.replace(/\s/g, '').length
})

const lineCount = computed(() => {
  return rawContent.value.split('\n').length
})

const renderedContent = computed(() => {
  return renderMarkdown(rawContent.value)
})

const renderMarkdown = (md: string): string => {
  let html = md
  
  headings.value = []
  
  html = html.replace(/^# (.*$)/gm, (match, text) => {
    const id = `heading-${headings.value.length}`
    headings.value.push({ id, text, level: 1 })
    return `<h1 id="${id}">${text}</h1>`
  })
  
  html = html.replace(/^## (.*$)/gm, (match, text) => {
    const id = `heading-${headings.value.length}`
    headings.value.push({ id, text, level: 2 })
    return `<h2 id="${id}">${text}</h2>`
  })
  
  html = html.replace(/^### (.*$)/gm, (match, text) => {
    const id = `heading-${headings.value.length}`
    headings.value.push({ id, text, level: 3 })
    return `<h3 id="${id}">${text}</h3>`
  })
  
  html = html.replace(/^#### (.*$)/gm, (match, text) => {
    const id = `heading-${headings.value.length}`
    headings.value.push({ id, text, level: 4 })
    return `<h4 id="${id}">${text}</h4>`
  })
  
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')
  html = html.replace(/`(.*?)`/g, '<code>$1</code>')
  
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
  
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
  
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
  
  html = html.replace(/^- (.*$)/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  
  html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    if (match.includes('<ul>')) return match
    return `<ol>${match}</ol>`
  })
  
  html = html.replace(/^---$/gm, '<hr>')
  
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
  
  html = html.replace(/\n\n/g, '</p><p>')
  html = `<p>${html}</p>`
  
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[1-6]>)/g, '$1')
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul>)/g, '$1')
  html = html.replace(/(<\/ul>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ol>)/g, '$1')
  html = html.replace(/(<\/ol>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre>)/g, '$1')
  html = html.replace(/(<\/pre>)<\/p>/g, '$1')
  html = html.replace(/<p>(<blockquote>)/g, '$1')
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1')
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1')

  // P18-2: 渲染前 sanitize, 防 XSS (renderMarkdown 基于正则拼接, 需 DOMPurify 过滤)
  return sanitizeHtml(html)
}

const loadContent = async () => {
  loading.value = true
  error.value = false

  try {
    abortController = cleanup.addAbortController()
    const response = await fetch(props.src, { signal: abortController.signal })
    if (!response.ok) throw new Error(t('markdown.loadError'))

    rawContent.value = await response.text()
    emit('loaded', rawContent.value)
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return
    error.value = true
    emit('error', e as Error)
  } finally {
    loading.value = false
  }
}

const toggleView = () => {
  viewMode.value = viewMode.value === 'preview' ? 'edit' : 'preview'
}

const toggleToc = () => {
  showToc.value = !showToc.value
}

const scrollToHeading = (id: string) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(rawContent.value)
    copied.value = true
    if (copyResetTimer !== null) clearTimeout(copyResetTimer)
    copyResetTimer = cleanup.addTimer(() => {
      copied.value = false
    }, 2000)
  } catch (e) {
      logger.error('Copy failed:', e)
  }
}

watch(() => props.src, loadContent, { immediate: true })
</script>

<style scoped>
.markdown-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.md-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
}

.md-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.md-icon {
  font-size: 18px;
}

.md-actions {
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

.action-btn:hover {
  background: var(--color-border-light);
}

.action-btn.active {
  background: var(--color-brand-blue-2);
  color: var(--el-bg-color);
}

.download-btn {
  text-decoration: none;
}

.md-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.md-toc {
  width: 240px;
  padding: 16px;
  background: var(--el-bg-color);
  border-right: var(--unified-border);
  overflow-y: auto;
  flex-shrink: 0;
}

.toc-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  padding: 6px 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: color 0.2s;
}

.toc-item:hover {
  color: var(--color-brand-blue-2);
}

.toc-level-2 { padding-left: 12px; }
.toc-level-3 { padding-left: 24px; }
.toc-level-4 { padding-left: 36px; }

.md-content {
  flex: 1;
  overflow-y: auto;
}

.md-content.with-toc {
  max-width: calc(100% - 240px);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: var(--el-text-color-placeholder);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--el-border-color);
  border-top-color: var(--color-brand-blue-2);
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
  background: var(--color-brand-blue-2);
  border-radius: var(--global-border-radius);
  color: var(--el-bg-color);
  text-decoration: none;
  font-size: 14px;
}

.md-preview {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.md-preview :deep(h1) {
  font-size: 2em;
  margin: 0.67em 0;
  border-bottom: var(--unified-border-bottom);
  padding-bottom: 0.3em;
}

.md-preview :deep(h2) {
  font-size: 1.5em;
  margin: 0.83em 0;
  border-bottom: var(--unified-border-bottom);
  padding-bottom: 0.3em;
}

.md-preview :deep(h3) {
  font-size: 1.17em;
  margin: 1em 0;
}

.md-preview :deep(h4) {
  font-size: 1em;
  margin: 1.33em 0;
}

.md-preview :deep(p) {
  margin: 1em 0;
  line-height: 1.6;
}

.md-preview :deep(a) {
  color: var(--color-brand-blue-2);
  text-decoration: none;
}

.md-preview :deep(a:hover) {
  text-decoration: underline;
}

.md-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--global-border-radius);
}

.md-preview :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid var(--color-brand-blue-2);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}

.md-preview :deep(code) {
  padding: 2px 6px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  font-family: var(--font-family-mono);
  font-size: 0.9em;
}

.md-preview :deep(pre) {
  margin: 1em 0;
  padding: 16px;
  background: var(--color-dark-bg-3);
  border-radius: var(--global-border-radius);
  overflow-x: auto;
}

.md-preview :deep(pre code) {
  padding: 0;
  background: transparent;
  color: var(--color-neutral-300);
}

.md-preview :deep(ul),
.md-preview :deep(ol) {
  margin: 1em 0;
  padding-left: 2em;
}

.md-preview :deep(li) {
  margin: 0.5em 0;
}

.md-preview :deep(hr) {
  border: none;
  border-top: var(--unified-border);
  margin: 2em 0;
}

.md-preview :deep(table) {
  width: 100%;
  margin: 1em 0;
  border-collapse: collapse;
}

.md-preview :deep(th),
.md-preview :deep(td) {
  padding: 8px 12px;
  border: var(--unified-border);
  text-align: left;
}

.md-preview :deep(th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.md-editor {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  resize: none;
  font-family: var(--font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  outline: none;
}

.md-footer {
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
  .md-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .md-toc {
    display: none;
  }
  
  .md-content.with-toc {
    max-width: 100%;
  }
}
</style>
