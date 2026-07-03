<template>
  <div class="progress-bar-container" :class="{ 'show-label': showLabel }">
    <div v-if="showLabel && label" class="progress-label">
      <span class="label-text">{{ label }}</span>
      <span v-if="showPercentage" class="percentage-text">{{ percentage }}%</span>
    </div>
    <div class="progress-bar-wrapper" :style="{ height: `${height}px` }">
      <div
        class="progress-bar"
        :class="[`progress-${status}`, { 'progress-animated': animated && status === 'active' }]"
        :style="{
          width: `${percentage}%`,
          backgroundColor: color || undefined,
        }"
        role="progressbar"
        :aria-valuenow="percentage"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="ariaLabel || label || t('progress.progressBar')"
      >
        <div v-if="showInnerText && innerText" class="progress-inner-text">
          {{ innerText }}
        </div>
      </div>
    </div>
    <div v-if="showDescription && description" class="progress-description">
      {{ description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  /** 进度百分比 (0-100) */
  percentage: number
  /** 进度条高度 (px) */
  height?: number
  /** 状态 */
  status?: 'active' | 'success' | 'exception' | 'warning'
  /** 自定义颜色 */
  color?: string
  /** 标签文本 */
  label?: string
  /** 描述文本 */
  description?: string
  /** 内部文本 */
  innerText?: string
  /** 是否显示标签 */
  showLabel?: boolean
  /** 是否显示百分比 */
  showPercentage?: boolean
  /** 是否显示描述 */
  showDescription?: boolean
  /** 是否显示内部文本 */
  showInnerText?: boolean
  /** 是否显示动画 */
  animated?: boolean
  /** ARIA标签 */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  percentage: 0,
  height: 8,
  status: 'active',
  showLabel: true,
  showPercentage: true,
  showDescription: false,
  showInnerText: false,
  animated: true,
})

// 确保百分比在0-100范围内
const percentage = computed(() => {
  return Math.max(0, Math.min(100, props.percentage))
})
</script>

<style scoped lang="scss">
.progress-bar-container {
  width: 100%;

  &.show-label {
    margin-bottom: 8px;
  }
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;

  .label-text {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .percentage-text {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.progress-bar-wrapper {
  width: 100%;
  background-color: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  position: relative;
}

.progress-bar {
  height: 100%;
  border-radius: var(--global-border-radius);
  transition:
    width 0.3s ease,
    background-color 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  &.progress-active {
    background-color: var(--el-color-primary);
  }

  &.progress-success {
    background-color: var(--el-color-success);
  }

  &.progress-exception {
    background-color: var(--el-color-danger);
  }

  &.progress-warning {
    background-color: var(--el-color-warning);
  }

  &.progress-animated {
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, var(--color-white-30), transparent);
      animation: progress-shimmer 1.5s ease-in-out infinite;
    }
  }

  .progress-inner-text {
    position: relative;
    z-index: var(--z-base);

    // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色导致浅色背景下不可见
    color: var(--app-button-text-on-primary);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
}

.progress-description {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

@keyframes progress-shimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

// 暗色模式支持
html.dark {
  .progress-bar-wrapper {
    background-color: var(--el-fill-color-darker);
  }

  .progress-bar.progress-animated::after {
    background: linear-gradient(90deg, transparent, var(--color-white-20), transparent);
  }
}

// 减少动画模式支持 - 使用 CSS 变量与单类，禁止高特异性
@media (prefers-reduced-motion: reduce) {
  :where(.progress-bar-container) :where(.progress-bar-wrapper) .progress-bar {
    --progress-transition: none;
    --progress-animation: none;

    transition: var(--progress-transition);

    &.progress-animated::after {
      animation: var(--progress-animation);
    }
  }
}
</style>
