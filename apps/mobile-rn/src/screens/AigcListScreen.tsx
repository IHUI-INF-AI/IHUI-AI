import { useState } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'

const PRIMARY = '#10B981'

type FileType = 0 | 1 | 3 | 4

interface AigcWork {
  id: string
  title: string
  subtitle?: string
  prompt?: string
  content?: string
  fileUrl?: string
  coverUrl?: string
  audioUrl?: string
  duration?: string
  fileType: FileType
  createdAt: string
}

type Category = 'all' | 'image' | 'video' | 'audio' | 'text'

const CATEGORIES: { key: Category; label: string; fileType?: FileType }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片', fileType: 0 },
  { key: 'video', label: '视频', fileType: 1 },
  { key: 'audio', label: '音频', fileType: 3 },
  { key: 'text', label: '文案', fileType: 4 },
]

const MOCK_WORKS: AigcWork[] = [
  {
    id: '1', title: '春日城市光影', subtitle: 'AI 生成插画', prompt: '赛博朋克城市,霓虹,雨天',
    fileUrl: 'https://picsum.photos/seed/aigc1/400/600', coverUrl: 'https://picsum.photos/seed/aigc1/400/600',
    fileType: 0, createdAt: '2026-07-20',
  },
  {
    id: '2', title: '极光夜景短片', subtitle: 'AI 生成视频', prompt: '极光,雪山,延时摄影',
    coverUrl: 'https://picsum.photos/seed/aigc2/400/600', fileType: 1, createdAt: '2026-07-19',
  },
  {
    id: '3', title: '治愈系播客', subtitle: '夜间电台', prompt: '温柔女声,治愈,轻音乐',
    audioUrl: '', duration: '03:42', coverUrl: 'https://picsum.photos/seed/aigc3/400/400',
    fileType: 3, createdAt: '2026-07-18',
  },
  {
    id: '4', title: '夏日品牌文案', subtitle: '营销短文', prompt: '夏日饮品,清新,年轻',
    content: '一杯清茶,半夏清凉。让每一口都成为夏日的仪式感,与好友分享这份宁静。',
    fileType: 4, createdAt: '2026-07-17',
  },
  {
    id: '5', title: '未来城市概念图', subtitle: 'AI 概念设计', prompt: '未来主义,空中城市,云端',
    fileUrl: 'https://picsum.photos/seed/aigc5/400/500', coverUrl: 'https://picsum.photos/seed/aigc5/400/500',
    fileType: 0, createdAt: '2026-07-16',
  },
  {
    id: '6', title: '森林晨曦视频', subtitle: '自然风光', prompt: '森林,晨雾,鸟鸣',
    coverUrl: 'https://picsum.photos/seed/aigc6/400/500', fileType: 1, createdAt: '2026-07-15',
  },
  {
    id: '7', title: '古风音乐短曲', subtitle: '古筝独奏', prompt: '古风,悠扬,宁静',
    audioUrl: '', duration: '02:18', coverUrl: 'https://picsum.photos/seed/aigc7/400/400',
    fileType: 3, createdAt: '2026-07-14',
  },
  {
    id: '8', title: '产品发布文案', subtitle: '科技新品', prompt: '科技感,简洁,高端',
    content: '重新定义边界,以匠心致敬未来。这一次,我们把想象带到了现实。',
    fileType: 4, createdAt: '2026-07-13',
  },
]

export default function AigcListScreen() {
  const navigation = useNavigation<any>()
  const [category, setCategory] = useState<Category>('all')
  const [refreshing, setRefreshing] = useState(false)

  const filtered = category === 'all'
    ? MOCK_WORKS
    : MOCK_WORKS.filter((w) => w.fileType === CATEGORIES.find((c) => c.key === category)?.fileType)

  const onRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  const openWork = (work: AigcWork) => {
    navigation.navigate('AigcCover', { id: work.id, title: work.title })
  }

  const goPublish = () => navigation.navigate('AigcPublish')

  const renderItem = ({ item }: { item: AigcWork }) => {
    if (item.fileType === 4) {
      return (
        <TouchableOpacity style={styles.textCard} onPress={() => openWork(item)} activeOpacity={0.7}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardTime}>{item.createdAt}</Text>
          </View>
          {item.prompt ? (
            <Text style={styles.promptText} numberOfLines={1}>提示词:{item.prompt}</Text>
          ) : null}
          <Text style={styles.contentText} numberOfLines={3}>{item.content}</Text>
        </TouchableOpacity>
      )
    }
    if (item.fileType === 3) {
      return (
        <TouchableOpacity style={styles.audioCard} onPress={() => openWork(item)} activeOpacity={0.7}>
          <Image source={{ uri: item.coverUrl }} style={styles.audioCover} />
          <View style={styles.audioInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.audioDuration}>{item.duration ?? '--:--'}</Text>
            <View style={styles.audioPlayBtn}>
              <Text style={styles.audioPlayText}>▶ 播放</Text>
            </View>
          </View>
        </TouchableOpacity>
      )
    }
    return (
      <TouchableOpacity style={styles.mediaCard} onPress={() => openWork(item)} activeOpacity={0.7}>
        <Image source={{ uri: item.coverUrl }} style={styles.mediaCover} resizeMode="cover" />
        {item.fileType === 1 ? (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>▶ 视频</Text>
          </View>
        ) : null}
        <View style={styles.mediaFooter}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {item.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>灵感</Text>
        <Text style={styles.subtitle}>AI 生成的图文/视频/音频作品</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar} contentContainerStyle={styles.categoryContent}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.categoryChip, category === c.key && styles.categoryChipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.categoryText, category === c.key && styles.categoryTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无作品</Text>
          </View>
        }
        renderItem={renderItem}
      />

      <TouchableOpacity style={styles.fab} onPress={goPublish} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ 发布作品</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  categoryBar: { maxHeight: 48 },
  categoryContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  categoryChipActive: { backgroundColor: PRIMARY },
  categoryText: { fontSize: 13, color: '#374151' },
  categoryTextActive: { color: '#fff', fontWeight: '600' },
  list: { flex: 1, paddingHorizontal: 12 },
  row: { gap: 12, marginBottom: 12 },
  mediaCard: { flex: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f9fafb' },
  mediaCover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#e5e7eb' },
  videoBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  videoBadgeText: { fontSize: 11, color: '#fff' },
  mediaFooter: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  textCard: { flex: 2, padding: 14, borderRadius: 8, backgroundColor: '#f9fafb', marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime: { fontSize: 11, color: '#9ca3af' },
  promptText: { marginTop: 8, fontSize: 12, color: PRIMARY },
  contentText: { marginTop: 8, fontSize: 13, color: '#374151', lineHeight: 20 },
  audioCard: { flex: 2, flexDirection: 'row', padding: 12, borderRadius: 8, backgroundColor: '#f9fafb', marginBottom: 12, alignItems: 'center' },
  audioCover: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' },
  audioInfo: { flex: 1, marginLeft: 12 },
  audioDuration: { marginTop: 4, fontSize: 11, color: '#9ca3af' },
  audioPlayBtn: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#d1fae5' },
  audioPlayText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  fab: {
    position: 'absolute', bottom: 24, left: '50%', transform: [{ translateX: -80 }],
    width: 160, height: 44, borderRadius: 8, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
