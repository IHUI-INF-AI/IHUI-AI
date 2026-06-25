<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  rows?: number
  animated?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  width: '100%',
  height: undefined,
  rows: 1,
  animated: true,
})

const computedWidth = computed(() => {
  if (typeof props.width === 'number') return `${props.width}px`
  return props.width
})

const computedHeight = computed(() => {
  if (props.height) {
    if (typeof props.height === 'number') return `${props.height}px`
    return props.height
  }
  switch (props.variant) {
    case 'circular':
      return computedWidth.value
    case 'rectangular':
      return '100px'
    case 'card':
      return '200px'
    default:
      return '1em'
  }
})

const borderRadius = computed(() => {
  switch (props.variant) {
    case 'circular':
      return '50%'
    case 'card':
      return 'var(--global-border-radius)'
    default:
      return '4px'
  }
})
</script>

<template>
  <div class="skeleton-wrapper" :class="{ animated }">
    <template v-if="variant === 'card'">
      <div class="skeleton-card">
        <div class="skeleton-card-image"></div>
        <div class="skeleton-card-content">
          <div class="skeleton-card-title"></div>
          <div class="skeleton-card-text"></div>
          <div class="skeleton-card-text short"></div>
        </div>
      </div>
    </template>
    <template v-else>
      <div
        v-for="i in rows"
        :key="i"
        class="skeleton-item"
        :class="[variant, { 'last-row': i === rows && rows > 1 }]"
        :style="{
          width: i === rows && rows > 1 ? '70%' : computedWidth,
          height: computedHeight,
          borderRadius: borderRadius,
        }"
      ></div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &.animated .skeleton-item,
  &.animated .skeleton-card-image,
  &.animated .skeleton-card-title,
  &.animated .skeleton-card-text {
    animation: skeleton-pulse 1.5s ease-in-out infinite;
    will-change: background-position;
  }
}

.skeleton-item {
  background: linear-gradient(
    90deg,
    var(--el-fill-color) 25%,
    var(--el-fill-color-light) 50%,
    var(--el-fill-color) 75%
  );
  background-size: 200% 100%;

  &.last-row {
    width: 70%;
  }
}

.skeleton-card {
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--el-bg-color);
  border: var(--unified-border);
  }

.skeleton-card-image {
  width: 100%;
  height: 140px;
  background: linear-gradient(
    90deg,
    var(--el-fill-color) 25%,
    var(--el-fill-color-light) 50%,
    var(--el-fill-color) 75%
  );
  background-size: 200% 100%;
}

.skeleton-card-content {
  padding: 16px;
}

.skeleton-card-title {
  width: 60%;
  height: 20px;
  margin-bottom: 12px;
  background: linear-gradient(
    90deg,
    var(--el-fill-color) 25%,
    var(--el-fill-color-light) 50%,
    var(--el-fill-color) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--global-border-radius);
}

.skeleton-card-text {
  width: 100%;
  height: 14px;
  margin-bottom: 8px;
  background: linear-gradient(
    90deg,
    var(--el-fill-color) 25%,
    var(--el-fill-color-light) 50%,
    var(--el-fill-color) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--global-border-radius);

  &.short {
    width: 80%;
    margin-bottom: 0;
  }
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
