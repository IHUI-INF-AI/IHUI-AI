<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { inject, computed } from 'vue'
import { cn } from '@/lib/utils'
import { TABS_KEY } from './tabsContext'

const props = defineProps<{
  value: string
  class?: HTMLAttributes['class']
}>()

const tabsCtx = inject(TABS_KEY, null)

const isActive = computed(() => tabsCtx?.activeTab.value === props.value)

function handleClick() {
  tabsCtx?.setActiveTab(props.value)
}
</script>

<template>
  <button
    type="button"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      isActive
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
      props.class,
    )"
    @click="handleClick"
  >
    <slot />
  </button>
</template>
