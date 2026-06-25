<template>
  <el-card
    class="agent-card"
    shadow="hover"
    role="article"
    :aria-label="`${getAgentDisplayName(agent)} - ${getAgentDisplayDescription(agent) || t('agents.noDescription')}`"
    tabindex="0"
    @click="handleClick"
    @keyup.enter="handleClick"
    @keyup.space.prevent="handleClick"
  >
    <div class="agent-header">
      <el-avatar
        :src="agent.avatar || agent.icon"
        :size="56"
        class="agent-avatar"
        :lazy="true"
        :fit="'cover'"
        :alt="`${getAgentDisplayName(agent)} avatar`"
      >
        <el-icon :size="28"><Server /></el-icon>
      </el-avatar>
      <div class="agent-info">
        <div class="agent-name-row">
          <h3 class="agent-name" :id="`agent-name-${agent.id}`">{{ getAgentDisplayName(agent) }}</h3>
          <el-tag
            v-if="agent.platform"
            size="small"
            :type="getPlatformTagType(agent.platform)"
            class="platform-tag"
          >
            {{ getPlatformName(agent.platform) }}
          </el-tag>
        </div>
        <p v-if="agent.creatorName" class="agent-creator">
          {{ t('agents.by') }} {{ agent.creatorName }}
        </p>
        <div v-if="agent.updateTime" class="agent-update-time">
          {{ formatUpdateTime(agent.updateTime) }}
        </div>
      </div>
      <el-button
        v-if="agent.isFavorite"
        :icon="Star"
        circle
        size="small"
        class="favorite-btn"
        :aria-label="t('agents.unfavorite')"
        @click.stop="handleUnfavorite"
      />
      <el-button
        v-else
        :icon="Star"
        circle
        size="small"
        class="favorite-btn"
        :aria-label="t('agents.favorite')"
        @click.stop="handleFavorite"
      />
    </div>

    <div class="agent-description" :aria-describedby="`agent-name-${agent.id}`">
      <p>{{ getAgentDisplayDescription(agent) || t('agents.noDescription') }}</p>
    </div>

    <!-- 平台能力标识 -->
    <div v-if="hasPlatformCapabilities" class="agent-capabilities">
      <el-tag v-if="agent.cozeBotId" size="small" type="success" class="capability-tag">
        <el-icon><Server /></el-icon>
        {{ t('agents.platformCoze') }}
      </el-tag>
      <el-tag v-if="agent.n8nWorkflowId" size="small" type="warning" class="capability-tag">
        <el-icon><Server /></el-icon>
        n8n Workflow
      </el-tag>
      <el-tag v-if="agent.difyAppId" size="small" type="info" class="capability-tag">
        <el-icon><Server /></el-icon>
        Dify App
      </el-tag>
      <el-tag v-if="agent.makeScenarioId" size="small" class="capability-tag">
        <el-icon><Server /></el-icon>
        Make Scenario
      </el-tag>
      <el-tag v-if="agent.dashscopeModel" size="small" type="danger" class="capability-tag">
        <el-icon><Server /></el-icon>
        {{ t('agentCard.dashscopeModel') }}
      </el-tag>
    </div>

    <div v-if="agent.tags && agent.tags.length > 0" class="agent-tags">
      <el-tag
        v-for="tag in agent.tags.slice(0, 3)"
        :key="tag"
        size="small"
        type="info"
        class="tag-item"
      >
        {{ tag }}
      </el-tag>
      <el-tag v-if="agent.tags.length > 3" size="small" type="info" class="tag-item">
        +{{ agent.tags.length - 3 }}
      </el-tag>
    </div>

    <div class="agent-footer">
      <div class="agent-stats">
        <span v-if="agent.rating !== undefined" class="stat-item rating">
          <el-icon><Star /></el-icon>
          <span class="stat-value">{{ agent.rating.toFixed(1) }}</span>
          <span v-if="agent.ratingCount" class="stat-count">
            ({{ formatNumber(agent.ratingCount) }})
          </span>
        </span>
        <span v-if="agent.usageCount !== undefined" class="stat-item usage">
          <el-icon><Eye /></el-icon>
          <span class="stat-value">{{ formatNumber(agent.usageCount) }}</span>
        </span>
        <span v-if="agent.status" class="stat-item status" :class="`status-${agent.status}`">
          <span class="status-dot"></span>
          <span>{{ getStatusText(agent.status) }}</span>
        </span>
      </div>
      <el-tag v-if="agent.category" size="small" class="category-tag">
        {{ agent.category }}
      </el-tag>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Server, Star, Eye } from '@/lib/lucide-fallback'
import type { Agent, AgentPlatform } from '@/api/agent/agents'
import { getAgentDisplayName, getAgentDisplayDescription } from '@/api/agent/agents'
import { formatNumber } from '@/utils/format'

interface Props {
  agent: Agent
}

interface Emits {
  (e: 'click', agent: Agent): void
  (e: 'favorite', agent: Agent): void
  (e: 'unfavorite', agent: Agent): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const handleClick = () => {
  emit('click', props.agent)
}

const handleFavorite = () => {
  emit('favorite', props.agent)
}

const handleUnfavorite = () => {
  emit('unfavorite', props.agent)
}

const formatUpdateTime = (time: string): string => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) {
    return t('agents.updatedToday')
  } else if (days === 1) {
    return t('agents.updatedYesterday')
  } else if (days < 7) {
    return t('agents.updatedDaysAgo', { days })
  } else {
    return date.toLocaleDateString()
  }
}

const getPlatformName = (platform: AgentPlatform): string => {
  switch (platform) {
    case 'coze':
      return t('agents.platformCoze')
    case 'n8n':
      return t('agents.platformN8n')
    case 'dify':
      return t('agents.platformDify')
    case 'make':
      return t('agents.platformMake')
    case 'dashscope':
      return t('agents.platformDashscope')
    case 'internal':
      return t('agents.platformInternal')
    default:
      return platform
  }
}

const getPlatformTagType = (platform: AgentPlatform): string => {
  const typeMap: Record<AgentPlatform, string> = {
    coze: 'success',
    n8n: 'warning',
    dify: 'info',
    make: '',
    dashscope: 'danger',
    internal: 'success',
    all: '',
  }
  return typeMap[platform] || ''
}

const getStatusText = (status: string): string => {
  switch (status) {
    case 'active':
      return t('agents.statusActive')
    case 'inactive':
      return t('agents.statusInactive')
    case 'deprecated':
      return t('agents.statusDeprecated')
    default:
      return status
  }
}

const hasPlatformCapabilities = computed(() => {
  return !!(
    props.agent.cozeBotId ||
    props.agent.n8nWorkflowId ||
    props.agent.difyAppId ||
    props.agent.makeScenarioId ||
    props.agent.dashscopeModel
  )
})
</script>

<style scoped lang="scss">
.agent-card {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  border: none;
  box-shadow: none;
  overflow: hidden;
  position: relative;
  outline: none;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--el-color-primary);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover,
  &:focus {
    background: var(--el-bg-color-hover);
    transform: translateY(-6px) translateZ(0);
    box-shadow: none;
    border-color: var(--el-border-color-hover);

    &::before {
      opacity: 1;
    }
  }

  &:focus-visible {
    outline: var(--el-border-width-primary) solid var(--el-color-primary);
    outline-offset: 2px;
  }

  :deep(.el-card__body) {
    padding: 20px;
  }

  .agent-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 16px;

    .agent-avatar {
      flex-shrink: 0;
      border: 2px solid var(--el-border-color);
      transition: border-color 0.3s ease;
    }

    .agent-card:hover .agent-avatar {
      border-color: var(--el-border-color-hover);
    }

    .agent-info {
      flex: 1;
      min-width: 0;

      .agent-name-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        flex-wrap: wrap;
      }

      .agent-name {
        // 组件级 CSS 变量
        --acard-name-font: var(--font-family-chinese);

        font-size: clamp(16px, 2vw, 18px);
        font-weight: 700;
        font-family: var(--acard-name-font);
        color: var(--el-text-color-primary);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }

      .platform-tag {
        flex-shrink: 0;
        border-radius: var(--global-border-radius);
        font-size: 12px;
        padding: 2px 8px;
      }

      .agent-creator {
        font-size: 13px;
        color: var(--el-text-color-regular);
        margin: 0 0 4px;
      }

      .agent-update-time {
        font-size: 12px;
        color: var(--el-text-color-placeholder);
      }
    }

    .favorite-btn {
      flex-shrink: 0;
      transition: all 0.2s ease;

      &:hover {
        transform: scale(1.1);
      }
    }
  }

  .agent-description {
    margin-bottom: 14px;
    min-height: 48px;

    p {
      font-size: 14px;
      color: var(--el-text-color-regular);
      line-height: 1.6;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  .agent-capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    padding: 8px 0;
    border-top: 1px dashed var(--el-border-color);
    border-bottom: 1px dashed var(--el-border-color);

    .capability-tag {
      border-radius: var(--global-border-radius);
      font-size: 12px;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      gap: 4px;

      .el-icon {
        font-size: 12px;
      }
    }
  }

  .agent-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;

    .tag-item {
      border-radius: var(--global-border-radius);
      font-size: 12px;
      padding: 2px 8px;
    }
  }

  .agent-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 14px;
    border-top: 1px dashed var(--el-border-color);
    margin-top: 4px;

    .agent-stats {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;

      .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: var(--el-text-color-regular);

        .el-icon {
          font-size: 14px;
          color: var(--el-color-warning);
        }

        .stat-value {
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .stat-count {
          color: var(--el-text-color-placeholder);
          font-size: 12px;
        }

        &.usage .el-icon {
          color: var(--el-color-info);
        }

        &.status {
          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: var(--global-border-radius);
            background: var(--el-text-color-placeholder);
            display: inline-block;
            margin-right: 4px;
          }

          &.status-active .status-dot {
            background: var(--el-color-success);
          }

          &.status-inactive .status-dot {
            background: var(--el-color-warning);
          }

          &.status-deprecated .status-dot {
            background: var(--el-color-danger);
          }
        }
      }
    }

    .category-tag {
      border-radius: var(--global-border-radius);
      font-size: 12px;
      padding: 2px 8px;
    }
  }
}

.login-content.login-page.dark-mode .agent-card {
  background: var(--el-fill-color);
  border: var(--unified-border);
  transition: border-color 0.2s ease;

  &:hover,
  &:focus {
    background: var(--el-fill-color-light);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    }

  &:focus-visible {
    outline: var(--el-border-width-primary) solid var(--el-color-primary);
    outline-offset: 2px;
  }
}
</style>
