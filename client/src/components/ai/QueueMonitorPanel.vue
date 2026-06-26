<template>
  <div class="queue-monitor-panel" :class="{ 'is-expanded': isExpanded }">
    <!-- 折叠状态 - 只显示简要信息 -->
    <div
      v-if="!isExpanded"
      class="panel-collapsed"
      @click="toggleExpand"
    >
      <div class="collapsed-content">
        <el-icon class="status-icon" :class="statusClass">
          <Loading v-if="stats.processing > 0" />
          <CircleCheck v-else-if="stats.pending === 0 && stats.failed === 0" />
          <Warning v-else-if="stats.failed > 0" />
          <Clock v-else />
        </el-icon>
        <span class="status-text">
          <template v-if="stats.processing > 0">
            {{ t('queue.processing') }} {{ stats.processing }}/{{ stats.total }}
          </template>
          <template v-else-if="stats.pending > 0">
            {{ t('queue.pending') }} {{ stats.pending }}
          </template>
          <template v-else-if="stats.failed > 0">
            {{ t('queue.failed') }} {{ stats.failed }}
          </template>
          <template v-else>
            {{ t('queue.idle') }}
          </template>
        </span>
      </div>
      <el-icon class="expand-icon"><ArrowDown /></el-icon>
    </div>

    <!-- 展开状态 -->
    <div v-else class="panel-expanded">
      <!-- 标题栏 -->
      <div class="panel-header">
        <div class="header-left">
          <el-icon><List /></el-icon>
          <span>{{ t('queue.title') }}</span>
          <el-tag size="small" :type="stats.processing > 0 ? 'primary' : 'info'">
            {{ stats.total }}
          </el-tag>
        </div>
        <div class="header-right">
          <el-button-group size="small">
            <el-button
              v-if="!isPaused"
              @click="handlePause"
              :disabled="stats.processing === 0 && stats.pending === 0"
            >
              <el-icon><VideoPause /></el-icon>
            </el-button>
            <el-button
              v-else
              type="primary"
              @click="handleResume"
            >
              <el-icon><VideoPlay /></el-icon>
            </el-button>
            <el-button @click="handleClear" :disabled="stats.total === 0">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-button-group>
          <el-button link circle size="small" @click="toggleExpand">
            <el-icon><ArrowUp /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="panel-stats">
        <div class="stat-item">
          <span class="stat-value processing">{{ stats.processing }}</span>
          <span class="stat-label">{{ t('queue.processingLabel') }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value pending">{{ stats.pending }}</span>
          <span class="stat-label">{{ t('queue.pendingLabel') }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value completed">{{ stats.completed }}</span>
          <span class="stat-label">{{ t('queue.completedLabel') }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value failed">{{ stats.failed }}</span>
          <span class="stat-label">{{ t('queue.failedLabel') }}</span>
        </div>
      </div>

      <!-- 任务列表 -->
      <div class="panel-content">
        <!-- 处理中的任务 -->
        <template v-if="processingTasks.length > 0">
          <div class="task-group">
            <div class="group-title">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>{{ t('queue.processingTasks') }}</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in processingTasks"
                :key="task.id"
                class="task-item processing"
              >
                <div class="task-info">
                  <el-icon><component :is="getTypeIcon(task.type)" /></el-icon>
                  <span class="task-prompt">{{ truncatePrompt(task.prompt) }}</span>
                </div>
                <div class="task-progress">
                  <el-progress
                    :percentage="task.status.progress"
                    :stroke-width="4"
                    :show-text="false"
                  />
                  <span class="progress-text">{{ task.status.progress }}%</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 等待中的任务 -->
        <template v-if="pendingTasks.length > 0">
          <div class="task-group">
            <div class="group-title">
              <el-icon><Clock /></el-icon>
              <span>{{ t('queue.pendingTasks') }} ({{ pendingTasks.length }})</span>
            </div>
            <div class="task-list">
              <div
                v-for="(task, index) in pendingTasks.slice(0, 5)"
                :key="task.id"
                class="task-item pending"
              >
                <div class="task-info">
                  <span class="task-order">#{{ Number(index) + 1 }}</span>
                  <el-icon><component :is="getTypeIcon(task.type)" /></el-icon>
                  <span class="task-prompt">{{ truncatePrompt(task.prompt) }}</span>
                </div>
                <div class="task-actions">
                  <el-tag size="small" :type="getPriorityType(task.priority)">
                    {{ task.priority }}
                  </el-tag>
                  <el-button
                    link
                    size="small"
                    type="danger"
                    @click="handleCancel(task.id)"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
              </div>
              <div v-if="pendingTasks.length > 5" class="more-tasks">
                {{ t('queue.moreTasks', { count: pendingTasks.length - 5 }) }}
              </div>
            </div>
          </div>
        </template>

        <!-- 空状态 -->
        <div
          v-if="stats.processing === 0 && stats.pending === 0"
          class="empty-state"
        >
          <el-icon><Inbox /></el-icon>
          <span>{{ t('queue.empty') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Loading,
  CircleCheck,
  Warning,
  Clock,
  ArrowDown,
  ArrowUp,
  List,
  VideoPause,
  VideoPlay,
  Delete,
  Close,
  Picture,
  Film,
  Box,
} from '@element-plus/icons-vue'
import { Inbox } from '@/lib/lucide-fallback'
import { useGenerationQueue } from '@/services/GenerationQueueService'
import { useNotificationCenter } from '@/composables/useNotificationCenter'
import type { GenerationType, Priority } from '@/types/ai-platform.types'
import type { Component } from 'vue'

// ============================================================================
// Setup
// ============================================================================

const { t } = useI18n()
const { stats, processingTasks, pendingTasks, pause, resume, clear, cancelTask } = useGenerationQueue()
const { showConfirm, showSuccess } = useNotificationCenter()

// ============================================================================
// 状态
// ============================================================================

const isExpanded = ref(false)
const isPaused = ref(false)

// ============================================================================
// 计算属性
// ============================================================================

const statusClass = computed(() => {
  if (stats.value.processing > 0) return 'processing'
  if (stats.value.failed > 0) return 'failed'
  if (stats.value.pending > 0) return 'pending'
  return 'idle'
})

// ============================================================================
// 方法
// ============================================================================

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const handlePause = () => {
  pause()
  isPaused.value = true
}

const handleResume = () => {
  resume()
  isPaused.value = false
}

const handleClear = async () => {
  const confirmed = await showConfirm(
    t('queue.clearConfirm') || '确定要清空所有待处理任务吗？',
    t('queue.clearTitle') || '清空队列'
  )
  
  if (confirmed) {
    clear()
    showSuccess(t('queue.cleared'))
  }
}

const handleCancel = (taskId: string) => {
  cancelTask(taskId)
}

const getTypeIcon = (type: GenerationType): Component => {
  const icons: Record<GenerationType, Component> = {
    image: Picture,
    video: Film,
    '3d': Box,
    audio: Film,
    text: Film,
  }
  return icons[type] || Picture
}

const getPriorityType = (priority: Priority): '' | 'success' | 'warning' | 'danger' | 'info' => {
  const types: Record<Priority, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    urgent: 'danger',
    high: 'warning',
    normal: 'info',
    low: '',
  }
  return types[priority]
}

const truncatePrompt = (prompt: string, maxLength = 30): string => {
  if (prompt.length <= maxLength) return prompt
  return prompt.substring(0, maxLength) + '...'
}
</script>

<style scoped lang="scss">
// ============================================================================
// 组件级 CSS 变量
// ============================================================================
.queue-monitor-panel {
  // 布局变量
  --qmp-panel-width: 360px;
  --qmp-panel-radius: 12px;
  --qmp-panel-shadow: var(--global-box-shadow);
  --qmp-panel-bottom: 20px;
  --qmp-panel-right: 74px;
  
  // 图标变量
  --qmp-icon-size: 18px;
  --qmp-icon-size-lg: 40px;
  
  // 间距变量
  --qmp-spacing-xs: 2px;
  --qmp-spacing-sm: 4px;
  --qmp-spacing-md: 8px;
  --qmp-spacing-lg: 12px;
  --qmp-spacing-xl: 16px;
  
  // 字体变量
  --qmp-font-xs: 11px;
  --qmp-font-sm: 12px;
  --qmp-font-md: 13px;
  --qmp-font-lg: 14px;
  --qmp-font-xl: 18px;
  
  position: fixed;
  bottom: var(--qmp-panel-bottom);
  right: var(--qmp-panel-right);
  z-index: var(--z-overlay);
  background: var(--el-bg-color);
  border-radius: var(--qmp-panel-radius);
  box-shadow: var(--qmp-panel-shadow);
  transition: width 0.3s ease;
  overflow: hidden;

  &.is-expanded {
    width: var(--qmp-panel-width);
  }
}

// ============================================================================
// 折叠状态
// ============================================================================
.panel-collapsed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: var(--el-fill-color-light);
  }
  
  .collapsed-content {
    display: flex;
    align-items: center;
    gap: var(--qmp-spacing-md);
  }
  
  .status-icon {
    font-size: var(--qmp-icon-size);
    
    &.processing {
      color: var(--el-color-primary);
    }

    &.pending {
      color: var(--el-color-warning);
    }

    &.failed {
      color: var(--el-color-danger);
    }

    &.idle {
      color: var(--el-color-success);
    }
  }
  
  .status-text {
    font-size: var(--qmp-font-md);
    color: var(--el-text-color-regular);
  }
  
  .expand-icon {
    color: var(--el-text-color-secondary);
    transition: transform 0.3s;
  }
}

// ============================================================================
// 展开状态
// ============================================================================
.panel-expanded {
  min-height: 200px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

// ============================================================================
// 头部样式
// ============================================================================
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--qmp-spacing-lg) var(--qmp-spacing-xl);
  border-bottom: var(--unified-border-bottom);
  
  .header-left {
    display: flex;
    align-items: center;
    gap: var(--qmp-spacing-md);
    font-size: var(--qmp-font-lg);
    font-weight: 600;
    
    .el-icon {
      color: var(--el-color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    img {
      display: block;
      vertical-align: middle;
      object-fit: contain;
    }
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--qmp-spacing-md);
    
    img {
      display: block;
      vertical-align: middle;
      object-fit: contain;
    }
  }
  
  img {
    display: block;
    vertical-align: middle;
    margin: 0 auto;
    object-fit: contain;
  }
}

// ============================================================================
// 统计面板
// ============================================================================
.panel-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--qmp-spacing-md);
  padding: var(--qmp-spacing-lg) var(--qmp-spacing-xl);
  border-bottom: var(--unified-border-bottom);
  background: var(--el-fill-color-lighter);
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--qmp-spacing-xs);
  }
  
  .stat-value {
    font-size: var(--qmp-font-xl);
    font-weight: 700;
    
    &.processing { color: var(--el-color-primary); }
    &.pending { color: var(--el-color-warning); }
    &.completed { color: var(--el-color-success); }
    &.failed { color: var(--el-color-danger); }
  }
  
  .stat-label {
    font-size: var(--qmp-font-xs);
    color: var(--el-text-color-secondary);
  }
}

// ============================================================================
// 内容区域
// ============================================================================
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--qmp-spacing-lg) var(--qmp-spacing-xl);
}

// ============================================================================
// 任务组
// ============================================================================
.task-group {
  margin-bottom: var(--qmp-spacing-xl);
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--qmp-spacing-md);
    font-size: var(--qmp-font-sm);
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }
}

// ============================================================================
// 任务列表
// ============================================================================
.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--qmp-spacing-md);
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--qmp-spacing-md) 10px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  
  &.processing {
    background: var(--el-color-primary-light-9);
  }
  
  .task-info {
    display: flex;
    align-items: center;
    gap: var(--qmp-spacing-md);
    flex: 1;
    min-width: 0;
    
    .task-order {
      font-size: var(--qmp-font-xs);
      color: var(--el-text-color-secondary);
    }
    
    .el-icon {
      flex-shrink: 0;
      color: var(--el-text-color-secondary);
    }
    
    .task-prompt {
      font-size: var(--qmp-font-sm);
      color: var(--el-text-color-regular);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  
  .task-progress {
    display: flex;
    align-items: center;
    gap: var(--qmp-spacing-md);
    width: 80px;
    
    .el-progress {
      flex: 1;
    }
    
    .progress-text {
      font-size: var(--qmp-font-xs);
      color: var(--el-color-primary);
      width: 30px;
      text-align: right;
    }
  }
  
  .task-actions {
    display: flex;
    align-items: center;
    gap: var(--qmp-spacing-sm);
  }
}

// ============================================================================
// 更多任务提示
// ============================================================================
.more-tasks {
  text-align: center;
  padding: var(--qmp-spacing-md);
  font-size: var(--qmp-font-sm);
  color: var(--el-text-color-secondary);
}

// ============================================================================
// 空状态
// ============================================================================
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: var(--el-text-color-secondary);
  
  .el-icon {
    font-size: var(--qmp-icon-size-lg);
    margin-bottom: var(--qmp-spacing-md);
  }
  
  span {
    font-size: var(--qmp-font-md);
  }
}
</style>

<!-- ============================================================================
     Element Plus 组件样式覆盖（非 scoped）
     使用单类，禁止高特异性 
============================================================================ -->
<style lang="scss">
// 通过组件根类名限定作用域，增加特异性
:where(.queue-monitor-panel) {
  // 定义 Element Plus 覆盖变量
  --qmp-el-icon-size: 18px;
  
  // 按钮组样式覆盖
  :where(.header-right) :where(.el-button-group) .el-button {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    
    // 按钮内所有子元素
    > * {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
      flex-shrink: 0;
    }
    
    // 图标容器 span
    > span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      height: auto;
      min-width: 0;
      min-height: 0;
      flex: 0 0 auto;
    }
    
    // 图标样式
    .el-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin: 0;
      padding: 0;
      font-size: var(--qmp-el-icon-size);
    }
  }
  
  // 圆形链接按钮样式覆盖（收起按钮）
  .header-right .el-button.is-circle.is-link {
    display: flex;
    align-items: center;
    justify-content: center;
    
    // 按钮内所有子元素
    > * {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
      flex-shrink: 0;
    }
    
    // 图标容器 span
    > span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      height: auto;
      min-width: 0;
      min-height: 0;
      flex: 0 0 auto;
    }
    
    // 图标样式
    .el-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin: 0;
      padding: 0;
      font-size: var(--qmp-el-icon-size);
    }
  }
}
</style>
