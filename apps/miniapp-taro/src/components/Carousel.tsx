// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, ScrollView, Image, Text } from '@tarojs/components'
import { useCallback } from 'react'
import { cn } from '@ihui/design-tokens'
import { useAutoPlay } from '@ihui/shared'
import type { CarouselItem } from '@ihui/types'

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
  height = 160,
  onItemClick,
  className = '',
  variant = 'default',
  courseMeta = [],
}: CarouselProps) {
  const tt = useTt()
  const { current, setCurrent } = useAutoPlay(items.length, interval, autoplay)
  const total = items.length

  const goTo = useCallback(
    (idx: number) => {
      if (total === 0) return
      setCurrent(((idx % total) + total) % total)
    },
    [total, setCurrent],
  )

  if (total === 0) return null

  const heightStyle = typeof height === 'number' ? `${height}px` : height

  return (
    <View
      className={cn('relative w-full overflow-hidden rounded-lg bg-muted', className)}
      style={{ height: heightStyle }}
    >
      <ScrollView
        scrollX
        scrollWithAnimation
        scrollIntoView={`carousel-item-${current}`}
        className="h-full"
        style={{ height: heightStyle }}
      >
        <View style={{ display: 'flex', width: `${total * 100}%` }}>
          {items.map((item, index) => {
            const meta = variant === 'course' ? courseMeta[index] : undefined
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
                onClick={() => onItemClick?.(item, index)}
              >
                {hasImg ? (
                  <Image src={item.img} mode="aspectFill" className="h-full w-full" lazyLoad />
                ) : null}
                {!hasImg && (item.title || item.subtitle) ? (
                  <View className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    {/* 亮色 fallback(2026-09-03):浅色 token 渐变底 → 文字用深色,与 web 端 bg-muted 兜底同族 */}
                    {item.title ? (
                      <Text className="text-xl font-bold text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] text-center mb-2">
                        {item.title}
                      </Text>
                    ) : null}
                    {item.subtitle ? (
                      <Text className="text-sm text-muted-foreground drop-shadow-[0_1px_3px_rgba(0,0,0,0.1)] text-center">
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {meta ? (
                  <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    {meta.title ? (
                      <Text className="block text-sm text-white line-clamp-1">{meta.title}</Text>
                    ) : null}
                    {meta.isFree || meta.price !== undefined || meta.tag ? (
                      <View className="flex items-center gap-2 mt-1">
                        {meta.isFree ? (
                          <Text className="text-xs text-white bg-success px-2 py-0.5 rounded-sm">
                            {tt('course.free', '免费')}
                          </Text>
                        ) : meta.price !== undefined ? (
                          <Text className="text-xs text-white bg-primary px-2 py-0.5 rounded-sm">
                            ¥{meta.price}
                          </Text>
                        ) : null}
                        {meta.tag ? (
                          <Text className="text-xs text-white/80">{meta.tag}</Text>
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
        <View className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5">
          {items.map((_, index) => (
            <View
              key={index}
              onClick={() => goTo(index)}
              className={cn(
                'h-1.5 rounded-sm transition-all',
                current === index ? 'w-4 bg-foreground/80' : 'w-1.5 bg-foreground/30',
              )}
            />
          ))}
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
