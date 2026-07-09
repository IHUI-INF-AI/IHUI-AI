<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    type?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
    effect?: 'dark' | 'light' | 'plain'
    closable?: boolean
    size?: 'default' | 'small' | 'large'
    class?: HTMLAttributes['class']
  }>(),
  {
    type: 'default',
    effect: 'light',
    closable: false,
    size: 'default',
  },
)

const emit = defineEmits<{
  close: [event: MouseEvent]
  click: [event: MouseEvent]
}>()

const typeColorMap: Record<string, { light: string; dark: string; plain: string }> = {
  default: {
    light: 'bg-gray-100 text-gray-700 border-gray-200',
    dark: 'bg-gray-700 text-white border-gray-700',
    plain: 'bg-transparent text-gray-700 border-gray-300',
  },
  primary: {
    light: 'bg-blue-100 text-blue-700 border-blue-200',
    dark: 'bg-blue-600 text-white border-blue-600',
    plain: 'bg-transparent text-blue-700 border-blue-300',
  },
  success: {
    light: 'bg-green-100 text-green-700 border-green-200',
    dark: 'bg-green-600 text-white border-green-600',
    plain: 'bg-transparent text-green-700 border-green-300',
  },
  warning: {
    light: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dark: 'bg-yellow-500 text-white border-yellow-500',
    plain: 'bg-transparent text-yellow-700 border-yellow-300',
  },
  danger: {
    light: 'bg-red-100 text-red-700 border-red-200',
    dark: 'bg-red-600 text-white border-red-600',
    plain: 'bg-transparent text-red-700 border-red-300',
  },
  info: {
    light: 'bg-gray-100 text-gray-600 border-gray-200',
    dark: 'bg-gray-600 text-white border-gray-600',
    plain: 'bg-transparent text-gray-600 border-gray-300',
  },
}

const sizeClass = computed(() => {
  if (props.size === 'small') return 'text-xs px-2 py-0.5'
  if (props.size === 'large') return 'text-sm px-3 py-1'
  return 'text-xs px-2 py-0.5'
})

const colorClass = computed(() => typeColorMap[props.type]?.[props.effect] || typeColorMap.default.light)
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center rounded border font-medium transition-colors',
        sizeClass,
        colorClass,
        props.class,
      )
    "
    @click="(e) => emit('click', e)"
  >
    <slot />
    <span
      v-if="closable"
      class="ml-1 inline-flex cursor-pointer items-center hover:opacity-70"
      @click.stop="(e) => emit('close', e)"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  </span>
</template>
