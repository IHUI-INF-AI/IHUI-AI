<!--
  SubAgentActivityFeed
  2026-07-07 无感升级改造 (Phase 2)

  功能: 显示 Agentic 模式下每个子智能体的实时活动
    - 头部: 折叠/展开切换按钮
      - 运行中: "⚡ N 个子智能体协作中" + 加载动画
      - 已完成: "✓ 已协调 N 个子智能体完成 (共 M 步)"
    - 主体: 每个子智能体一行
      - 状态点 (颜色对应状态: pending/idle/thinking/acting/reflecting/completed/failed)
      - 名称 + "subagent" 标签 + 状态文本
      - 已完成步骤: ✓ 步骤描述
      - 当前步骤: 加载动画 + 步骤描述

  用法:
    <SubAgentActivityFeed
      v-if="msg.subagentActivities?.length"
      :swarm-id="msg.metadata.swarm"
      :activities="msg.subagentActivities"
      :completed="msg.status === 'sent'"
    />

  数据契约 (与 AIChat.vue 协调):
    - activities 每 2s 由 AIChat.vue 重建一次 (与 60s 轮询周期同步)
    - completed 由 AIChat.vue 传 message.status === 'sent' 控制
-->
<template>
  <div class="subagent-activity-feed" :class="{ 'is-completed': completed, 'is-expanded': expanded }">
    <div
      class="feed-header"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="ariaLabel"
      @click="toggleExpand"
      @keydown.enter.prevent="toggleExpand"
      @keydown.space.prevent="toggleExpand"
    >
      <div class="feed-header-left">
        <el-icon class="feed-icon" :class="{ 'is-spinning': !completed && hasRunningAgent }">
          <Loader2 v-if="!completed && hasRunningAgent" />
          <CheckCircle2 v-else-if="completed" />
          <Zap v-else />
        </el-icon>
        <span class="feed-title">
          <template v-if="completed">
            {{ t('floatingChat.subagentActivity.completed', { count: activities.length }) }}
            <span v-if="totalSteps > 0" class="feed-total-steps">
              {{ t('floatingChat.subagentActivity.totalSteps', { count: totalSteps }) }}
            </span>
          </template>
          <template v-else>
            {{ t('floatingChat.subagentActivity.collaborating', { count: activities.length }) }}
          </template>
        </span>
      </div>
      <el-icon class="feed-chevron">
        <ChevronUp v-if="expanded" />
        <ChevronDown v-else />
      </el-icon>
    </div>

    <Transition name="feed-body">
      <div v-show="expanded" class="feed-body">
        <div
          v-for="agent in activities"
          :key="agent.agentId"
          class="agent-row"
          :class="`status-${agent.status}`"
        >
          <div class="agent-row-header">
            <span class="agent-status-dot" :class="`status-${agent.status}`"></span>
            <span class="agent-name">{{ agent.name || agent.type || t('floatingChat.subagentActivity.tag') }}</span>
            <span class="agent-tag">{{ t('floatingChat.subagentActivity.tag') }}</span>
            <span class="agent-status-text">{{ getStatusText(agent.status) }}</span>
          </div>

          <div v-if="agent.completedSteps.length > 0 || agent.currentStep" class="agent-steps">
            <div
              v-for="(step, i) in agent.completedSteps"
              :key="`${agent.agentId}-done-${i}-${step.createdAt}`"
              class="agent-step done"
            >
              <el-icon class="step-icon"><Check /></el-icon>
              <span class="step-text">{{ step.stepAction }}</span>
            </div>
            <div
              v-if="agent.currentStep && agent.status !== 'completed' && agent.status !== 'failed'"
              class="agent-step current"
            >
              <el-icon class="step-icon is-spinning"><Loader2 /></el-icon>
              <span class="step-text">{{ agent.currentStep }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * SubAgentActivityFeed - Agentic 模式子智能体活动面板
 * 2026-07-07 无感升级改造: 在对话流内显示 subagent 实时活动, 替代全局 Toast
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
} from '@/lib/lucide-fallback'

/** 子智能体单步执行结果 (与 SwarmExecutionResult 对齐) */
export interface SubAgentStep {
  stepAction: string
  createdAt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

/** 子智能体活动状态 (由 AIChat.vue 重建) */
export interface SubAgentActivity {
  agentId: string
  name: string
  type: string
  status: 'idle' | 'pending' | 'thinking' | 'acting' | 'reflecting' | 'waiting' | 'completed' | 'failed'
  currentStep: string
  completedSteps: SubAgentStep[]
}

const props = withDefaults(
  defineProps<{
    /** Swarm ID */
    swarmId: string
    /** 子智能体活动列表 */
    activities: SubAgentActivity[]
    /** 是否已完成 (控制折叠态显示) */
    completed?: boolean
    /** 初始是否展开 (运行中默认展开, 已完成默认折叠) */
    initiallyExpanded?: boolean
  }>(),
  {
    completed: false,
    initiallyExpanded: false,
  }
)

const { t } = useI18n()

/** 展开状态: 运行中默认展开, 已完成默认折叠 */
const expanded = ref<boolean>(
  props.initiallyExpanded !== undefined ? props.initiallyExpanded : !props.completed
)

/** 切换展开/折叠 */
function toggleExpand() {
  expanded.value = !expanded.value
}

/** 是否有 agent 正在执行 (用于头部 icon 旋转动画) */
const hasRunningAgent = computed<boolean>(() => {
  return props.activities.some(
    (a: SubAgentActivity) => a.status !== 'completed' && a.status !== 'failed' && a.status !== 'idle'
  )
})

/** 所有 agent 的已完成步骤总数 (用于头部 "(共 M 步)") */
const totalSteps = computed<number>(() => {
  return props.activities.reduce(
    (sum: number, a: SubAgentActivity) => sum + a.completedSteps.length,
    0
  )
})

/** 状态文本 (i18n) */
function getStatusText(status: SubAgentActivity['status']): string {
  const key = `floatingChat.agenticStatus.${status}`
  const text = t(key)
  // 如果 i18n 找不到 (返回 key 本身), 用 fallback
  if (text === key) {
    const fallback: Record<string, string> = {
      pending: t('floatingChat.agenticStatus.pending'),
      running: t('floatingChat.agenticStatus.running'),
      completed: t('floatingChat.agenticStatus.completed'),
      failed: t('floatingChat.agenticStatus.failed'),
      idle: t('floatingChat.agenticStatus.idle'),
      thinking: t('floatingChat.agenticStatus.thinking'),
      acting: t('floatingChat.agenticStatus.acting'),
      reflecting: t('floatingChat.agenticStatus.reflecting'),
      waiting: t('floatingChat.agenticStatus.pending'),
    }
    return fallback[status] || status
  }
  return text
}

const ariaLabel = computed(() =>
  expanded.value
    ? t('floatingChat.subagentActivity.hideProcess')
    : t('floatingChat.subagentActivity.viewProcess')
)
</script>

<style scoped lang="scss">
/**
 * SubAgentActivityFeed 样式
 * 沿用项目硬约束:
 *   - 浅灰底容器 + 1px light/dark 描边 (无 blue glowing border)
 *   - 圆角与输入框协调
 *   - 紧凑布局, 不喧宾夺主
 *   - 状态点用纯 CSS, 不用 el-color (避免颜色冲突)
 */

.subagent-activity-feed {
  margin: 8px 0 12px;
  background: var(--el-fill-color-light, #f5f7fa);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.5;
  transition: border-color 0.18s ease;

  // 暗色模式适配
  :global(html.dark) &,
  :global(.dark) & {
    background: var(--el-fill-color-light, #1f1f1f);
    border-color: var(--el-border-color-light, #4c4d4f);
  }

  &:hover {
    border-color: var(--el-border-color, #dcdfe6);
    :global(html.dark) &,
    :global(.dark) & {
      border-color: var(--el-border-color, #606266);
    }
  }

  // 完成态: 头部略淡绿, 给用户完成感
  &.is-completed {
    border-color: var(--el-color-success-light-5, #c2e7b0);
    :global(html.dark) &,
    :global(.dark) & {
      border-color: var(--el-color-success-dark-2, #4f8f4f);
    }
  }
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.18s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.02);
    :global(html.dark) &,
    :global(.dark) & {
      background: rgba(255, 255, 255, 0.03);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary-light-3, #79bbff);
    outline-offset: -2px;
  }
}

.feed-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.feed-icon {
  font-size: 14px;
  flex-shrink: 0;
  color: var(--el-color-primary, #409eff);

  &.is-spinning {
    animation: subagent-spin 1.2s linear infinite;
  }
}

.subagent-activity-feed.is-completed .feed-icon {
  color: var(--el-color-success, #67c23a);
}

.feed-title {
  flex: 1;
  min-width: 0;
  color: var(--el-text-color-regular, #606266);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-total-steps {
  color: var(--el-text-color-secondary, #909399);
  font-weight: 400;
  margin-left: 4px;
}

.feed-chevron {
  font-size: 14px;
  flex-shrink: 0;
  color: var(--el-text-color-secondary, #909399);
  transition: transform 0.18s ease;
}

.feed-body {
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  :global(html.dark) &,
  :global(.dark) & {
    border-top-color: var(--el-border-color-lighter, #3a3a3c);
  }
}

// 折叠/展开过渡
.feed-body-enter-active,
.feed-body-leave-active {
  transition: max-height 0.22s ease, opacity 0.18s ease;
  overflow: hidden;
}
.feed-body-enter-from,
.feed-body-leave-to {
  max-height: 0;
  opacity: 0;
}
.feed-body-enter-to,
.feed-body-leave-from {
  max-height: 800px;
  opacity: 1;
}

.agent-row {
  padding: 8px 12px 8px 24px;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);

  &:last-child {
    border-bottom: none;
  }

  :global(html.dark) &,
  :global(.dark) & {
    border-bottom-color: var(--el-border-color-lighter, #3a3a3c);
  }
}

.agent-row-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.agent-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--el-color-info, #909399);

  &.status-pending,
  &.status-idle,
  &.status-waiting {
    background: var(--el-color-info, #909399);
  }
  &.status-thinking {
    background: var(--el-color-warning, #e6a23c);
    animation: subagent-pulse 1.5s ease-in-out infinite;
  }
  &.status-acting,
  &.status-running {
    background: var(--el-color-primary, #409eff);
    animation: subagent-pulse 1.5s ease-in-out infinite;
  }
  &.status-reflecting {
    background: var(--el-color-warning-light-2, #f3d04e);
    animation: subagent-pulse 1.5s ease-in-out infinite;
  }
  &.status-completed {
    background: var(--el-color-success, #67c23a);
  }
  &.status-failed {
    background: var(--el-color-danger, #f56c6c);
  }
}

.agent-name {
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.agent-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
  flex-shrink: 0;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: lowercase;

  :global(html.dark) &,
  :global(.dark) & {
    background: var(--el-color-primary-dark-2, #1d3a6e);
    color: var(--el-color-primary-light-3, #79bbff);
  }
}

.agent-status-text {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  flex-shrink: 0;
}

.agent-steps {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-left: 16px;
  margin-top: 2px;
}

.agent-step {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary, #606266);
  font-size: 12px;
  line-height: 1.4;

  &.current {
    color: var(--el-text-color-primary, #303133);
    font-weight: 500;
  }
}

.step-icon {
  font-size: 12px;
  flex-shrink: 0;
  color: var(--el-color-success, #67c23a);

  &.is-spinning {
    color: var(--el-color-primary, #409eff);
    animation: subagent-spin 1.2s linear infinite;
  }
}

.step-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes subagent-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes subagent-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.3);
  }
}
</style>
