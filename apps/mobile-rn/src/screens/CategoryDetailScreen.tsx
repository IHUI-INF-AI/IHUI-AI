import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { CategoryDetailScreen as SharedCategoryDetailScreen } from '@ihui/rn-app'
import { getAgents, getCategories } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function CategoryDetailScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<
    { id: string; name: string; description?: string; cover?: string }[]
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
      const [agentsRes, categoriesRes] = await Promise.all([
        getAgents({ page, pageSize: 20 }),
        getCategories(),
      ])
      const list = agentsRes.success ? (agentsRes.data?.list ?? []) : []
      setItems((prev) => (page === 1 ? list : [...prev, ...list]))
      setHasMore(list.length >= 20)
      if (categoriesRes.success && categoriesRes.data) {
        setActiveTab('推荐')
      }
    } catch {
      setError('加载失败，请下拉刷新重试')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [page])

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
      onTabChange={setActiveTab}
      onLoadMore={onLoadMore}
      onAgentPress={onAgentPress}
      onBack={() => navigation.goBack()}
    />
  )
}
