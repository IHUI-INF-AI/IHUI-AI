<template>
  <div class="empty-state" :class="customClass">
    <div class="empty-icon" v-if="icon">
      <component :is="icon" :size="iconSize" />
    </div>
    <div class="empty-content">
      <h3 v-if="title" class="empty-title">{{ title }}</h3>
      <p v-if="description" class="empty-description">{{ description }}</p>
      <div v-if="$slots.default" class="empty-actions">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title?: string
  description?: string
  icon?: Component
  iconSize?: number
  customClass?: string
}

withDefaults(defineProps<Props>(), {
  iconSize: 64,
  customClass: '',
})
</script>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  min-height: 200px;

  .empty-icon {
    margin-bottom: 16px;
    color: var(--el-text-color-placeholder);
  }

  .empty-content {
    .empty-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin: 0 0 8px;
    }

    .empty-description {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin: 0 0 16px;
    }

    .empty-actions {
      margin-top: 16px;
    }
  }
}
</style>
