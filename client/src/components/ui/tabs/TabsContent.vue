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
</script>

<template>
  <div v-if="isActive" :class="cn('mt-2 focus-visible:outline-none', props.class)">
    <slot />
  </div>
</template>
