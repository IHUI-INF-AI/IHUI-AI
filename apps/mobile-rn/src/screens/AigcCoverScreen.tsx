import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

const PRIMARY = tokens.brand.DEFAULT

type AigcCoverRouteParamList = {
  AigcCover: { id: string; title: string } | undefined
}
type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<AigcCoverRouteParamList, 'AigcCover'>

interface CoverOption {
  id: string
  url: string
  source: 'work' | 'ai'
  label: string
}

// AigcTask.result 为 unknown,用类型守卫安全提取 url/label/source 字段。
// 避免对 unknown 直接 `as` 断言(不安全),也禁止 any 兜底。
interface AigcCoverResult {
  url?: string
  label?: string
  source?: 'work' | 'ai'
}

function readResult(raw: unknown): AigcCoverResult {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const url = typeof r.url === 'string' ? r.url : undefined
  const label = typeof r.label === 'string' ? r.label : undefined
  const source = r.source === 'work' || r.source === 'ai' ? r.source : undefined
  return { url, label, source }
}

function mapTaskToCover(task: AigcTask): CoverOption | null {
  const r = readResult(task.result)
  if (!r.url) return null
  return {
    id: task.taskId,
    url: r.url,
    source: r.source || 'work',
    label: r.label || '作品',
  }
}

export default function AigcCoverScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const workTitle = (route.params?.title as string) ?? '未命名作品'
  const [covers, setCovers] = useState<CoverOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [filter, setFilter] = useState<'all' | 'work' | 'ai'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 从 @ihui/api-client 加载真实 AIGC 任务列表,映射为 CoverOption[]。
  // cancelled flag 防止组件卸载后 setState 导致内存泄漏。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getAigcTasks({ page: 1, pageSize: 20 })
        if (cancelled) return
        if (res.success) {
          const mapped = res.data.list
            .map(mapTaskToCover)
            .filter((c): c is CoverOption => c !== null)
          setCovers(mapped)
        } else {
          setError(res.error || '加载失败')
        }
      } catch {
        if (!cancelled) setError('加载失败,请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = covers.find((c) => c.id === selectedId) ?? covers[0]
  const filtered = filter === 'all' ? covers : covers.filter((c) => c.source === filter)

  const onConfirm = () => {
    if (!selected) return
    // TODO: i18n — Alert.alert 硬编码中文待翻译(封面已应用 / 已为「X」应用封面 / 好的)
    Alert.alert('封面已应用', `已为「${workTitle}」应用封面:${selected.label}`, [
      { text: '好的', onPress: () => navigation.goBack() },
    ])
  }

  const onGenerateAi = () => {
    // TODO: i18n — Alert.alert 硬编码中文待翻译(AI 生成封面 / 功能开发中 / 知道了)
    Alert.alert('AI 生成封面', '功能开发中', [{ text: '知道了' }])
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>加载中...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.stateWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>选择封面</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          作品:{workTitle}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {selected ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: selected.url }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>{selected.label}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {(
            [
              { key: 'all', label: '全部' },
              { key: 'work', label: '作品原图' },
              { key: 'ai', label: 'AI 模板' },
            ] as const
          ).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无封面,请先生成</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.coverItem, selectedId === c.id && styles.coverItemActive]}
                onPress={() => setSelectedId(c.id)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: c.url }} style={styles.coverImage} resizeMode="cover" />
                <Text style={styles.coverLabel} numberOfLines={1}>
                  {c.label}
                </Text>
                {selectedId === c.id ? (
                  <View style={styles.selectedDot}>
                    <Text style={styles.selectedDotText}>✓</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.aiGenBtn} onPress={onGenerateAi} activeOpacity={0.7}>
          <Text style={styles.aiGenText}>✨ 让 AI 生成新封面</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
          onPress={onConfirm}
          activeOpacity={0.85}
          disabled={!selected}
        >
          <Text style={styles.confirmText}>应用此封面</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.light },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  stateText: { fontSize: 13, color: tokens.text.tertiary },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  previewWrap: { position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
  preview: { width: '100%', aspectRatio: 1, backgroundColor: tokens.border.light },
  previewBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  previewBadgeText: { fontSize: 12, color: tokens.surface.light },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  filterChipActive: { backgroundColor: PRIMARY },
  filterText: { fontSize: 13, color: tokens.text.medium },
  filterTextActive: { color: tokens.surface.light, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  coverItem: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: tokens.surface.muted,
    paddingBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  coverItemActive: { borderColor: PRIMARY },
  coverImage: { width: '100%', aspectRatio: 1, backgroundColor: tokens.border.light },
  coverLabel: { marginTop: 6, paddingHorizontal: 8, fontSize: 12, color: tokens.text.medium },
  selectedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDotText: { color: tokens.surface.light, fontSize: 14, fontWeight: '700' },
  aiGenBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
    backgroundColor: tokens.success.light,
    alignItems: 'center',
  },
  aiGenText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tokens.surface.light },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: { backgroundColor: tokens.text.tertiary },
  confirmText: { color: tokens.surface.light, fontSize: 15, fontWeight: '600' },
})
