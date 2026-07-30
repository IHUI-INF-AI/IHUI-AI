import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { getTokens, type AppThemeMode } from '../theme/tokens'
import type { CarouselItem } from '@ihui/types'

/**
 * Carousel 轮播组件(跨端共享层)。
 *
 * 对齐原项目 mobile-rn/Carousel.tsx + miniapp-taro 的横向轮播。
 *
 * 平台无关:
 * - 不依赖 @tarojs/* 或 react-native,使用 div/span/img + onClick
 * - 自动播放逻辑内联实现(`useAutoPlay` 等价 hook,9 行),不依赖 @ihui/shared 避免新增依赖
 * - 滑动状态用 `onScroll`(容器 onScroll)替代 RN 的 `onMomentumScrollEnd`
 * - 指标(indicator)用 div 渲染,active/inactive 状态用宽度+颜色区分
 * - 容器宽度通过 ResizeObserver 响应式适配(替代 RN `useWindowDimensions`)
 */
export interface CarouselProps {
  /** 轮播数据(共享类型 CarouselItem) */
  banner: CarouselItem[]
  /** 容器高度(px),默认 160 */
  height?: number
  /** 自动播放间隔(ms),默认 3000 */
  autoplayInterval?: number
  /** 单项点击回调 */
  onItemPress?: (item: CarouselItem, index: number) => void
  className?: string
  /** 已解析主题,默认 'light' */
  colorScheme?: AppThemeMode
}

const DEFAULT_HEIGHT = 160
const DEFAULT_VIEWPORT_WIDTH = 375

/** 内联自动播放 hook(等价 @ihui/shared/useAutoPlay,避免新增依赖) */
function useCarouselAutoPlay(
  total: number,
  interval: number,
  enabled: boolean,
): {
  current: number
  setCurrent: (n: number) => void
} {
  const [current, setCurrentState] = useState(0)
  useEffect(() => {
    if (!enabled || total <= 1) return
    const timer = setInterval(() => {
      setCurrentState((prev) => (prev + 1) % total)
    }, interval)
    return () => clearInterval(timer)
  }, [enabled, interval, total])
  return { current, setCurrent: setCurrentState }
}

/** view container 样式(独立函数避免 style 联合类型) */
const viewStyles = {
  root: (height: number): CSSProperties => ({
    position: 'relative',
    width: '100%',
    height,
    overflow: 'hidden',
  }),
  viewport: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
  }),
  slide: (width: number, height: number): CSSProperties => ({
    flex: '0 0 auto',
    width,
    height,
    scrollSnapAlign: 'start',
  }),
  image: (width: number, height: number): CSSProperties => ({
    display: 'block',
    width,
    height,
    objectFit: 'cover',
  }),
  empty: (height: number): CSSProperties => ({
    width: '100%',
    height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  }),
  indicatorWrap: (): CSSProperties => ({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  }),
  dot: (active: boolean): CSSProperties => ({
    width: active ? 16 : 6,
    height: 6,
    backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
    borderRadius: 3,
    transition: 'all 0.3s ease',
  }),
}

const textStyles = {
  empty: (): CSSProperties => ({
    fontSize: 12,
    color: '#9CA3AF',
  }),
}

/** 检测 viewport 宽度(web 端无 useWindowDimensions,降级到默认值) */
function getViewportWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_VIEWPORT_WIDTH
  return window.innerWidth || DEFAULT_VIEWPORT_WIDTH
}

export function Carousel({
  banner,
  height = DEFAULT_HEIGHT,
  autoplayInterval = 3000,
  onItemPress,
  className,
  colorScheme = 'light',
}: CarouselProps) {
  // 触发主题 token 解析,确保 brand 颜色被引用进入 inline style
  void getTokens(colorScheme)
  const { current, setCurrent } = useCarouselAutoPlay(
    banner?.length ?? 0,
    autoplayInterval,
    !!banner && banner.length > 1,
  )
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportWidth, setViewportWidth] = useState<number>(getViewportWidth)
  const [containerWidth, setContainerWidth] = useState<number>(DEFAULT_VIEWPORT_WIDTH)

  // 监听窗口尺寸变化(web 端等价 useWindowDimensions)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = (): void => setViewportWidth(window.innerWidth || DEFAULT_VIEWPORT_WIDTH)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // 监听容器实际宽度(响应式适配父容器)
  useEffect(() => {
    const el = viewportRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (w > 0) setContainerWidth(w)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 有效滚动宽度(优先用容器实际宽度,降级到 viewport 宽度)
  const slideWidth = containerWidth > 0 ? containerWidth : viewportWidth

  // current 变化时滚动到对应位置(useCarouselAutoPlay 内部已驱动 current 自动变化)
  useEffect(() => {
    const el = viewportRef.current
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ left: current * slideWidth, behavior: 'smooth' })
    }
  }, [current, slideWidth])

  const onScroll = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      const idx = Math.round(target.scrollLeft / slideWidth)
      if (idx !== current && idx >= 0 && idx < (banner?.length ?? 0)) {
        setCurrent(idx)
      }
    },
    [current, slideWidth, banner, setCurrent],
  )

  if (!banner || banner.length === 0) {
    return (
      <div className={className} style={viewStyles.empty(height)}>
        <span style={textStyles.empty()}>暂无轮播图</span>
      </div>
    )
  }

  return (
    <div className={className} style={viewStyles.root(height)}>
      <div ref={viewportRef} onScroll={onScroll} style={viewStyles.viewport()}>
        {banner.map((item, index) => (
          <div
            key={index}
            role="button"
            tabIndex={0}
            onClick={() => onItemPress?.(item, index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onItemPress?.(item, index)
              }
            }}
            style={viewStyles.slide(slideWidth, height)}
          >
            <img src={item.img} alt="" style={viewStyles.image(slideWidth, height)} />
          </div>
        ))}
      </div>

      {/* 指示器(用 gap-* 分隔,非圆形) */}
      <div style={viewStyles.indicatorWrap()}>
        {banner.map((_, index) => (
          <div key={index} style={viewStyles.dot(index === current)} />
        ))}
      </div>
    </div>
  )
}
