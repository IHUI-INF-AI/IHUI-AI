<script setup lang="ts">
/**
 * AI 闪烁图标组件 (推荐使用)
 * 
 * 设计理念：
 * - 四角星形：代表 AI 的灵感闪现、智慧火花
 * - 极简几何：符合 Vercel/Linear 的现代极简风格
 * - 动态暗示：星形自带"闪烁"的视觉联想
 * - 通用性强：适合各种 AI 场景（对话、生成、分析等）
 * 
 * 参考设计：
 * - Google Gemini 的四角星
 * - Notion AI 的闪烁图标
 * - GitHub Copilot 的星形元素
 * 
 * 这是最推荐的图标，简洁有力且符合 AI 产品的主流设计趋势
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
    :stroke="color"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="ai-spark-icon"
  >
    <!-- 
      四角星设计 - AI 智慧闪烁
      由四个贝塞尔曲线构成的流畅星形
    -->
    <path 
      d="M12 2C12 2 13.5 7 12 9.5C10.5 12 12 12 12 12C12 12 13.5 12 16 10.5C18.5 9 22 12 22 12C22 12 18.5 15 16 13.5C13.5 12 12 12 12 12C12 12 10.5 12 12 14.5C13.5 17 12 22 12 22C12 22 10.5 17 12 14.5C13.5 12 12 12 12 12C12 12 10.5 12 8 13.5C5.5 15 2 12 2 12C2 12 5.5 9 8 10.5C10.5 12 12 12 12 12C12 12 13.5 12 12 9.5C10.5 7 12 2 12 2Z" 
    />
  </svg>
</template>

<style scoped>
.ai-spark-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
