<template>
  <!-- IhuiAi动效层 - 完全独立的层，不影响现有内容 -->
  <div class="ihui-ai-effects-layer">
    <!-- 背景图片层 -->
    <div class="ihui-ai-background-layer">
      <img
        v-if="showBackground && bgTopUrl"
        :src="bgTopUrl"
        alt=""
        class="ihui-ai-bg-top"
        loading="lazy"
        @error="handleImageError"
      />
      <img
        v-if="showBackground && bgFeatureUrl"
        :src="bgFeatureUrl"
        alt=""
        class="ihui-ai-bg-feature"
        loading="lazy"
        @error="handleImageError"
      />
    </div>

    <!-- 动画元素层 -->
    <div class="ihui-ai-animations-layer">
      <!-- 淡入动画元素 -->
      <div
        v-for="(item, index) in animationItems"
        :key="index"
        class="ihui-ai-animation-item"
        :class="{
          'ihui-ai-fade-in-left': item.type === 'left',
          'ihui-ai-fade-in-top': item.type === 'top',
          'ihui-ai-opacity': item.type === 'opacity',
        }"
        :style="{
          top: item.top + 'px',
          left: item.left + 'px',
          'animation-delay': item.delay + 's',
        }"
      >
        <div class="ihui-ai-particle"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

interface Props {
  showBackground?: boolean
  animationCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  showBackground: true,
  animationCount: 10,
})

const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
const animationItems = ref<
  Array<{
    type: 'left' | 'top' | 'opacity'
    top: number
    left: number
    delay: number
  }>
>([])

// 动态图片 URL - 使用运行时路径，避免构建时检查
const bgTopUrl = ref<string>('')
const bgFeatureUrl = ref<string>('')

// 初始化动画元素
const initAnimationItems = () => {
  if (typeof window === 'undefined') return
  if (prefersReducedMotion()) {
    animationItems.value = []
    return
  }

  animationItems.value = []
  const height = window.innerHeight || 800
  const width = window.innerWidth || 1200

  // 根据视口自适应数量，避免移动端/低性能设备过多粒子
  const viewportBasedCount = (() => {
    const w = width
    if (w <= 480) return Math.min(props.animationCount, 4)
    if (w <= 900) return Math.min(props.animationCount, 7)
    return props.animationCount
  })()

  for (let i = 0; i < viewportBasedCount; i++) {
    animationItems.value.push({
      type: ['left', 'top', 'opacity'][Math.floor(Math.random() * 3)] as 'left' | 'top' | 'opacity',
      top: Math.random() * height,
      left: Math.random() * width,
      delay: Math.random() * 2,
    })
  }
}

let resizeRafId: number | null = null
let resizeHandler: (() => void) | null = null
const cleanup = useCleanup()
cleanup.add(() => {
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
})

// 在组件挂载时检查图片是否存在
onMounted(() => {
  // 使用运行时路径检查，避免构建时解析错误
  if (typeof window !== 'undefined') {
    // 设置图片 URL，如果图片不存在会在 @error 处理中隐藏
    bgTopUrl.value =
      props.showBackground && !prefersReducedMotion() ? '/images/ihui-ai/bgtop.3a236362.png' : ''
    bgFeatureUrl.value =
      props.showBackground && !prefersReducedMotion()
        ? '/images/ihui-ai/featurebg.123bfed8.png'
        : ''
  }

  initAnimationItems()

  // 窗口大小变化时重新初始化
  resizeHandler = () => {
    if (resizeRafId !== null) return
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null
      initAnimationItems()
    })
  }
  if (typeof window !== 'undefined') {
    cleanup.addEventListener(window, 'resize', resizeHandler as EventListener)
  }
})

// 处理图片加载错误
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  // 图片加载失败时隐藏图片，避免显示破损图标
  if (img) {
    img.style.display = 'none'
  }
}
</script>

<style scoped>
/* IhuiAi动效层 - 使用fixed定位，不影响现有布局 */
.ihui-ai-effects-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none ; /* 不拦截点击事件 */
  z-index: var(--z-dropdown);
  overflow: hidden;

  /* 所有子元素也不拦截点击 */
  * {
    pointer-events: none ;
  }
}

/* 背景层 */
.ihui-ai-background-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.1;
  pointer-events: none;
}

.ihui-ai-bg-top {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: auto;
  object-fit: cover;
  opacity: 0.15;
  pointer-events: none ; /* 不拦截点击事件 */
}

.ihui-ai-bg-feature {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: auto;
  object-fit: cover;
  opacity: 0.1;
  pointer-events: none ; /* 不拦截点击事件 */
}

/* 动画层 */
.ihui-ai-animations-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%; /* 不拦截点击事件 */
  pointer-events: none;
}

/* 动画粒子 */
.ihui-ai-animation-item {
  position: absolute;
  width: var(--particle-size);
  height: var(--particle-size);
  pointer-events: none;
  will-change: transform, opacity;
}

.ihui-ai-particle {
  width: 100%;
  height: 100%;
  background: var(--particle-fill);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  animation: ihui-ai-particle-pulse 2s ease-in-out infinite;
}

:global(html) {
}

:global(html.dark) {
  --particle-fill: var(--el-text-color-primary);
  --particle-shadow-1: var(--el-text-color-primary);
  --particle-shadow-2: var(--el-text-color-primary);
  --particle-shadow-3: var(--el-text-color-primary);
  --particle-size: 4px;
}

:global(html:not(.dark)) .ihui-ai-animations-layer {
  display: none;
}

@keyframes ihui-ai-particle-pulse {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 淡入动画 - 从左侧 */
.ihui-ai-fade-in-left {
  animation-name: ihui-ai-fade-in-left;
  animation-duration: 1s;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

@keyframes ihui-ai-fade-in-left {
  from {
    transform: translateX(-30px);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 淡入动画 - 从顶部 */
.ihui-ai-fade-in-top {
  animation-name: ihui-ai-fade-in-top;
  animation-duration: 1s;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

@keyframes ihui-ai-fade-in-top {
  from {
    transform: translateY(-30px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 透明度动画 */
.ihui-ai-opacity {
  animation-name: ihui-ai-opacity;
  animation-duration: 0.5s;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

@keyframes ihui-ai-opacity {
  from {
    transform: scale(0.7);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* 响应式 */
@media (width <= 768px) {
  .ihui-ai-background-layer {
    opacity: 0.05;
  }

  .ihui-ai-animation-item {
    width: 3px;
    height: 3px;
  }
}
</style>
