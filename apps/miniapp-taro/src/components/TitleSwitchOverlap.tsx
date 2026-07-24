import { View, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

export interface TitleSwitchOverlapItem {
  name: string
}

export interface TitleSwitchOverlapProps {
  mainList?: TitleSwitchOverlapItem[]
  defaultCurrent?: number
  onCurrentChange?: (index: number) => void
}

const DEFAULT_LIST: TitleSwitchOverlapItem[] = [
  { name: '赛道一' },
  { name: '赛道二' },
  { name: '赛道三' },
  { name: '赛道四' },
  { name: '赛道五' },
]

/** 5 层堆叠样式:对标旧项目 active_before2/before/item/after/after2 */
function getLayerStyle(delta: number): CSSProperties {
  const base: CSSProperties = {
    width: '180px',
    height: '48px',
    borderRadius: '15px',
    boxShadow: '0 0 6px 0 rgba(0, 0, 0, 0.3)',
    position: 'relative',
    color: '#000',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  if (delta === 0) {
    return {
      ...base,
      color: 'rgba(0, 0, 0, 1)',
      fontWeight: 600,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      transform: 'scale(1)',
      opacity: 1,
      zIndex: 10,
    }
  }
  if (delta === -1) {
    return { ...base, transform: 'translateY(21px) scale(0.8)', opacity: 0.8, zIndex: -1 }
  }
  if (delta === -2) {
    return { ...base, transform: 'translateY(52px) scale(0.6)', opacity: 0.8, zIndex: -2 }
  }
  if (delta === 1) {
    return { ...base, transform: 'translateY(-19px) scale(0.8)', opacity: 0.8, zIndex: -10 }
  }
  if (delta === 2) {
    return { ...base, transform: 'translateY(-50px) scale(0.6)', opacity: 0.8, zIndex: -100 }
  }
  return { ...base, opacity: 0.3 }
}

/**
 * 大型重叠标题切换组件(对标旧项目 title-switch/overlap_large.vue)
 * - 5 层堆叠的滚动选择器,通过 scroll 位置计算 current
 * - 左右按钮可手动切换
 */
export default function TitleSwitchOverlap({
  mainList = DEFAULT_LIST,
  defaultCurrent = 0,
  onCurrentChange,
}: TitleSwitchOverlapProps) {
  const [current, setCurrent] = useState(defaultCurrent)
  const lockRef = useRef(false)

  useEffect(() => {
    onCurrentChange?.(current)
  }, [current, onCurrentChange])

  const scrolling = useCallback(() => {
    if (lockRef.current) return
    lockRef.current = true
    const query = Taro.createSelectorQuery()
    query
      .selectAll('.tso-scroll-content')
      .boundingClientRect((data) => {
        const rects = data as Array<{ top: number }>
        if (Array.isArray(rects)) {
          for (let i = 0; i < rects.length; i++) {
            if (Math.abs(rects[i]!.top - 120.5) < 11.5) {
              setCurrent(i)
              break
            }
          }
        }
        lockRef.current = false
      })
      .exec()
  }, [])

  const prev = useCallback(
    () => setCurrent((c) => Math.max(0, c - 1)),
    [],
  )
  const next = useCallback(
    () => setCurrent((c) => Math.min(mainList.length - 1, c + 1)),
    [mainList.length],
  )

  return (
    <View className="w-full box-border flex flex-col items-center">
      <ScrollView
        scrollY
        className="w-full"
        style={{ height: '382px' }}
        onScroll={scrolling}
      >
        <View className="flex flex-col items-center justify-center">
          <View style={{ padding: '56px' }} />
          {mainList.map((item, index) => (
            <View
              key={index}
              className="w-[200px] h-[50px] flex items-center justify-center relative"
            >
              <View
                className="tso-scroll-content"
                style={getLayerStyle(current - index)}
              >
                <View>{item.name}</View>
              </View>
            </View>
          ))}
          <View style={{ padding: '140px' }} />
        </View>
      </ScrollView>
      <View className="flex items-center justify-around box-border w-[60%] gap-[20px]">
        <Image
          className="w-[40px] h-[40px]"
          src="/static/images/saidao_title_left.png"
          onClick={prev}
        />
        <Image
          className="w-[40px] h-[40px]"
          src="/static/images/saidao_title_right.png"
          onClick={next}
        />
      </View>
    </View>
  )
}
