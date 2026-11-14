// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { CategoryDetailScreen as SharedCategoryDetailScreen } from '@ihui/rn-app'
import { getAgents } from '@ihui/api-client'
import { apiFailureToText, toUserFriendlyMessage } from '@ihui/shared/utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function sortItems<T extends { useCount?: number }>(list: T[], tab: string): T[] {
  if (tab === '热门') return [...list].sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
  if (tab === '最新') return [...list].reverse()
  return list
}

export default function CategoryDetailScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProp<RootStackParamList, 'CategoryDetail'>>()

  const [items, setItems] = useState<
    {
      id: string
      name: string
      description?: string
      cover?: string
      avatar?: string | null
      useCount?: number
    }[]
  >([])
  const [activeTab, setActiveTab] = useState('推荐')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const agentsRes = await getAgents({ page, pageSize: 20 })
      // success:false 不会抛异常,旧代码把它当空列表 ⇒ 用户看到"暂无数据"以为分类下真没智能体
      if (!agentsRes.success) {
        setError(apiFailureToText(agentsRes, t('common.loadFailPullRetry')))
        return
      }
      const mapped = (agentsRes.data?.list ?? []).map((a) => ({
        id: a.agentId,
        name: a.name,
        description: a.description,
        cover: a.cover ?? undefined,
        avatar: a.avatar,
        useCount: a.usageCount,
      }))
      const list = sortItems(mapped, activeTab)
      setItems((prev) => (page === 1 ? list : [...prev, ...list]))
      setHasMore(list.length >= 20)
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      setError(detail.trim() ? toUserFriendlyMessage(e) : t('common.loadFailPullRetry'))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeTab, page, t])

  useEffect(() => {
    void load()
  }, [load])

  const onLoadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      setLoadingMore(true)
      setPage((p) => p + 1)
    }
  }, [loading, loadingMore, hasMore])

  const onAgentPress = useCallback(
    (id: string) => {
      navigation.navigate('AgentDetail', { id })
    },
    [navigation],
  )

  return (
    <SharedCategoryDetailScreen
      t={t}
      items={items}
      activeTab={activeTab}
      loading={loading}
      hasMore={hasMore}
      error={error}
      onTabChange={(tab) => {
        if (tab === activeTab) return
        // 切 tab 必须回到第 1 页并清空上一档数据:旧代码只改 tab 和本地排序、page 留在
        // 上档翻到的页码,新 tab 的第 1 页从不请求,追加分支还会把两档数据拼在一起(重复+串味)
        setActiveTab(tab)
        setPage(1)
        setItems([])
      }}
      onLoadMore={onLoadMore}
      onAgentPress={onAgentPress}
      onBack={() => navigation.goBack()}
      onRetry={() => {
        void load()
      }}
      colorScheme={resolvedTheme}
      title="分类详情"
      // 分类头与 web 共用同一段(CategoryHeader);RN 只有路由 title,不伪造状态/时间
      header={{ name: route.params.title }}
      tabLabels={['推荐', '热门', '最新']}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
