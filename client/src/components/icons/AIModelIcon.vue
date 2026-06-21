<script setup lang="ts">
/**
 * AI 模型图标组件
 * 
 * 设计理念：
 * - 六边形结构：代表神经网络的节点连接，体现 AI 的智能本质
 * - 中心脉冲：表示 AI 的思考与响应过程
 * - 精密线条：符合项目"工业精密"的设计语言
 * - 单色设计：适配亮/暗主题自动切换
 * 
 * 参考设计：
 * - OpenAI ChatGPT 的六边形花朵
 * - Linear 的精密几何图标
 * - Vercel 的简洁现代风格
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
    class="ai-model-icon"
  >
    <!-- 
      设计说明：
      - 外层六边形：代表完整的 AI 系统边界
      - 内部三角网格：代表神经网络的连接结构
      - 中心圆点：代表 AI 核心/智能中枢
    -->
    
    <!-- 外层六边形轮廓 -->
    <path d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z" />
    
    <!-- 内部连接线 - 形成网格结构 -->
    <path d="M12 2V8" />
    <path d="M12 16V22" />
    <path d="M2.5 7.5L8 12" />
    <path d="M16 12L21.5 7.5" />
    <path d="M2.5 16.5L8 12" />
    <path d="M16 12L21.5 16.5" />
    
    <!-- 中心节点区域 - 六边形内核 -->
    <path d="M8 12L12 8L16 12L12 16L8 12Z" />
    
    <!-- 中心圆点 - AI 核心 -->
    <circle cx="12" cy="12" r="2" :fill="color" stroke="none" />
  </svg>
</template>

<style scoped>
.ai-model-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
