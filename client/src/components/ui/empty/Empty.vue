<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    description?: string
    imageSize?: number
    class?: HTMLAttributes['class']
  }>(),
  {
    description: '暂无数据',
    imageSize: 64,
  },
)
</script>

<template>
  <div :class="cn('flex flex-col items-center justify-center py-8 text-center', props.class)">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="imageSize"
      :height="imageSize"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      class="mb-2 text-muted-foreground"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
    <p class="text-sm text-muted-foreground">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
