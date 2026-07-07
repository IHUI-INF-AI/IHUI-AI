<!--
  WorkspaceFolderSelector — 工作区文件夹选择器组件

  对标 Claude Code / Cursor / Codex 的工作区选择界面:
  - 浏览本地文件系统
  - 最近项目列表
  - 显示技术栈/Git 状态
  - 选择后进入工作区

  用法:
    <WorkspaceFolderSelector
      v-model:visible="showSelector"
      @select="handleFolderSelect"
    />
-->
<template>
  <Teleport to="body">
    <Transition name="workspace-selector">
      <div
        v-if="visible"
        class="workspace-selector-overlay"
        @click.self="handleClose"
      >
        <div class="workspace-selector-dialog">
          <!-- 标题栏 -->
          <div class="ws-header">
            <h2 class="ws-title">{{ t('workspaceFolder.selectTitle') }}</h2>
            <button class="ws-close-btn" @click="handleClose" :aria-label="t('common.close')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 内容区: 左侧浏览 + 右侧最近 -->
          <div class="ws-body">
            <!-- 左侧: 文件浏览 -->
            <div class="ws-browser">
              <div class="ws-browser-toolbar">
                <!-- 当前路径面包屑 -->
                <div class="ws-breadcrumb">
                  <button
                    class="ws-breadcrumb-item"
                    @click="goUp"
                    :disabled="!currentPath"
                    :title="t('workspaceFolder.goUp')"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <span class="ws-current-path" :title="currentPath || t('workspaceFolder.selectDrive')">
                    {{ currentPath || t('workspaceFolder.selectDrive') }}
                  </span>
                </div>
                <!-- 新建项目按钮 -->
                <button class="ws-new-btn" @click="handleNewProject">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {{ t('workspaceFolder.newProject') }}
                </button>
              </div>

              <!-- 目录列表 -->
              <div class="ws-dir-list" ref="dirListRef">
                <div v-if="loading" class="ws-loading">
                  <span class="ws-spinner"></span>
                  {{ t('common.loading') }}
                </div>
                <div v-else-if="dirEntries.length === 0" class="ws-empty">
                  {{ t('workspaceFolder.noFolders') }}
                </div>
                <div
                  v-for="entry in dirEntries"
                  :key="entry.path"
                  v-else
                  class="ws-dir-item"
                  :class="{
                    'is-selected': selectedPath === entry.path,
                    'is-dir': entry.is_dir,
                  }"
                  @click="handleEntryClick(entry)"
                  @dblclick="handleEntryDblClick(entry)"
                >
                  <span class="ws-dir-icon">
                    <svg v-if="entry.is_dir" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                    </svg>
                    <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </span>
                  <span class="ws-dir-name">{{ entry.name }}</span>
                  <span v-if="!entry.is_dir && entry.size > 0" class="ws-dir-size">
                    {{ formatSize(entry.size) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 右侧: 最近项目 -->
            <div class="ws-recent">
              <h3 class="ws-recent-title">{{ t('workspaceFolder.recentProjects') }}</h3>
              <div v-if="recentWorkspaces.length === 0" class="ws-recent-empty">
                {{ t('workspaceFolder.noRecentProjects') }}
              </div>
              <div
                v-for="ws in recentWorkspaces"
                :key="ws.path"
                v-else
                class="ws-recent-item"
                @click="handleRecentClick(ws)"
              >
                <div class="ws-recent-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  </svg>
                </div>
                <div class="ws-recent-info">
                  <span class="ws-recent-name">{{ ws.name }}</span>
                  <span class="ws-recent-path" :title="ws.path">{{ ws.path }}</span>
                  <div v-if="ws.tech_stack?.length" class="ws-recent-tech">
                    <span v-for="tech in ws.tech_stack.slice(0, 4)" :key="tech" class="ws-tech-tag">{{ tech }}</span>
                  </div>
                </div>
                <span class="ws-recent-time">{{ formatTime(ws.last_opened) }}</span>
              </div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="ws-footer">
            <div class="ws-selected-info" v-if="selectedPath">
              <span class="ws-selected-label">{{ t('workspaceFolder.selected') }}:</span>
              <span class="ws-selected-path" :title="selectedPath">{{ selectedPath }}</span>
            </div>
            <div class="ws-footer-actions">
              <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
              <el-button
                type="primary"
                :disabled="!selectedPath"
                @click="handleConfirm"
              >
                {{ t('workspaceFolder.openWorkspace') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  browseDirectory,
  openWorkspace,
  getRecentWorkspaces,
  type DirEntry,
  type RecentWorkspace,
} from '@/api/services/workspace.service'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [path: string]
}>()

// 状态
const loading = ref(false)
const currentPath = ref('')
const dirEntries = ref<DirEntry[]>([])
const selectedPath = ref('')
const recentWorkspaces = ref<RecentWorkspace[]>([])
const dirListRef = ref<HTMLElement>()

// 监听 visible 变化
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      await loadRecent()
      if (!currentPath.value) {
        await browse()
      }
    }
  },
)

onMounted(async () => {
  if (props.visible) {
    await loadRecent()
    await browse()
  }
})

// 浏览目录
async function browse(path?: string) {
  loading.value = true
  try {
    const entries = await browseDirectory(path)
    dirEntries.value = entries
    currentPath.value = path ?? ''
    selectedPath.value = ''
  } catch (e) {
    console.error('[WorkspaceFolderSelector] browse error:', e)
    dirEntries.value = []
  } finally {
    loading.value = false
  }
}

// 加载最近项目
async function loadRecent() {
  try {
    recentWorkspaces.value = await getRecentWorkspaces()
  } catch {
    recentWorkspaces.value = []
  }
}

// 点击目录项
function handleEntryClick(entry: DirEntry) {
  if (entry.is_dir) {
    selectedPath.value = entry.path
  }
}

// 双击进入目录
function handleEntryDblClick(entry: DirEntry) {
  if (entry.is_dir) {
    browse(entry.path)
  }
}

// 返回上级
function goUp() {
  if (!currentPath.value) return
  const parts = currentPath.value.replace(/\\/g, '/').split('/')
  parts.pop()
  const parent = parts.join('/')
  if (parent) {
    browse(parent)
  } else {
    browse('') // 回到根/盘符列表
  }
}

// 点击最近项目
async function handleRecentClick(ws: RecentWorkspace) {
  selectedPath.value = ws.path
  emit('select', ws.path)
  emit('update:visible', false)
}

// 新建项目
function handleNewProject() {
  // 暂时简化: 打开一个 prompt 输入路径
  // 后续可以做成模板选择器
  const path = window.prompt(t('workspaceFolder.enterProjectPath') + ':')
  if (path) {
    selectedPath.value = path
  }
}

// 确认选择
async function handleConfirm() {
  if (!selectedPath.value) return
  try {
    await openWorkspace(selectedPath.value)
    emit('select', selectedPath.value)
    emit('update:visible', false)
  } catch (e) {
    console.error('[WorkspaceFolderSelector] openWorkspace error:', e)
  }
}

// 关闭
function handleClose() {
  emit('update:visible', false)
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// 格式化时间
function formatTime(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts * 1000
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('workspaceFolder.justNow')
  if (minutes < 60) return `${minutes} ${t('workspaceFolder.minutesAgo')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${t('workspaceFolder.hoursAgo')}`
  const days = Math.floor(hours / 24)
  return `${days} ${t('workspaceFolder.daysAgo')}`
}
</script>

<style scoped lang="scss">
.workspace-selector-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.workspace-selector-dialog {
  width: 800px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}

.ws-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color);

  .ws-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .ws-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-primary);
    }
  }
}

.ws-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.ws-browser {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color);
}

.ws-browser-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color);
  gap: 8px;
}

.ws-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;

  .ws-breadcrumb-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      color: var(--el-text-color-primary);
      border-color: var(--el-color-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .ws-current-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--el-text-color-regular);
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }
}

.ws-new-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }
}

.ws-dir-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.ws-loading,
.ws-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.ws-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--el-border-color);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: ws-spin 0.8s linear infinite;
}

@keyframes ws-spin {
  to {
    transform: rotate(360deg);
  }
}

.ws-dir-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.is-selected {
    background: var(--el-color-primary-light-9);

    .ws-dir-name {
      color: var(--el-color-primary);
    }
  }

  .ws-dir-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
  }

  .ws-dir-name {
    flex: 1;
    font-size: 14px;
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ws-dir-size {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
  }
}

.ws-recent {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-lighter);

  .ws-recent-title {
    margin: 0;
    padding: 12px 16px 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .ws-recent-empty {
    padding: 24px 16px;
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    text-align: center;
  }
}

.ws-recent-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--el-fill-color);
  }

  .ws-recent-icon {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
    margin-top: 2px;
  }

  .ws-recent-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ws-recent-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ws-recent-path {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }

  .ws-recent-tech {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .ws-tech-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--el-fill-color);
    color: var(--el-text-color-secondary);
    border: 1px solid var(--el-border-color);
  }

  .ws-recent-time {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
    white-space: nowrap;
  }
}

.ws-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--el-border-color);
  gap: 12px;
}

.ws-selected-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;

  .ws-selected-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  .ws-selected-path {
    font-size: 13px;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }
}

.ws-footer-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

// 过渡动画
.workspace-selector-enter-active,
.workspace-selector-leave-active {
  transition: opacity 0.2s;

  .workspace-selector-dialog {
    transition: transform 0.2s, opacity 0.2s;
  }
}

.workspace-selector-enter-from,
.workspace-selector-leave-to {
  opacity: 0;

  .workspace-selector-dialog {
    transform: scale(0.95);
    opacity: 0;
  }
}
</style>
