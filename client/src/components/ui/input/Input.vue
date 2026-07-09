<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    type?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    size?: 'default' | 'small' | 'large'
    class?: HTMLAttributes['class']
  }>(),
  {
    type: 'text',
    disabled: false,
    clearable: false,
    size: 'default',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [value: string]
  change: [value: string]
  clear: []
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const attrs = useAttrs()

const sizeClass = computed(() => {
  if (props.size === 'small') return 'h-8 px-2 text-xs'
  if (props.size === 'large') return 'h-12 px-4 text-base'
  return 'h-10 px-3 text-sm'
})

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const val = target.value
  emit('update:modelValue', val)
  emit('input', val)
}

const onChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('change', target.value)
}

const clearValue = () => {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<template>
  <div :class="cn('relative inline-flex w-full items-center', props.class)">
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      v-bind="attrs"
      :class="
        cn(
          'flex w-full rounded-md border border-input bg-background text-foreground ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          sizeClass,
          clearable && modelValue ? 'pr-8' : '',
        )
      "
      @input="onInput"
      @change="onChange"
      @focus="(e) => emit('focus', e)"
      @blur="(e) => emit('blur', e)"
    />
    <span
      v-if="clearable && modelValue && !disabled"
      class="absolute right-2 flex h-4 w-4 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
      @click="clearValue"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  </div>
</template>
