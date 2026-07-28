import { View, ScrollView, Image } from '@tarojs/components'
import { useCallback } from 'react'
import { cn } from '@ihui/design-tokens'
import { useAutoPlay } from '@ihui/shared'
import type { CarouselItem } from '@ihui/types'

// 共享类型 CarouselItem + 共享 hook useAutoPlay 已下沉到 packages,
// 消除 mobile-rn / miniapp-taro 两端类型与自动播放逻辑重复。
export type { CarouselItem }

export interface CarouselProps {
  items?: CarouselItem[]
  autoplay?: boolean
  interval?: number
  height?: number | string
  onItemClick?: (item: CarouselItem, index: number) => void
  className?: string
}

export default function Carousel({
  items = [],
  autoplay = true,
  interval = 3000,
  height = 160,
  onItemClick,
  className = '',
}: CarouselProps) {
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
          {items.map((item, index) => (
            <View
              key={index}
              id={`carousel-item-${index}`}
              style={{ width: `${100 / total}%` }}
              onClick={() => onItemClick?.(item, index)}
            >
              <Image src={item.img} mode="aspectFill" className="h-full w-full" lazyLoad />
            </View>
          ))}
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
