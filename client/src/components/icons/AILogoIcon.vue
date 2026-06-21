<script setup lang="ts">
/**
 * AI Logo 图标组件 (旗舰方案)
 * 
 * 设计理念：
 * - 灵感来源：OpenAI ChatGPT 的六瓣花朵
 * - 连续线条：一笔画风格，象征 AI 流畅的思维过程
 * - 中心对称：六向对称设计，体现完美与平衡
 * - 留白美学：简洁的线条与适当留白，高级感十足
 * 
 * 技术细节：
 * - 基于黄金比例设计
 * - 线条粗细统一
 * - 完美支持任意尺寸缩放
 * 
 * 这是模仿顶级 AI 产品的旗舰图标设计
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
    class="ai-logo-icon"
  >
    <!-- 
      六瓣花朵 - OpenAI 风格
      中心六边形 + 六个外延花瓣
    -->
    
    <!-- 中心六边形 -->
    <path d="M12 8L15.5 10V14L12 16L8.5 14V10L12 8Z" />
    
    <!-- 六个花瓣向外延伸 -->
    <!-- 顶部花瓣 -->
    <path d="M12 8V3" />
    <path d="M10 4L12 3L14 4" />
    
    <!-- 右上花瓣 -->
    <path d="M15.5 10L19.5 7.5" />
    <path d="M18 9L19.5 7.5L19.5 5.5" />
    
    <!-- 右下花瓣 -->
    <path d="M15.5 14L19.5 16.5" />
    <path d="M19.5 18.5L19.5 16.5L18 15" />
    
    <!-- 底部花瓣 -->
    <path d="M12 16V21" />
    <path d="M14 20L12 21L10 20" />
    
    <!-- 左下花瓣 -->
    <path d="M8.5 14L4.5 16.5" />
    <path d="M4.5 18.5L4.5 16.5L6 15" />
    
    <!-- 左上花瓣 -->
    <path d="M8.5 10L4.5 7.5" />
    <path d="M6 9L4.5 7.5L4.5 5.5" />
  </svg>
</template>

<style scoped>
.ai-logo-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
