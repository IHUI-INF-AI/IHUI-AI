/**
 * TitleSwitchOverlap — 垂直滚动赛道选择器(overlap_large.vue 迁移)
 * 中心选中项放大高亮,前后项缩放半透明,左右按钮切换。
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
  onCurrentChange?: (index: number) => void
}

const ITEM_HEIGHT = 50
const VERTICAL_PADDING = 80

const DEFAULT_LIST: TitleSwitchItem[] = [
  { name: '赛道一' }, { name: '赛道二' }, { name: '赛道三' },
  { name: '赛道四' }, { name: '赛道五' }, { name: '赛道六' },
  { name: '赛道7' }, { name: '赛道8' }, { name: '赛道9' },
  { name: '赛道10' }, { name: '赛道11' },
]

export function TitleSwitchOverlap({ mainList = DEFAULT_LIST, onCurrentChange }: Props) {
  const [current, setCurrent] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    onCurrentChange?.(current)
  }, [current, onCurrentChange])

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(mainList.length - 1, idx))
    setCurrent(clamped)
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true })
  }

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const idx = Math.round(y / ITEM_HEIGHT)
    if (idx !== current && idx >= 0 && idx < mainList.length) {
      setCurrent(idx)
    }
  }

  return (
    <View style={s.outer}>
      <ScrollView
        ref={scrollRef}
        style={s.scrollBody}
        contentContainerStyle={{ paddingVertical: VERTICAL_PADDING }}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        showsVerticalScrollIndicator={false}
      >
        {mainList.map((item, index) => {
          const distance = Math.abs(index - current)
          const isActive = index === current
          return (
            <View key={index} style={s.itemWrap}>
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
      <View style={s.btns}>
        <Pressable style={s.btn} onPress={() => goTo(current - 1)} accessibilityLabel="上一个赛道">
          <Text style={s.btnText}>‹</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={() => goTo(current + 1)} accessibilityLabel="下一个赛道">
          <Text style={s.btnText}>›</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  outer: { width: '100%', height: 250 },
  scrollBody: { height: 200 },
  itemWrap: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  item: {
    width: 180, height: 48, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 2,
  },
  itemActive: { backgroundColor: 'rgba(255,255,255,0.95)' },
  itemNear: { transform: [{ scale: 0.8 }], opacity: 0.8 },
  itemFar: { transform: [{ scale: 0.6 }], opacity: 0.6 },
  itemText: { color: '#000', fontSize: 14 },
  itemTextActive: { fontWeight: '700', color: '#000' },
  btns: { flexDirection: 'row', justifyContent: 'space-around', width: '60%', alignSelf: 'center', paddingVertical: 8 },
  btn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 22, color: '#374151' },
})

export default TitleSwitchOverlap
