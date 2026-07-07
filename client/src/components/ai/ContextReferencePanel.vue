<!--
  ContextReferencePanel.vue — 引用上下文面板 (Trae 风格 @ 按钮)
  2026-07-06 立: 替代原 @ 提及 stub, 提供工作区文件浏览 + 上传 + 上下文标签

  功能:
  1. 浏览工作区文件 (使用 /workspace/browse API)
  2. 搜索过滤文件
  3. 选择/取消选择文件作为上下文引用
  4. 上传新文件 (复用父组件 handleFileUpload)
  5. 已选文件显示为标签 (chips)

  Props:
  - visible: boolean — 面板显隐
  - workspacePath: string — 当前工作区路径 (空则不显示文件浏览)
  - triggerRect: DOMRect | null — 触发按钮位置 (用于面板定位)

  Emits:
  - update:visible
  - select — 选中文件 (filePath, fileName, content)
  - deselect — 取消选中 (filePath)
  - upload — 请求上传文件
-->
<template>
  <Teleport to="body">
    <Transition name="context-ref-panel">
      <div v-if="visible" ref="panelRef" class="context-ref-panel"
        :class="['context-ref-panel--' + placement]"
        :style="panelStyle"
        role="dialog"
        :aria-label="t('aiChatInput.contextReference')"
        @click.stop>
        <!-- 面板头部 -->
        <div class="context-ref-header">
          <span class="context-ref-title">{{ t('aiChatInput.contextReference') }}</span>
          <button type="button" class="context-ref-close-btn"
            :aria-label="t('common.close')" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <!-- 搜索框 -->
        <div class="context-ref-search-wrap">
          <el-input v-model="searchQuery" :placeholder="t('aiChatInput.searchFilesPlaceholder')"
            size="small" clearable :prefix-icon="Search" />
        </div>

        <!-- 面板主体 -->
        <div class="context-ref-body">
          <!-- 无工作区提示 -->
          <div v-if="!workspacePath" class="context-ref-empty">
            <el-icon :size="32"><FolderOpened /></el-icon>
            <p>{{ t('aiChatInput.noWorkspaceHint') }}</p>
          </div>

          <!-- 加载中 -->
          <div v-else-if="loading" class="context-ref-loading">
            <el-icon class="is-loading" :size="20"><Loading /></el-icon>
            <span>{{ t('common.loading') }}</span>
          </div>

          <!-- 文件列表 -->
          <template v-else>
            <!-- 面包屑导航 -->
            <div v-if="breadcrumb.length > 0" class="context-ref-breadcrumb">
              <button type="button" class="breadcrumb-item breadcrumb-root"
                @click="navigateTo(workspacePath)">
                <el-icon :size="12"><HomeFilled /></el-icon>
                <span>{{ workspaceName }}</span>
              </button>
              <template v-for="(crumb, idx) in breadcrumb" :key="crumb.path">
                <el-icon :size="10" class="breadcrumb-sep"><ArrowRight /></el-icon>
                <button type="button" class="breadcrumb-item"
                  :class="{ 'breadcrumb-current': idx === breadcrumb.length - 1 }"
                  @click="navigateTo(crumb.path)">
                  {{ crumb.name }}
                </button>
              </template>
            </div>

            <!-- 空目录 -->
            <div v-if="filteredEntries.length === 0" class="context-ref-empty">
              <el-icon :size="24"><Document /></el-icon>
              <p>{{ searchQuery ? t('aiChatInput.noFilesFound') : t('aiChatInput.emptyDir') }}</p>
            </div>

            <!-- 文件/目录条目 -->
            <div v-else class="context-ref-list">
              <div v-for="entry in filteredEntries" :key="entry.path"
                class="context-ref-entry"
                :class="{
                  'is-dir': entry.is_dir,
                  'is-selected': !entry.is_dir && isSelected(entry.path)
                }"
                role="option"
                :aria-selected="!entry.is_dir && isSelected(entry.path)"
                tabindex="0"
                @click="handleEntryClick(entry)"
                @keydown.enter="handleEntryClick(entry)">
                <el-icon v-if="entry.is_dir" :size="14"><Folder /></el-icon>
                <el-icon v-else :size="14"><Document /></el-icon>
                <span class="entry-name" :title="entry.name">{{ entry.name }}</span>
                <el-icon v-if="!entry.is_dir && isSelected(entry.path)" class="entry-check" :size="12">
                  <Check />
                </el-icon>
              </div>
            </div>
          </template>
        </div>

        <!-- 面板底部 -->
        <div class="context-ref-footer">
          <button type="button" class="context-ref-upload-btn"
            @click="$emit('upload')">
            <el-icon :size="14"><Upload /></el-icon>
            <span>{{ t('aiChatInput.uploadFile') }}</span>
          </button>
          <span v-if="selectedPaths.length > 0" class="context-ref-count">
            {{ t('aiChatInput.filesSelected', { count: selectedPaths.length }) }}
          </span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Close, Search, Loading, Folder, FolderOpened, Document,
  ArrowRight, Check, Upload, HomeFilled,
} from '@/lib/lucide-fallback'
import { browseDirectory, type DirEntry } from '@/api/services/workspace.service'

const props = defineProps<{
  visible: boolean
  workspacePath: string
  triggerRect: DOMRect | null
  selectedPaths: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'select', filePath: string, fileName: string): void
  (e: 'deselect', filePath: string): void
  (e: 'upload'): void
}>()

const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const loading = ref(false)
const entries = ref<DirEntry[]>([])
const currentPath = ref('')
const placement = ref<'up' | 'down'>('up')

// 面板定位样式
const panelStyle = computed(() => {
  if (!props.triggerRect) return {}
  const rect = props.triggerRect
  const viewportH = window.innerHeight
  const PANEL_MAX_H = 360
  const spaceBelow = viewportH - rect.bottom
  placement.value = spaceBelow < PANEL_MAX_H + 22 ? 'up' : 'down'
  return {
    position: 'fixed' as const,
    top: placement.value === 'up'
      ? `${rect.top - 6}px`
      : `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    maxHeight: `${Math.min(PANEL_MAX_H, placement.value === 'up' ? rect.top - 22 : spaceBelow - 22)}px`,
  }
})

// 工作区名称
const workspaceName = computed(() => {
  if (!props.workspacePath) return ''
  const parts = props.workspacePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || props.workspacePath
})

// 面包屑导航
const breadcrumb = computed(() => {
  if (!props.workspacePath || !currentPath.value) return []
  if (currentPath.value === props.workspacePath) return []
  const basePath = props.workspacePath.replace(/\\/g, '/')
  const currPath = currentPath.value.replace(/\\/g, '/')
  if (!currPath.startsWith(basePath)) return []
  const relative = currPath.slice(basePath.length).replace(/^\/+/, '')
  if (!relative) return []
  const parts = relative.split('/')
  const crumbs: { name: string; path: string }[] = []
  let acc = basePath
  for (const part of parts) {
    acc = acc + '/' + part
    crumbs.push({ name: part, path: acc })
  }
  return crumbs
})

// 过滤后的文件条目
const filteredEntries = computed(() => {
  if (!searchQuery.value.trim()) return entries.value
  const q = searchQuery.value.toLowerCase()
  return entries.value.filter(e => e.name.toLowerCase().includes(q))
})

// 是否已选中
const isSelected = (path: string) => props.selectedPaths.includes(path)

// 关闭面板
const close = () => emit('update:visible', false)

// 加载目录
const loadDir = async (path: string) => {
  if (!props.workspacePath) return
  loading.value = true
  try {
    const result = await browseDirectory(path)
    // 目录在前, 文件在后, 各按名称排序
    entries.value = result.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    currentPath.value = path
  } catch {
    entries.value = []
  } finally {
    loading.value = false
  }
}

// 导航到目录
const navigateTo = (path: string) => {
  searchQuery.value = ''
  loadDir(path)
}

// 条目点击: 目录→进入, 文件→选中/取消
const handleEntryClick = (entry: DirEntry) => {
  if (entry.is_dir) {
    navigateTo(entry.path)
    return
  }
  if (isSelected(entry.path)) {
    emit('deselect', entry.path)
  } else {
    emit('select', entry.path, entry.name)
  }
}

// 外部点击关闭
const handleOutsideClick = (e: MouseEvent) => {
  if (!props.visible) return
  const target = e.target as Node
  if (panelRef.value && !panelRef.value.contains(target)) {
    close()
  }
}

// Escape 关闭
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    close()
  }
}

// 面板打开时加载工作区根目录
watch(() => props.visible, (val) => {
  if (val && props.workspacePath) {
    loadDir(props.workspacePath)
    searchQuery.value = ''
  }
})

// 工作区路径变化时重新加载
watch(() => props.workspacePath, (val) => {
  if (val && props.visible) {
    loadDir(val)
  }
})

onMounted(() => {
  document.addEventListener('click', handleOutsideClick, true)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick, true)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.context-ref-panel {
  width: 320px;
  background: var(--el-bg-color, #fff);
  border: 1px solid #e6e8ed;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  z-index: 2001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 13px;
}

:where(html.dark) .context-ref-panel {
  background: #1a1a1a;
  border-color: #3a3b3d;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* 向上展开时面板在触发按钮上方 */
.context-ref-panel--up {
  transform: translateY(-100%);
}

/* 头部 */
.context-ref-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter, #f0f0f0);
}

:where(html.dark) .context-ref-header {
  border-color: #2a2b2d;
}

.context-ref-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary, #1a1a1a);
}

:where(html.dark) .context-ref-title {
  color: #e5eaf3;
}

.context-ref-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary, #909399);
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.context-ref-close-btn:hover {
  background: var(--el-fill-color-light, #f5f5f5);
}

:where(html.dark) .context-ref-close-btn:hover {
  background: #2a2b2d;
}

/* 搜索框 */
.context-ref-search-wrap {
  padding: 8px 12px;
}

/* 面板主体 */
.context-ref-body {
  flex: 1;
  overflow-y: auto;
  min-height: 120px;
  max-height: 240px;
}

/* 面包屑 */
.context-ref-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter, #f0f0f0);
}

:where(html.dark) .context-ref-breadcrumb {
  border-color: #2a2b2d;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-item:hover {
  color: var(--el-color-primary, #409eff);
}

.breadcrumb-current {
  color: var(--el-text-color-primary, #1a1a1a);
  font-weight: 500;
}

:where(html.dark) .breadcrumb-current {
  color: #e5eaf3;
}

.breadcrumb-sep {
  color: var(--el-text-color-placeholder, #c0c4cc);
  flex-shrink: 0;
}

/* 空状态 / 加载 */
.context-ref-empty,
.context-ref-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--el-text-color-secondary, #909399);
}

:where(html.dark) .context-ref-empty,
:where(html.dark) .context-ref-loading {
  color: #8d9095;
}

.context-ref-empty p,
.context-ref-loading span {
  font-size: 12px;
  margin: 0;
}

/* 文件列表 */
.context-ref-list {
  padding: 4px 0;
}

.context-ref-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.12s;
  outline: none;
}

.context-ref-entry:hover,
.context-ref-entry:focus-visible {
  background: var(--el-fill-color-light, #f5f5f5);
}

:where(html.dark) .context-ref-entry:hover,
:where(html.dark) .context-ref-entry:focus-visible {
  background: #2a2b2d;
}

.context-ref-entry.is-selected {
  background: var(--el-color-primary-light-9, #ecf5ff);
}

:where(html.dark) .context-ref-entry.is-selected {
  background: rgba(64, 158, 255, 0.12);
}

.context-ref-entry .entry-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary, #1a1a1a);
}

:where(html.dark) .context-ref-entry .entry-name {
  color: #e5eaf3;
}

.context-ref-entry.is-dir .entry-name {
  color: var(--el-text-color-regular, #606266);
}

.entry-check {
  color: var(--el-color-primary, #409eff);
  flex-shrink: 0;
}

/* 底部 */
.context-ref-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-lighter, #f0f0f0);
  gap: 8px;
}

:where(html.dark) .context-ref-footer {
  border-color: #2a2b2d;
}

.context-ref-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--el-border-color, #e6e8ed);
  background: transparent;
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.context-ref-upload-btn:hover {
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
}

:where(html.dark) .context-ref-upload-btn {
  border-color: #3a3b3d;
  color: #cfd3dc;
}

:where(html.dark) .context-ref-upload-btn:hover {
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
}

.context-ref-count {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}

:where(html.dark) .context-ref-count {
  color: #8d9095;
}

/* 过渡动画 */
.context-ref-panel-enter-active,
.context-ref-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.context-ref-panel-enter-from,
.context-ref-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}

.context-ref-panel--up.context-ref-panel-enter-from,
.context-ref-panel--up.context-ref-panel-leave-to {
  transform: translateY(-100%) translateY(-8px) scale(0.97);
}
</style>
