<template>
  <div class="security-score">
    <div class="score-header">
      <h3 class="score-title">{{ t('settings.securityScore.title') }}</h3>
      <p class="score-desc">{{ t('settings.securityScore.description') }}</p>
    </div>

    <div class="score-display">
      <div class="score-circle" :style="{ '--score-color': scoreColor }">
        <svg viewBox="0 0 100 100">
          <circle
            class="score-bg"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke-width="8"
          />
          <circle
            class="score-progress"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke-width="8"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <div class="score-value">
          <span class="score-number">{{ scoreData.total }}</span>
          <span class="score-max">/{{ scoreData.maxScore }}</span>
        </div>
      </div>
      <div class="score-level" :style="{ color: scoreColor }">
        <el-icon :size="20">
          <CircleCheck v-if="scoreData.level === 'excellent' || scoreData.level === 'high'" />
          <Warning v-else-if="scoreData.level === 'medium'" />
          <CircleClose v-else />
        </el-icon>
        <span>{{ levelLabel }}</span>
      </div>
    </div>

    <div class="score-items">
      <div
        v-for="item in scoreData.items"
        :key="item.id"
        class="score-item"
        :class="item.status"
      >
        <div class="item-header">
          <span class="item-name">{{ item.name }}</span>
          <span class="item-score">{{ item.score }}/{{ item.maxScore }}</span>
        </div>
        <div class="item-progress">
          <div
            class="item-fill"
            :style="{
              width: (item.score / item.maxScore * 100) + '%',
              backgroundColor: getStatusColor(item.status)
            }"
          ></div>
        </div>
        <p class="item-desc">{{ item.description }}</p>
        <p v-if="item.recommendation" class="item-recommendation">
          <el-icon><InfoFilled /></el-icon>
          {{ item.recommendation }}
        </p>
      </div>
    </div>

    <div v-if="scoreData.recommendations.length > 0" class="score-recommendations">
      <h4>{{ t('settings.securityScore.recommendations') }}</h4>
      <ul>
        <li v-for="(rec, index) in scoreData.recommendations" :key="index">
          {{ rec }}
        </li>
      </ul>
    </div>

    <div class="score-actions">
      <el-button type="primary" @click="handleRefresh">
        {{ t('common.refresh') }}
      </el-button>
      <el-button @click="handleViewDetails">
        {{ t('settings.securityScore.viewDetails') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CircleCheck, Warning, CircleClose, InfoFilled } from '@element-plus/icons-vue'
import { SecurityScoreService, type SecurityScore } from '@/utils/securityScoreService'

const { t } = useI18n()
const router = useRouter()

const scoreData = ref<SecurityScore>({
  total: 0,
  maxScore: 100,
  level: 'medium',
  items: [],
  recommendations: [],
})

const circumference = 2 * Math.PI * 45

const dashOffset = computed(() => {
  const progress = scoreData.value.total / scoreData.value.maxScore
  return circumference * (1 - progress)
})

const scoreColor = computed(() => SecurityScoreService.getLevelColor(scoreData.value.level))

const levelLabel = computed(() => SecurityScoreService.getLevelLabel(scoreData.value.level))

const getStatusColor = (status: 'pass' | 'warning' | 'fail'): string => {
  const colors = {
    pass: 'var(--color-success)',
    warning: 'var(--color-warning-variant)',
    fail: 'var(--color-danger-variant)',
  }
  return colors[status]
}

const loadScore = () => {
  scoreData.value = SecurityScoreService.calculateScore()
}

const handleRefresh = () => {
  loadScore()
}

const handleViewDetails = () => {
  router.push('/settings/security')
}

onMounted(() => {
  loadScore()
})
</script>

<style scoped lang="scss">
.security-score {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.score-header {
  margin-bottom: 20px;

  .score-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .score-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.score-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin-bottom: 24px;
}

.score-circle {
  position: relative;
  width: 120px;
  height: 120px;

  svg {
    transform: rotate(-90deg);
  }

  .score-bg {
    stroke: var(--el-fill-color);
  }

  .score-progress {
    stroke: var(--score-color);
    transition: stroke-dashoffset 0.5s ease;
  }

  .score-value {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;

    .score-number {
      font-size: 28px;
      font-weight: 700;
      color: var(--score-color);
    }

    .score-max {
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
  }
}

.score-level {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.score-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.score-item {
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  border-left: 3px solid var(--el-color-success);

  &.warning {
    border-left-color: var(--el-color-warning);
  }

  &.fail {
    border-left-color: var(--el-color-danger);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .item-name {
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    .item-score {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }

  .item-progress {
    height: 4px;
    background: var(--el-fill-color);
    border-radius: var(--global-border-radius);
    overflow: hidden;
    margin-bottom: 8px;

    .item-fill {
      height: 100%;
      transition: width 0.3s;
    }
  }

  .item-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }

  .item-recommendation {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-color-warning-dark-2);
    margin: 8px 0 0;
    padding: 6px 8px;
    background: var(--el-color-warning-light-9);
    border-radius: var(--global-border-radius);
  }
}

.score-recommendations {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--el-color-info-light-9);
  border-radius: var(--global-border-radius);

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      margin-bottom: 4px;
    }
  }
}

.score-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 16px;
  border-top: var(--unified-border);
}
</style>
