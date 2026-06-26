<template>
  <el-card class="stats-panel" shadow="hover">
    <template #header>
      <div class="panel-header">
        <span class="panel-title">
          <el-icon><DataAnalysis /></el-icon>
          {{ title }}
        </span>
        <el-button link size="small" @click="handleRefresh" :loading="refreshing">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </template>

    <div class="stats-content">
      <div
        v-for="stat in stats"
        :key="stat.key"
        class="stat-item"
        :class="{ 'stat-item-clickable': stat.onClick }"
        @click="stat.onClick && stat.onClick()"
      >
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-value" :class="`stat-value-${stat.type || 'default'}`">
          <span v-if="stat.prefix">{{ stat.prefix }}</span>
          <span class="value-number">{{ formatValue(stat.value) }}</span>
          <span v-if="stat.suffix">{{ stat.suffix }}</span>
        </div>
        <div
          v-if="stat.trend !== undefined"
          class="stat-trend"
          :class="`trend-${stat.trend > 0 ? 'up' : 'down'}`"
        >
          <el-icon>
            <ArrowUp v-if="stat.trend > 0" />
            <ArrowDown v-else />
          </el-icon>
          <span>{{ Math.abs(stat.trend) }}%</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { DataAnalysis, Refresh, ArrowUp, ArrowDown } from '@element-plus/icons-vue'

export interface StatItem {
  key: string
  label: string
  value: number | string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  prefix?: string
  suffix?: string
  trend?: number
  onClick?: () => void
}

interface Props {
  title: string
  stats: StatItem[]
  refreshing?: boolean
}

const _props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
}>()

const handleRefresh = () => {
  emit('refresh')
}

const formatValue = (value: number | string): string => {
  if (typeof value === 'number') {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M'
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K'
    }
    return value.toLocaleString()
  }
  return value
}
</script>

<style scoped lang="scss">
.stats-panel {
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .stats-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 24px;
  }

  .stat-item {
    padding: 16px;
    background-color: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    transition: background-color 0.2s, transform 0.2s;

    &.stat-item-clickable {
      cursor: pointer;

      &:hover {
        background-color: var(--el-fill-color);
        
      }
    }

    .stat-label {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;

      .value-number {
        color: var(--el-text-color-primary);
      }

      &.stat-value-primary {
        .value-number {
          color: var(--el-color-primary);
        }
      }

      &.stat-value-success {
        .value-number {
          color: var(--el-color-success);
        }
      }

      &.stat-value-warning {
        .value-number {
          color: var(--el-color-warning);
        }
      }

      &.stat-value-danger {
        .value-number {
          color: var(--el-color-danger);
        }
      }

      &.stat-value-info {
        .value-number {
          color: var(--el-color-info);
        }
      }
    }

    .stat-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;

      &.trend-up {
        color: var(--el-color-success);
      }

      &.trend-down {
        color: var(--el-color-danger);
      }
    }
  }
}

// 移动端适配
@media (width <= 768px) {
  .stats-panel {
    .stats-content {
      grid-template-columns: 1fr;
      gap: 16px;
    }
  }
}
</style>
