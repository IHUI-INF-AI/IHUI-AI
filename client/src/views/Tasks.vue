<template>
  <div class="tasks-container page-container" role="main">
    <!-- 页面头部 -->
    <header class="tasks-header">
      <div class="header-content">
        <div class="page-title-group">
          <h1 class="page-title">{{ t('tasks.title') }}</h1>
          <p class="page-subtitle">{{ t('tasks.subtitle') }}</p>
        </div>
      </div>
    </header>

    <!-- 任务列表 -->
    <div class="tasks-content">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="6" animated />
      </div>

      <el-empty v-else-if="tasks.length === 0 && !error" :description="t('tasks.noTasks')" />

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-container">
        <el-empty :description="error">
          <el-button type="primary" @click="loadTasks">{{ t('tasks.retry') }}</el-button>
        </el-empty>
      </div>

      <!-- 任务列表 -->
      <div v-else class="tasks-list">
        <el-card v-for="task in tasks" :key="task.taskId" class="task-card" shadow="never">
          <div class="task-content">
            <div class="task-header">
              <div class="task-info">
                <h3 class="task-title">{{ task.type }}</h3>
                <el-tag :type="getStatusType(task.status)">
                  {{ getStatusText(task.status) }}
                </el-tag>
              </div>
              <div class="task-actions">
                <el-button
                  v-if="task.status === 'pending' || task.status === 'processing'"
                  text
                  type="danger"
                  size="small"
                  @click="handleCancelTask(task)"
                >
                  {{ t('tasks.cancel') }}
                </el-button>
              </div>
            </div>

            <!-- 进度条 -->
            <div v-if="task.status === 'processing'" class="task-progress">
              <el-progress
                :percentage="task.progress"
                :status="task.status === 'failed' ? 'exception' : undefined"
              />
            </div>

            <!-- 任务结果 -->
            <div v-if="task.result" class="task-result">
              <el-collapse>
                <el-collapse-item :title="t('tasks.viewResults')" name="result">
                  <pre class="result-content">{{ JSON.stringify(task.result, null, 2) }}</pre>
                </el-collapse-item>
              </el-collapse>
            </div>

            <!-- 错误信息 -->
            <div v-if="task.error" class="task-error">
              <el-alert :title="task.error" type="error" :closable="false" />
            </div>

            <!-- 任务元信息 -->
            <div class="task-meta">
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                {{ t('tasks.createdAt') }}: {{ formatDate(task.createdAt) }}
              </span>
              <span class="meta-item">
                <el-icon><Refresh /></el-icon>
                {{ t('tasks.updatedAt') }}: {{ formatDate(task.updatedAt) }}
              </span>
              <span v-if="task.cancelledAt" class="meta-item">
                <el-icon><Close /></el-icon>
                {{ t('tasks.cancelledAt') }}: {{ formatDate(task.cancelledAt) }}
              </span>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Clock, Refresh, Close } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { getTasks, cancelTask, type Task } from '@/api/tasks'
import { useTaskWebSocket } from '@/composables/useTaskWebSocket'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const authStore = useAuthStore() as ReturnType<typeof useAuthStore> & {
  user: { uuid?: string } | null
}
const { handleResult } = useOperationFeedback()
const { confirmDelete } = useConfirmDialog()
const { loading: apiLoading, error: apiError, execute } = useApiError()

// 响应式数据
const tasks = ref<Task[]>([])
const loading = computed(() => apiLoading.value)
const error = computed(() => apiError.value?.message || null)

// WebSocket连接
const { connected: _connected, onTaskEvent, joinUserRoom, leaveUserRoom } = useTaskWebSocket({
  autoConnect: true,
  onConnect: () => {
    if (authStore.user?.uuid) {
      joinUserRoom(authStore.user.uuid)
    }
  },
})

// 监听任务更新事件
const unsubscribe = onTaskEvent('task:update', event => {
  const index = tasks.value.findIndex(t => t.taskId === event.taskId)
  if (index !== -1) {
    tasks.value[index] = {
      ...tasks.value[index],
      status: event.status,
      progress: event.progress,
      result: event.result,
      error: event.error,
      updatedAt: event.updatedAt,
    }
  } else {
    // 新任务，添加到列表
    tasks.value.unshift({
      taskId: event.taskId,
      type: event.type,
      status: event.status,
      progress: event.progress,
      result: event.result,
      error: event.error,
      updatedAt: event.updatedAt,
      createdAt: event.updatedAt,
    })
  }
})

// 监听任务取消事件
const unsubscribeCancelled = onTaskEvent('task:cancelled', event => {
  const index = tasks.value.findIndex(t => t.taskId === event.taskId)
  if (index !== -1) {
    tasks.value[index] = {
      ...tasks.value[index],
      status: 'cancelled',
      cancelledAt: event.cancelledAt,
      cancelledBy: event.cancelledBy,
    }
  }
})

// 加载任务列表
const loadTasks = async () => {
  const result = await execute(
    () =>
      getTasks({
        page: 1,
        pageSize: 50,
      }),
    {
      showMessage: false,
    }
  )

  if (result && 'items' in result) {
    tasks.value = result.items || []
  } else {
    tasks.value = []
  }
}

// 取消任务
const handleCancelTask = async (task: Task) => {
  const confirmed = await confirmDelete(t('tasks.confirmCancel'))
  if (!confirmed) return

  // 乐观更新
  const previousStatus = task.status
  const index = tasks.value.findIndex(t => t.taskId === task.taskId)
  if (index !== -1) {
    tasks.value[index].status = 'cancelled'
  }

  await handleResult(cancelTask(task.taskId), {
    successMessage: t('tasks.cancelSuccess'),
    errorMessage: t('tasks.cancelFailed'),
    onError: () => {
      // 回滚状态
      if (index !== -1) {
        tasks.value[index].status = previousStatus
      }
    },
  })
}

// 获取状态类型
const getStatusType = (status: string) => {
  const statusMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    completed: 'success',
    processing: 'warning',
    failed: 'danger',
    cancelled: 'info',
    pending: 'info',
  }
  return statusMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: t('tasks.status.pending'),
    processing: t('tasks.status.processing'),
    completed: t('tasks.status.completed'),
    failed: t('tasks.status.failed'),
    cancelled: t('tasks.status.cancelled'),
  }
  return statusMap[status] || t('tasks.status.unknown')
}

// 格式化日期
const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 初始化
onMounted(() => {
  loadTasks()
})

// 清理
onUnmounted(() => {
  unsubscribe()
  unsubscribeCancelled()
  if (authStore.user?.uuid) {
    leaveUserRoom(authStore.user.uuid)
  }
})
</script>

<style scoped lang="scss">
.tasks-container {
  padding: 24px;
  width: 100%;
  margin: 0 auto;
}

.tasks-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 28px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--el-text-color-regular);
    margin: 0;
  }
}

.tasks-content {
  /* 容器自身样式 */
}

.loading-container,
.error-container {
  padding: 40px 0;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-card {
  /* 卡片样式 */
}

.task-content {
  /* 内容样式 */
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.task-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.task-progress {
  margin-bottom: 16px;
}

.task-result {
  margin-bottom: 16px;
}

.result-content {
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  overflow-x: auto;
}

.task-error {
  margin-bottom: 16px;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
