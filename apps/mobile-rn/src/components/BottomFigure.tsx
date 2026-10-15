// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { tokens as tk } from '../theme/active-tokens'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Carousel, { type CarouselSlideImg } from './Carousel'
import type { CarouselItem } from '@ihui/ui-native'
import { rnRadius } from '@ihui/design-tokens'

export interface BottomFigureItem extends Omit<CarouselItem, 'img'> {
  id: number
  /** 原项目字段 imageUrl(1:1 对齐;缺失时回退 img)。远端 URL 与本地 require 资源均可 */
  imageUrl?: CarouselSlideImg
  img: CarouselSlideImg
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
// 2026-10-15 本地化:原 bspapp 云存储 CDN(mp-aab956eb-…)整体不可达(HTTP 000),
// 3 张默认图按原 CDN 路径打包进应用(文件副本与 apps/web/public 本地化批次同源):
//   tabbar/home/carousel4-footer1/BottomFigure.png → assets/images/carousel/BottomFigure.png
//   recruitment/recruit2.png                       → assets/images/carousel/recruit2.png
//   recruitment/recruit3.png                       → assets/images/carousel/recruit3.png
const IMG_FIGURE = require('../../assets/images/carousel/BottomFigure.png')
const IMG_RECRUIT2 = require('../../assets/images/carousel/recruit2.png')
const IMG_RECRUIT3 = require('../../assets/images/carousel/recruit3.png')
const DEFAULT_ITEMS: readonly BottomFigureItem[] = [
  {
    id: 1,
    imageUrl: IMG_FIGURE,
    img: IMG_FIGURE,
  },
  {
    id: 2,
    imageUrl: IMG_RECRUIT2,
    img: IMG_RECRUIT2,
  },
  {
    id: 3,
    imageUrl: IMG_RECRUIT3,
    img: IMG_RECRUIT3,
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
    borderRadius: rnRadius.lg,
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
})

export default BottomFigure
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
