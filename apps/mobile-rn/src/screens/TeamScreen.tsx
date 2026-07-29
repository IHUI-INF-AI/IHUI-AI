import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import {
  TeamScreen as SharedTeamScreen,
  type TeamStats,
  type TeamMember,
  type TeamTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function TeamScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState<TeamTab>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [statsRes, membersRes] = await Promise.all([
        fetchApi<TeamStats>('/team/stats'),
        fetchApi<{ list: TeamMember[] }>('/team/members', {
          params: { page: 1, pageSize: 20 },
        }),
      ])
      if (!statsRes.success || !membersRes.success) {
        setError(t('team.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setStats(statsRes.data ?? null)
      // 格式化日期字段,共享组件只负责渲染
      const rawMembers = membersRes.data?.list ?? []
      setMembers(
        rawMembers.map((m) => ({ ...m, joinDate: formatDateOnly(m.joinDate) })),
      )
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedTeamScreen
      t={t}
      stats={stats}
      members={members}
      activeTab={activeTab}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onSelectTab={setActiveTab}
      onRefresh={() => void load(true)}
      onBack={() => navigation.goBack()}
    />
  )
}
