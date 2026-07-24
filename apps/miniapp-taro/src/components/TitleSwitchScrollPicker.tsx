import { View, PickerView, PickerViewColumn, Text } from '@tarojs/components'
import { useState, useCallback, useEffect } from 'react'
import type { CSSProperties } from 'react'

export interface TitleSwitchScrollPickerItem {
  name: string
}

export interface TitleSwitchScrollPickerProps {
  mainList?: TitleSwitchScrollPickerItem[]
  defaultIndex?: number
  onChange?: (index: number) => void
}

const DEFAULT_LIST: TitleSwitchScrollPickerItem[] = [
  { name: '赛道一' },
  { name: '赛道二' },
  { name: '赛道三' },
  { name: '赛道四' },
  { name: '赛道五' },
  { name: '赛道六' },
  { name: '赛道七' },
  { name: '赛道八' },
]

/** 5 层堆叠样式:对标旧项目 active_before2/before/item/after/after2 */
function getItemStyle(delta: number): CSSProperties {
  const base: CSSProperties = {
    textAlign: 'center',
    width: '200px',
    height: '80px',
    fontSize: '32px',
    color: '#666',
    borderRadius: '15px',
    background: 'rgba(255, 255, 255, 0.3)',
    boxSizing: 'border-box',
    boxShadow: '1px 0 9px 1px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.5s ease',
    fontWeight: 'bold',
    letterSpacing: '0.08em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '4px',
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
    return { ...base, transform: 'translateY(40px) scale(0.8)', opacity: 0.8, zIndex: -1 }
  }
  if (delta === -2) {
    return { ...base, transform: 'translateY(90px) scale(0.6)', opacity: 0.8, zIndex: -1 }
  }
  if (delta === 1) {
    return { ...base, transform: 'translateY(-38px) scale(0.8)', opacity: 0.8, zIndex: -10, position: 'relative' }
  }
  if (delta === 2) {
    return { ...base, transform: 'translateY(-90px) scale(0.6)', opacity: 0.8, zIndex: -100, position: 'relative' }
  }
  return { ...base, transform: 'scale(0.6)', opacity: 0.3 }
}

/**
 * 滚动选择器标题切换(对标旧项目 title-switch/scroll_picker.vue)
 * - 用 PickerView + PickerViewColumn 实现原生滚轮选择
 * - 上/下点击区域可手动 ±1
 */
export default function TitleSwitchScrollPicker({
  mainList = DEFAULT_LIST,
  defaultIndex = 0,
  onChange,
}: TitleSwitchScrollPickerProps) {
  const [itemIndex, setItemIndex] = useState<number[]>([defaultIndex])

  useEffect(() => {
    onChange?.(itemIndex[0] ?? 0)
  }, [itemIndex, onChange])

  const prev = useCallback(() => {
    setItemIndex(([v]) => [Math.max(0, (v ?? 0) - 1)])
  }, [])

  const next = useCallback(() => {
    setItemIndex(([v]) => [Math.min(mainList.length - 1, (v ?? 0) + 1)])
  }, [mainList.length])

  const handleChange = useCallback(
    (e: { detail: { value: number[] } }) => {
      const next = Array.isArray(e.detail.value) ? e.detail.value : [0]
      setItemIndex(next)
    },
    [],
  )

  const cur = itemIndex[0] ?? 0

  return (
    <View className="relative">
      <View
        className="absolute top-0 left-0 z-[9995] flex flex-col items-center justify-between"
        style={{ height: '140px' }}
      >
        <View className="w-full h-[20px]" onClick={prev} />
        <View className="w-full h-[20px]" onClick={next} />
      </View>
      <PickerView
        value={itemIndex}
        onChange={handleChange}
        immediateChange
        className="w-[210px] h-[140px]"
      >
        <PickerViewColumn className="relative" style={{ paddingLeft: '4px' }}>
          {mainList.map((item, index) => (
            <View key={index} style={getItemStyle(cur - index)}>
              <Text>{item.name}</Text>
            </View>
          ))}
        </PickerViewColumn>
      </PickerView>
    </View>
  )
}
