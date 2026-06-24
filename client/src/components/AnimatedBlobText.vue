<template>
  <div class="animated-blob-text-container">
    <div
      ref="containerRef"
      class="animated-blob-div"
      :style="{
        width: actualSvgWidth + 'px',
        height: actualSvgHeight + 'px',
      }"
    >
      <svg
        ref="svgRef"
        :viewBox="svgViewBox"
        class="animated-blob-svg-inner"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath :id="clipPathId" class="filled-heading">
            <text
              v-for="(line, index) in textLines"
              :key="`text-${index}`"
              :id="`textLine${index}-${componentId}`"
              :y="getLineY(index)"
              :x="getLineX(index)"
              text-anchor="middle"
              class="clip-text"
              :fill="computedTextColor"
            >
              {{ line }}
            </text>
          </clipPath>
        </defs>

        <!-- 使用简单的文本渲染替代复杂的clipPath效果 -->
        <g class="text-group">
          <text
            v-for="(line, index) in textLines"
            :key="`simple-text-${index}`"
            :y="getLineY(index)"
            :x="getLineX(index)"
            text-anchor="middle"
            class="simple-clip-text"
            :fill="computedTextColor"
          >
            {{ line }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

interface Props {
  textLines: string[]
  fontSize?: number
  lineHeight?: number
  svgWidth?: number
  svgHeight?: number
  textColor?: string
  backgroundColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  fontSize: 80,
  lineHeight: 1.2,
  svgWidth: 1200,
  svgHeight: 400,
  textColor: 'currentColor', // 默认使用当前文字颜色，适配主题
  backgroundColor: 'var(--el-bg-color-page)',
})

// 主题状态
const isDarkTheme = ref(false)
const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// 如果减少动态，关闭淡入动画
const animationStyle = computed(() => (reduceMotion ? 'none' : 'fadeIn 1s ease-out forwards'))

// 检查主题
const checkTheme = () => {
  if (typeof document !== 'undefined') {
    isDarkTheme.value = document.documentElement.classList.contains('dark')
  }
}

// 计算主题适配的文字颜色
const computedTextColor = computed(() => {
  // 如果传入的是 currentColor，需要根据主题计算实际颜色
  if (props.textColor === 'currentColor') {
    // 明亮主题：黑色，暗色主题：白色
    return isDarkTheme.value ? 'var(--el-text-color-primary)' : 'var(--el-text-color-primary)'
  }
  return props.textColor
})

// 监听主题变化
let observer: MutationObserver | null = null
const cleanup = useCleanup()

// 生成唯一的ID，避免多个组件实例冲突
const componentId = Math.random().toString(36).substr(2, 9)
const clipPathId = computed(() => `textClip-${componentId}`)

// 简化尺寸计算，直接使用props值（缩小默认尺寸以减小首屏开销）
const actualSvgWidth = ref(Math.min(props.svgWidth, 960))
const actualSvgHeight = ref(Math.min(props.svgHeight, 320))
const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// 移除复杂的动态计算，直接使用props值
const svgViewBox = computed(() => {
  return `0 0 ${actualSvgWidth.value} ${actualSvgHeight.value}`
})

// 不再放大字体，保持原始大小
const doubledFontSize = computed(() => props.fontSize)

// 组件挂载时仅检查主题，移除复杂的尺寸更新
onMounted(() => {
  checkTheme()

  // 监听主题变化
  if (typeof document !== 'undefined') {
    observer = new MutationObserver(() => {
      checkTheme()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    cleanup.add(() => {
      observer?.disconnect()
      observer = null
    })
  }
})

// 使用放大后的字体计算位置
const getLineY = (index: number): number => {
  const baseY = doubledFontSize.value * props.lineHeight
  return baseY + index * doubledFontSize.value * props.lineHeight * 0.9
}

const getLineX = (_index: number): number => {
  return actualSvgWidth.value / 2
}
</script>

<style scoped lang="scss">
.animated-blob-text-container {
  width: 100%;
  max-width: 100%;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  box-sizing: border-box;
  overflow: visible; /* 允许内容正常显示，不限制 */
}

.animated-blob-div {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  box-sizing: border-box;
  overflow: visible; /* 允许内容正常显示，不限制 */
}

// 使用单类与变量，禁止高特异性 
.animated-blob-svg-inner {
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: 80vh;
  min-height: 140px;
  object-fit: contain;
  display: block;
  box-sizing: border-box;
}

.clip-text,
.simple-clip-text {
  text-transform: uppercase;
  font-family: var(--font-family-chinese);
  font-size: v-bind('doubledFontSize + "px"');
  font-weight: 900;
  line-height: 0.9;
}

.text-group {
  animation: v-bind('animationStyle');
}

.simple-clip-text {
  opacity: 0;
  animation: v-bind('animationStyle');
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

// 无障碍：减少动画 - 保留 （符合规范）
@media (prefers-reduced-motion: reduce) {
  .text-group,
  .simple-clip-text {
    animation: none;
    opacity: 1;
  }
}

/* 响应式设计 - 单类与媒体查询 */
@media (width <= 768px) {
  .animated-blob-text-container {
    width: 100%;
    max-width: 100%;
  }

  .animated-blob-div {
    width: 100%;
    max-width: 100%;
  }

  .animated-blob-svg-inner {
    width: 100%;
    max-width: 100%;
    min-height: 300px;
  }
}

@media (width <= 480px) {
  .animated-blob-text-container {
    width: 100%;
    max-width: 100%;
  }

  .animated-blob-div {
    width: 100%;
    max-width: 100%;
  }

  .animated-blob-svg-inner {
    width: 100%;
    max-width: 100%;
    min-height: 240px;
  }
}

/* 主题适配 */
:deep(.clip-text),
:deep(.simple-clip-text) {
  fill: v-bind('computedTextColor');
}
</style>
