/**
 * BottomFigure 底部轮播图 (mobile-rn 端)
 *
 * 对齐历史项目 BottomFigure/index.vue:
 * - 原项目是 swiper 轮播(autoplay 3000ms / circular / indicator 指示点 / 点击跳转)
 * - 复用 Carousel 组件实现轮播(autoplayInterval 3000, 高度 149dp=原 298rpx)
 * - 原项目数据字段为 imageUrl,本组件 1:1 兼容(imageUrl 优先,缺失回退 img)
 * - 点击回调 onItemPress(item, index):原项目仅 index===1 跳招聘页,RN 由调用方注入(预留)
 * - 浅色优雅风,圆角矩形(非圆形),无霓虹无渐变
 */
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Carousel from './Carousel'
import type { CarouselItem } from '@ihui/ui-native'

export interface BottomFigureItem extends CarouselItem {
  id: number
  /** 原项目字段 imageUrl(1:1 对齐;缺失时回退 img) */
  imageUrl?: string
}

export interface BottomFigureProps {
  /** 轮播数据(对齐原项目 carouselList);缺省用原项目 3 张默认图 */
  items?: BottomFigureItem[]
  /** 高度(原 298rpx ≈ 149dp) */
  height?: number
  /** 点击回调(原项目 index===1 跳招聘页,由调用方注入;后端跳转逻辑预留) */
  onItemPress?: (item: BottomFigureItem, index: number) => void
}

const DEFAULT_HEIGHT = 149
const DEFAULT_ITEMS: readonly BottomFigureItem[] = [
  {
    id: 1,
    imageUrl:
      'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/BottomFigure.png',
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/BottomFigure.png',
  },
  {
    id: 2,
    imageUrl:
      'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/recruit2.png',
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/recruit2.png',
  },
  {
    id: 3,
    imageUrl:
      'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/recruit3.png',
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/recruit3.png',
  },
] as const

export function BottomFigure({ items, height = DEFAULT_HEIGHT, onItemPress }: BottomFigureProps) {
  const raw = items ?? [...DEFAULT_ITEMS]
  // 归一化 imageUrl → img,交给 Carousel 渲染
  const banner: CarouselItem[] = raw.map((it) => ({ ...it, img: it.imageUrl ?? it.img }))

  return (
    <View style={[styles.container, { height }]}>
      <Carousel
        banner={banner}
        height={height}
        autoplayInterval={3000}
        onItemPress={(_, index) => {
          const source = raw[index]
          if (source) onItemPress?.(source, index)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 16,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
})

export default BottomFigure
