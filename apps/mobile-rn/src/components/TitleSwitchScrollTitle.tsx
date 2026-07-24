/**
 * TitleSwitchScrollTitle — 主子赛道横向选择器(scroll_title.vue 迁移)
 * 主赛道横向滚动选择,选中后联动显示子赛道;子赛道选中后回调。
 */
import { useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

export interface TitleSwitchItem {
  name: string
  children?: TitleSwitchItem[]
}

interface Props {
  mainList?: TitleSwitchItem[]
  onChange?: (item: TitleSwitchItem) => void
}

const DEFAULT_LIST: TitleSwitchItem[] = [
  { name: '赛道一' }, { name: '赛道二' }, { name: '赛道三' },
  { name: '赛道四' }, { name: '赛道五' }, { name: '赛道六' },
]

export function TitleSwitchScrollTitle({ mainList = DEFAULT_LIST, onChange }: Props) {
  const [current, setCurrent] = useState(0)
  const [subList, setSubList] = useState<TitleSwitchItem[]>(mainList[0]?.children ?? [])
  const [subSelected, setSubSelected] = useState<number | null>(null)

  useEffect(() => {
    setSubList(mainList[current]?.children ?? [])
    setSubSelected(null)
  }, [current, mainList])

  const selectMain = (index: number) => {
    setCurrent(index)
    setSubList(mainList[index]?.children ?? [])
    setSubSelected(null)
  }

  const selectSub = (item: TitleSwitchItem, index: number) => {
    setSubSelected(index)
    onChange?.(item)
  }

  const hasSub = subList.length > 0

  return (
    <View style={s.container}>
      <View style={s.section}>
        <Text style={s.sectionTitle}>主赛道:</Text>
        <FlatList
          horizontal
          data={mainList}
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          renderItem={({ item, index }) => {
            const active = current === index
            return (
              <Pressable
                style={[s.item, active && s.itemActive]}
                onPress={() => selectMain(index)}
                accessibilityLabel={`主赛道 ${item.name}`}
              >
                <Text style={[s.itemText, active && s.itemTextActive]}>{item.name}</Text>
              </Pressable>
            )
          }}
        />
      </View>
      {hasSub ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>子赛道:</Text>
          <FlatList
            horizontal
            data={subList}
            keyExtractor={(_, i) => String(i)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.listContent}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            renderItem={({ item, index }) => {
              const active = subSelected === index
              return (
                <Pressable
                  style={[s.item, active && s.itemActive]}
                  onPress={() => selectSub(item, index)}
                  accessibilityLabel={`子赛道 ${item.name}`}
                >
                  <Text style={[s.itemText, active && s.itemTextActive]}>{item.name}</Text>
                </Pressable>
              )
            }}
          />
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  section: { paddingHorizontal: 14, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 6 },
  listContent: { paddingVertical: 4 },
  item: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,249,252,0.65)',
  },
  itemActive: {
    borderColor: '#7361FF',
    backgroundColor: 'rgba(205,208,255,0.35)',
  },
  itemText: { fontSize: 13, color: 'rgba(0,0,0,0.6)' },
  itemTextActive: { color: '#7361FF', fontWeight: '700' },
})

export default TitleSwitchScrollTitle
