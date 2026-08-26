import { useCallback, useEffect, useState } from 'react'
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getAigcTasks, resolveFileUrl, type AigcTask } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type TabKey = 'history' | 'favorites'

/** 历史与收藏统一渲染结构(status 仅历史任务有,收藏无状态) */
interface GridItem {
  id: string
  coverUrl: string
  prompt: string
  status?: AigcTask['status']
  createdAt: string
}

interface FavoritesData {
  list: Array<{ id: string; prompt: string; imageUrl: string; createdAt: string }>
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    return timeFormatter.format(new Date(iso))
  } catch {
    return iso
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function coverOf(result: unknown): string {
  const r = isRecord(result) ? result : {}
  const raw = asString(r.coverUrl) || asString(r.fileUrl)
  return raw ? resolveFileUrl(raw) : ''
}

function toGridHistoryItem(task: AigcTask): GridItem {
  const r = isRecord(task.result) ? task.result : {}
  return {
    id: task.taskId,
    coverUrl: coverOf(task.result),
    prompt: asString(r.prompt),
    status: task.status,
    createdAt: task.createdAt ?? '',
  }
}

function toGridFavoriteItem(item: FavoritesData['list'][number]): GridItem {
  return {
    id: item.id,
    coverUrl: item.imageUrl,
    prompt: item.prompt,
    createdAt: item.createdAt,
  }
}

const STATUS_KEY: Record<AigcTask['status'], string> = {
  pending: 'imageGen.statusPending',
  running: 'imageGen.statusRunning',
  succeeded: 'imageGen.statusSucceeded',
  failed: 'imageGen.statusFailed',
}

const TABS: Array<{ key: TabKey; labelKey: string }> = [
  { key: 'history', labelKey: 'imageGen.tabHistory' },
  { key: 'favorites', labelKey: 'imageGen.tabFavorites' },
]

/**
 * 图像生成历史 / 收藏(M3 补齐:web /image-gen/history、/image-gen/favorites 在移动端的入口)
 * 历史数据源:getAigcTasks(GET /api/ai/aigc/records,含生成状态与封面)
 * 收藏数据源:fetchApi(GET /api/image-gen/favorites,含 prompt + imageUrl 快照)
 */
export function ImageGenHistoryScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<TabKey>('history')
  const [historyItems, setHistoryItems] = useState<GridItem[]>([])
  const [favItems, setFavItems] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async () => {
    setError('')
    try {
      if (tab === 'history') {
        const res = await getAigcTasks({ page: 1, pageSize: PAGE_SIZE })
        if (res.success) {
          setHistoryItems(res.data.list.map(toGridHistoryItem))
          setHasMore(res.data.list.length >= PAGE_SIZE)
        } else {
          setError(res.error || t('imageGen.loadFailed'))
        }
      } else {
        const res = await fetchApi<FavoritesData>('/api/image-gen/favorites', {
          params: { page: 1, pageSize: PAGE_SIZE },
        })
        if (res.success) {
          setFavItems(res.data.list.map(toGridFavoriteItem))
          setHasMore(res.data.list.length >= PAGE_SIZE)
        } else {
          setError(res.error || t('imageGen.loadFailed'))
        }
      }
      setPage(1)
    } catch {
      setError(t('imageGen.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tab, t])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      if (tab === 'history') {
        const res = await getAigcTasks({ page: nextPage, pageSize: PAGE_SIZE })
        if (res.success) {
          const nextItems = res.data.list.map(toGridHistoryItem)
          if (nextItems.length < PAGE_SIZE) setHasMore(false)
          setHistoryItems((prev) => [...prev, ...nextItems])
        }
      } else {
        const res = await fetchApi<FavoritesData>('/api/image-gen/favorites', {
          params: { page: nextPage, pageSize: PAGE_SIZE },
        })
        if (res.success) {
          const nextItems = res.data.list.map(toGridFavoriteItem)
          if (nextItems.length < PAGE_SIZE) setHasMore(false)
          setFavItems((prev) => [...prev, ...nextItems])
        }
      }
      setPage(nextPage)
    } catch {
      // 上拉加载失败静默,下次 onEndReached 重试
    } finally {
      setLoadingMore(false)
    }
  }, [loading, loadingMore, hasMore, page, tab])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const onTabPress = (key: TabKey) => {
    if (key === tab) return
    setTab(key)
    setHistoryItems([])
    setFavItems([])
    setLoading(true)
    setError('')
  }

  const items = tab === 'history' ? historyItems : favItems

  const renderItem = ({ item }: { item: GridItem }) => (
    <View className="mb-3 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={{ aspectRatio: 1, width: '100%' }} resizeMode="cover" />
      ) : (
        <View className="aspect-square w-full items-center justify-center bg-gray-100 px-3 dark:bg-neutral-700">
          <Text className="text-center text-xs text-gray-400" numberOfLines={4}>
            {item.prompt || t('imageGen.promptFallback')}
          </Text>
        </View>
      )}
      {item.status ? (
        <View className="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5">
          <Text className="text-[10px] text-white">{t(STATUS_KEY[item.status])}</Text>
        </View>
      ) : null}
      <View className="p-2">
        <Text className="text-xs font-medium text-gray-800 dark:text-gray-100" numberOfLines={2}>
          {item.prompt || t('imageGen.promptFallback')}
        </Text>
        <Text className="mt-1 text-[10px] text-gray-400">{formatTime(item.createdAt)}</Text>
      </View>
    </View>
  )

  if (loading) {
    return (
      <View className={`flex-1 items-center justify-center ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('imageGen.title')}</Text>
        <View className="w-8" />
      </View>

      <View className="flex-row gap-2 px-4 pb-2">
        {TABS.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => onTabPress(item.key)}
            className={`rounded-md px-3 py-1.5 ${tab === item.key ? 'bg-gray-200 dark:bg-neutral-700' : ''}`}
          >
            <Text className={`text-sm ${tab === item.key ? 'font-medium text-gray-900 dark:text-gray-50' : 'text-gray-500'}`}>
              {t(item.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-center text-sm text-gray-500">{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true)
              void load()
            }}
            className="rounded-md bg-gray-200 px-4 py-2 dark:bg-neutral-700"
          >
            <Text className="text-sm">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.3}
          onEndReached={() => void loadMore()}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-gray-500">
                {tab === 'history' ? t('imageGen.historyEmpty') : t('imageGen.favoritesEmpty')}
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </View>
  )
}
