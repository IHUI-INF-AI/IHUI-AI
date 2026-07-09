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
    name?: string
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

const isChecked = computed(() => props.modelValue === props.value)

const handleChange = () => {
  if (props.disabled) return
  emit('update:modelValue', props.value)
  emit('change', props.value)
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
          'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
          isChecked ? 'border-primary' : 'border-input',
        )
      "
      @click="handleChange"
    >
      <span
        v-if="isChecked"
        class="h-2 w-2 rounded-full bg-primary"
      />
    </span>
    <input
      type="radio"
      class="sr-only"
      :name="name"
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
