<template>
  <button
    :class="[
      'design-system-button',
      `btn-${variant}`,
      `btn-${size}`,
      {
        'btn-loading': loading,
        'btn-disabled': disabled,
        'click-feedback': !disabled && !loading,
      },
    ]"
    :disabled="disabled || loading"
    :type="type"
    @click="handleClick"
  >
    <span v-if="loading" class="btn-spinner"></span>
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.design-system-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  border: none;
  border-radius: $radius-8;
  font-family: var(--global-font-family);
  font-weight: $font-weight-medium;
  cursor: pointer;
  transition: $transition-base;
  position: relative;
  overflow: hidden;

  // 尺寸变体
  &.btn-sm {
    padding: $spacing-xs $spacing-sm;
    font-size: $font-size-sm;
    min-height: 32px;
  }

  &.btn-md {
    padding: $spacing-sm $spacing-md;
    font-size: $font-size-base;
    min-height: 40px;
  }

  &.btn-lg {
    padding: $spacing-md $spacing-lg;
    font-size: $font-size-lg;
    min-height: 48px;
  }

  // 主要按钮
  &.btn-primary {
    background-color: $primary-color;
    color: var(--app-surface-1);

    &:hover:not(.btn-disabled, .btn-loading) {
      background-color: $primary-light;
      transform: translateY(-2px);
    }

    &:active:not(.btn-disabled, .btn-loading) {
      transform: translateY(0);
    }
  }

  // 次要按钮
  &.btn-secondary {
    background-color: $bg-secondary;
    color: var(--app-text-primary);
    border: var(--unified-border);

    &:hover:not(.btn-disabled, .btn-loading) {
      background-color: $bg-hover;
      border-color: $border-light;
    }
  }

  // 轮廓按钮
  &.btn-outline {
    background-color: transparent;
    color: var(--app-text-primary);
    border: var(--unified-border);

    &:hover:not(.btn-disabled, .btn-loading) {
      background-color: $bg-hover;
    }
  }

  // 幽灵按钮
  &.btn-ghost {
    background-color: transparent;
    color: var(--app-text-primary);

    &:hover:not(.btn-disabled, .btn-loading) {
      background-color: $bg-hover;
    }
  }

  // 加载状态
  &.btn-loading {
    cursor: not-allowed;
    opacity: 0.7;
  }

  // 禁用状态
  &.btn-disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  // 加载动画
  .btn-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid currentcolor;
    border-top-color: transparent;
    border-radius: var(--global-border-radius);
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 暗色主题适配
html.dark {
  .design-system-button {
    &.btn-primary {
      background-color: var(--app-surface-1);
      color: var(--app-text-primary);

      &:hover:not(.btn-disabled, .btn-loading) {
        background-color: var(--el-bg-color-hover);
      }
    }

    &.btn-secondary {
      background-color: var(--app-surface-2);
      color: var(--app-text-primary);
      border-color: var(--app-divider);
    }
  }
}
</style>
