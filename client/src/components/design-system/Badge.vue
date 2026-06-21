<template>
  <span :class="['design-system-badge', `badge-${variant}`, `badge-${size}`, { 'badge-dot': dot }]">
    <span v-if="dot" class="badge-dot-icon"></span>
    <slot />
  </span>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  dot: false,
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.design-system-badge {
  display: inline-flex;
  align-items: center;
  gap: $spacing-xs;
  border-radius: $radius-120;
  font-weight: $font-weight-medium;
  white-space: nowrap;

  // 尺寸
  &.badge-sm {
    padding: 2px $spacing-xs;
    font-size: $font-size-xs;
  }

  &.badge-md {
    padding: $spacing-xs $spacing-sm;
    font-size: $font-size-sm;
  }

  &.badge-lg {
    padding: $spacing-sm $spacing-md;
    font-size: $font-size-base;
  }

  // 变体
  &.badge-primary {
    background-color: $primary-color;
    color: var(--app-surface-1);
  }

  &.badge-secondary {
    background-color: $bg-secondary;
    color: var(--app-text-primary);
    border: var(--unified-border);
  }

  &.badge-success {
    background-color: $success-color;
    color: var(--app-surface-1);
  }

  &.badge-warning {
    background-color: $warning-color;
    color: var(--app-surface-1);
  }

  &.badge-danger {
    background-color: $danger-color;
    color: var(--app-surface-1);
  }

  // 点状徽章
  &.badge-dot {
    padding-left: $spacing-md;

    .badge-dot-icon {
      width: 6px;
      height: 6px;
      border-radius: var(--global-border-radius);
      background-color: currentcolor;
    }
  }
}
</style>
