import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AigcListScreen as SharedAigcListScreen,
  type AigcCategoryOption,
  type AigcFileType,
  type AigcListItem,
  type AigcListScreenProps,
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

type Nav = NativeStackNavigationProp<RootStackParamList>

/** 分页大小(首次与上拉一致,避免后端按 page/pageSize 计算偏移时出现重叠/空洞) */
const PAGE_SIZE = 20

/** 本地扩展 AigcCategoryOption,补 icon 字段对齐 Uniapp fenlei_icon(不改 @ihui/rn-app 类型) */
type AigcCategoryOptionWithIcon = AigcCategoryOption & { icon?: string }

const CATEGORIES: AigcCategoryOptionWithIcon[] = [
  { key: 'all', label: '全部', icon: '🌟' },
  { key: 'image', label: '图片', fileType: 0, icon: '🖼️' },
  { key: 'video', label: '视频', fileType: 1, icon: '🎬' },
  { key: 'audio', label: '音频', fileType: 3, icon: '🎵' },
  { key: 'text', label: '文案', fileType: 4, icon: '📝' },
]

/** 按分类 key 解析对应的 fileType(供 API 查询用,'all' 不传 fileType) */
function fileTypeForCategory(key: AigcCategoryOption['key']): AigcFileType | undefined {
  return CATEGORIES.find((c) => c.key === key)?.fileType
}

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
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  /** 当前分类对应的 fileType(供 load / loadMore 查询 API);'all' 为 undefined */
  const fileTypeRef = useRef<AigcFileType | undefined>(fileTypeForCategory('all'))

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getAigcTasks({
        page: 1,
        pageSize: PAGE_SIZE,
        ...(fileTypeRef.current !== undefined ? { fileType: fileTypeRef.current } : {}),
      })
      if (res.success) {
        setItems(res.data.list.map(toAigcWork))
        setPage(1)
        setHasMore(res.data.list.length >= PAGE_SIZE)
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

  /** 上拉加载下一页(对齐 Uniapp scrolltolower + pushData) */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await getAigcTasks({
        page: nextPage,
        pageSize: PAGE_SIZE,
        ...(fileTypeRef.current !== undefined ? { fileType: fileTypeRef.current } : {}),
      })
      if (res.success) {
        const nextItems = res.data.list.map(toAigcWork)
        if (nextItems.length < PAGE_SIZE) setHasMore(false)
        setItems((prev) => [...prev, ...nextItems])
        setPage(nextPage)
      }
    } catch (e) {
      console.error('loadMore error', e)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  /** 分类切换:清空列表 + 重置分页 + 以新 fileType 重新请求 API(对齐 Uniapp onCategoryChange → resetData + fetchData) */
  const handleSelectCategory = useCallback(
    (key: AigcCategoryOption['key']) => {
      setCategory(key)
      fileTypeRef.current = fileTypeForCategory(key)
      setItems([])
      setPage(1)
      setHasMore(true)
      setLoading(true)
      void load()
    },
    [load],
  )

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  )

  /** SharedAigcListScreen 注入 props;onLoadMore 已由共享屏 FlatList 的 onEndReached 消费触发上拉分页 */
  const sharedListProps: AigcListScreenProps = {
    t,
    items,
    categories: CATEGORIES,
    category,
    loading,
    refreshing,
    error,
    onSelectCategory: handleSelectCategory,
    onRefresh,
    onPressItem: openWork,
    onPublish: goPublish,
    onBack: () => navigation.goBack(),
    onLoadMore: loadMore,
  }

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
              <SharedAigcListScreen {...sharedListProps} />
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
    paddingTop: 12,
    paddingBottom: 8,
    gap: 3,
    backgroundColor: tokens.surface.bg,
  },
  tab: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 4,
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
    fontWeight: '700',
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
