import { useCallback, useEffect, useState } from 'react'
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
import { tokens } from '@ihui/rn-app'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

const PRIMARY = tokens.brand.DEFAULT

// Aigc 系列屏幕未注册到 RootStackParamList(独立 mock 屏幕),本地扩展导航类型
// 避免 useNavigation<any>() 退化为 any,保留 navigate/goBack 的类型安全
type AigcStackParamList = RootStackParamList & {
  AigcCover: { id: string; title: string }
  AigcPublish: undefined
}
type Nav = NativeStackNavigationProp<AigcStackParamList>

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asFileType(v: unknown): FileType {
  if (v === 0 || v === 1 || v === 3 || v === 4) return v
  return 0
}

/** 将 AIGC 任务(result 为 unknown)安全映射为 UI 层 AigcWork,避免 any */
function toAigcWork(task: AigcTask): AigcWork {
  const r = isRecord(task.result) ? task.result : {}
  return {
    id: task.taskId,
    title: asString(r.title) ?? '未命名作品',
    subtitle: asString(r.subtitle),
    prompt: asString(r.prompt),
    content: asString(r.content),
    fileUrl: asString(r.fileUrl),
    coverUrl: asString(r.coverUrl),
    audioUrl: asString(r.audioUrl),
    duration: asString(r.duration),
    fileType: asFileType(r.fileType),
    createdAt: task.createdAt ?? '',
  }
}

export default function AigcListScreen() {
  const navigation = useNavigation<Nav>()
  const [category, setCategory] = useState<Category>('all')
  const [items, setItems] = useState<AigcWork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getAigcTasks({ page: 1, pageSize: 50 })
      if (res.success) {
        setItems(res.data.list.map(toAigcWork))
      } else {
        setError(res.error || '加载失败')
      }
    } catch {
      setError('加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const filtered =
    category === 'all'
      ? items
      : items.filter((w) => w.fileType === CATEGORIES.find((c) => c.key === category)?.fileType)

  const openWork = (work: AigcWork) => {
    navigation.navigate('AigcCover', { id: work.id, title: work.title })
  }

  const goPublish = () => navigation.navigate('AigcPublish')

  const renderItem = ({ item }: { item: AigcWork }) => {
    if (item.fileType === 4) {
      return (
        <TouchableOpacity
          style={styles.textCard}
          onPress={() => openWork(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardTime}>{item.createdAt}</Text>
          </View>
          {item.prompt ? (
            <Text style={styles.promptText} numberOfLines={1}>
              提示词:{item.prompt}
            </Text>
          ) : null}
          <Text style={styles.contentText} numberOfLines={3}>
            {item.content}
          </Text>
        </TouchableOpacity>
      )
    }
    if (item.fileType === 3) {
      return (
        <TouchableOpacity
          style={styles.audioCard}
          onPress={() => openWork(item)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: item.coverUrl }} style={styles.audioCover} />
          <View style={styles.audioInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
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
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
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
        <Text style={styles.headerSubtitle}>AI 生成的图文/视频/音频作品</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryContent}
      >
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.categoryChip, category === c.key && styles.categoryChipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.categoryText, category === c.key && styles.categoryTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{loading ? '加载中...' : '暂无作品'}</Text>
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
  container: { flex: 1, backgroundColor: tokens.surface.light },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  headerSubtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  categoryBar: { maxHeight: 48 },
  categoryContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  categoryChipActive: { backgroundColor: PRIMARY },
  categoryText: { fontSize: 13, color: tokens.text.medium },
  categoryTextActive: { color: tokens.surface.light, fontWeight: '600' },
  list: { flex: 1, paddingHorizontal: 12 },
  row: { gap: 12, marginBottom: 12 },
  mediaCard: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: tokens.surface.muted,
  },
  mediaCover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: tokens.border.light },
  videoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  videoBadgeText: { fontSize: 11, color: tokens.surface.light },
  mediaFooter: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  textCard: {
    flex: 2,
    padding: 14,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime: { fontSize: 11, color: tokens.text.tertiary },
  promptText: { marginTop: 8, fontSize: 12, color: PRIMARY },
  contentText: { marginTop: 8, fontSize: 13, color: tokens.text.medium, lineHeight: 20 },
  audioCard: {
    flex: 2,
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    marginBottom: 12,
    alignItems: 'center',
  },
  audioCover: { width: 64, height: 64, borderRadius: 8, backgroundColor: tokens.border.light },
  audioInfo: { flex: 1, marginLeft: 12 },
  audioDuration: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  audioPlayBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: tokens.success.light,
  },
  audioPlayText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: [{ translateX: -80 }],
    width: 160,
    height: 44,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fabText: { color: tokens.surface.light, fontSize: 14, fontWeight: '600' },
})
