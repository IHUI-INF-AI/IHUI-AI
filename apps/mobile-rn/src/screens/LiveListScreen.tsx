import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  LiveListScreen as SharedLiveListScreen,
  type LiveListItem,
  type LiveListTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList } from '../hooks'
import { formatShortDateTime } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface LivePage {
  list: Array<{
    id: string
    title: string
    lecturer: string
    status: 'upcoming' | 'ongoing' | 'ended'
    startAt: string
    viewerCount: number
    cover: string | null
  }>
  total: number
}

const PAGE_SIZE = 20

export function LiveListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [statusTab, setStatusTab] = useState<LiveListTab>('all')

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusTab,
      })
      const res = await fetchApi<LivePage>(`/live/list?${params.toString()}`)
      if (!res.success) return { success: false as const, error: t('liveList.loadFailed') }
      const list: LiveListItem[] = (res.data?.list ?? []).map((i) => ({
        id: i.id,
        title: i.title,
        lecturer: i.lecturer,
        status: i.status,
        startAt: formatShortDateTime(i.startAt),
        viewerCount: i.viewerCount,
        cover: i.cover,
      }))
      return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
    },
    [statusTab, t],
  )

  const { items, loading, refreshing, error, refresh } = usePaginatedList<LiveListItem>(
    fetcher,
    PAGE_SIZE,
  )

  const onSelectTab = (tab: LiveListTab) => {
    if (tab === statusTab) return
    setStatusTab(tab)
    setTimeout(refresh, 0)
  }

  return (
    <SharedLiveListScreen
      t={t}
      items={items}
      activeTab={statusTab}
      onSelectTab={onSelectTab}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      onPressItem={(item: LiveListItem) => navigation.navigate('LiveDetail', { id: item.id })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
