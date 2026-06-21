<template>
  <div class="flashlight-background">
    <div class="flashlight-spot" ref="spotRef"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { logger } from '../../utils/logger'
const spotRef = ref<HTMLElement | null>(null)

let mouseMoveHandler: ((event: PointerEvent) => void) | null = null
// rAF 节流：鼠标移动每帧最多更新一次位置
let pointerRafId: number | null = null
let pendingX = 0
let pendingY = 0

onMounted(() => {
  if (!spotRef.value) {
    return
  }

  // 初始位置设置为屏幕中心
  const centerX = window.innerWidth / 2
  const centerY = window.innerHeight / 2

  spotRef.value.style.left = `${centerX}px`
  spotRef.value.style.top = `${centerY}px`

  // 鼠标移动处理函数（rAF 节流）
  mouseMoveHandler = (event: PointerEvent) => {
    pendingX = event.clientX
    pendingY = event.clientY
    if (pointerRafId !== null) return
    pointerRafId = requestAnimationFrame(() => {
      pointerRafId = null
      if (!spotRef.value) return
      spotRef.value.style.left = `${pendingX}px`
      spotRef.value.style.top = `${pendingY}px`
    })
  }

  window.addEventListener('pointermove', mouseMoveHandler, { passive: true })
})

onUnmounted(() => {
  try {
    if (mouseMoveHandler) {
      window.removeEventListener('pointermove', mouseMoveHandler)
      mouseMoveHandler = null
    }
    if (pointerRafId !== null) {
      cancelAnimationFrame(pointerRafId)
      pointerRafId = null
    }
  } catch (error) {
    logger.warn('[FlashlightBackground] Error cleaning up:', error)
  }
})
</script>

<style scoped lang="scss">
.flashlight-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: var(--z-0);
  overflow: hidden;
  pointer-events: none;
  background-color: transparent;
}

.flashlight-spot {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  height: 400px;
  border-radius: var(--global-border-radius);
  pointer-events: none;
  z-index: var(--z-base);

  // 纯白色手电筒效果 - 从中心向外扩散的光晕
  background: var(--el-bg-color-page);

  // 添加轻微的模糊效果，模拟手电筒光晕
  filter: blur(30px);
  -webkit-filter: blur(30px);
  will-change: left, top, transform;
}

/* 响应式设计 */
@media (width <= 768px) {
  .flashlight-spot {
    width: 300px;
    height: 300px;
    filter: blur(25px);
    -webkit-filter: blur(25px);
  }
}

@media (width <= 480px) {
  .flashlight-spot {
    width: 250px;
    height: 250px;
    filter: blur(20px);
    -webkit-filter: blur(20px);
  }
}

/* 低性能设备优化 */
@media (prefers-reduced-motion: reduce) {
  .flashlight-spot {
    filter: blur(15px);
    -webkit-filter: blur(15px);
  }
}
</style>
