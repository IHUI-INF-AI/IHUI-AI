<script setup lang="ts">
/**
 * 上传加号图标组件
 * 
 * 设计理念：
 * - 圆角矩形外框：代表文件/容器的边界
 * - 中心加号：表示"添加/上传"的动作
 * - 极简设计：符合项目的精密工业风格
 * 
 * 参考设计：
 * - Figma 的添加图标
 * - Linear 的上传图标
 * - Notion 的添加按钮
 */

interface Props {
  /** 图标尺寸 */
  size?: number | string
  /** 自定义颜色（默认继承 currentColor） */
  color?: string
  /** 线条粗细 */
  strokeWidth?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: '1em',
  color: 'currentColor',
  strokeWidth: 1.5,
})

const computedSize = computed(() => {
  if (typeof props.size === 'number') {
    return `${props.size}px`
  }
  return props.size
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="computedSize"
    :height="computedSize"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="upload-plus-icon"
  >
    <!-- 圆角矩形外框 -->
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    
    <!-- 中心加号 - 水平线 -->
    <line x1="8" y1="12" x2="16" y2="12" />
    
    <!-- 中心加号 - 垂直线 -->
    <line x1="12" y1="8" x2="12" y2="16" />
  </svg>
</template>

<style scoped>
.upload-plus-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
