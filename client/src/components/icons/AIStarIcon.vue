<script setup lang="ts">
/**
 * AI 星芒图标组件 (强烈推荐)
 * 
 * 设计理念：
 * - 四角星芒：Google Gemini 风格的简洁四角星
 * - 精密几何：完美的数学比例，体现 AI 的精确性
 * - 动感线条：尖锐的角度暗示智能的敏锐与速度
 * - 极简优雅：去除所有多余元素，只保留核心形态
 * 
 * 设计参数：
 * - 外角延伸比例: 1:3 (内径:外角)
 * - 角度: 90° 等分
 * - 曲线: 直线连接，干净利落
 * 
 * 这是最符合 2024-2026 AI 图标设计趋势的方案
 */

interface Props {
  /** 图标尺寸 */
  size?: number | string
  /** 自定义颜色（默认继承 currentColor） */
  color?: string
  /** 线条粗细 */
  strokeWidth?: number | string
  /** 是否填充 */
  filled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: '1em',
  color: 'currentColor',
  strokeWidth: 1.5,
  filled: false,
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
    :fill="filled ? color : 'none'"
    :stroke="filled ? 'none' : color"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="ai-star-icon"
  >
    <!-- 
      四角星芒 - Gemini 风格
      M12,2  -> 顶点
      L14,10 -> 右上内角
      L22,12 -> 右顶点
      L14,14 -> 右下内角
      L12,22 -> 底点
      L10,14 -> 左下内角
      L2,12  -> 左顶点
      L10,10 -> 左上内角
      Z      -> 闭合回顶点
    -->
    <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10L12 2Z" />
  </svg>
</template>

<style scoped>
.ai-star-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
