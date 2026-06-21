<script setup lang="ts">
/**
 * 左右双引号图标 - 用于回复/引用
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
    viewBox="0 0 24 24"
    fill="currentColor"
    class="quote-icon"
  >
    <!-- 左双引号 „ (Feather/Quote 风格) -->
    <path d="M4 12v8h4V12c0-2.2-1.8-4-4-4V8c2.2 0 4-1.8 4-4s-1.8-4-4-4H4c0 2.2 1.8 4 4 4v4z" />
    <!-- 右双引号 " -->
    <path d="M16 12v8h4V12c0-2.2-1.8-4-4-4V8c2.2 0 4-1.8 4-4s-1.8-4-4-4h-4c0 2.2 1.8 4 4 4v4z" />
  </svg>
</template>

<style scoped>
.quote-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
