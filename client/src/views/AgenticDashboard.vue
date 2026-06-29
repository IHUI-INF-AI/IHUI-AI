<template>
  <div class="agentic-dashboard">
    <div class="dashboard-header mb-xl">
      <h1 class="text-4xl font-bold text-primary mb-sm">{{ t('agenticDashboard.title') }}</h1>
      <p class="text-lg text-secondary">{{ t('agenticDashboard.subtitle') }}</p>
    </div>

    <div class="dashboard-grid">
      <!-- 任务创建 -->
      <div class="dashboard-section">
        <AgenticTaskCreator @created="handleTaskCreated" />
      </div>

      <!-- Swarm 监控 -->
      <div class="dashboard-section" v-if="currentSwarmId">
        <AgenticSwarmMonitor :swarm-id="currentSwarmId" />
      </div>

      <!-- 组件生成器 -->
      <div class="dashboard-section">
        <AgenticComponentGenerator />
      </div>

      <!-- 活跃 Swarm 列表 -->
      <div class="dashboard-section">
        <DesignSystemCard :title="t('agenticDashboard.activeSwarms')" radius="15" padding="lg">
          <div class="swarms-list">
            <div
              v-for="swarm in activeSwarms"
              :key="swarm.swarmId"
              class="swarm-item"
              :class="{ active: swarm.swarmId === currentSwarmId }"
              @click="selectSwarm(swarm.swarmId)"
            >
              <div class="swarm-header">
                <span class="swarm-id">{{ swarm.swarmId }}</span>
                <Badge :variant="getStatusVariant(swarm.status)">
                  {{ getStatusText(swarm.status) }}
                </Badge>
              </div>
              <div class="swarm-task">{{ swarm.task.substring(0, 50) }}...</div>
              <div class="swarm-info">
                <span>{{ t('agenticDashboard.coordination') }}: {{ swarm.coordination }}</span>
                <span v-if="swarm.currentIteration">
                  {{ t('agenticDashboard.iteration') }}: {{ swarm.currentIteration }}/{{
                    swarm.maxIterations
                  }}
                </span>
              </div>
            </div>

            <div v-if="activeSwarms.length === 0" class="empty-state">
              <p class="text-secondary">{{ t('agenticDashboard.noActiveSwarms') }}</p>
            </div>
          </div>
        </DesignSystemCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref } from 'vue'
import { useSEO } from '@/composables/useSEO'
import { useAgentic } from '@/composables/useAgentic'
import { useI18n } from 'vue-i18n'
import DesignSystemCard from '@/components/design-system/DesignSystemCard.vue'
import Badge from '@/components/design-system/Badge.vue'
import AgenticTaskCreator from '@/components/agentic/AgenticTaskCreator.vue'
import AgenticSwarmMonitor from '@/components/agentic/AgenticSwarmMonitor.vue'
import AgenticComponentGenerator from '@/components/agentic/AgenticComponentGenerator.vue'

const { t } = useI18n()

// SEO 配置
useSEO({
  title: t('agenticDashboard.seoTitle'),
  description: t('agenticDashboard.seoDescription'),
  keywords: t('agenticDashboard.seoKeywords'),
})

const { activeSwarms } = useAgentic()

const currentSwarmId = ref<string | null>(null)

const handleTaskCreated = (swarmId: string) => {
  currentSwarmId.value = swarmId
}

const selectSwarm = (swarmId: string) => {
  currentSwarmId.value = swarmId
}

const getStatusVariant = (
  status: string
): 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
  const statusMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
    pending: 'secondary',
    running: 'primary',
    completed: 'success',
    failed: 'danger',
  }
  return statusMap[status] || 'secondary'
}

const getStatusText = (status: string): string => {
  return t(`agenticDashboard.status.${status}`)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.agentic-dashboard {
  width: 100%;
  margin: 0 auto;
  padding: $spacing-xl;

  .dashboard-header {
    text-align: center;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: $spacing-xl;

    .dashboard-section {
      min-width: 0; // 防止 grid 溢出
    }
  }
}

.swarms-list {
  .swarm-item {
    padding: $spacing-md;
    margin-bottom: $spacing-md;
    border: var(--unified-border);
    border-radius: $radius-8;
    background-color: $bg-primary;
    cursor: pointer;
    transition: $transition-base;

    &:hover {
      background-color: $bg-hover;
      transform: translateY(-2px);
    }

    &.active {
      border-color: $primary-color;
      background-color: $bg-hover;
    }

    .swarm-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: $spacing-sm;

      .swarm-id {
        font-family: var(--font-family-mono);
        font-size: $font-size-sm;
        color: $text-secondary;
      }
    }

    .swarm-task {
      font-size: $font-size-sm;
      color: $text-primary;
      margin-bottom: $spacing-xs;
      word-break: break-word;
    }

    .swarm-info {
      display: flex;
      gap: $spacing-md;
      font-size: $font-size-xs;
      color: $text-secondary;
    }
  }

  .empty-state {
    padding: $spacing-xl;
    text-align: center;
  }
}
</style>
