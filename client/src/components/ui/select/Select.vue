<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref, watch, provide, computed } from 'vue'
import { cn } from '@/lib/utils'
import { SELECT_KEY } from './selectContext'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | boolean | Array<string | number | boolean> | null
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    multiple?: boolean
    size?: 'default' | 'small' | 'large'
    class?: HTMLAttributes['class']
  }>(),
  {
    disabled: false,
    clearable: false,
    multiple: false,
    size: 'default',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: any]
  change: [value: any]
  visibleChange: [visible: boolean]
}>()

const isOpen = ref(false)
const selectedLabel = ref('')

const toggle = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  emit('visibleChange', isOpen.value)
}

const close = () => {
  isOpen.value = false
  emit('visibleChange', false)
}

const selectOption = (value: any, label: string) => {
  if (props.multiple) {
    const currentValues = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = currentValues.indexOf(value)
    if (idx > -1) {
      currentValues.splice(idx, 1)
    } else {
      currentValues.push(value)
    }
    emit('update:modelValue', currentValues)
    emit('change', currentValues)
  } else {
    emit('update:modelValue', value)
    emit('change', value)
    selectedLabel.value = label
    close()
  }
}

const clearValue = (e: Event) => {
  e.stopPropagation()
  emit('update:modelValue', props.multiple ? [] : '')
  emit('change', props.multiple ? [] : '')
  selectedLabel.value = ''
}

const sizeClass = computed(() => {
  if (props.size === 'small') return 'h-8 text-xs'
  if (props.size === 'large') return 'h-12 text-base'
  return 'h-10 text-sm'
})

provide(SELECT_KEY, {
  modelValue: computed(() => props.modelValue),
  multiple: props.multiple,
  selectOption,
  close,
})

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.select-container')) {
    close()
  }
}

watch(isOpen, (val) => {
  if (val) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div :class="cn('select-container relative inline-flex w-full', props.class)">
    <div
      :class="
        cn(
          'flex w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-0 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          sizeClass,
          disabled && 'cursor-not-allowed opacity-50',
        )
      "
      @click="toggle"
    >
      <span :class="cn('flex-1 truncate', !selectedLabel && !modelValue && 'text-muted-foreground')">
        {{ selectedLabel || placeholder || '' }}
      </span>
      <span v-if="clearable && modelValue && !disabled" class="ml-2 text-muted-foreground hover:text-foreground" @click="clearValue">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="cn('ml-2 transition-transform', isOpen && 'rotate-180')"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
    <div
      v-if="isOpen"
      class="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <slot />
    </div>
  </div>
</template>
