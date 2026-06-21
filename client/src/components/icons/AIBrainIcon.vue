<script setup lang="ts">
/**
 * AI 智脑图标组件
 * 
 * 设计理念：
 * - 灵感来源：ChatGPT 的六边形花朵 + Linear 的精密感
 * - 流畅线条：连续的曲线形成花瓣/脑回路的视觉效果
 * - 对称美学：完美的六向对称，体现 AI 的精确与平衡
 * - 空间层次：通过线条疏密创造深度感
 * 
 * 这是推荐的默认图标，最符合国际顶尖 AI 产品的设计语言
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
    class="ai-brain-icon"
  >
    <!-- 
      六瓣花朵设计 - 类似 ChatGPT 但更精致
      每个花瓣由贝塞尔曲线构成，形成连续流畅的外形
    -->
    
    <!-- 花瓣路径 - 六向对称的曲线结构 -->
    <path d="M12 2C12 2 14.5 4 14.5 6.5C14.5 9 12 10 12 12C12 10 9.5 9 9.5 6.5C9.5 4 12 2 12 2Z" />
    <path d="M12 22C12 22 14.5 20 14.5 17.5C14.5 15 12 14 12 12C12 14 9.5 15 9.5 17.5C9.5 20 12 22 12 22Z" />
    <path d="M2.5 7.5C2.5 7.5 5.5 7 7.5 8.5C9.5 10 10 12 12 12C10 12 9.5 14 7.5 15.5C5.5 17 2.5 16.5 2.5 16.5" />
    <path d="M21.5 7.5C21.5 7.5 18.5 7 16.5 8.5C14.5 10 14 12 12 12C14 12 14.5 14 16.5 15.5C18.5 17 21.5 16.5 21.5 16.5" />
    
    <!-- 中心点 -->
    <circle cx="12" cy="12" r="2" :fill="color" stroke="none" />
  </svg>
</template>

<style scoped>
.ai-brain-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
