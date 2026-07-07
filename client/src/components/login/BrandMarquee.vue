<!--
  BrandMarquee - 品牌跑马灯组件 (弹窗内嵌版本)
  2026-07-06 立, 用户规则: 从 git 历史 (5e56b6ba) 恢复跑马灯功能, 适配 UniversalLogin 弹窗内嵌布局.
  原 full-page 版本用 position:fixed 定位在屏幕左下角, 此版本改为弹窗内 flow 布局, 放在第三方登录下方.
  保留: 15 个品牌 logo (与首页同步) + JS requestAnimationFrame 无缝滚动 + 鼠标/触摸拖拽.
-->
<template>
  <div class="brand-marquee-container">
    <div class="brand-marquee">
      <div
        class="marquee-track"
        ref="marqueeTrackRef"
        :class="{ dragging: isDragging }"
        @mousedown="handleMarqueeMouseDown"
        @touchstart="handleMarqueeTouchStart"
      >
        <div class="marquee-item" v-for="i in BRAND_COUNT" :key="i">
          <img
            :src="getMarqueeImageSrc(i)"
            :alt="getMarqueeImageAlt(i)"
            class="marquee-image"
            @error="handleImageError($event, i)"
            @load="handleImageLoad($event, i)"
            loading="lazy"
          />
        </div>
        <!-- 复制一份用于无缝滚动 -->
        <div class="marquee-item" v-for="i in BRAND_COUNT" :key="`copy-${i}`">
          <img
            :src="getMarqueeImageSrc(i)"
            :alt="getMarqueeImageAlt(i)"
            class="marquee-image"
            @error="handleImageError($event, i)"
            @load="handleImageLoad($event, i)"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

// 品牌跑马灯图片导入 (与首页 Home.vue 完全同步, 15 个品牌)
import kouziIcon from '@/assets/images/kouzi-icon.png'
import bbxIcon from '@/assets/images/bbxlogo.svg'
import openaiIcon from '@/assets/images/openai.png'
import brand6Icon from '@/assets/images/智谱清言@1x.png'
import brand7Icon from '@/assets/images/gork.png'
import brand8Icon from '@/assets/images/8@1x.png'
import brand9Icon from '@/assets/images/ali.png'
import brand10Icon from '@/assets/images/TX.png'
import brand11Icon from '@/assets/images/华为.svg'
import brand12Icon from '@/assets/images/百度.svg'
import brand13Icon from '@/assets/images/ybx.png'
import brand14Icon from '@/assets/images/Yushu.png'
import brand15Icon from '@/assets/images/dbsfdx.png'
import brand16Icon from '@/assets/images/jldx.png'
import n8nIcon from '@/assets/images/n8n.svg'

const { t } = useI18n()
const cleanup = useCleanup()

const BRAND_COUNT = 15

// 品牌图片数组 (索引 0 对应 i=1)
const brandImages: string[] = [
  kouziIcon,    // 1. 扣子
  bbxIcon,      // 2. 百宝箱
  openaiIcon,   // 3. OpenAI
  brand6Icon,   // 4. 智谱清言
  brand7Icon,   // 5. Gork
  brand8Icon,   // 6. 8@1x
  brand9Icon,   // 7. Ali
  brand10Icon,  // 8. TX
  brand11Icon,  // 9. 华为
  brand12Icon,  // 10. 百度
  brand13Icon,  // 11. ybx
  brand14Icon,  // 12. Yushu
  brand15Icon,  // 13. dbsfdx
  brand16Icon,  // 14. jldx
  n8nIcon,      // 15. n8n
]

const brandNames: string[] = [
  '扣子',
  '百宝箱',
  'OpenAI',
  '智谱清言',
  'Gork',
  '品牌8',
  'Ali',
  'TX',
  '华为',
  '百度',
  'ybx',
  'Yushu',
  'dbsfdx',
  'jldx',
  'n8n',
]

// 跑马灯状态
const marqueeTrackRef = ref<HTMLElement | null>(null)
let marqueeAnimationId: number | null = null

// 拖拽状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragCurrentX = ref(0)
const dragOffset = ref(0)
let isMouseDown = false
let isTouchStart = false
let marqueeDragRafId: number | null = null

const getMarqueeImageSrc = (index: number): string => {
  return brandImages[index - 1] || '/images/logo.svg'
}

const getMarqueeImageAlt = (index: number): string => {
  return brandNames[index - 1] || `Brand ${index}`
}

const handleImageError = (event: Event, index: number): void => {
  const img = event.target as HTMLImageElement
  logger.warn(`[BrandMarquee] Image ${index} failed to load, fallback to logo`)
  img.src = '/images/logo.svg'
}

const handleImageLoad = (_event: Event, _index: number): void => {
  // 图片加载成功
}

// 启动跑马灯动画
const startMarqueeAnimation = (): void => {
  if (!marqueeTrackRef.value || isDragging.value) return

  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }

  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
  }

  nextTick(() => {
    setTimeout(() => {
      if (!marqueeTrackRef.value) return

      const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
      const matrix = computedStyle.transform
      let currentPosition = 0
      if (matrix && matrix !== 'none') {
        const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
        if (matrixValues && matrixValues.length >= 4) {
          currentPosition = parseFloat(matrixValues[4]) || 0
        }
      }

      const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
      if (items.length === 0 || items.length < BRAND_COUNT * 2) {
        setTimeout(() => startMarqueeAnimation(), 100)
        return
      }

      const firstItem = items[0] as HTMLElement
      if (!firstItem || firstItem.offsetWidth === 0) {
        setTimeout(() => startMarqueeAnimation(), 100)
        return
      }

      const itemWidth = firstItem.offsetWidth
      const gap = 8
      const singleItemWidth = itemWidth + gap
      const originalWidth = singleItemWidth * BRAND_COUNT

      while (currentPosition < -originalWidth) {
        currentPosition += originalWidth
      }
      while (currentPosition >= 0) {
        currentPosition -= originalWidth
      }

      const speed = 0.5

      const animate = (): void => {
        if (!marqueeTrackRef.value) {
          marqueeAnimationId = null
          return
        }

        currentPosition -= speed

        if (currentPosition <= -originalWidth + singleItemWidth) {
          currentPosition = currentPosition + originalWidth
        }

        marqueeTrackRef.value.style.transform = `translateX(${currentPosition}px)`
        marqueeAnimationId = requestAnimationFrame(animate)
      }

      marqueeAnimationId = requestAnimationFrame(animate)
    }, 100)
  })
}

// 鼠标拖拽
const handleMarqueeMouseDown = (e: MouseEvent): void => {
  if (!marqueeTrackRef.value) return
  isMouseDown = true

  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }

  isDragging.value = true
  dragStartX.value = e.clientX
  dragCurrentX.value = e.clientX

  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
    const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
    const matrix = computedStyle.transform
    if (matrix && matrix !== 'none') {
      const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
      if (matrixValues && matrixValues.length >= 4) {
        dragOffset.value = parseFloat(matrixValues[4]) || 0
        const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
        if (items.length > 0) {
          const firstItem = items[0] as HTMLElement
          const itemWidth = firstItem.offsetWidth
          const gap = 8
          const singleItemWidth = itemWidth + gap
          const originalWidth = singleItemWidth * BRAND_COUNT
          while (dragOffset.value <= -originalWidth) {
            dragOffset.value += originalWidth
          }
          while (dragOffset.value > 0) {
            dragOffset.value -= originalWidth
          }
        }
      }
    } else {
      dragOffset.value = 0
    }
  }

  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('mouseup', handleDocumentMouseUp)
  e.preventDefault()
  e.stopPropagation()
}

const handleDocumentMouseMove = (e: MouseEvent): void => {
  if (!isDragging.value || !marqueeTrackRef.value || !isMouseDown) return

  dragCurrentX.value = e.clientX
  if (marqueeDragRafId !== null) return
  marqueeDragRafId = requestAnimationFrame(() => {
    marqueeDragRafId = null
    if (!isDragging.value || !marqueeTrackRef.value) return
    const deltaX = dragCurrentX.value - dragStartX.value
    const newPosition = dragOffset.value + deltaX

    const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
    if (items.length > 0) {
      const firstItem = items[0] as HTMLElement
      const itemWidth = firstItem.offsetWidth
      const gap = 8
      const singleItemWidth = itemWidth + gap
      const originalWidth = singleItemWidth * BRAND_COUNT

      let finalPosition = newPosition
      while (finalPosition <= -originalWidth) {
        finalPosition += originalWidth
      }
      while (finalPosition > 0) {
        finalPosition -= originalWidth
      }

      marqueeTrackRef.value.style.transform = `translateX(${finalPosition}px)`
    }
  })
  e.preventDefault()
}

const handleDocumentMouseUp = (e: MouseEvent): void => {
  if (!isDragging.value) return
  isMouseDown = false
  isDragging.value = false

  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }

  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)

  if (marqueeTrackRef.value) {
    startMarqueeAnimation()
  }
  e.preventDefault()
}

// 触摸拖拽
const handleMarqueeTouchStart = (e: Event): void => {
  if (!marqueeTrackRef.value) return
  const touchEvent = e as globalThis.TouchEvent
  isTouchStart = true
  const touch = touchEvent.touches[0]

  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }

  isDragging.value = true
  dragStartX.value = touch.clientX
  dragCurrentX.value = touch.clientX

  if (marqueeTrackRef.value) {
    marqueeTrackRef.value.style.animation = 'none'
    const computedStyle = window.getComputedStyle(marqueeTrackRef.value)
    const matrix = computedStyle.transform
    if (matrix && matrix !== 'none') {
      const matrixValues = matrix.match(/matrix.*\((.+)\)/)?.[1].split(', ')
      if (matrixValues && matrixValues.length >= 4) {
        dragOffset.value = parseFloat(matrixValues[4]) || 0
        const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
        if (items.length > 0) {
          const firstItem = items[0] as HTMLElement
          const itemWidth = firstItem.offsetWidth
          const gap = 8
          const singleItemWidth = itemWidth + gap
          const originalWidth = singleItemWidth * BRAND_COUNT
          while (dragOffset.value <= -originalWidth) {
            dragOffset.value += originalWidth
          }
          while (dragOffset.value > 0) {
            dragOffset.value -= originalWidth
          }
        }
      }
    } else {
      dragOffset.value = 0
    }
  }

  document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false })
  document.addEventListener('touchend', handleDocumentTouchEnd)
  e.preventDefault()
  e.stopPropagation()
}

const handleDocumentTouchMove = (e: Event): void => {
  if (!isDragging.value || !marqueeTrackRef.value || !isTouchStart) return
  const touchEvent = e as globalThis.TouchEvent
  const touch = touchEvent.touches[0]
  dragCurrentX.value = touch.clientX
  if (marqueeDragRafId !== null) return
  marqueeDragRafId = requestAnimationFrame(() => {
    marqueeDragRafId = null
    if (!isDragging.value || !marqueeTrackRef.value) return
    const deltaX = dragCurrentX.value - dragStartX.value
    const newPosition = dragOffset.value + deltaX

    const items = marqueeTrackRef.value.querySelectorAll('.marquee-item')
    if (items.length > 0) {
      const firstItem = items[0] as HTMLElement
      const itemWidth = firstItem.offsetWidth
      const gap = 8
      const singleItemWidth = itemWidth + gap
      const originalWidth = singleItemWidth * BRAND_COUNT

      let finalPosition = newPosition
      while (finalPosition <= -originalWidth) {
        finalPosition += originalWidth
      }
      while (finalPosition > 0) {
        finalPosition -= originalWidth
      }
      marqueeTrackRef.value.style.transform = `translateX(${finalPosition}px)`
    }
  })
  e.preventDefault()
}

const handleDocumentTouchEnd = (e: Event): void => {
  if (!isDragging.value) return
  isTouchStart = false
  isDragging.value = false

  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }

  document.removeEventListener('touchmove', handleDocumentTouchMove)
  document.removeEventListener('touchend', handleDocumentTouchEnd)

  if (marqueeTrackRef.value) {
    startMarqueeAnimation()
  }
  e.preventDefault()
}

onMounted(() => {
  setTimeout(() => {
    startMarqueeAnimation()
  }, 500)
})

cleanup.add(() => {
  if (marqueeAnimationId !== null) {
    cancelAnimationFrame(marqueeAnimationId)
    marqueeAnimationId = null
  }
  if (marqueeDragRafId !== null) {
    cancelAnimationFrame(marqueeDragRafId)
    marqueeDragRafId = null
  }
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
  document.removeEventListener('touchmove', handleDocumentTouchMove)
  document.removeEventListener('touchend', handleDocumentTouchEnd)
})
</script>

<style scoped lang="scss">
// 弹窗内嵌版本: 全局 brand-marquee.scss 通过 main.ts 全局加载,
// 其选择器 .brand-marquee-container .marquee-item (特异性 0,2,0) 会覆盖 scoped 的 .marquee-item[data-v-xxx] (0,2,0)
// 解决: 用嵌套选择器 .brand-marquee-container .xxx 提高特异性到 0,3,0

.brand-marquee-container {
  width: 100%;
  margin-top: 12px;
  padding: 4px 0;
  overflow: hidden;
  display: flex;
  justify-content: flex-start;
  align-items: center;

  .brand-marquee {
    position: relative;
    width: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    padding: 2px 0;
    cursor: grab;
    user-select: none;

    &:active {
      cursor: grabbing;
    }
  }

  .marquee-track {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    width: max-content;
    will-change: transform;
    position: relative;

    &.dragging {
      cursor: grabbing;
    }
  }

  // 弹窗内嵌: 卡片 (用户反馈"还是太小了", 再调大)
  .marquee-item {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border-radius: var(--global-border-radius);
    min-width: 0;
    min-height: 0;
    width: 88px;
    height: 44px;
    box-sizing: border-box;
  }

  .marquee-image {
    width: 80px;
    height: 40px;
    min-width: 0;
    min-height: 0;
    max-width: 80px;
    max-height: 40px;
    object-fit: contain;
    opacity: 0.85;
    transition: opacity 0.3s ease;
    background: transparent;
    padding: 0;
    border: none;
    box-shadow: none;
    border-radius: var(--global-border-radius);

    &:hover {
      opacity: 1;
    }
  }
}

// 移动端
@media (max-width: 480px) {
  .brand-marquee-container {
    .marquee-item {
      width: 72px;
      height: 36px;
      padding: 3px 6px;
    }

    .marquee-image {
      width: 64px;
      height: 32px;
      max-width: 64px;
      max-height: 32px;
    }
  }
}
</style>
