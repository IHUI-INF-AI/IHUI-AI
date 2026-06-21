<template>
  <div
    class="design-system-card"
    :class="[`rounded-${radius}`, hoverEffect && 'hover-lift']"
    :style="cardStyles"
  >
    <div v-if="title" class="card-header">
      <h3 class="text-xl font-semibold text-primary">{{ title }}</h3>
    </div>

    <div class="card-body" :class="bodyPadding">
      <slot />
    </div>

    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDesignSystem } from '@/composables/useDesignSystem'

interface Props {
  title?: string
  radius?: '2' | '3' | '4' | '6' | '8' | '15' | '30' | '60' | '120'
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  hoverEffect?: boolean
  variant?: 'primary' | 'secondary' | 'tertiary'
}

const props = withDefaults(defineProps<Props>(), {
  radius: '8',
  padding: 'md',
  hoverEffect: true,
  variant: 'primary',
})

const { applyDesignSystem } = useDesignSystem()

const cardStyles = computed(() => {
  return applyDesignSystem({
    backgroundColor: props.variant,
    padding: props.padding,
    borderRadius: props.radius,
    transition: 'base',
  })
})

const bodyPadding = computed(() => {
  return `p-${props.padding}`
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.design-system-card {
  background-color: var(--el-fill-color-light);
  border: none;
  transition: $transition-base;

  .card-header {
    padding: $spacing-md;
    border-bottom: var(--unified-border-bottom);
  }

  .card-footer {
    padding: $spacing-md;
    border-top: var(--unified-border);
  }
}
</style>
