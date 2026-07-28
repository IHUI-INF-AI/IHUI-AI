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
import { useAutoPlay } from '@ihui/shared'
import type { CarouselItem } from '@ihui/ui-native'

export interface CarouselProps {
  banner: CarouselItem[]
  height?: number
  autoplayInterval?: number
  onItemPress?: (item: CarouselItem, index: number) => void
}

const DEFAULT_HEIGHT = 160

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
    [current, width, banner.length],
  )

  if (!banner || banner.length === 0) {
    return (
      <View
        className="w-full items-center justify-center bg-gray-100 rounded-lg"
        style={{ height }}
      >
        <Text className="text-xs text-gray-400">暂无轮播图</Text>
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

      {/* 指示器(用 gap-* 分隔,非圆形,rounded-sm/rounded-md 尺寸梯度) */}
      <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
        {banner.map((_, index) => (
          <View
            key={index}
            className={
              index === current
                ? 'w-4 h-1.5 bg-white rounded-md'
                : 'w-1.5 h-1.5 bg-white/50 rounded-sm'
            }
          />
        ))}
      </View>
    </View>
  )
}
