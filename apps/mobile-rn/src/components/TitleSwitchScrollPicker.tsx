/**
 * TitleSwitchScrollPicker — 滚轮选择器(scroll_picker.vue 迁移)
 * 中心高亮项,上下点击区域切换,滚动 snap 对齐。
 */
import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'

export interface TitleSwitchItem {
  name: string
}

interface Props {
  mainList?: TitleSwitchItem[]
  onChange?: (index: number) => void
}

const ITEM_HEIGHT = 80
const CONTAINER_HEIGHT = 140

const DEFAULT_LIST: TitleSwitchItem[] = [
  { name: '赛道一' }, { name: '赛道二' }, { name: '赛道三' },
  { name: '赛道四' }, { name: '赛道五' }, { name: '赛道六' },
  { name: '赛道7' }, { name: '赛道8' }, { name: '赛道9' },
  { name: '赛道10' }, { name: '赛道11' }, { name: '赛道12' },
]

export function TitleSwitchScrollPicker({ mainList = DEFAULT_LIST, onChange }: Props) {
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const lastIndex = mainList.length - 1

  useEffect(() => {
    onChange?.(index)
  }, [index, onChange])

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(lastIndex, idx))
    setIndex(clamped)
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true })
  }

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const idx = Math.round(y / ITEM_HEIGHT)
    if (idx !== index && idx >= 0 && idx <= lastIndex) {
      setIndex(idx)
    }
  }

  return (
    <View style={s.outer}>
      <View style={s.maskBody}>
        <Pressable style={s.maskRegion} onPress={() => goTo(index - 1)} accessibilityLabel="上一个" />
        <Pressable style={s.maskRegion} onPress={() => goTo(index + 1)} accessibilityLabel="下一个" />
      </View>
      <ScrollView
        ref={scrollRef}
        style={s.scrollBody}
        contentContainerStyle={{ paddingVertical: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2 }}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        showsVerticalScrollIndicator={false}
      >
        {mainList.map((item, i) => {
          const distance = Math.abs(i - index)
          const isActive = i === index
          return (
            <View key={i} style={s.itemWrap}>
              <View
                style={[
                  s.item,
                  isActive && s.itemActive,
                  distance === 1 && s.itemNear,
                  distance >= 2 && s.itemFar,
                ]}
              >
                <Text style={[s.itemText, isActive && s.itemTextActive]}>{item.name}</Text>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  outer: { width: 210, height: CONTAINER_HEIGHT, alignSelf: 'center' },
  maskBody: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 5,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  maskRegion: { width: '100%', height: 20 },
  scrollBody: { width: '100%', height: CONTAINER_HEIGHT },
  itemWrap: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  item: {
    width: 200, height: 80, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 2,
    transform: [{ scale: 0.6 }],
    opacity: 0.3,
  },
  itemActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    transform: [{ scale: 1 }],
    opacity: 1,
  },
  itemNear: { transform: [{ scale: 0.8 }], opacity: 0.8 },
  itemFar: { transform: [{ scale: 0.6 }], opacity: 0.6 },
  itemText: { color: '#666', fontSize: 16, fontWeight: '700' },
  itemTextActive: { color: '#000', fontWeight: '700' },
})

export default TitleSwitchScrollPicker
