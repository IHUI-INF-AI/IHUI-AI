<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    direction?: 'horizontal' | 'vertical'
    position?: 'left' | 'center' | 'right'
    class?: HTMLAttributes['class']
  }>(),
  {
    direction: 'horizontal',
    position: 'center',
  },
)
</script>

<template>
  <div
    v-if="direction === 'vertical'"
    :class="cn('inline-flex h-full w-px self-stretch bg-border', props.class)"
    role="separator"
    aria-orientation="vertical"
  />
  <div
    v-else
    :class="cn('relative my-4 flex w-full items-center', props.class)"
    role="separator"
    aria-orientation="horizontal"
  >
    <template v-if="$slots.default">
      <span v-if="position === 'left'" class="pr-3 text-sm text-muted-foreground whitespace-nowrap">
        <slot />
      </span>
      <div class="flex-1 border-t border-border" :class="position === 'left' ? '' : 'border-t'" />
      <span v-if="position === 'center'" class="px-3 text-sm text-muted-foreground whitespace-nowrap">
        <slot />
      </span>
      <span v-if="position === 'right'" class="pl-3 text-sm text-muted-foreground whitespace-nowrap">
        <slot />
      </span>
      <div v-if="position !== 'left'" class="flex-1 border-t border-border" />
    </template>
    <div v-else class="w-full border-t border-border" />
  </div>
</template>
