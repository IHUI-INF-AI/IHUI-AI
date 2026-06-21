<template>
  <DesignSystemCard :title="t('aiChat.agenticMonitor.title')" radius="15" padding="lg">
    <div class="agentic-swarm-monitor">
      <!-- Swarm 状态概览 -->
      <div class="swarm-overview mb-lg">
        <div class="overview-item">
          <span class="label">Swarm ID:</span>
          <span class="value">{{ swarm?.swarmId || '-' }}</span>
        </div>
        <div class="overview-item">
          <span class="label">{{ t('common.status') }}:</span>
          <Badge
            :variant="getStatusVariant(swarm?.status || 'pending')"
            :class="`status-${swarm?.status}`"
          >
            {{ getStatusText(swarm?.status || 'pending') }}
          </Badge>
        </div>
        <div class="overview-item" v-if="swarm?.currentIteration">
          <span class="label">{{ t('common.iteration') }}:</span>
          <span class="value">{{ swarm.currentIteration }}/{{ swarm.maxIterations || '-' }}</span>
        </div>
      </div>

      <!-- Agent 列表 -->
      <div class="agents-section mb-lg">
        <h3 class="text-lg font-semibold mb-md">{{ t('aiChat.agenticMonitor.agentStatus') }}</h3>
        <div class="agents-grid">
          <div
            v-for="agent in swarm?.agents || []"
            :key="agent.agentId"
            class="agent-card"
            :class="`agent-${agent.status}`"
          >
            <div class="agent-header">
              <span class="agent-icon">{{ getAgentTypeIcon(agent.type) }}</span>
              <div class="agent-info">
                <div class="agent-name">{{ agent.agentName ?? agent.name }}</div>
                <div class="agent-type">{{ getAgentTypeName(agent.type) }}</div>
              </div>
            </div>
            <div class="agent-status">
              <Badge :variant="getStatusVariant(agent.status)" size="sm">
                {{ getStatusText(agent.status) }}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <!-- 任务规划 -->
      <div class="plan-section" v-if="taskPlan">
        <h3 class="text-lg font-semibold mb-md">{{ t('aiChat.agenticMonitor.taskPlanning') }}</h3>

        <!-- 战略层 -->
        <div class="plan-layer mb-md">
          <h4 class="text-base font-medium mb-sm">{{ t('aiChat.agenticMonitor.strategicLayer') }}</h4>
          <div class="plan-content">
            <div class="plan-item">
              <span class="plan-label">{{ t('hardcoded.agentic.swarm.monitor.目标') }}</span>
              <ul class="plan-list">
                <li v-for="goal in taskPlan.strategic.goals" :key="goal">{{ goal }}</li>
              </ul>
            </div>
            <div class="plan-item">
              <span class="plan-label">{{ t('hardcoded.agentic.swarm.monitor.约束') }}</span>
              <ul class="plan-list">
                <li v-for="constraint in taskPlan.strategic.constraints" :key="constraint">
                  {{ constraint }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 战术层 -->
        <div class="plan-layer mb-md">
          <h4 class="text-base font-medium mb-sm">{{ t('aiChat.agenticMonitor.tacticalLayer') }}</h4>
          <div class="tactics-list">
            <div
              v-for="(tactic, index) in taskPlan.tactical.tactics"
              :key="index"
              class="tactic-item"
            >
              <div class="tactic-priority">{{ t('agenticSwarmMonitor.priority') }}: {{ tactic.priority }}</div>
              <div class="tactic-name">{{ tactic.name }}</div>
              <div class="tactic-description">{{ tactic.description }}</div>
            </div>
          </div>
        </div>

        <!-- 操作层 -->
        <div class="plan-layer">
          <h4 class="text-base font-medium mb-sm">{{ t('aiChat.agenticMonitor.operationalLayer') }}</h4>
          <div class="steps-list">
            <div v-for="step in taskPlan.operational.steps" :key="step.id" class="step-item">
              <div class="step-id">{{ step.id }}</div>
              <div class="step-action">{{ step.action }}</div>
              <div class="step-agent">Agent: {{ step.agent }}</div>
              <div v-if="step.dependencies.length > 0" class="step-deps">
                {{ t('agenticSwarmMonitor.dependencies') }}: {{ step.dependencies.join(', ') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 反思结果 -->
      <div class="reflection-section" v-if="reflectionResults.length > 0">
        <h3 class="text-lg font-semibold mb-md">{{ t('aiChat.agenticMonitor.reflectionResults') }}</h3>
        <div v-for="(reflection, index) in reflectionResults" :key="index" class="reflection-item">
          <div class="reflection-metrics">
            <div class="metric">
              <span class="metric-label">{{ t('hardcoded.agentic.swarm.monitor.质量') }}</span>
              <span class="metric-value">{{ (reflection.quality * 100).toFixed(1) }}%</span>
            </div>
            <div class="metric">
              <span class="metric-label">{{ t('hardcoded.agentic.swarm.monitor.效率') }}</span>
              <span class="metric-value">{{ (reflection.efficiency * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div v-if="reflection.errors.length > 0" class="reflection-errors">
            <div
              v-for="(error, errIndex) in reflection.errors"
              :key="errIndex"
              class="error-item"
              :class="`error-${error.severity}`"
            >
              [{{ error.severity }}] {{ error.type }}: {{ error.description }}
            </div>
          </div>
          <div v-if="reflection.improvements.length > 0" class="reflection-improvements">
            <div
              v-for="(improvement, impIndex) in reflection.improvements"
              :key="impIndex"
              class="improvement-item"
            >
              💡 {{ improvement }}
            </div>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <Spinner size="lg" />
        <span class="ml-sm">{{ t('aiChat.agenticMonitor.processing') }}</span>
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="error-state">
        <span class="text-danger">❌ {{ error }}</span>
      </div>
    </div>
  </DesignSystemCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useAgentic,
  type AgentSwarmConfig,
} from '@/composables/useAgentic'
import DesignSystemCard from '@/components/design-system/DesignSystemCard.vue'
import Badge from '@/components/design-system/Badge.vue'
import Spinner from '@/components/design-system/Spinner.vue'

const { t } = useI18n()

interface Props {
  swarmId?: string
}

const props = defineProps<Props>()

const {
  activeSwarms,
  currentSwarm,
  taskPlan,
  reflectionResults,
  isLoading,
  error,
  getAgentTypeIcon,
  getAgentTypeName,
} = useAgentic()

const swarm = computed<AgentSwarmConfig | null>(() => {
  if (props.swarmId) {
    return activeSwarms.value.find(s => s.swarmId === props.swarmId) || null
  }
  return currentSwarm.value
})

const getStatusVariant = (
  status: string
): 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
  const statusMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
    pending: 'secondary',
    running: 'primary',
    completed: 'success',
    failed: 'danger',
    idle: 'secondary',
    thinking: 'primary',
    acting: 'success',
    reflecting: 'warning',
    waiting: 'secondary',
  }
  return statusMap[status] || 'secondary'
}

const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: t('aiChat.agenticStatus.pending'),
    running: t('aiChat.agenticStatus.running'),
    completed: t('aiChat.agenticStatus.completed'),
    failed: t('aiChat.agenticStatus.failed'),
    idle: t('aiChat.agenticStatus.idle'),
    thinking: t('aiChat.agenticStatus.thinking'),
    acting: t('aiChat.agenticStatus.acting'),
    reflecting: t('aiChat.agenticStatus.reflecting'),
    waiting: t('aiChat.agenticStatus.pending'),
  }
  return statusMap[status] || status
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.agentic-swarm-monitor {
  .swarm-overview {
    display: flex;
    gap: $spacing-lg;
    flex-wrap: wrap;
    padding: $spacing-md;
    background-color: $bg-secondary;
    border-radius: $radius-8;

    .overview-item {
      display: flex;
      align-items: center;
      gap: $spacing-sm;

      .label {
        font-weight: $font-weight-medium;
        color: $text-secondary;
      }

      .value {
        color: $text-primary;
      }
    }
  }

  .agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: $spacing-md;

    .agent-card {
      padding: $spacing-md;
      border: var(--unified-border);
      border-radius: $radius-8;
      background-color: $bg-primary;
      transition: $transition-base;

      &:hover {
        background-color: $bg-hover;
        transform: translateY(-2px);
      }

      .agent-header {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        margin-bottom: $spacing-sm;

        .agent-icon {
          font-size: $font-size-2xl;
        }

        .agent-info {
          flex: 1;

          .agent-name {
            font-weight: $font-weight-semibold;
            color: $text-primary;
          }

          .agent-type {
            font-size: $font-size-xs;
            color: $text-secondary;
          }
        }
      }

      .agent-status {
        display: flex;
        justify-content: flex-end;
      }
    }
  }

  .plan-layer {
    padding: $spacing-md;
    background-color: $bg-secondary;
    border-radius: $radius-8;
    margin-bottom: $spacing-md;

    .plan-content {
      .plan-item {
        margin-bottom: $spacing-sm;

        .plan-label {
          font-weight: $font-weight-medium;
          color: $text-primary;
          margin-right: $spacing-sm;
        }

        .plan-list {
          list-style: disc;
          margin-left: $spacing-lg;
          color: $text-secondary;
        }
      }
    }

    .tactics-list {
      .tactic-item {
        padding: $spacing-sm;
        margin-bottom: $spacing-sm;
        background-color: $bg-primary;
        border-radius: $radius-4;
        border-left: 3px solid $primary-color;

        .tactic-priority {
          font-size: $font-size-xs;
          color: $text-secondary;
          margin-bottom: $spacing-xs;
        }

        .tactic-name {
          font-weight: $font-weight-semibold;
          color: $text-primary;
          margin-bottom: $spacing-xs;
        }

        .tactic-description {
          font-size: $font-size-sm;
          color: $text-secondary;
        }
      }
    }

    .steps-list {
      .step-item {
        padding: $spacing-sm;
        margin-bottom: $spacing-sm;
        background-color: $bg-primary;
        border-radius: $radius-4;

        .step-id {
          font-size: $font-size-xs;
          color: $text-secondary;
          margin-bottom: $spacing-xs;
        }

        .step-action {
          font-weight: $font-weight-medium;
          color: $text-primary;
          margin-bottom: $spacing-xs;
        }

        .step-agent {
          font-size: $font-size-sm;
          color: $text-secondary;
        }

        .step-deps {
          font-size: $font-size-xs;
          color: $text-placeholder;
          margin-top: $spacing-xs;
        }
      }
    }
  }

  .reflection-section {
    .reflection-item {
      padding: $spacing-md;
      background-color: $bg-secondary;
      border-radius: $radius-8;
      margin-bottom: $spacing-md;

      .reflection-metrics {
        display: flex;
        gap: $spacing-lg;
        margin-bottom: $spacing-md;

        .metric {
          .metric-label {
            font-weight: $font-weight-medium;
            color: $text-secondary;
            margin-right: $spacing-xs;
          }

          .metric-value {
            font-weight: $font-weight-semibold;
            color: $text-primary;
          }
        }
      }

      .reflection-errors {
        margin-bottom: $spacing-md;

        .error-item {
          padding: $spacing-xs $spacing-sm;
          margin-bottom: $spacing-xs;
          border-radius: $radius-4;
          font-size: $font-size-sm;

          &.error-high {
            background-color: var(--el-bg-color);
            color: var(--el-color-danger);
          }

          &.error-medium {
            background-color: var(--el-bg-color);
            color: var(--el-color-warning);
          }

          &.error-low {
            background-color: var(--el-bg-color);
            color: var(--el-text-color-secondary);
          }
        }
      }

      .reflection-improvements {
        .improvement-item {
          padding: $spacing-xs;
          font-size: $font-size-sm;
          color: $text-secondary;
        }
      }
    }
  }

  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-xl;
  }
}
</style>
