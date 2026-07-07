<template>
  <div class="task-list-panel">
    <!-- 标题栏 -->
    <div class="task-list-panel__header">
      <span class="task-list-panel__title">
        {{ t('floatingChat.workspaceAgent.taskList.title') }}
      </span>
      <span v-if="stats.total > 0" class="task-list-panel__counter">
        {{ stats.completed }}/{{ stats.total }}
      </span>
    </div>

    <!-- 空状态 -->
    <div v-if="!todos || todos.length === 0" class="task-list-panel__empty">
      {{ t('floatingChat.workspaceAgent.taskList.empty') }}
    </div>

    <!-- 任务列表 -->
    <ul v-else class="task-list-panel__list">
      <li
        v-for="(todo, idx) in todos"
        :key="idx"
        class="task-list-panel__item"
        :class="`is-${todo.status}`"
      >
        <!-- 状态图标 -->
        <span class="task-list-panel__status" :aria-label="todo.status">
          <span v-if="todo.status === 'completed'" class="status-completed">●</span>
          <span v-else-if="todo.status === 'in_progress'" class="status-progress">◐</span>
          <span v-else class="status-pending">○</span>
        </span>

        <!-- 任务内容 -->
        <span class="task-list-panel__content" :class="{ 'is-struck': todo.status === 'completed' }">
          {{ todo.content }}
        </span>

        <!-- 优先级标签 -->
        <el-tag
          v-if="todo.priority"
          :type="priorityType(todo.priority)"
          size="small"
          effect="plain"
          class="task-list-panel__priority"
        >
          {{ priorityLabel(todo.priority) }}
        </el-tag>
      </li>
    </ul>

    <!-- 进度条 -->
    <div v-if="stats.total > 0" class="task-list-panel__progress">
      <div class="task-list-panel__progress-bar" :style="{ width: `${stats.percent}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority?: 'high' | 'medium' | 'low'
}

const { t } = useI18n()

interface Props {
  /** 任务清单 (来自 agent.todo.update 事件) */
  todos: TodoItem[]
}

const props = withDefaults(defineProps<Props>(), {
  todos: () => [],
})

const stats = computed(() => {
  const total = props.todos?.length ?? 0
  const completed = props.todos?.filter((x: TodoItem) => x.status === 'completed').length ?? 0
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { total, completed, percent }
})

function priorityType(p: string): 'danger' | 'warning' | 'info' {
  if (p === 'high') return 'danger'
  if (p === 'medium') return 'warning'
  return 'info'
}

function priorityLabel(p: string): string {
  return t(`floatingChat.workspaceAgent.taskList.priority.${p}`)
}
</script>

<style lang="scss" scoped>
.task-list-panel {
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;
  font-size: 13px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__title {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__counter {
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__empty {
    padding: 18px 14px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 6px 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    transition: background-color 0.15s ease;

    &:last-child {
      border-bottom: none;
    }

    &.is-in_progress {
      background-color: var(--el-color-primary-light-9);
    }

    &.is-completed {
      .task-list-panel__status .status-completed {
        color: var(--el-color-success);
      }
    }
  }

  &__status {
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    font-size: 14px;
    line-height: 1;

    .status-pending {
      color: var(--el-text-color-secondary);
    }
    .status-progress {
      color: var(--el-color-primary);
      animation: task-pulse 1.2s ease-in-out infinite;
    }
    .status-completed {
      color: var(--el-color-success);
    }
  }

  &__content {
    flex: 1;
    min-width: 0;
    color: var(--el-text-color-primary);
    word-break: break-word;

    &.is-struck {
      text-decoration: line-through;
      color: var(--el-text-color-secondary);
    }
  }

  &__priority {
    flex-shrink: 0;
  }

  &__progress {
    height: 3px;
    background-color: var(--el-fill-color-light);
    border-top: 1px solid var(--el-border-color-lighter);
  }

  &__progress-bar {
    height: 100%;
    background-color: var(--el-color-success);
    transition: width 0.3s ease;
  }
}

@keyframes task-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

/* 暗色模式 */
:where(html.dark) {
  .task-list-panel {
    &__item.is-in_progress {
      background-color: var(--color-white-8);
    }
  }
}
</style>
