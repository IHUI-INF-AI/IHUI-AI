// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Carousel 轮播组件 (mobile-rn 端)
 * 基于 ScrollView horizontal + pagingEnabled 实现横向轮播
 * 保留自动播放 + 指示器功能
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/Carousel/index.vue)
 *
 * 共享类型 CarouselItem + 共享 hook useAutoPlay 已下沉到 packages,
 * 消除 mobile-rn / miniapp-taro 两端类型与自动播放逻辑重复。
 */
import { useCallback, useEffect, useRef } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { tokens } from '../theme/active-tokens'
import { useAutoPlay } from '@ihui/shared'
import {
  carouselDefaultHeightPx,
  carouselIndicatorWrapStyle,
  carouselDotStyle,
} from '@ihui/shared/ui/carousel-spec'
import type { CarouselItem } from '@ihui/ui-native'

export interface CarouselProps {
  banner: CarouselItem[]
  height?: number
  autoplayInterval?: number
  onItemPress?: (item: CarouselItem, index: number) => void
}

/// 指示点几何/默认高度不在本文件取数 —— 唯一源是 @ihui/shared/ui/carousel-spec(与小程序端同档);
/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等(同 packages/app 那份共享层写法)。
const toUnit = (px: number) => px

const DEFAULT_HEIGHT = carouselDefaultHeightPx()

export default function Carousel({
  banner,
  height = DEFAULT_HEIGHT,
  autoplayInterval = 3000,
  onItemPress,
}: CarouselProps) {
  const { current, setCurrent } = useAutoPlay(
    banner?.length ?? 0,
    autoplayInterval,
    !!banner && banner.length > 1,
  )
  const scrollRef = useRef<ScrollView>(null)
  const { width } = useWindowDimensions()

  // current 变化时滚动到对应位置(useAutoPlay 内部已驱动 current 自动变化)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: current * width, animated: true })
    }
  }, [current, width])

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width)
      if (idx !== current && idx >= 0 && idx < banner.length) {
        setCurrent(idx)
      }
    },
    [current, width, banner.length, setCurrent],
  )

  if (!banner || banner.length === 0) {
    return (
      <View
        className="w-full items-center justify-center rounded-lg"
        style={{ height, backgroundColor: tokens.surface.muted }}
      >
        <Text className="text-xs" style={{ color: tokens.text.tertiary }}>
          暂无轮播图
        </Text>
      </View>
    )
  }

  return (
    <View className="w-full" style={{ height }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        style={StyleSheet.absoluteFill}
      >
        {banner.map((item, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.9}
            onPress={() => onItemPress?.(item, index)}
            style={{ width, height }}
          >
            <Image source={{ uri: item.img }} style={{ width, height, resizeMode: 'cover' }} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 指示器:容器结构与点的宽高一律取 carousel-spec(与小程序端同一份档),
          本文件只留配色与圆角两个端内落点(圆角归守门 77、配色归 tokens 派生链)。 */}
      <View style={carouselIndicatorWrapStyle(toUnit)}>
        {banner.map((_, index) => (
          <View
            key={index}
            style={carouselDotStyle(toUnit, index === current)}
            className={index === current ? 'bg-white rounded-md' : 'bg-white/50 rounded-sm'}
          />
        ))}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
