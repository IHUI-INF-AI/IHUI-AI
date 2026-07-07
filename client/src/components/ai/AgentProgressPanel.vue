<template>
  <div class="agent-progress-panel">
    <!-- 运行状态指示 -->
    <div class="agent-progress-panel__status-bar" :class="{ 'is-running': isRunning }">
      <span class="agent-progress-panel__status-indicator">
        <el-icon v-if="isRunning" class="is-loading"><Loading /></el-icon>
        <el-icon v-else><CircleCheck /></el-icon>
      </span>
      <span class="agent-progress-panel__status-text">
        {{ isRunning ? t('floatingChat.workspaceAgent.agentRunning') : t('floatingChat.workspaceAgent.agentIdle') }}
      </span>
    </div>

    <!-- 上下文信息（可折叠） -->
    <el-collapse v-if="context" v-model="contextCollapsed" class="agent-progress-panel__collapse">
      <el-collapse-item :title="t('floatingChat.workspaceAgent.contextInfo')" name="context">
        <div class="agent-progress-panel__context">
          <div v-if="context.workspace" class="agent-progress-panel__context-item">
            <span class="agent-progress-panel__context-label">
              {{ t('floatingChat.workspaceAgent.workspace') }}:
            </span>
            <span class="agent-progress-panel__context-value" :title="context.workspace">{{ context.workspace }}</span>
          </div>
          <div v-if="context.model" class="agent-progress-panel__context-item">
            <span class="agent-progress-panel__context-label">
              {{ t('floatingChat.workspaceAgent.model') }}:
            </span>
            <span class="agent-progress-panel__context-value">{{ context.model }}</span>
          </div>
          <div v-if="context.tools && context.tools.length > 0" class="agent-progress-panel__context-item">
            <span class="agent-progress-panel__context-label">
              {{ t('floatingChat.workspaceAgent.availableTools') }}:
            </span>
            <div class="agent-progress-panel__tools-list">
              <el-tag v-for="tool in context.tools" :key="tool" size="small" type="info" effect="plain">
                {{ tool }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <!-- 工具调用时间线（可折叠） -->
    <el-collapse v-model="timelineCollapsed" class="agent-progress-panel__collapse">
      <el-collapse-item :title="t('floatingChat.workspaceAgent.toolTimeline')" name="timeline">
        <div v-if="toolCalls.length === 0" class="agent-progress-panel__empty">
          {{ t('floatingChat.workspaceAgent.noToolCalls') }}
        </div>
        <div v-else class="agent-progress-panel__timeline">
          <div
            v-for="toolCall in toolCalls"
            :key="toolCall.id"
            class="agent-progress-panel__timeline-item"
            :class="`is-${toolCall.status}`"
          >
            <!-- 时间线连接线 -->
            <div class="agent-progress-panel__timeline-marker">
              <el-icon v-if="toolCall.status === 'running'" class="is-loading marker-running">
                <Loading />
              </el-icon>
              <el-icon v-else-if="toolCall.status === 'completed'" class="marker-completed">
                <CircleCheckFilled />
              </el-icon>
              <el-icon v-else-if="toolCall.status === 'failed'" class="marker-failed">
                <CircleCloseFilled />
              </el-icon>
              <el-icon v-else-if="toolCall.status === 'blocked'" class="marker-blocked">
                <WarnTriangleFilled />
              </el-icon>
            </div>

            <!-- 工具调用卡片 -->
            <div class="agent-progress-panel__timeline-content">
              <ToolCallCard
                :tool-name="toolCall.name"
                :tool-input="toolCall.input"
                :tool-output="toolCall.output"
                :status="toolCall.status"
                :iteration="toolCall.iteration"
                :error="toolCall.error"
              />
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Loading,
  CircleCheck,
  CircleCheckFilled,
  CircleCloseFilled,
  WarnTriangleFilled,
} from '@/lib/lucide-fallback'
import type { ToolCallInfo } from '@/composables/useWorkspaceAgent'
import ToolCallCard from './ToolCallCard.vue'

const { t } = useI18n()

interface AgentContext {
  workspace: string
  model: string
  tools: string[]
}

interface Props {
  /** 工具调用列表 */
  toolCalls: ToolCallInfo[]
  /** 是否正在运行 */
  isRunning: boolean
  /** 上下文信息 */
  context?: AgentContext | null
}

withDefaults(defineProps<Props>(), {
  context: undefined,
})

const contextCollapsed = ref<string[]>(['context'])
const timelineCollapsed = ref<string[]>(['timeline'])
</script>

<style lang="scss" scoped>
.agent-progress-panel {
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;

  &__status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
    transition: background-color 0.3s ease;

    &.is-running {
      background-color: var(--el-color-primary-light-9);
    }
  }

  &__status-indicator {
    display: inline-flex;
    align-items: center;
    font-size: 16px;

    .is-loading {
      animation: agent-spin 1s linear infinite;
      color: var(--el-color-primary);
    }

    .el-icon:not(.is-loading) {
      color: var(--el-color-success);
    }
  }

  &__status-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__collapse {
    border: none;

    :deep(.el-collapse-item__header) {
      padding: 0 14px;
      border-bottom: 1px solid var(--el-border-color-lighter);
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      background-color: transparent;
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
      background-color: transparent;
    }

    :deep(.el-collapse-item__content) {
      padding: 8px 14px 14px;
    }
  }

  &__context {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__context-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
  }

  &__context-label {
    color: var(--el-text-color-secondary);
    font-weight: 600;
    flex-shrink: 0;
  }

  &__context-value {
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: break-all;
  }

  &__tools-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__empty {
    padding: 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  &__timeline-item {
    display: flex;
    gap: 10px;
    position: relative;

    /* 时间线连接线 */
    &::before {
      content: '';
      position: absolute;
      left: 7px;
      top: 24px;
      bottom: -4px;
      width: 2px;
      background-color: var(--el-border-color-lighter);
    }

    &:last-child::before {
      display: none;
    }

    &.is-running::before {
      background-color: var(--el-color-primary-light-5);
    }

    &.is-completed::before {
      background-color: var(--el-color-success-light-5);
    }
  }

  &__timeline-marker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 24px;
    flex-shrink: 0;
    z-index: 1;
    position: relative;

    .marker-running {
      color: var(--el-color-primary);
      animation: agent-spin 1s linear infinite;
    }

    .marker-completed {
      color: var(--el-color-success);
    }

    .marker-failed {
      color: var(--el-color-danger);
    }

    .marker-blocked {
      color: var(--el-color-warning);
    }
  }

  &__timeline-content {
    flex: 1;
    min-width: 0;

    :deep(.tool-call-card) {
      margin: 0 0 8px 0;
    }
  }
}

@keyframes agent-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 暗色模式 */
:where(html.dark) {
  .agent-progress-panel {
    &__status-bar {
      &.is-running {
        background-color: var(--color-white-8);
      }
    }

    &__timeline-item {
      &::before {
        background-color: var(--color-white-12);
      }
    }
  }
}
</style>
