<template>
  <div class="token-usage-panel">
    <div class="token-usage-panel__header">
      <span class="token-usage-panel__title">
        <el-icon class="token-usage-panel__icon"><DataLine /></el-icon>
        Token 用量
      </span>
      <span v-if="usage.total_tokens > 0" class="token-usage-panel__total">
        {{ formatNumber(usage.total_tokens) }}
      </span>
    </div>

    <div v-if="usage.total_tokens > 0" class="token-usage-panel__body">
      <!-- 双柱状条: prompt vs completion -->
      <div class="token-usage-panel__bars">
        <div class="token-usage-panel__bar-item">
          <span class="token-usage-panel__bar-label">输入</span>
          <div class="token-usage-panel__bar-track">
            <div
              class="token-usage-panel__bar-fill token-usage-panel__bar-fill--prompt"
              :style="{ width: promptPercent + '%' }"
            />
          </div>
          <span class="token-usage-panel__bar-value">{{ formatNumber(usage.prompt_tokens) }}</span>
        </div>
        <div class="token-usage-panel__bar-item">
          <span class="token-usage-panel__bar-label">输出</span>
          <div class="token-usage-panel__bar-track">
            <div
              class="token-usage-panel__bar-fill token-usage-panel__bar-fill--completion"
              :style="{ width: completionPercent + '%' }"
            />
          </div>
          <span class="token-usage-panel__bar-value">{{ formatNumber(usage.completion_tokens) }}</span>
        </div>
      </div>

      <!-- 迭代次数 -->
      <div v-if="usage.iterations > 0" class="token-usage-panel__meta">
        <span class="token-usage-panel__meta-item">
          <el-icon><Refresh /></el-icon>
          {{ usage.iterations }} 轮迭代
        </span>
        <span v-if="avgTokensPerIteration > 0" class="token-usage-panel__meta-item">
          均 {{ formatNumber(avgTokensPerIteration) }} tokens/轮
        </span>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="token-usage-panel__empty">
      暂无用量数据
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DataLine, Refresh } from '@element-plus/icons-vue'

export interface UsageData {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  iterations: number
}

interface Props {
  usage: UsageData
}

const props = withDefaults(defineProps<Props>(), {
  usage: () => ({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, iterations: 0 }),
})

const promptPercent = computed(() => {
  if (props.usage.total_tokens === 0) return 0
  return Math.round((props.usage.prompt_tokens / props.usage.total_tokens) * 100)
})

const completionPercent = computed(() => {
  if (props.usage.total_tokens === 0) return 0
  return Math.round((props.usage.completion_tokens / props.usage.total_tokens) * 100)
})

const avgTokensPerIteration = computed(() => {
  if (props.usage.iterations === 0) return 0
  return Math.round(props.usage.total_tokens / props.usage.iterations)
})

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
</script>

<style lang="scss" scoped>
.token-usage-panel {
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;
  font-size: 12px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
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

  &__icon {
    font-size: 14px;
    color: var(--el-color-primary);
  }

  &__total {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: var(--el-color-primary);
    font-size: 13px;
  }

  &__body {
    padding: 10px 12px;
  }

  &__bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__bar-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__bar-label {
    flex-shrink: 0;
    width: 28px;
    color: var(--el-text-color-secondary);
    font-size: 11px;
  }

  &__bar-track {
    flex: 1;
    height: 6px;
    background-color: var(--el-fill-color-light);
    border-radius: 3px;
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s ease;

    &--prompt {
      background-color: var(--el-color-primary);
    }

    &--completion {
      background-color: var(--el-color-success);
    }
  }

  &__bar-value {
    flex-shrink: 0;
    width: 48px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
    font-size: 11px;
  }

  &__meta {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--el-text-color-secondary);
    font-size: 11px;

    .el-icon {
      font-size: 12px;
    }
  }

  &__empty {
    padding: 12px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 11px;
  }
}

/* 暗色模式 */
:where(html.dark) {
  .token-usage-panel {
    &__bar-track {
      background-color: var(--el-fill-color-dark);
    }
  }
}
</style>
