import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AigcListScreen as SharedAigcListScreen,
  type AigcCategoryOption,
  type AigcFileType,
  type AigcListItem,
} from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import MaterialList, {
  type MaterialCategory,
  type MaterialItem,
  type MaterialType,
} from '../components/MaterialList'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

// Aigc 系列屏幕未注册到 RootStackParamList(独立 mock 屏幕),本地扩展导航类型
// 避免 useNavigation<any>() 退化为 any,保留 navigate/goBack 的类型安全
type AigcStackParamList = RootStackParamList & {
  AigcCover: { id: string; title: string }
  AigcPublish: undefined
}
type Nav = NativeStackNavigationProp<AigcStackParamList>

const CATEGORIES: AigcCategoryOption[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片', fileType: 0 },
  { key: 'video', label: '视频', fileType: 1 },
  { key: 'audio', label: '音频', fileType: 3 },
  { key: 'text', label: '文案', fileType: 4 },
]

const MATERIAL_CATEGORIES: MaterialCategory[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'doc', label: '文档' },
]

type ViewMode = 'shared' | 'local'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asFileType(v: unknown): AigcFileType {
  if (v === 0 || v === 1 || v === 3 || v === 4) return v
  return 0
}

function toMaterialType(ft: AigcFileType): MaterialType {
  if (ft === 1) return 'video'
  if (ft === 3 || ft === 4) return 'doc'
  return 'image'
}

/** AigcFileType → 是否可作为 MaterialList 素材(只保留 image/video/audio/text 4 类) */
function isMaterialType(ft: AigcFileType): boolean {
  return ft === 0 || ft === 1 || ft === 3 || ft === 4
}

/** 将 AIGC 任务(result 为 unknown)安全映射为 UI 层 AigcListItem,避免 any */
function toAigcWork(task: AigcTask): AigcListItem {
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

function toMaterialItem(work: AigcListItem): MaterialItem {
  return {
    id: work.id,
    title: work.title,
    type: toMaterialType(work.fileType),
    createdAt: work.createdAt ? work.createdAt.slice(0, 10) : undefined,
  }
}

/** AIGC 作品类型 → 顶部轮播 emoji(0 图片 / 1 视频 / 3 音频 / 4 文案) */
const FILE_TYPE_ICON: Readonly<Record<AigcFileType, string>> = {
  0: '🖼️',
  1: '🎬',
  3: '🎵',
  4: '📝',
}

/** AIGC 作品 → 顶部轮播卡片项(全部免费,price=0 + isFree=true) */
function toCarouselItems(items: AigcListItem[]): CourseCarouselItem[] {
  return items.slice(0, 5).map((it) => ({
    id: it.id,
    title: it.title,
    price: 0,
    isFree: true,
    icon: FILE_TYPE_ICON[it.fileType] ?? '✨',
  }))
}

export default function AigcListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [viewMode, setViewMode] = useState<ViewMode>('shared')
  const [category, setCategory] = useState<AigcCategoryOption['key']>('all')
  const [materialCategory, setMaterialCategory] = useState<string>('all')
  const [items, setItems] = useState<AigcListItem[]>([])
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

  const openWork = (work: AigcListItem) => {
    navigation.navigate('AigcCover', { id: work.id, title: work.title })
  }

  const goPublish = () => navigation.navigate('AigcPublish')

  // 派生 MaterialList 数据(从已加载的 AigcListItem 中筛选素材类)
  const materialItems = useMemo<MaterialItem[]>(
    () =>
      items.filter((it) => isMaterialType(it.fileType)).map(toMaterialItem),
    [items],
  )

  const filteredMaterialItems = useMemo<MaterialItem[]>(
    () =>
      materialCategory === 'all'
        ? materialItems
        : materialItems.filter((m) => m.type === materialCategory),
    [materialItems, materialCategory],
  )

  const handleMaterialPress = useCallback(
    (id: string) => {
      const found = items.find((it) => it.id === id)
      if (found) openWork(found)
    },
    [items],
  )

  // 顶部 AIGC 作品轮播(取前 5 条,与 shared 屏共用 items 数据源)
  const carouselItems = useMemo<CourseCarouselItem[]>(
    () => toCarouselItems(items),
    [items],
  )

  const handleCarouselPress = useCallback(
    (id: string) => {
      const found = items.find((it) => it.id === id)
      if (found) openWork(found)
    },
    [items],
  )

  return (
    <View style={styles.shell}>
      {/* 顶部视图切换 tab(平台/路由 adapter:仅做 props 注入 + 视图切换) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'shared' && styles.tabActive]}
          onPress={() => setViewMode('shared')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'shared' ? styles.tabTextActive : styles.tabText}>
            作品
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'local' && styles.tabActive]}
          onPress={() => setViewMode('local')}
          activeOpacity={0.8}
        >
          <Text style={viewMode === 'local' ? styles.tabTextActive : styles.tabText}>
            素材库
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.viewport}>
        {viewMode === 'shared' ? (
          <View style={styles.sharedPane}>
            <CourseCarousel
              courses={carouselItems}
              onPress={handleCarouselPress}
            />
            <View style={styles.sharedFill}>
              <SharedAigcListScreen
                t={t}
                items={items}
                categories={CATEGORIES}
                category={category}
                loading={loading}
                refreshing={refreshing}
                error={error}
                onSelectCategory={setCategory}
                onRefresh={onRefresh}
                onPressItem={openWork}
                onPublish={goPublish}
                onBack={() => navigation.goBack()}
              />
            </View>
          </View>
        ) : (
          <MaterialList
            categories={MATERIAL_CATEGORIES}
            activeCategory={materialCategory}
            onCategoryChange={setMaterialCategory}
            items={filteredMaterialItems}
            onPress={handleMaterialPress}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  tabActive: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  tabText: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  tabTextActive: {
    fontSize: 13,
    color: tokens.surface.light,
    fontWeight: '600',
  },
  viewport: {
    flex: 1,
  },
  sharedPane: {
    flex: 1,
  },
  sharedFill: {
    flex: 1,
  },
})
