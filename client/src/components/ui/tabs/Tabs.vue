<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref, watch, provide } from 'vue'
import { cn } from '@/lib/utils'
import { TABS_KEY } from './tabsContext'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    class?: HTMLAttributes['class']
  }>(),
  {
    modelValue: '',
  },
)

const emits = defineEmits<{
  'update:modelValue': [value: string]
  'tab-change': [value: string]
}>()

const activeTab = ref(props.modelValue)

watch(
  () => props.modelValue,
  (val) => {
    activeTab.value = val
  },
)

function setActiveTab(value: string) {
  activeTab.value = value
  emits('update:modelValue', value)
  emits('tab-change', value)
}

provide(TABS_KEY, { activeTab, setActiveTab })
</script>

<template>
  <div :class="cn('w-full', props.class)">
    <slot />
  </div>
</template>
