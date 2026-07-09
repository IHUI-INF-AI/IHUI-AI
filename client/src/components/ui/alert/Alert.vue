<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
    title?: string
    description?: string
    closable?: boolean
    showIcon?: boolean
    class?: HTMLAttributes['class']
  }>(),
  {
    variant: 'default',
    closable: false,
    showIcon: true,
  },
)

const emit = defineEmits<{
  close: []
}>()

const visible = ref(true)
const handleClose = () => {
  visible.value = false
  emit('close')
}

const variantClass: Record<string, string> = {
  default: 'bg-background text-foreground border-border',
  destructive: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-800',
  success: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-800',
  warning: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-800',
  info: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800',
}

const iconMap: Record<string, string> = {
  default: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  destructive: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}
</script>

<template>
  <div
    v-if="visible"
    :class="cn('relative w-full rounded-lg border p-4', variantClass[props.variant], props.class)"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <svg
        v-if="showIcon"
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" :d="iconMap[props.variant]" />
      </svg>
      <div class="flex-1">
        <h5 v-if="title" class="mb-1 font-medium leading-none tracking-tight">{{ title }}</h5>
        <div v-if="description || $slots.default" class="text-sm opacity-90">
          <slot>{{ description }}</slot>
        </div>
      </div>
      <button
        v-if="closable"
        class="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
        @click="handleClose"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </div>
</template>
