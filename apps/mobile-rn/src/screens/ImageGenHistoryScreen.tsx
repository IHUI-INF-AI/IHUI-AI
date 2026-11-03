// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ImageGenHistoryScreen 图像生成历史/收藏(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app ImageGenHistoryScreen,
 * 本 wrapper 仅保留平台特定职责:
 * - 数据:fetchApi(GET /api/image-gen/history,aiGcContent 域)历史分页 + fetchApi(GET /api/image-gen/favorites)收藏分页
 * - URL:resolveFileUrl 解析封面;时间文本按当前 locale 预格式化
 * - 分页:PAGE_SIZE=20,onEndReached 上拉加载(静默失败,下次触底重试)+ RefreshControl 下拉刷新
 * - 导航:goBack / ImageGenCreate 跳转;主题色 / i18n 注入
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { ImageGenHistoryScreen as SharedImageGenHistoryScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { WEB_BASE_URL } from '../lib/webview-portal-config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 历史与收藏统一渲染结构(status 仅历史任务有,收藏无状态;coverUrl 已 resolve,timeText 已按 locale 格式化) */
interface GridItem {
  id: string
  coverUrl: string
  prompt: string
  status?: 'pending' | 'running' | 'succeeded' | 'failed'
  timeText: string
}

interface FavoritesData {
  list: Array<{ id: string; prompt: string; imageUrl: string; createdAt: string }>
  total: number
  page: number
  pageSize: number
}

/** /api/image-gen/history 行(aiGcContent 裸行,与 web 同源) */
interface HistoryData {
  list: Array<{
    id: string
    content: string | null
    status: number | null
    createdAt: string
  }>
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

function formatTime(iso: string, formatter: Intl.DateTimeFormat): string {
  if (!iso) return ''
  try {
    return formatter.format(new Date(iso))
  } catch {
    return iso
  }
}

/**
 * aiGcContent 行 → 网格项(对齐 web /image-gen/history 口径)。
 * 该表无图片 URL 列(content 仅存提示词),故 coverUrl 恒空,与 web 渲染一致;
 * status 为内容启用标志(0/1),非生成任务状态,不映射。
 */
function toGridHistoryRow(row: HistoryData['list'][number], formatter: Intl.DateTimeFormat): GridItem {
  return {
    id: row.id,
    coverUrl: '',
    prompt: row.content ?? '',
    timeText: formatTime(row.createdAt ?? '', formatter),
  }
}

function toGridFavoriteItem(
  item: FavoritesData['list'][number],
  formatter: Intl.DateTimeFormat,
): GridItem {
  return {
    id: item.id,
    coverUrl: item.imageUrl,
    prompt: item.prompt,
    timeText: formatTime(item.createdAt, formatter),
  }
}

export function ImageGenHistoryScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<'history' | 'favorites'>('history')
  const [historyItems, setHistoryItems] = useState<GridItem[]>([])
  const [favItems, setFavItems] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      if (tab === 'history') {
        const res = await fetchApi<HistoryData>('/api/image-gen/history', {
          params: { page: 1, pageSize: PAGE_SIZE },
        })
        if (res.success) {
          setHistoryItems(res.data.list.map((row) => toGridHistoryRow(row, timeFormatter)))
          setHasMore(res.data.list.length >= PAGE_SIZE)
        } else {
          setError(apiFailureToText(res, t('imageGen.loadFailed')))
        }
      } else {
        const res = await fetchApi<FavoritesData>('/api/image-gen/favorites', {
          params: { page: 1, pageSize: PAGE_SIZE },
        })
        if (res.success) {
          setFavItems(res.data.list.map((item) => toGridFavoriteItem(item, timeFormatter)))
          setHasMore(res.data.list.length >= PAGE_SIZE)
        } else {
          setError(apiFailureToText(res, t('imageGen.loadFailed')))
        }
      }
      setPage(1)
    } catch {
      setError(t('imageGen.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tab, t, timeFormatter])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      if (tab === 'history') {
        const res = await fetchApi<HistoryData>('/api/image-gen/history', {
          params: { page: nextPage, pageSize: PAGE_SIZE },
        })
        if (res.success) {
          const nextItems = res.data.list.map((row) => toGridHistoryRow(row, timeFormatter))
          if (nextItems.length < PAGE_SIZE) setHasMore(false)
          setHistoryItems((prev) => [...prev, ...nextItems])
        }
      } else {
        const res = await fetchApi<FavoritesData>('/api/image-gen/favorites', {
          params: { page: nextPage, pageSize: PAGE_SIZE },
        })
        if (res.success) {
          const nextItems = res.data.list.map((item) => toGridFavoriteItem(item, timeFormatter))
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
  }, [loading, loadingMore, hasMore, page, tab, timeFormatter])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const onTabPress = (key: 'history' | 'favorites') => {
    if (key === tab) return
    setTab(key)
    setHistoryItems([])
    setFavItems([])
    setLoading(true)
    setError('')
  }

  const items = tab === 'history' ? historyItems : favItems

  return (
    <SharedImageGenHistoryScreen
      t={t}
      tab={tab}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onTabChange={onTabPress}
      onRefresh={onRefresh}
      onLoadMore={() => void loadMore()}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
      onBack={() => navigation.goBack()}
      // ImageGenCreate 在小程序 route-map 无映射(app.config 无生图创建页)⇒ 静默不跳。
      // 与 ImageGenTemplates 同款(2026-11-01 收口):统一改走 WebView 承载 web /image-gen,
      // 小程序 webview 页按 host 白名单放行(域内 https),双端行为一致。
      onCreate={() =>
        navigation.navigate('WebView', {
          url: `${WEB_BASE_URL}/image-gen`,
        })
      }
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
