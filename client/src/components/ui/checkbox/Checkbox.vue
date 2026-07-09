<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    modelValue?: any
    value?: any
    disabled?: boolean
    label?: string
    class?: HTMLAttributes['class']
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: any]
  change: [value: any]
}>()

const isChecked = computed(() => {
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.includes(props.value)
  }
  return props.modelValue === true
})

const handleChange = () => {
  if (props.disabled) return
  if (Array.isArray(props.modelValue)) {
    const newValue = isChecked.value
      ? props.modelValue.filter((v: any) => v !== props.value)
      : [...props.modelValue, props.value]
    emit('update:modelValue', newValue)
    emit('change', newValue)
  } else {
    emit('update:modelValue', !isChecked.value)
    emit('change', !isChecked.value)
  }
}
</script>

<template>
  <label
    :class="
      cn(
        'inline-flex cursor-pointer items-center gap-2',
        disabled && 'cursor-not-allowed opacity-50',
        props.class,
      )
    "
  >
    <span
      :class="
        cn(
          'flex h-4 w-4 items-center justify-center rounded border-2 transition-colors',
          isChecked ? 'border-primary bg-primary' : 'border-input',
        )
      "
      @click="handleChange"
    >
      <svg
        v-if="isChecked"
        class="h-3 w-3 text-primary-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="3"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
    <input
      type="checkbox"
      class="sr-only"
      :value="value"
      :checked="isChecked"
      :disabled="disabled"
      @change="handleChange"
    />
    <span v-if="label || $slots.default" class="text-sm">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
