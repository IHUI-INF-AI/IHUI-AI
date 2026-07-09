<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    src?: string
    size?: number | 'default' | 'small' | 'large'
    shape?: 'circle' | 'square'
    icon?: string
    class?: HTMLAttributes['class']
  }>(),
  {
    size: 'default',
    shape: 'circle',
  },
)

const hasError = ref(false)

const sizeClass = computed(() => {
  if (typeof props.size === 'number') return ''
  if (props.size === 'small') return 'h-8 w-8'
  if (props.size === 'large') return 'h-12 w-12'
  return 'h-10 w-10'
})

const sizeStyle = computed(() => {
  if (typeof props.size === 'number') {
    return { width: props.size + 'px', height: props.size + 'px' }
  }
  return {}
})
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-muted text-muted-foreground',
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        sizeClass,
        props.class,
      )
    "
    :style="sizeStyle"
  >
    <img
      v-if="src && !hasError"
      :src="src"
      class="h-full w-full object-cover"
      @error="hasError = true"
    />
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      class="h-1/2 w-1/2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  </span>
</template>
