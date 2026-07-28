import { useEffect, useMemo, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { tokens } from '@ihui/rn-app'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAigcTask, getAigcTasks, type AigcTask } from '@ihui/api-client'
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

// 静态 UI 模板配置(非 mock 数据):AI 模板预置封面,URL 是 UI 配置
const AI_TEMPLATE_OPTIONS: CoverOption[] = [
  {
    id: 'ai-tpl-1',
    url: 'https://picsum.photos/seed/aicover1/600/600',
    source: 'ai',
    label: 'AI 模板 · 治愈',
  },
  {
    id: 'ai-tpl-2',
    url: 'https://picsum.photos/seed/aicover2/600/600',
    source: 'ai',
    label: 'AI 模板 · 复古',
  },
  {
    id: 'ai-tpl-3',
    url: 'https://picsum.photos/seed/aicover3/600/600',
    source: 'ai',
    label: 'AI 模板 · 极简',
  },
]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

/** 将 AIGC 任务(result 为 unknown)安全映射为 CoverOption,无 coverUrl 返回 undefined */
function toCoverFromTask(task: AigcTask): CoverOption | undefined {
  const r = isRecord(task.result) ? task.result : {}
  const url = asString(r.coverUrl)
  if (!url) return undefined
  const title = asString(r.title) ?? '作品原图'
  return {
    id: task.taskId,
    url,
    source: 'work',
    label: title,
  }
}

export default function AigcCoverScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const workTitle = (route.params?.title as string) ?? '未命名作品'
  const routeId = route.params?.id

  const [works, setWorks] = useState<CoverOption[]>([])
  const [currentCover, setCurrentCover] = useState<CoverOption | null>(null)
  const [selectedId, setSelectedId] = useState<string>(routeId ?? '')
  const [filter, setFilter] = useState<'all' | 'work' | 'ai'>('all')

  // 加载用户 AIGC 作品列表,从 result.coverUrl 提取封面
  const loadWorks = async () => {
    try {
      const res = await getAigcTasks({ page: 1, pageSize: 20 })
      if (res.success) {
        const covers = res.data.list
          .map(toCoverFromTask)
          .filter((c): c is CoverOption => c !== undefined)
        setWorks(covers)
      }
    } catch {
      // 静默失败:works 为空时 UI 仍可用 AI 模板
    }
  }

  // 路由 id 用于调 getAigcTask(id) 获取当前作品的真实 coverUrl,作为预览默认值
  const loadCurrent = async () => {
    if (!routeId) return
    try {
      const res = await getAigcTask(routeId)
      if (res.success) {
        const cover = toCoverFromTask(res.data)
        if (cover) {
          setCurrentCover(cover)
          setSelectedId(cover.id)
        }
      }
    } catch {
      // 静默失败
    }
  }

  useEffect(() => {
    void loadWorks()
    if (routeId) void loadCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  // 合并去重:当前作品优先 + works 列表 + AI 模板
  const allOptions = useMemo<CoverOption[]>(() => {
    const map = new Map<string, CoverOption>()
    if (currentCover) map.set(currentCover.id, currentCover)
    for (const c of works) {
      if (!map.has(c.id)) map.set(c.id, c)
    }
    for (const c of AI_TEMPLATE_OPTIONS) map.set(c.id, c)
    return Array.from(map.values())
  }, [works, currentCover])

  // selectedId 为空时默认选第一个(避免初始无选中)
  useEffect(() => {
    if (!selectedId && allOptions.length > 0) {
      setSelectedId(allOptions[0]!.id)
    }
  }, [selectedId, allOptions])

  const selected =
    allOptions.find((c) => c.id === selectedId) ?? allOptions[0] ?? AI_TEMPLATE_OPTIONS[0]!

  const filtered =
    filter === 'all' ? allOptions : allOptions.filter((c) => c.source === filter)

  const onConfirm = () => {
    Alert.alert('提示', '封面应用功能待接入')
  }

  const onGenerateAi = () => {
    Alert.alert('提示', 'AI 生成封面功能待接入')
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
        <View style={styles.previewWrap}>
          <Image source={{ uri: selected.url }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>{selected.label}</Text>
          </View>
        </View>

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
  container: { flex: 1, backgroundColor: tokens.surface.light },
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
    backgroundColor: '#ecfdf5',
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
  confirmText: { color: tokens.surface.light, fontSize: 15, fontWeight: '600' },
})
