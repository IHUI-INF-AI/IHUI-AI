<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    disabled?: boolean
    size?: 'default' | 'small'
    class?: HTMLAttributes['class']
  }>(),
  {
    modelValue: false,
    disabled: false,
    size: 'default',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

const toggle = () => {
  if (props.disabled) return
  const val = !props.modelValue
  emit('update:modelValue', val)
  emit('change', val)
}

const trackSize = computed(() => {
  if (props.size === 'small') return 'h-4 w-7'
  return 'h-6 w-11'
})

const thumbSize = computed(() => {
  if (props.size === 'small') return 'h-3 w-3'
  return 'h-5 w-5'
})

const thumbTranslate = computed(() => {
  if (props.size === 'small') return props.modelValue ? 'translate-x-3' : 'translate-x-0.5'
  return props.modelValue ? 'translate-x-5' : 'translate-x-0.5'
})
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    :class="
      cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        trackSize,
        modelValue ? 'bg-primary' : 'bg-input',
        props.class,
      )
    "
    @click="toggle"
  >
    <span
      :class="
        cn(
          'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform',
          thumbSize,
          thumbTranslate,
        )
      "
    />
  </button>
</template>
