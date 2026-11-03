// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTheme } from '../context/ThemeContext'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import { toUserFriendlyMessage } from '@ihui/shared/utils'
import type { AudioPort } from '@ihui/types'
import { useAudioPlayer } from 'expo-audio'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AigcListScreen as SharedAigcListScreen,
  type AigcCategoryOption,
  type AigcFileType,
  type AigcListItem,
  type AigcListScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type Nav = NativeStackNavigationProp<RootStackParamList>

/** 分页大小(首次与上拉一致,避免后端按 page/pageSize 计算偏移时出现重叠/空洞) */
const PAGE_SIZE = 20

const CATEGORIES: AigcCategoryOption[] = [
  { key: 'all', label: 'home.matAll' },
  { key: 'image', label: 'chat.assetCatImage', fileType: 0 },
  { key: 'video', label: 'chat.assetCatVideo', fileType: 1 },
  { key: 'audio', label: 'chat.assetCatAudio', fileType: 3 },
  { key: 'text', label: 'menu.catCopyShort', fileType: 4 },
]

/** 按分类 key 解析对应的 fileType(供 API 查询用,'all' 不传 fileType) */
function fileTypeForCategory(key: AigcCategoryOption['key']): AigcFileType | undefined {
  return CATEGORIES.find((c) => c.key === key)?.fileType
}

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

/** 将 AIGC 任务(result 为 unknown)安全映射为 UI 层 AigcListItem,避免 any
 *  tr 由调用方注入:模块顶层不调 t()(求值早于 I18nProvider 挂载,运行必炸) */
function toAigcWork(task: AigcTask, tr: (key: string) => string): AigcListItem {
  const r = isRecord(task.result) ? task.result : {}
  return {
    id: task.taskId,
    title: asString(r.title) ?? tr('aigcCover.workTitleDefault'),
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

/** 音频端口 — expo-audio 真注入(共享屏只认端口形状,不感知宿主 SDK) */
function useAudioPort(): AudioPort {
  const player = useAudioPlayer(null)
  return useMemo<AudioPort>(
    () => ({
      play(url) {
        player.replace(url)
        player.play()
      },
      pause() {
        player.pause()
      },
      stop() {
        // expo-audio 没有 stop():暂停 + 归零头,行为等价
        player.pause()
        void player.seekTo(0)
      },
    }),
    [player],
  )
}

/**
 * RN 薄壳 — 只保留取数/分页/状态与端口注入,渲染全部交给共享 AigcListScreen。
 * 原端内 MaterialList 视图与 CourseCarousel 已删:
 * - 列表渲染由共享屏 packages/app/src/features/aigc-list/AigcListScreen.tsx:88-167(renderItem)+ :239-256(FlatList)承接;
 *   头部 :208-212、分类栏 :214-231、空态 :248-254、发布 FAB :258-260 均同屏承接;
 * - 轮播能力共享屏此前缺失,现以可选 carousel props 注入,由共享屏 :171-206 渲染,缺省不渲染。
 */
export default function AigcListScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [category, setCategory] = useState<AigcCategoryOption['key']>('all')
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
        setItems(res.data.list.map((task) => toAigcWork(task, t)))
        setPage(1)
        setHasMore(res.data.list.length >= PAGE_SIZE)
      } else {
        setError(res.error || t('chat.notes.loadFailShort'))
      }
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      setError(detail.trim() ? toUserFriendlyMessage(e) : t('chat.notes.loadFailShort'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

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
        const nextItems = res.data.list.map((task) => toAigcWork(task, t))
        if (nextItems.length < PAGE_SIZE) setHasMore(false)
        setItems((prev) => [...prev, ...nextItems])
        setPage(nextPage)
      }
    } catch (e) {
      console.error('loadMore error', e)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page, t])

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

  const { onToast } = useHostPorts()
  const audio = useAudioPort()

  /** 共享屏 props:轮播能力以可选端口注入(共享屏缺省不渲染),端内不再自绘一份 */
  const sharedListProps: AigcListScreenProps = {
    t,
    items,
    categories: CATEGORIES.map((c) => ({ ...c, label: t(c.label) })),
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
    colorScheme: resolvedTheme,
    onToast,
    audio,
    carousel: { items: items.slice(0, 5), onPress: openWork },
  }

  return <SharedAigcListScreen {...sharedListProps} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
