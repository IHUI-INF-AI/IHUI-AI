import { View, ScrollView, Image, Text } from '@tarojs/components'
import { useCallback } from 'react'
import { cn } from '@ihui/design-tokens'
import { useAutoPlay } from '@ihui/shared'
import { useI18n } from '@/i18n'
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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
            return (
              <View
                key={index}
                id={`carousel-item-${index}`}
                className="relative h-full"
                style={{ width: `${100 / total}%` }}
                onClick={() => onItemClick?.(item, index)}
              >
                <Image src={item.img} mode="aspectFill" className="h-full w-full" lazyLoad />
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
                current === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50',
              )}
            />
          ))}
        </View>
      )}
    </View>
  )
}
