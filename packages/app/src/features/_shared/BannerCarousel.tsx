// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BannerCarousel 跨端轮播（共享层）
 *
 * 旧 RN 壳各自持有一份轮播（CoursePlanet 的 CourseCarousel variant="swiper"、
 * MoreCourse 的 Carousel）。薄壳化后渲染主体在共享屏，本组件承接这两处「顶部图片轮播」，
 * 端内只注入图源，不再复制横向滚动 / 指示点 / 自动播放。
 *
 * 几何档一律取 @ihui/shared/ui/carousel-spec（与 apps/mobile-rn/src/components/Carousel.tsx
 * 同源），本文件只留配色与圆角两个落点。images 为空时返回 null（不摆空占位）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useAutoPlay } from '@ihui/shared'
import {
  carouselDefaultHeightPx,
  carouselDotStyle,
  carouselIndicatorWrapStyle,
} from '@ihui/shared/ui/carousel-spec'
import { rnRadius } from '@ihui/design-tokens'

export interface BannerCarouselProps {
  images: readonly ImageSourcePropType[]
  height?: number
}

/** RN 单位是 dp，与逻辑 px 1:1，换算取恒等（同端内 Carousel 的 toUnit）。 */
const toUnit = (px: number) => px

const AUTOPLAY_INTERVAL = 3000

export function BannerCarousel({ images, height = carouselDefaultHeightPx() }: BannerCarouselProps) {
  const { width: windowWidth } = useWindowDimensions()
  const [containerWidth, setContainerWidth] = useState(0)
  const slideWidth = containerWidth > 0 ? containerWidth : windowWidth
  const { current, setCurrent } = useAutoPlay(images.length, AUTOPLAY_INTERVAL, images.length > 1)
  const scrollRef = useRef<ScrollView>(null)
  const activeIndex = current < images.length ? current : 0

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ x: activeIndex * slideWidth, animated: true })
  }, [activeIndex, slideWidth])

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width)
    setContainerWidth((prev) => (prev === next ? prev : next))
  }, [])

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth)
      if (idx !== current && idx >= 0 && idx < images.length) setCurrent(idx)
    },
    [current, images.length, setCurrent, slideWidth],
  )

  if (images.length === 0) return null

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={onLayout}
      accessibilityLabel="轮播图"
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={StyleSheet.absoluteFill}
      >
        {images.map((img, index) => (
          <Image
            key={index}
            source={img}
            resizeMode="cover"
            accessibilityLabel={`轮播图 ${index + 1}`}
            style={{ width: slideWidth, height }}
          />
        ))}
      </ScrollView>
      <View style={carouselIndicatorWrapStyle(toUnit)}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              carouselDotStyle(toUnit, index === activeIndex),
              index === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: rnRadius.lg,
    backgroundColor: '#00000000',
  },
  dot: { borderRadius: rnRadius.sm },
  dotActive: { backgroundColor: '#FFFFFF' },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.5)' },
})
