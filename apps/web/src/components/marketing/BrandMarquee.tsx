'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Pause, Play } from 'lucide-react'

/**
 * 15 品牌图片跑马灯(第 6 页)
 *
 * 还原自原版 client/src/views/Home.vue 的 brand-marquee 区块。
 * 功能:
 *  - 自动滚动(requestAnimationFrame,默认速度 1)
 *  - 鼠标/触摸拖拽
 *  - 滚轮控制(默认灵敏度 0.5)
 *  - 惯性滑动(friction = 0.92)
 *  - 无缝循环(复制一份 15 张卡片,共 30 张;位置规范化到 [-W, 0])
 *  - 速度/灵敏度滑块 + 暂停/继续按钮
 *  - prefers-reduced-motion 降级(不启动自动滚动)
 */

interface BrandItem {
  src: string
  altKey: string
}

const BRANDS: BrandItem[] = [
  { src: '/brands/kouzi.png', altKey: 'kouzi' },
  { src: '/brands/bbx.svg', altKey: 'bbxLogo' },
  { src: '/brands/openai.png', altKey: 'openai' },
  { src: '/brands/zhipu.png', altKey: 'zhipu' },
  { src: '/brands/gork.png', altKey: 'gork' },
  { src: '/brands/brand8.png', altKey: 'brand8' },
  { src: '/brands/ali.png', altKey: 'ali' },
  { src: '/brands/tencent.png', altKey: 'tencent' },
  { src: '/brands/huawei.svg', altKey: 'huawei' },
  { src: '/brands/baidu.svg', altKey: 'baidu' },
  { src: '/brands/ybx.png', altKey: 'yuanbaoxiang' },
  { src: '/brands/yushu.png', altKey: 'yushu' },
  { src: '/brands/dbsfdx.png', altKey: 'dbsfdx' },
  { src: '/brands/jldx.png', altKey: 'jldx' },
  { src: '/brands/n8n.svg', altKey: 'n8n' },
]

const DEFAULT_SPEED = 1
const DEFAULT_SENSITIVITY = 0.5
const FRICTION = 0.92
const MIN_VELOCITY = 1
const WHEEL_STOP_DELAY = 100
const DRAG_LOCK_DELAY = 500

/** 从 element 的 transform matrix 解析当前 translateX */
function readCurrentTranslateX(el: HTMLElement | null): number {
  if (!el) return 0
  const matrix = window.getComputedStyle(el).transform
  if (!matrix || matrix === 'none') return 0
  const matched = matrix.match(/matrix.*\((.+)\)/)
  if (!matched) return 0
  const parts = matched[1]?.split(', ')
  if (!parts || parts.length < 4) return 0
  const tx = parts[4]
  if (typeof tx !== 'string') return 0
  return parseFloat(tx) || 0
}

/** 测量原始列表宽度(第 1 个卡片到第 16 个卡片的位置差) */
function measureOriginalWidth(container: HTMLElement | null): number {
  if (!container) return 0
  const items = container.querySelectorAll<HTMLElement>('.marquee-item')
  if (items.length < 16) return 0
  const first = items[0]
  const item16 = items[15]
  if (!first || !item16) return 0
  return item16.offsetLeft - first.offsetLeft
}

/** 将位置规范化到 [-width, 0] 区间 */
function normalizePosition(pos: number, width: number): number {
  if (width <= 0) return pos
  let p = pos
  while (p <= -width) p += width
  while (p > 0) p -= width
  return p
}

export function BrandMarquee() {
  const t = useTranslations('marketing.marquee')

  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const animationRef = React.useRef<number | null>(null)
  const dragRafRef = React.useRef<number | null>(null)
  const inertiaRef = React.useRef<number | null>(null)
  const wheelRafRef = React.useRef<number | null>(null)
  const wheelStopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDraggingRef = React.useRef(false)
  const isMouseDownRef = React.useRef(false)
  const isTouchStartRef = React.useRef(false)
  const lastTouchTimeRef = React.useRef(0)

  const dragOffsetRef = React.useRef(0)
  const dragStartXRef = React.useRef(0)
  const dragCurrentXRef = React.useRef(0)
  const dragVelocityRef = React.useRef(0)
  const lastDragXRef = React.useRef(0)
  const lastDragTimeRef = React.useRef(0)

  const wheelDeltaRef = React.useRef(0)
  const wheelVelocityRef = React.useRef(0)

  const reduceMotionRef = React.useRef(false)
  const isPausedRef = React.useRef(false)
  const speedRef = React.useRef(DEFAULT_SPEED)
  const sensitivityRef = React.useRef(DEFAULT_SENSITIVITY)

  const [isPaused, setIsPaused] = React.useState(false)
  const [speed, setSpeed] = React.useState(DEFAULT_SPEED)
  const [sensitivity, setSensitivity] = React.useState(DEFAULT_SENSITIVITY)

  const startAutoAnimation = React.useCallback(() => {
    const track = trackRef.current
    if (!track || isDraggingRef.current || reduceMotionRef.current || isPausedRef.current) return

    if (inertiaRef.current !== null) {
      cancelAnimationFrame(inertiaRef.current)
      inertiaRef.current = null
    }
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    track.style.animation = 'none'

    const initTimer = window.setTimeout(() => {
      window.clearTimeout(initTimer)
      if (!trackRef.current || isDraggingRef.current || isPausedRef.current) return

      const originalWidth = measureOriginalWidth(trackRef.current)
      if (originalWidth <= 0) {
        const retry = window.setTimeout(() => {
          window.clearTimeout(retry)
          startAutoAnimation()
        }, 100)
        return
      }

      let currentPosition = normalizePosition(
        readCurrentTranslateX(trackRef.current),
        originalWidth,
      )

      const animate = () => {
        if (!trackRef.current || isDraggingRef.current || isPausedRef.current) {
          animationRef.current = null
          return
        }
        currentPosition -= speedRef.current
        if (currentPosition <= -originalWidth) {
          currentPosition += originalWidth
        }
        trackRef.current.style.transform = `translateX(${Math.round(currentPosition)}px)`
        animationRef.current = requestAnimationFrame(animate)
      }
      animationRef.current = requestAnimationFrame(animate)
    }, 100)
  }, [])

  const startInertia = React.useCallback(() => {
    const track = trackRef.current
    if (!track) {
      startAutoAnimation()
      return
    }
    const originalWidth = measureOriginalWidth(track)
    if (originalWidth <= 0) {
      startAutoAnimation()
      return
    }

    let currentPosition = normalizePosition(readCurrentTranslateX(track), originalWidth)

    const step = () => {
      if (!trackRef.current) {
        inertiaRef.current = null
        return
      }
      if (Math.abs(dragVelocityRef.current) < MIN_VELOCITY) {
        inertiaRef.current = null
        startAutoAnimation()
        return
      }
      currentPosition += dragVelocityRef.current
      dragVelocityRef.current *= FRICTION
      currentPosition = normalizePosition(currentPosition, originalWidth)
      trackRef.current.style.transform = `translateX(${Math.round(currentPosition)}px)`
      inertiaRef.current = requestAnimationFrame(step)
    }
    inertiaRef.current = requestAnimationFrame(step)
  }, [startAutoAnimation])

  const handleDocumentMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !isMouseDownRef.current || !trackRef.current) return
    dragCurrentXRef.current = e.clientX
    if (dragRafRef.current !== null) return
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null
      if (!isDraggingRef.current || !trackRef.current) return

      const deltaX = dragCurrentXRef.current - dragStartXRef.current
      let position = dragOffsetRef.current + deltaX

      const now = Date.now()
      const dt = now - lastDragTimeRef.current
      if (dt > 0) {
        dragVelocityRef.current = ((dragCurrentXRef.current - lastDragXRef.current) / dt) * 16
      }
      lastDragXRef.current = dragCurrentXRef.current
      lastDragTimeRef.current = now

      const originalWidth = measureOriginalWidth(trackRef.current)
      if (originalWidth > 0) {
        position = normalizePosition(position, originalWidth)
        trackRef.current.style.transform = `translateX(${Math.round(position)}px)`
      }
    })
    e.preventDefault()
  }, [])

  const handleDocumentMouseUp = React.useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      isMouseDownRef.current = false
      isDraggingRef.current = false

      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)

      if (trackRef.current) {
        if (Math.abs(dragVelocityRef.current) > MIN_VELOCITY) {
          startInertia()
        } else {
          startAutoAnimation()
        }
      }
      e.preventDefault()
    },
    [handleDocumentMouseMove, startAutoAnimation, startInertia],
  )

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (lastTouchTimeRef.current && Date.now() - lastTouchTimeRef.current < DRAG_LOCK_DELAY)
        return
      const track = trackRef.current
      if (!track) return

      isMouseDownRef.current = true
      dragVelocityRef.current = 0
      lastDragXRef.current = e.clientX
      lastDragTimeRef.current = Date.now()

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (inertiaRef.current !== null) {
        cancelAnimationFrame(inertiaRef.current)
        inertiaRef.current = null
      }

      isDraggingRef.current = true
      dragStartXRef.current = e.clientX
      dragCurrentXRef.current = e.clientX
      dragOffsetRef.current = normalizePosition(
        readCurrentTranslateX(track),
        measureOriginalWidth(track),
      )

      document.addEventListener('mousemove', handleDocumentMouseMove)
      document.addEventListener('mouseup', handleDocumentMouseUp)

      e.preventDefault()
      e.stopPropagation()
    },
    [handleDocumentMouseMove, handleDocumentMouseUp],
  )

  const handleDocumentTouchMove = React.useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || !isTouchStartRef.current || !trackRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    dragCurrentXRef.current = touch.clientX
    if (dragRafRef.current !== null) return
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null
      if (!isDraggingRef.current || !trackRef.current) return

      const deltaX = dragCurrentXRef.current - dragStartXRef.current
      let position = dragOffsetRef.current + deltaX

      const now = Date.now()
      const dt = now - lastDragTimeRef.current
      if (dt > 0) {
        dragVelocityRef.current = ((dragCurrentXRef.current - lastDragXRef.current) / dt) * 16
      }
      lastDragXRef.current = dragCurrentXRef.current
      lastDragTimeRef.current = now

      const originalWidth = measureOriginalWidth(trackRef.current)
      if (originalWidth > 0) {
        position = normalizePosition(position, originalWidth)
        trackRef.current.style.transform = `translateX(${Math.round(position)}px)`
      }
    })
    e.preventDefault()
  }, [])

  const handleDocumentTouchEnd = React.useCallback(
    (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      isTouchStartRef.current = false
      isDraggingRef.current = false

      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
      document.removeEventListener('touchmove', handleDocumentTouchMove)
      document.removeEventListener('touchend', handleDocumentTouchEnd)

      if (trackRef.current) {
        if (Math.abs(dragVelocityRef.current) > MIN_VELOCITY) {
          startInertia()
        } else {
          startAutoAnimation()
        }
      }
      e.preventDefault()
    },
    [handleDocumentTouchMove, startAutoAnimation, startInertia],
  )

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const track = trackRef.current
      if (!track) return
      isTouchStartRef.current = true
      lastTouchTimeRef.current = Date.now()
      const touch = e.touches[0]
      if (!touch) return

      dragVelocityRef.current = 0
      lastDragXRef.current = touch.clientX
      lastDragTimeRef.current = Date.now()

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (inertiaRef.current !== null) {
        cancelAnimationFrame(inertiaRef.current)
        inertiaRef.current = null
      }

      isDraggingRef.current = true
      dragStartXRef.current = touch.clientX
      dragCurrentXRef.current = touch.clientX
      dragOffsetRef.current = normalizePosition(
        readCurrentTranslateX(track),
        measureOriginalWidth(track),
      )

      document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false })
      document.addEventListener('touchend', handleDocumentTouchEnd)

      e.preventDefault()
      e.stopPropagation()
    },
    [handleDocumentTouchMove, handleDocumentTouchEnd],
  )

  const handleWheel = React.useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const track = trackRef.current
      if (!track) return
      e.preventDefault()
      wheelDeltaRef.current += e.deltaY
      wheelVelocityRef.current = -e.deltaY * sensitivityRef.current

      if (inertiaRef.current !== null) {
        cancelAnimationFrame(inertiaRef.current)
        inertiaRef.current = null
      }
      if (wheelStopTimerRef.current) {
        clearTimeout(wheelStopTimerRef.current)
      }
      if (wheelRafRef.current !== null) return
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null
        if (!trackRef.current) return
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }

        const originalWidth = measureOriginalWidth(trackRef.current)
        if (originalWidth <= 0) {
          wheelDeltaRef.current = 0
          return
        }

        let currentPosition = readCurrentTranslateX(trackRef.current)
        currentPosition -= wheelDeltaRef.current
        wheelDeltaRef.current = 0
        currentPosition = normalizePosition(currentPosition, originalWidth)
        trackRef.current.style.transform = `translateX(${Math.round(currentPosition)}px)`
        trackRef.current.style.animation = 'none'

        wheelStopTimerRef.current = setTimeout(() => {
          wheelStopTimerRef.current = null
          if (Math.abs(wheelVelocityRef.current) > MIN_VELOCITY) {
            dragVelocityRef.current = wheelVelocityRef.current
            startInertia()
          } else {
            startAutoAnimation()
          }
        }, WHEEL_STOP_DELAY)
      })
    },
    [startAutoAnimation, startInertia],
  )

  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduceMotionRef.current = mql.matches
    const onMotionChange = (ev: MediaQueryListEvent) => {
      reduceMotionRef.current = ev.matches
      if (ev.matches) {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
      } else {
        startAutoAnimation()
      }
    }
    mql.addEventListener('change', onMotionChange)
    startAutoAnimation()
    return () => {
      mql.removeEventListener('change', onMotionChange)
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      if (dragRafRef.current !== null) cancelAnimationFrame(dragRafRef.current)
      if (inertiaRef.current !== null) cancelAnimationFrame(inertiaRef.current)
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current)
      if (wheelStopTimerRef.current) clearTimeout(wheelStopTimerRef.current)
      document.removeEventListener('mousemove', handleDocumentMouseMove)
      document.removeEventListener('mouseup', handleDocumentMouseUp)
      document.removeEventListener('touchmove', handleDocumentTouchMove)
      document.removeEventListener('touchend', handleDocumentTouchEnd)
    }
  }, [
    startAutoAnimation,
    handleDocumentMouseMove,
    handleDocumentMouseUp,
    handleDocumentTouchMove,
    handleDocumentTouchEnd,
  ])

  const handleTogglePause = () => {
    const next = !isPausedRef.current
    isPausedRef.current = next
    setIsPaused(next)
    if (next) {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    } else {
      startAutoAnimation()
    }
  }

  const handleSpeedChange = (v: number) => {
    speedRef.current = v
    setSpeed(v)
  }

  const handleSensitivityChange = (v: number) => {
    sensitivityRef.current = v
    setSensitivity(v)
  }

  const loop = [...BRANDS, ...BRANDS]

  return (
    <div className="w-full px-4 py-8 md:px-6 md:py-12">
      <div className="mb-6 text-center md:mb-8">
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">{t('title')}</h2>
        <h3 className="font-edix mt-1 text-xs uppercase tracking-wider text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground md:mt-2 md:text-base">{t('subtitle')}</p>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl border bg-card/30"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onWheel={handleWheel}
        role="region"
        aria-label={t('title')}
      >
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ transform: 'translateX(0px)', gap: '30px', cursor: 'grab' }}
        >
          {loop.map((brand, idx) => (
            <div
              key={`${brand.altKey}-${idx}`}
              className="marquee-item flex h-16 shrink-0 items-center justify-center px-4 md:h-20 md:px-6"
              style={{ width: '180px' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.src}
                alt={t(brand.altKey)}
                loading="lazy"
                draggable={false}
                className="max-h-12 max-w-full object-contain md:max-h-16"
              />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground md:text-base">{t('joinText')}</p>

      {/* 控制条:暂停 + 速度滑块 + 灵敏度滑块 */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-4 md:gap-6">
        <button
          type="button"
          onClick={handleTogglePause}
          aria-label={isPaused ? t('resumeScroll') : t('pauseScroll')}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
        >
          {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {isPaused ? t('resumeScroll') : t('pauseScroll')}
        </button>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('marqueeSpeedLabel')}</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.5}
            value={speed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-primary md:w-24"
            aria-label={t('marqueeSpeedLabel')}
          />
          <span className="w-6 text-center font-medium text-foreground">{speed.toFixed(1)}x</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('wheelSensitivityLabel')}</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={sensitivity}
            onChange={(e) => handleSensitivityChange(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-primary md:w-24"
            aria-label={t('wheelSensitivityLabel')}
          />
          <span className="w-6 text-center font-medium text-foreground">
            {sensitivity.toFixed(1)}
          </span>
        </label>
      </div>
    </div>
  )
}
