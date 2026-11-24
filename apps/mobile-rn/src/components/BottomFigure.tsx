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
import Carousel, { useAppFrameWidth, type CarouselSlide, type CarouselSlideImg } from './Carousel'
import type { CarouselItem } from '@ihui/ui-native'
import { rnRadius } from '@ihui/design-tokens'
import { rpx } from '../utils/rpx'
// 推广轮播图静态 import(declarations.d.ts 图片模块声明,Metro 标准形态,无需 lint 抑制)
import IMG_BRAND from '../../assets/images/carousel/banner-brand.jpg'
import IMG_LEARN from '../../assets/images/carousel/banner-learn.jpg'
import IMG_APPS from '../../assets/images/carousel/banner-apps.jpg'

export interface BottomFigureItem extends Omit<CarouselItem, 'img'> {
  /** API 轮播为 uuid 字符串,内置默认图为数字序号,两者兼容 */
  id: number | string
  /** 原项目字段 imageUrl(1:1 对齐;缺失时回退 img)。远端 URL 与本地 require 资源均可 */
  imageUrl?: CarouselSlideImg
  img: CarouselSlideImg
}

export interface BottomFigureProps {
  /** 轮播数据(对齐原项目 carouselList);缺省用原项目 3 张默认图 */
  items?: BottomFigureItem[]
  /** 显式高度(装饰位等特殊场景);缺省按标准比例 HEIGHT_RATIO 随容器宽等比推导 */
  height?: number
  /** 点击回调(原项目 index===1 跳招聘页,由调用方注入;后端跳转逻辑预留) */
  onItemPress?: (item: BottomFigureItem, index: number) => void
}

/** 标准出图比例(2026-10-15 用户定稿):21:9 标准长图/宽银幕比例(宽:高 ≈ 2.33:1);
 *  高度随容器宽等比推导(宽 × 9/21),任何屏宽下比例恒定;
 *  出图规格对照:1260×540 / 900×386 / 840×360 / 2100×900 */
const HEIGHT_RATIO = 9 / 21 // 21:9
/** 组件内聚横向留白(原 Uniapp custom-carousel-wrapper margin 20rpx 语义);
 *  调用方 wrap 不再设横向 padding,容器内宽 = 窗口宽 − 2×SIDE_INSET 精确同步可得
 *  (2026-10-15 实证:本环境 RN Web onLayout 不触发,宽度不可依赖 layout 回调测量) */
const SIDE_INSET = rpx(20)
// 2026-10-15 推广轮播图(用户定稿 21:9 出图,3360×1440 AI 生成,按平台三大业务线设计):
//   banner-brand.jpg —— 「用AI·找AI」品牌主视觉(AI 助手与人手连接,金币/网络粒子)
//   banner-learn.jpg —— 「学AI」AI 课程学习(书本/学士帽/笔记本)
//   banner-apps.jpg  —— AI 应用商店·智能体矩阵(中央 AI 能量球连接应用)
// 旧本地化默认图(BottomFigure/recruit2/recruit3,比例不合 21:9)文件保留在目录,引用已替换
const DEFAULT_ITEMS: readonly BottomFigureItem[] = [
  {
    id: 1,
    imageUrl: IMG_BRAND,
    img: IMG_BRAND,
  },
  {
    id: 2,
    imageUrl: IMG_LEARN,
    img: IMG_LEARN,
  },
  {
    id: 3,
    imageUrl: IMG_APPS,
    img: IMG_APPS,
  },
] as const

export function BottomFigure({ items, height, onItemPress }: BottomFigureProps) {
  const raw = items ?? [...DEFAULT_ITEMS]
  // 归一化 imageUrl → img,交给 Carousel 渲染
  const banner: CarouselSlide[] = raw.map((it) => ({ ...it, img: it.imageUrl ?? it.img }))

  // 容器内宽由应用框架实际宽精确推导(useAppFrameWidth:web 预览下 #root 固定宽 ≠ 窗口宽;
  // 组件内聚 SIDE_INSET 横向留白,调用方 wrap 不设横向 padding):
  // slide 步长对齐该宽 → 图片精确铺满可视区,左右不再被裁;高度按 21:9 随宽等比推导。
  // 显式传 height 时高度用显式值(RankingScreen 等装饰位),slide 步长仍对齐容器内宽。
  const appFrameWidth = useAppFrameWidth()
  const innerWidth = Math.max(0, appFrameWidth - 2 * SIDE_INSET)
  const resolvedHeight = height ?? Math.round(innerWidth * HEIGHT_RATIO)

  return (
    <View style={styles.container}>
      <View style={[styles.frame, { width: innerWidth, height: resolvedHeight }]}>
        <Carousel
          banner={banner}
          height={resolvedHeight}
          itemWidth={innerWidth}
          autoplayInterval={3000}
          onItemPress={(_, index) => {
            const source = raw[index]
            if (source) onItemPress?.(source, index)
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // 顶部间距对齐 Uniapp custom-carousel-wrapper 的 margin 18rpx(2026-10-15 用户定稿轮播置顶;
    // 原「页尾装饰」位的 marginTop 16dp 已收敛,避免与导航栏之间多出预留空档)
    marginTop: rpx(18),
    // 横向留白内聚于组件(SIDE_INSET),调用方 wrap 不再设横向 padding
    paddingHorizontal: SIDE_INSET,
  } as ViewStyle,
  frame: {
    // 圆角/裁切/底色作用于图片可视区(内层),随内宽等比定形
    overflow: 'hidden',
    borderRadius: rnRadius.lg,
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
})

export default BottomFigure
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
