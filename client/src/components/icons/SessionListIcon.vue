<script setup lang="ts">
/**
 * 会话列表图标 - 容器/历史列表风格
 * 来源：用户提供的 容器 1361.svg
 */

interface Props {
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
})

const computedSize = computed(() =>
  typeof props.size === 'number' ? `${props.size}px` : props.size
)
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="computedSize"
    :height="computedSize"
    viewBox="0 0 600 600"
    fill="none"
    class="session-list-icon"
  >
    <rect
      x="20"
      y="20"
      width="560"
      height="560"
      rx="70"
      fill="none"
      stroke="currentColor"
      stroke-width="40"
    />
    <line
      x1="391"
      y1="-20"
      x2="991"
      y2="-20"
      stroke="currentColor"
      stroke-width="40"
      transform="matrix(0,1,-1,0,391,-391)"
    />
  </svg>
</template>

<style scoped>
.session-list-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
