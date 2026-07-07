<template>
  <div class="routines-panel">
    <!-- 标题栏 -->
    <div class="routines-panel__header">
      <span class="routines-panel__title">
        <el-icon class="routines-panel__title-icon"><Timer /></el-icon>
        定时任务
      </span>
      <div class="routines-panel__header-actions">
        <span v-if="enabledCount > 0" class="routines-panel__badge routines-panel__badge--active">
          {{ enabledCount }} 活跃
        </span>
        <el-button text size="small" :icon="Refresh" :loading="loading" @click="refresh" />
        <el-button v-if="closable" text size="small" :icon="Close" @click="emit('close')" />
      </div>
    </div>

    <!-- 创建按钮 -->
    <div class="routines-panel__create-bar">
      <el-button size="small" type="primary" :icon="Plus" @click="showCreateForm = !showCreateForm">
        {{ showCreateForm ? '取消' : '新建任务' }}
      </el-button>
    </div>

    <!-- 创建表单 -->
    <div v-if="showCreateForm" class="routines-panel__form">
      <el-input v-model="newRoutine.name" placeholder="任务名称" size="small" class="routines-panel__form-input" />
      <el-input v-model="newRoutine.cron_expression" placeholder="Cron 表达式 (如: 0 9 * * 1-5)" size="small" class="routines-panel__form-input" />
      <el-input v-model="newRoutine.prompt" type="textarea" :rows="2" placeholder="定时执行的 Prompt" size="small" class="routines-panel__form-input" />
      <el-button size="small" type="success" :loading="creating" @click="handleCreate">创建</el-button>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && routines.length === 0" class="routines-panel__empty">
      <el-icon class="routines-panel__empty-icon"><Timer /></el-icon>
      <p>暂无定时任务</p>
      <p class="routines-panel__empty-hint">点击"新建任务"或使用 /routine add 创建</p>
    </div>

    <!-- 任务列表 -->
    <ul v-else class="routines-panel__list">
      <li v-for="routine in routines" :key="routine.id" class="routines-panel__item" :class="{ 'is-disabled': !routine.enabled }">
        <div class="routines-panel__item-header">
          <span class="routines-panel__item-name">{{ routine.name }}</span>
          <el-tag :type="routine.enabled ? 'success' : 'info'" size="small" effect="plain">
            {{ routine.enabled ? '启用' : '禁用' }}
          </el-tag>
        </div>
        <div class="routines-panel__item-cron">
          <el-icon><Clock /></el-icon>
          <code>{{ routine.cron_expression }}</code>
        </div>
        <div class="routines-panel__item-prompt" :title="routine.prompt">{{ routine.prompt }}</div>
        <div class="routines-panel__item-meta">
          <span v-if="routine.next_run" class="routines-panel__item-next">
            下次: {{ formatTime(routine.next_run) }}
          </span>
          <span v-if="routine.last_run" class="routines-panel__item-last">
            上次: {{ formatTime(routine.last_run) }}
          </span>
        </div>
        <div class="routines-panel__item-actions">
          <el-button text size="small" :type="routine.enabled ? 'warning' : 'success'" @click="toggleEnable(routine)">
            {{ routine.enabled ? '禁用' : '启用' }}
          </el-button>
          <el-button text size="small" type="primary" @click="handleTrigger(routine)">触发</el-button>
          <el-button text size="small" type="danger" @click="handleDelete(routine)">删除</el-button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Close, Plus, Timer, Clock } from '@element-plus/icons-vue'
import {
  listRoutines,
  createRoutine,
  deleteRoutine,
  triggerRoutine,
  type RoutineInfo,
} from '@/api/services/workspace.service'

const props = defineProps<{
  workspacePath: string
  closable?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)
const routines = ref<RoutineInfo[]>([])
const showCreateForm = ref(false)
const creating = ref(false)
const newRoutine = ref({
  name: '',
  cron_expression: '',
  prompt: '',
})

const enabledCount = computed(() => routines.value.filter(r => r.enabled).length)

async function refresh() {
  if (!props.workspacePath) return
  loading.value = true
  try {
    routines.value = await listRoutines(props.workspacePath)
  } catch (e) {
    console.error('加载定时任务失败:', e)
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!newRoutine.value.name || !newRoutine.value.cron_expression || !newRoutine.value.prompt) {
    ElMessage.warning('请填写完整信息')
    return
  }
  creating.value = true
  try {
    await createRoutine({
      ...newRoutine.value,
      workspace_path: props.workspacePath,
    })
    ElMessage.success('定时任务已创建')
    newRoutine.value = { name: '', cron_expression: '', prompt: '' }
    showCreateForm.value = false
    await refresh()
  } catch (e) {
    ElMessage.error('创建失败: ' + (e as Error).message)
  } finally {
    creating.value = false
  }
}

async function toggleEnable(routine: RoutineInfo) {
  // 通过 updateRoutine 切换 enabled 状态
  try {
    const { updateRoutine } = await import('@/api/services/workspace.service')
    await updateRoutine(routine.id, { enabled: !routine.enabled })
    ElMessage.success(routine.enabled ? '已禁用' : '已启用')
    await refresh()
  } catch (e) {
    ElMessage.error('操作失败: ' + (e as Error).message)
  }
}

async function handleTrigger(routine: RoutineInfo) {
  try {
    const result = await triggerRoutine(routine.id)
    if (result.triggered) {
      ElMessage.success(`已触发 (${result.agent_id || ''})`)
    } else {
      ElMessage.warning('触发失败')
    }
  } catch (e) {
    ElMessage.error('触发失败: ' + (e as Error).message)
  }
}

async function handleDelete(routine: RoutineInfo) {
  try {
    await ElMessageBox.confirm(`确定删除任务 "${routine.name}"?`, '确认', { type: 'warning' })
    await deleteRoutine(routine.id)
    ElMessage.success('已删除')
    await refresh()
  } catch {
    // 用户取消
  }
}

function formatTime(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  refresh()
})

watch(() => props.workspacePath, () => {
  refresh()
})
</script>

<style scoped lang="scss">
.routines-panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 14px;
  }

  &__title-icon {
    font-size: 16px;
    color: var(--el-color-primary);
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;

    &--active {
      background: var(--el-color-success-light-9);
      color: var(--el-color-success);
    }
  }

  &__create-bar {
    padding: 8px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-light);

    &-input {
      width: 100%;
    }
  }

  &__empty {
    text-align: center;
    padding: 32px 16px;
    color: var(--el-text-color-secondary);

    &-icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.4;
    }

    p {
      margin: 4px 0;
      font-size: 13px;
    }

    .routines-panel__empty-hint {
      font-size: 12px;
      opacity: 0.7;
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 360px;
    overflow-y: auto;
  }

  &__item {
    padding: 10px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    transition: background 0.15s;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.is-disabled {
      opacity: 0.55;
    }

    &-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    &-name {
      font-weight: 600;
      font-size: 13px;
    }

    &-cron {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 4px;

      code {
        font-family: 'SF Mono', 'Fira Code', monospace;
        background: var(--el-fill-color);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 11px;
      }
    }

    &-prompt {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    &-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: var(--el-text-color-placeholder);
      margin-bottom: 6px;
    }

    &-actions {
      display: flex;
      gap: 4px;
    }
  }
}
</style>
