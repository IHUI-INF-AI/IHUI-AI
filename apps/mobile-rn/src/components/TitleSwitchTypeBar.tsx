/**
 * TitleSwitchTypeBar — 横向多选分类条(type_bar.vue 迁移)
 * 支持"全部"切换、多选标签、自定义种类弹窗。
 */
import { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

export interface TypeTabItem {
  id: string
  name: string
  butUrl?: string
  field1?: string
}

interface Props {
  showAll?: boolean
  customize?: boolean
  onChange?: (ids: string[]) => void
}

const DEFAULT_TABS: TypeTabItem[] = [
  { id: '1', name: '文案' },
  { id: '2', name: '图片' },
  { id: '3', name: '视频' },
]

export function TitleSwitchTypeBar({ showAll = false, customize = false, onChange }: Props) {
  const [tabList, setTabList] = useState<TypeTabItem[]>(DEFAULT_TABS)
  const [selected, setSelected] = useState<TypeTabItem[]>([])
  const [all, setAll] = useState(true)
  const [addType, setAddType] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (selected.length > 0 && showAll) setAll(false)
    if (selected.length === 0) setAll(true)
    onChange?.(selected.map((i) => i.id))
  }, [selected, showAll, onChange])

  const toggle = (item: TypeTabItem) => {
    setSelected((prev) =>
      prev.some((i) => i.id === item.id) ? prev.filter((i) => i.id !== item.id) : [...prev, item],
    )
  }

  const selectAllTab = () => {
    setAll((v) => {
      const next = !v
      if (next) setSelected([])
      return next
    })
  }

  const addCustom = () => {
    if (value.trim()) {
      const item: TypeTabItem = { id: value, name: value }
      setTabList((prev) => [item, ...prev])
      setSelected((prev) => [...prev, item])
    }
    setAddType(false)
    setValue('')
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {showAll ? (
          <Pressable
            style={[s.tab, all && s.tabActive]}
            onPress={selectAllTab}
            accessibilityLabel="全部"
          >
            <Text style={[s.tabText, all && s.tabTextActive]}>全部</Text>
          </Pressable>
        ) : null}
        {tabList.map((item) => {
          const active = selected.some((i) => i.id === item.id)
          return (
            <Pressable
              key={item.id}
              style={[s.tab, active && s.tabActive]}
              onPress={() => toggle(item)}
              accessibilityLabel={item.name}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{item.name}</Text>
            </Pressable>
          )
        })}
        {customize ? (
          <Pressable
            style={[s.tab, addType && s.tabActive]}
            onPress={() => setAddType(true)}
            accessibilityLabel="自定义"
          >
            <Text style={[s.tabText, addType && s.tabTextActive]}>自定义</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal visible={addType} transparent animationType="fade" onRequestClose={() => setAddType(false)}>
        <Pressable style={s.mask} onPress={() => setAddType(false)}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>请设置自定义种类</Text>
            <TextInput
              style={s.input}
              value={value}
              onChangeText={setValue}
              maxLength={4}
              placeholder="请输入种类"
              placeholderTextColor="#9CA3AF"
            />
            <Pressable style={s.dialogBtn} onPress={addCustom} accessibilityLabel="确定">
              <Text style={s.dialogBtnText}>确定</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  listContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(248,249,252,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderColor: '#E0E8FF',
    backgroundColor: 'rgba(205,208,255,0.5)',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(0,0,0,0.4)' },
  tabTextActive: { color: '#000' },
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: 280,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  dialogTitle: { fontSize: 14, fontWeight: '700', color: '#3D3D3D', marginBottom: 16 },
  input: {
    width: 240,
    height: 40,
    borderWidth: 1,
    borderColor: '#979797',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#374151',
    marginBottom: 16,
  },
  dialogBtn: {
    width: 80,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(205,208,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnText: { fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.9)' },
})

export default TitleSwitchTypeBar
