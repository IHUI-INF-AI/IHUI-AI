<template>
  <div :class="['design-system-spinner', `spinner-${size}`, `spinner-${variant}`]">
    <div class="spinner-circle"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'primary',
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.design-system-spinner {
  display: inline-block;

  &.spinner-sm {
    width: 16px;
    height: 16px;
  }

  &.spinner-md {
    width: 24px;
    height: 24px;
  }

  &.spinner-lg {
    width: 32px;
    height: 32px;
  }

  .spinner-circle {
    width: 100%;
    height: 100%;
    border: 2px solid transparent;
    border-top-color: currentcolor;
    border-radius: var(--global-border-radius);
    animation: spin 0.8s linear infinite;
  }

  &.spinner-primary {
    color: $primary-color;
  }

  &.spinner-secondary {
    color: var(--app-text-secondary);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
