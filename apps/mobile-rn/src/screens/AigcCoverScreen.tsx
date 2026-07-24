import { useState } from 'react'
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'

const PRIMARY = '#10B981'

interface CoverOption {
  id: string
  url: string
  source: 'work' | 'ai'
  label: string
}

const MOCK_COVERS: CoverOption[] = [
  { id: 'c1', url: 'https://picsum.photos/seed/cover1/600/600', source: 'work', label: '作品原图 1' },
  { id: 'c2', url: 'https://picsum.photos/seed/cover2/600/600', source: 'work', label: '作品原图 2' },
  { id: 'c3', url: 'https://picsum.photos/seed/cover3/600/600', source: 'work', label: '作品原图 3' },
  { id: 'c4', url: 'https://picsum.photos/seed/aicover1/600/600', source: 'ai', label: 'AI 模板 · 治愈' },
  { id: 'c5', url: 'https://picsum.photos/seed/aicover2/600/600', source: 'ai', label: 'AI 模板 · 复古' },
  { id: 'c6', url: 'https://picsum.photos/seed/aicover3/600/600', source: 'ai', label: 'AI 模板 · 极简' },
]

export default function AigcCoverScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<RouteProp<any>>()
  const workTitle = (route.params?.title as string) ?? '未命名作品'
  const [selectedId, setSelectedId] = useState<string>(MOCK_COVERS[0].id)
  const [filter, setFilter] = useState<'all' | 'work' | 'ai'>('all')

  const selected = MOCK_COVERS.find((c) => c.id === selectedId) ?? MOCK_COVERS[0]
  const filtered = filter === 'all' ? MOCK_COVERS : MOCK_COVERS.filter((c) => c.source === filter)

  const onConfirm = () => {
    Alert.alert('封面已应用', `已为「${workTitle}」应用封面:${selected.label}`, [
      { text: '好的', onPress: () => navigation.goBack() },
    ])
  }

  const onGenerateAi = () => {
    Alert.alert('AI 生成封面', '正在调用 AI 生成新封面,请稍候…(mock)', [
      { text: '知道了' },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>选择封面</Text>
        <Text style={styles.subtitle} numberOfLines={1}>作品:{workTitle}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.previewWrap}>
          <Image source={{ uri: selected.url }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>{selected.label}</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {([
            { key: 'all', label: '全部' },
            { key: 'work', label: '作品原图' },
            { key: 'ai', label: 'AI 模板' },
          ] as const).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.grid}>
          {filtered.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.coverItem, selectedId === c.id && styles.coverItemActive]}
              onPress={() => setSelectedId(c.id)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: c.url }} style={styles.coverImage} resizeMode="cover" />
              <Text style={styles.coverLabel} numberOfLines={1}>{c.label}</Text>
              {selectedId === c.id ? (
                <View style={styles.selectedDot}>
                  <Text style={styles.selectedDotText}>✓</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.aiGenBtn} onPress={onGenerateAi} activeOpacity={0.7}>
          <Text style={styles.aiGenText}>✨ 让 AI 生成新封面</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
          <Text style={styles.confirmText}>应用此封面</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  previewWrap: { position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
  preview: { width: '100%', aspectRatio: 1, backgroundColor: '#e5e7eb' },
  previewBadge: {
    position: 'absolute', bottom: 8, left: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  previewBadgeText: { fontSize: 12, color: '#fff' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  filterChipActive: { backgroundColor: PRIMARY },
  filterText: { fontSize: 13, color: '#374151' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  coverItem: {
    width: '48%', flexGrow: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f9fafb',
    paddingBottom: 8, borderWidth: 2, borderColor: 'transparent',
  },
  coverItemActive: { borderColor: PRIMARY },
  coverImage: { width: '100%', aspectRatio: 1, backgroundColor: '#e5e7eb' },
  coverLabel: { marginTop: 6, paddingHorizontal: 8, fontSize: 12, color: '#374151' },
  selectedDot: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 6,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
  selectedDotText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  aiGenBtn: {
    marginTop: 16, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: PRIMARY,
    backgroundColor: '#ecfdf5', alignItems: 'center',
  },
  aiGenText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  confirmBtn: {
    paddingVertical: 14, borderRadius: 8, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
