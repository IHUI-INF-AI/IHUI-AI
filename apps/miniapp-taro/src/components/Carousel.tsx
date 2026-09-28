// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, ScrollView, Image, Text } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import { cn, TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  carouselDefaultHeightPx,
  carouselIndicatorWrapStyle,
  carouselDotStyle,
} from '@ihui/shared/ui/carousel-spec'
import { useAutoPlay } from '@ihui/shared'
import type { CarouselItem } from '@ihui/types'
import { rpx } from '@/utils/rpx'

/// 指示点几何/默认高度不在本文件取数 —— 唯一源是 @ihui/shared/ui/carousel-spec(与 RN 端同档);
/// 本文件只做 rpx 换算 + 挂 Taro 原语。数字类名(bottom-2/gap-1.5/h-1.5/w-1.5/w-4)已撤,
/// 否则端内既定档就是第二份真相(守门 128 立项量出的 174 处差异档即此型)。
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)

// 共享类型 CarouselItem + 共享 hook useAutoPlay 已下沉到 packages,
// 消除 mobile-rn / miniapp-taro 两端类型与自动播放逻辑重复。
export type { CarouselItem }

/** 课程轮播叠加元数据(course variant 专用,与 items 同长,按索引覆盖在轮播图上) */
export interface CourseMetaItem {
  title?: string
  price?: number
  isFree?: boolean
  tag?: string
}

export interface CarouselProps {
  items?: CarouselItem[]
  autoplay?: boolean
  interval?: number
  height?: number | string
  onItemClick?: (item: CarouselItem, index: number) => void
  className?: string
  /** 样式变体:'default'(通用,默认)/ 'course'(课程专用,叠加标题+价格) */
  variant?: 'default' | 'course'
  /** course variant 专用:与 items 同长的元数据数组,覆盖在轮播图上 */
  courseMeta?: CourseMetaItem[]
}

/** 失败图源集合的初始值:模块级常量,避免每次 render 造一个新 Set 打穿 useMemo 依赖。 */
const NO_FAILED_SOURCES: ReadonlySet<string> = new Set<string>()

/**
 * Carousel 通用轮播 / 课程专用轮播
 *
 * 两种 variant:
 * - 'default'(默认,兼容旧调用):通用图片轮播
 * - 'course'(课程专用):在轮播图上叠加底部渐变蒙层 + 课程标题 + 价格/免费标签
 *   注意:渐变蒙层使用 `bg-gradient-to-t from-black/60 to-transparent`(Tailwind 背景渐变),
 *   非 mask-image,符合 AGENTS.md §4 禁止渐变遮罩约束。
 */
export default function Carousel({
  items = [],
  autoplay = true,
  interval = 3000,
  height = carouselDefaultHeightPx(),
  onItemClick,
  className = '',
  variant = 'default',
  courseMeta = [],
}: CarouselProps) {
  const tt = useTt()
  /**
   * 图源加载失败的项**整项不渲染**(内容级降级),与 RN 端 `apps/mobile-rn/src/components/
   * Carousel.tsx` 同一处置 —— 两端同名组件的失败语义必须同形(守门 128 的立项理由)。
   *
   * 成因:轮播图来自后端字段(carousels.imageUrl / lessons.coverImage / agents.avatar),
   * 行内存的是 picsum.photos 这类境外随机图服务,国内移动网络可达性不稳 → 取不到图。
   * 小程序 <Image> 失败时不留任何占位,营销位就是空一块;摘掉该项才是这里要的结果。
   * 键取 uri 而非下标:换一批数据后同一 uri 仍应继续被摘除,下标会错位。
   * 注意:img 本就是空串的项**不进这一格** —— 它走下方既有的「无图兜底文案卡」,
   * 那是有意设计的文字形态(pkg-ai/ai/agent.tsx 三张营销卡就靠它),不是失败态。
   */
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(NO_FAILED_SOURCES)
  const markSourceFailed = useCallback((uri: string) => {
    setFailedSources((prev) => (prev.has(uri) ? prev : new Set<string>(prev).add(uri)))
  }, [])

  const slides = useMemo(
    () =>
      items
        .map((item, sourceIndex) => ({ item, sourceIndex }))
        .filter(({ item }) => !item.img || !failedSources.has(item.img)),
    [items, failedSources],
  )

  const { current, setCurrent } = useAutoPlay(slides.length, interval, autoplay)
  const total = slides.length

  const goTo = useCallback(
    (idx: number) => {
      if (total === 0) return
      setCurrent(((idx % total) + total) % total)
    },
    [total, setCurrent],
  )

  if (total === 0) return null

  const heightStyle = typeof height === 'number' ? `${height}px` : height
  // 有项因图失败被摘掉后,current 可能暂时越界(自动播放的下一跳会自己取模收敛),
  // 这里只把这一帧的落点夹回首项,不做任何位移补偿。与 RN 端同一处理。
  const activeIndex = current < total ? current : 0

  return (
    <View
      className={cn('relative w-full overflow-hidden rounded-lg bg-muted', className)}
      style={{ height: heightStyle }}
    >
      <ScrollView
        scrollX
        scrollWithAnimation
        scrollIntoView={`carousel-item-${activeIndex}`}
        className="h-full"
        style={{ height: heightStyle }}
      >
        <View style={{ display: 'flex', width: `${total * 100}%` }}>
          {slides.map(({ item, sourceIndex }, index) => {
            // courseMeta / onItemClick 的入参下标语义 = 调用方传进来的那个数组的下标,
            // 所以一律用 sourceIndex —— 前面某项因图失败被摘掉后,叠加层与点击回调
            // 不得跟着错位(courseMeta 与 items 同长是按原下标对齐的)。
            const meta = variant === 'course' ? courseMeta[sourceIndex] : undefined
            // 修复 (2026-08-12 v2 + 2026-09-03 亮色化):img 为空 → 渐变 banner fallback。
            //   H5 实测 inline backgroundImage 会被 Taro 样式序列化丢弃，导致首屏只剩浅灰。
            //   方案:① className 绑定 carousel-fallback-0/1/2（由 app.css 全局写死亮色 token
            //        linear-gradient，与 web 端 bg-muted/bg-card 亮色兜底同族，两端一致）；
            //        ② 不再内联深色科技风 solid/gradient（曾致微信端深色残留，2026-09-03 已删，
            //        与 app.css .carousel-fallback-* 亮色定义保持一致）。
            const hasImg = !!item.img
            const FALLBACK_COUNT = 3
            const fbIndex = index % FALLBACK_COUNT
            return (
              <View
                key={index}
                id={`carousel-item-${index}`}
                className={
                  hasImg
                    ? 'relative'
                    : `relative carousel-fallback carousel-fallback-$(fbIndex)`.replace(
                        '$(fbIndex)',
                        String(fbIndex),
                      )
                }
                style={{
                  width: `${100 / total}%`,
                  // 修复:H5 ScrollView 内 h-full (100%) 继承高度不稳定,导致渐变背景 h=0。
                  // 显式设置高度,保证 banner 的渐变/纯色完整铺满可见区域。
                  // 背景色/渐变全部由 className 的 .carousel-fallback-* 提供(亮色 token),
                  // 不再内联深色兜底(2026-09-03 与 web 亮色一致化)。
                  height: heightStyle,
                  flex: '0 0 auto',
                }}
                onClick={() => onItemClick?.(item, sourceIndex)}
                hoverClass="opacity-60"
              >
                {hasImg ? (
                  <Image
                    src={item.img}
                    mode="aspectFill"
                    className="h-full w-full"
                    lazyLoad
                    onError={() => markSourceFailed(item.img)}
                  />
                ) : null}
                {!hasImg && (item.title || item.subtitle) ? (
                  // 守门 128:整块「无图兜底文案」(p-4/text-xl/mb-2/text-sm 折出 16/20/8/14)是
                  // 小程序端独有渲染 —— RN 同名文件不渲染逐项兜底,无同一元素可对照。
                  // 数字刻意留在类名里可见、不入 spec、不改走函数(裁决与禁假绿依据见
                  // @ihui/shared/ui/carousel-spec 头注;收口前置 = RN 移植该渲染或台账拆对声明)。
                  <View className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    {/* 亮色 fallback(2026-09-03):浅色 token 渐变底 → 文字用深色,与 web 端 bg-muted 兜底同族 */}
                    {item.title ? (
                      <Text className="text-xl font-bold text-foreground drop-shadow-[0_2px_4px_var(--color-black-15)] text-center mb-2">
                        {item.title}
                      </Text>
                    ) : null}
                    {item.subtitle ? (
                      <Text className="text-sm text-muted-foreground drop-shadow-[0_1px_3px_var(--color-black-10)] text-center">
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {meta ? (
                  // 守门 128:「course 变体叠加层」(p-3/gap-2/mt-1/px-2/py-0.5/text-sm/text-xs 折出
                  // 12/8/4/8/2/14/12)同为小程序端独有渲染:variant='course'/courseMeta 只在小程序
                  // 组件入参存在,RN 侧课程卡是另一枚组件(CourseCarousel),不在本配对面上。
                  // 处置同上方兜底块 —— 数字留在类名可见,收口前置见 carousel-spec 头注。
                  <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--color-black-60)] to-transparent p-3">
                    {meta.title ? (
                      <Text className="block text-sm text-[var(--color-white-98)] line-clamp-1">
                        {meta.title}
                      </Text>
                    ) : null}
                    {meta.isFree || meta.price !== undefined || meta.tag ? (
                      <View className="flex items-center gap-2 mt-1">
                        {meta.isFree ? (
                          <Text className="text-xs text-success-foreground bg-success px-2 py-0.5 rounded-sm">
                            {tt('course.free', '免费')}
                          </Text>
                        ) : meta.price !== undefined ? (
                          <Text className="text-xs text-cta-foreground bg-cta px-2 py-0.5 rounded-sm">
                            ¥{meta.price}
                          </Text>
                        ) : null}
                        {meta.tag ? (
                          <Text className="text-xs text-[var(--color-white-80)]">{meta.tag}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      </ScrollView>
      {total > 1 && (
        <View style={carouselIndicatorWrapStyle(toUnit)}>
          {/* 指示点两态的档与 RN 同一份落点:活跃 16×6 取 md、非活跃 6×6 取 sm(此前两端声明不同档) */}
          {slides.map((_, index) => (
            <View
              key={index}
              onClick={() => goTo(index)}
              style={carouselDotStyle(toUnit, activeIndex === index)}
              className={cn(
                'transition-all',
                activeIndex === index
                  ? 'rounded-md bg-foreground/80'
                  : 'rounded-sm bg-foreground/30',
              )}
            />
          ))}
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
