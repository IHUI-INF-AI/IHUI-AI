<script setup lang="ts">
import { computed, inject } from 'vue'
import { cn } from '@/lib/utils'
import { SELECT_KEY } from './selectContext'

const props = withDefaults(
  defineProps<{
    value: any
    label?: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const context = inject(SELECT_KEY, null)

const isActive = computed(() => {
  if (!context) return false
  const val = context.modelValue.value
  if (context.multiple) {
    return Array.isArray(val) && val.includes(props.value)
  }
  return val === props.value
})

const handleClick = () => {
  if (props.disabled || !context) return
  context.selectOption(props.value, props.label || String(props.value))
}
</script>

<template>
  <div
    :class="
      cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      )
    "
    @click="handleClick"
  >
    <slot>{{ label }}</slot>
  </div>
</template>
