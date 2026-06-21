<template>
  <svg :class="['svg-icon', className]" :style="style" aria-hidden="true">
    <use :xlink:href="iconName" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// Vue API 通过 auto-import 全局可用，无需导入

interface Props {
  name: string
  className?: string
  color?: string
  size?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  className: '',
  color: 'var(--el-text-color-primary)',
  size: 20,
})

const iconName = computed(() => `#icon-${props.name}`)
const style = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
  fill: props.color,
}))
</script>

<style scoped>
.svg-icon {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  fill: currentcolor;
  overflow: hidden;
}
</style>
