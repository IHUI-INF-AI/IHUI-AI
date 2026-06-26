<template>
  <div class="markdown-alert" :class="alertType">
    <div class="alert-icon">
      <el-icon>
        <component :is="iconComponent" />
      </el-icon>
    </div>
    <div class="alert-content">
      <div v-if="title" class="alert-title">{{ title }}</div>
      <div class="alert-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  InfoFilled,
  WarningFilled,
  CircleCheckFilled,
  QuestionFilled,
} from '@element-plus/icons-vue'

interface Props {
  type?: 'info' | 'warning' | 'success' | 'error' | 'tip'
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
})

const alertType = computed(() => {
  // 根据组件名称或 type prop 确定类型
  const componentName = props.type || 'info'
  return `alert-${componentName}`
})

const iconComponent = computed(() => {
  switch (props.type) {
    case 'success':
      return CircleCheckFilled
    case 'warning':
      return WarningFilled
    case 'error':
      return WarningFilled
    case 'tip':
      return QuestionFilled
    default:
      return InfoFilled
  }
})
</script>

<style scoped lang="scss">
.markdown-alert {
  display: flex;
  gap: 12px;
  padding: 16px;
  margin: 16px 0;
  border-radius: var(--global-border-radius);
  background-color: var(--el-fill-color-lighter);
  border-left: 4px solid var(--el-color-info);

  &.alert-info {
    border-left-color: var(--el-color-info);
    background-color: var(--el-color-info-light-9);
  }

  &.alert-warning {
    border-left-color: var(--el-color-warning);
    background-color: var(--el-color-warning-light-9);
  }

  &.alert-success {
    border-left-color: var(--el-color-success);
    background-color: var(--el-color-success-light-9);
  }

  &.alert-error {
    border-left-color: var(--el-color-danger);
    background-color: var(--el-color-danger-light-9);
  }

  &.alert-tip {
    border-left-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  .alert-icon {
    flex-shrink: 0;
    font-size: 20px;
    color: var(--el-text-color-primary);
  }

  .alert-content {
    flex: 1;
    min-width: 0;

    .alert-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--el-text-color-primary);
    }

    .alert-body {
      color: var(--el-text-color-regular);
      line-height: 1.6;
    }
  }
}

// 暗色模式支持
:where(html.dark) {
  .markdown-alert {
    &.alert-info {
      background-color: var(--el-color-info-dark-2);
    }

    &.alert-warning {
      background-color: var(--el-color-warning-dark-2);
    }

    &.alert-success {
      background-color: var(--el-color-success-dark-2);
    }

    &.alert-error {
      background-color: var(--el-color-danger-dark-2);
    }

    &.alert-tip {
      background-color: var(--el-color-primary-dark-2);
    }
  }
}
</style>
