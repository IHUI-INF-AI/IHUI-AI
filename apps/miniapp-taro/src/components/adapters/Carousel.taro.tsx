import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeMode } from '@ihui/design-tokens'
import type { CarouselItem } from '@ihui/types'

/**
 * Taro 适配层:Carousel
 *
 * 平台特有:依赖 @tarojs/components 的 ScrollView/View/Image + onTap,
 * 不适合共享层。
 *
 * 复用 packages/app/src/components/Carousel 的 props 契约 + 自动播放逻辑(内联),
 * 替换 web 元素(`div`/`img` → `ScrollView`/`View`/`Image`)+ 事件(`onClick` → `onTap`)。
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 web 端主题一致。
 *
 * 自动播放:用 setInterval + setCurrentState 内联实现,等价共享 hook useAutoPlay。
 * 容器宽度用 `Taro.getSystemInfoSync().windowWidth` 替代 web window.innerWidth。
 */
export interface CarouselProps {
  banner: CarouselItem[]
  height?: number
  autoplayInterval?: number
  onItemPress?: (item: CarouselItem, index: number) => void
  className?: string
  colorScheme?: RnThemeMode
}

const DEFAULT_HEIGHT = 160

function getWindowWidth(): number {
  if (typeof window === 'undefined') return 375
  // web/H5 端直接读 window.innerWidth;Taro 端调用方可在 useEffect 中通过
  // `Taro.getSystemInfoSync()` 注入 windowWidth(典型场景:页面 onLoad 时设置全局)。
  // 适配层不直接 require('@tarojs/taro') 以保持 ESM 纯净 + 避免 SSR/单测环境找不到。
  return window.innerWidth || 375
}

/** Taro `rpx` 单位换算(1px = 2rpx,保持与 miniapp-taro 全局风格一致) */
const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  root: (height: number): CSSProperties => ({
    position: 'relative',
    width: '100%',
    height: toRpx(height),
  }),
  empty: (height: number): CSSProperties => ({
    width: '100%',
    height: toRpx(height),
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
    bottom: toRpx(12),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  dot: (active: boolean): CSSProperties => ({
    width: active ? 16 : 6,
    height: 6,
    backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
    borderRadius: 3,
    marginLeft: 3,
    marginRight: 3,
  }),
}

const textStyles = {
  empty: (): CSSProperties => ({
    fontSize: toRpx(12),
    color: '#9CA3AF',
  }),
}

export function Carousel({
  banner,
  height = DEFAULT_HEIGHT,
  autoplayInterval = 3000,
  onItemPress,
  className,
  colorScheme = 'light',
}: CarouselProps) {
  // 触发主题 token 解析,确保 brand 颜色被引用
  void getRnTokens(colorScheme)
  const [current, setCurrent] = useState(0)
  const [windowWidth, setWindowWidth] = useState<number>(getWindowWidth)

  // 监听窗口尺寸(单测环境无 window,跳过)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setWindowWidth(getWindowWidth())
  }, [])

  // 自动播放
  useEffect(() => {
    if (!banner || banner.length <= 1) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banner.length)
    }, autoplayInterval)
    return () => clearInterval(timer)
  }, [banner, autoplayInterval])

  if (!banner || banner.length === 0) {
    return (
      <View className={className} style={viewStyles.empty(height)}>
        <Text style={textStyles.empty()}>{'暂无轮播图'}</Text>
      </View>
    )
  }

  return (
    <View className={className} style={viewStyles.root(height)}>
      <ScrollView
        scrollX
        scrollWithAnimation
        scrollIntoView={`slide-${current}`}
        style={{ width: '100%', height: toRpx(height) }}
      >
        <View style={{ display: 'flex', flexDirection: 'row' }}>
          {banner.map((item, index) => (
            <View
              key={index}
              id={`slide-${index}`}
              onTap={() => onItemPress?.(item, index)}
              style={{ width: toRpx(windowWidth), height: toRpx(height) }}
            >
              <Image
                src={item.img}
                style={{ width: toRpx(windowWidth), height: toRpx(height) }}
                mode="aspectFill"
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 指示器 */}
      <View style={viewStyles.indicatorWrap()}>
        {banner.map((_, index) => (
          <View key={index} style={viewStyles.dot(index === current)} />
        ))}
      </View>
    </View>
  )
}
