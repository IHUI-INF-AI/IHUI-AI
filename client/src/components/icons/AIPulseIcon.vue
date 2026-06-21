<script setup lang="ts">
/**
 * AI 脉冲图标组件
 * 
 * 设计理念：
 * - 圆形基底：代表完整、和谐的 AI 系统
 * - 三层波纹：代表 AI 的思考、处理、响应三个阶段
 * - 中心光点：代表 AI 核心智能
 * - 极简设计：符合项目"精密灰度"的设计语言
 * 
 * 适用场景：
 * - 当前选中的 AI 模型指示
 * - 模型切换按钮
 * - 加载/思考状态
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
    class="ai-pulse-icon"
  >
    <!-- 外层波纹 -->
    <circle cx="12" cy="12" r="10" opacity="0.3" />
    
    <!-- 中层波纹 -->
    <circle cx="12" cy="12" r="6.5" opacity="0.6" />
    
    <!-- 内层圆环 -->
    <circle cx="12" cy="12" r="3.5" />
    
    <!-- 中心实心点 -->
    <circle cx="12" cy="12" r="1.5" :fill="color" stroke="none" />
  </svg>
</template>

<style scoped>
.ai-pulse-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
