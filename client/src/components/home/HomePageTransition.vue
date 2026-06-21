<!-- 页面过渡效果组件 -->

<template>
  <div class="page-transition-overlay" :class="{ active: isTransitioning }"></div>

</template>

<script setup lang="ts">
defineOptions({
  name: 'HomePageTransition',
  inheritAttrs: false,
})

interface Props {
  isTransitioning: boolean
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.page-transition-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-notification);
  opacity: 0;
  transition: opacity 0.3s ease;

  &.active {
    opacity: 1;
    background: var(--color-black-8);
  }
}
</style>
