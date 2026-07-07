<template>
  <div class="bg-agents-panel">
    <!-- 标题栏 -->
    <div class="bg-agents-panel__header">
      <span class="bg-agents-panel__title">
        <el-icon class="bg-agents-panel__title-icon"><Cpu /></el-icon>
        后台 Agent
      </span>
      <div class="bg-agents-panel__header-actions">
        <span v-if="stats.running > 0" class="bg-agents-panel__badge bg-agents-panel__badge--running">
          {{ stats.running }} 运行中
        </span>
        <el-button
          text
          size="small"
          :icon="Refresh"
          :loading="loading"
          @click="refresh"
        />
        <el-button
          v-if="closable"
          text
          size="small"
          :icon="Close"
          @click="emit('close')"
        />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && agents.length === 0" class="bg-agents-panel__empty">
      <el-icon class="bg-agents-panel__empty-icon"><Cpu /></el-icon>
      <p>暂无后台 Agent</p>
      <p class="bg-agents-panel__empty-hint">使用 /agents 或 API 启动后台任务</p>
    </div>

    <!-- Agent 列表 -->
    <ul v-else class="bg-agents-panel__list">
      <li
        v-for="agent in agents"
        :key="agent.agent_id"
        class="bg-agents-panel__item"
        :class="`is-${agent.status}`"
      >
        <!-- 状态指示器 -->
        <div class="bg-agents-panel__item-status">
          <el-icon v-if="agent.status === 'running'" class="is-loading"><Loading /></el-icon>
          <el-icon v-else-if="agent.status === 'completed'" class="status-completed"><CircleCheckFilled /></el-icon>
          <el-icon v-else-if="agent.status === 'failed'" class="status-failed"><CircleClose /></el-icon>
          <el-icon v-else-if="agent.status === 'cancelled'" class="status-cancelled"><MinusIcon /></el-icon>
        </div>

        <!-- 内容区 -->
        <div class="bg-agents-panel__item-body">
          <!-- 第一行: agent_id + 状态标签 -->
          <div class="bg-agents-panel__item-header">
            <span class="bg-agents-panel__item-id">{{ agent.agent_id }}</span>
            <el-tag :type="statusTagType(agent.status)" size="small" effect="plain">
              {{ statusLabel(agent.status) }}
            </el-tag>
            <span v-if="agent.progress?.tool_calls" class="bg-agents-panel__item-meta">
              {{ agent.progress.tool_calls }} 次工具调用
            </span>
          </div>

          <!-- 第二行: 任务描述 -->
          <div class="bg-agents-panel__item-prompt" :title="agent.prompt">
            {{ truncate(agent.prompt, 80) }}
          </div>

          <!-- 第三行: 进度预览 (运行中) -->
          <div v-if="agent.status === 'running' && agent.progress?.text_preview" class="bg-agents-panel__item-progress">
            {{ truncate(agent.progress.text_preview, 100) }}
          </div>

          <!-- 第四行: 结果摘要 (已完成) -->
          <div v-if="agent.result?.output && agent.status === 'completed'" class="bg-agents-panel__item-result">
            {{ truncate(agent.result.output, 100) }}
          </div>

          <!-- 第五行: 错误信息 (失败) -->
          <div v-if="agent.error" class="bg-agents-panel__item-error">
            {{ agent.error }}
          </div>

          <!-- 操作栏 -->
          <div class="bg-agents-panel__item-actions">
            <span class="bg-agents-panel__item-time">{{ formatTime(agent.updated_at || agent.created_at) }}</span>
            <el-button
              v-if="agent.status === 'running'"
              text
              size="small"
              type="danger"
              @click="handleCancel(agent.agent_id)"
            >
              取消
            </el-button>
            <el-button
              v-if="agent.status === 'completed'"
              text
              size="small"
              type="primary"
              @click="handleViewResult(agent.agent_id)"
            >
              查看结果
            </el-button>
            <el-button
              v-if="agent.status !== 'running'"
              text
              size="small"
              @click="handlePurge(agent.agent_id)"
            >
              删除
            </el-button>
          </div>
        </div>
      </li>
    </ul>

    <!-- 底部统计 -->
    <div v-if="agents.length > 0" class="bg-agents-panel__footer">
      <span>共 {{ agents.length }} 个</span>
      <span v-if="stats.completed > 0">完成 {{ stats.completed }}</span>
      <span v-if="stats.failed > 0">失败 {{ stats.failed }}</span>
      <span v-if="stats.cancelled > 0">已取消 {{ stats.cancelled }}</span>
    </div>

    <!-- 结果查看弹窗 -->
    <el-dialog
      v-model="resultDialogVisible"
      title="后台 Agent 结果"
      width="700px"
      :append-to-body="true"
    >
      <div v-loading="resultLoading" class="bg-agents-panel__result-dialog">
        <div v-if="currentResult" class="bg-agents-panel__result-content">
          <el-descriptions :column="2" border size="small" class="bg-agents-panel__result-desc">
            <el-descriptions-item label="Agent ID">{{ currentResult.agentId }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ currentResult.data?.status }}</el-descriptions-item>
            <el-descriptions-item label="迭代次数">{{ currentResult.data?.iterations ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="Token 用量">
              {{ formatTokens(currentResult.data?.usage?.total_tokens) }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="bg-agents-panel__result-output">
            <pre>{{ currentResult.data?.output || '(无输出)' }}</pre>
          </div>
        </div>
        <el-empty v-else description="无结果数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Loading, CircleCheckFilled, CircleClose, Cpu, Minus as MinusIcon, Close } from '@/lib/lucide-fallback'
import {
  listBackgroundAgents,
  cancelBackgroundAgent,
  getBackgroundAgentResult,
  purgeBackgroundAgent,
  type BackgroundAgentInfo,
} from '@/api/services/workspace.service'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** 工作区路径 (用于过滤后台 agent) */
  workspacePath?: string
  /** 是否自动轮询 (有运行中任务时) */
  autoPoll?: boolean
  /** 轮询间隔 (ms) */
  pollInterval?: number
  /** 是否显示关闭按钮 */
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  workspacePath: '',
  autoPoll: true,
  pollInterval: 3000,
  closable: false,
})

const emit = defineEmits<{
  close: []
}>()

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

const agents = ref<BackgroundAgentInfo[]>([])
const loading = ref(false)
const resultDialogVisible = ref(false)
const resultLoading = ref(false)
const currentResult = ref<{ agentId: string; data: Record<string, unknown> | null } | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// 计算属性
// ---------------------------------------------------------------------------

const stats = computed(() => {
  const list = agents.value
  return {
    total: list.length,
    running: list.filter((a) => a.status === 'running').length,
    completed: list.filter((a) => a.status === 'completed').length,
    failed: list.filter((a) => a.status === 'failed').length,
    cancelled: list.filter((a) => a.status === 'cancelled').length,
  }
})

const hasRunning = computed(() => stats.value.running > 0)

// ---------------------------------------------------------------------------
// 方法
// ---------------------------------------------------------------------------

async function refresh() {
  loading.value = true
  try {
    agents.value = await listBackgroundAgents(props.workspacePath || undefined)
  } catch (e) {
    console.error('[BackgroundAgentsPanel] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

async function handleCancel(agentId: string) {
  try {
    await ElMessageBox.confirm(`确定取消后台 agent ${agentId} 吗?`, '取消确认', {
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }
  try {
    const ok = await cancelBackgroundAgent(agentId)
    if (ok) {
      ElMessage.success(`Agent ${agentId} 已取消`)
    } else {
      ElMessage.warning('取消失败: agent 可能已结束')
    }
    await refresh()
  } catch (e) {
    ElMessage.error('取消失败')
    console.error(e)
  }
}

async function handleViewResult(agentId: string) {
  resultDialogVisible.value = true
  resultLoading.value = true
  currentResult.value = { agentId, data: null }
  try {
    const data = await getBackgroundAgentResult(agentId)
    currentResult.value = { agentId, data: data as unknown as Record<string, unknown> }
  } catch (e) {
    console.error('[BackgroundAgentsPanel] 获取结果失败:', e)
  } finally {
    resultLoading.value = false
  }
}

async function handlePurge(agentId: string) {
  try {
    await ElMessageBox.confirm(`确定删除后台 agent ${agentId} 的记录吗? 此操作不可恢复。`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await purgeBackgroundAgent(agentId)
    ElMessage.success('已删除')
    await refresh()
  } catch (e) {
    ElMessage.error('删除失败')
    console.error(e)
  }
}

function startPolling() {
  stopPolling()
  if (!props.autoPoll) return
  pollTimer = setInterval(() => {
    // 只在有运行中任务时轮询
    if (hasRunning.value || agents.value.length === 0) {
      refresh()
    }
  }, props.pollInterval)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function statusTagType(status: string): 'primary' | 'success' | 'danger' | 'info' {
  switch (status) {
    case 'running':
      return 'primary'
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    default:
      return 'info'
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }
  return labels[status] ?? status
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return `${Math.floor(diff)}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return new Date(ts * 1000).toLocaleDateString()
}

function formatTokens(n: number | undefined): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------

watch(
  () => props.workspacePath,
  () => refresh(),
)

onMounted(() => {
  refresh()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

// 暴露刷新方法供父组件调用
defineExpose({ refresh })
</script>

<style lang="scss" scoped>
.bg-agents-panel {
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  max-height: 100%;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__title-icon {
    font-size: 16px;
    color: var(--el-color-primary);
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;

    &--running {
      background-color: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
  }

  &__empty {
    padding: 32px 14px;
    text-align: center;
    color: var(--el-text-color-secondary);
  }

  &__empty-icon {
    font-size: 32px;
    color: var(--el-text-color-placeholder);
    margin-bottom: 8px;
  }

  &__empty-hint {
    font-size: 11px;
    margin-top: 4px;
    color: var(--el-text-color-placeholder);
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    transition: background-color 0.15s ease;

    &:last-child {
      border-bottom: none;
    }

    &.is-running {
      background-color: var(--el-color-primary-light-9);
    }
  }

  &__item-status {
    flex-shrink: 0;
    width: 18px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 2px;
    font-size: 14px;

    .is-loading {
      color: var(--el-color-primary);
      animation: bg-agent-spin 1s linear infinite;
    }

    .status-completed {
      color: var(--el-color-success);
    }

    .status-failed {
      color: var(--el-color-danger);
    }

    .status-cancelled {
      color: var(--el-text-color-secondary);
    }
  }

  &__item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__item-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__item-id {
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
    font-weight: 600;
  }

  &__item-meta {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  &__item-prompt {
    font-size: 12px;
    color: var(--el-text-color-primary);
    word-break: break-word;
    line-height: 1.4;
  }

  &__item-progress {
    font-size: 11px;
    color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
    padding: 4px 8px;
    border-radius: 4px;
    word-break: break-word;
    line-height: 1.4;
    max-height: 60px;
    overflow: hidden;
  }

  &__item-result {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    word-break: break-word;
    line-height: 1.4;
    max-height: 60px;
    overflow: hidden;
  }

  &__item-error {
    font-size: 11px;
    color: var(--el-color-danger);
    word-break: break-word;
  }

  &__item-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }

  &__item-time {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    margin-right: auto;
  }

  &__footer {
    display: flex;
    gap: 12px;
    padding: 8px 14px;
    background-color: var(--el-fill-color-light);
    border-top: 1px solid var(--el-border-color-lighter);
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  &__result-dialog {
    min-height: 200px;
  }

  &__result-desc {
    margin-bottom: 12px;
  }

  &__result-output {
    max-height: 400px;
    overflow-y: auto;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;
    padding: 12px;

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.5;
      color: var(--el-text-color-regular);
    }
  }
}

@keyframes bg-agent-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 暗色模式 */
:where(html.dark) {
  .bg-agents-panel {
    &__item {
      &.is-running {
        background-color: var(--color-white-8);
      }
    }

    &__item-progress {
      background-color: var(--color-white-8);
    }

    &__result-output {
      background-color: var(--color-white-8);
    }
  }
}
</style>
