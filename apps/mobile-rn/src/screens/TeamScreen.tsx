import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTeamMembers, getTeamStats } from '@ihui/api-client'
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
      // 2026-08-21:历史 fetchApi('/team/stats'|'/team/members') 在后端不存在(404),
      // 迁移到真实端点 /distribution/team/*(对齐 Uniapp distribution_personnel_list)。
      const [statsRes, membersRes] = await Promise.all([
        getTeamStats(),
        getTeamMembers({ page: 1, pageSize: 20 }),
      ])
      if (!statsRes.success || !membersRes.success) {
        setError(t('team.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      const raw = statsRes.data
      if (raw) {
        setStats({
          totalMembers: raw.totalMembers,
          activeMembers: raw.activeMembers,
          directCount: raw.directCount,
          indirectCount: raw.indirectCount,
          totalContribution: raw.totalContribution,
        })
      } else {
        setStats(null)
      }
      // 格式化日期字段,共享组件只负责渲染
      const rawMembers = membersRes.data?.list ?? []
      setMembers(
        rawMembers.map((m) => ({
          id: m.id,
          nickname: m.nickname,
          avatar: m.avatar,
          level: m.level,
          joinDate: formatDateOnly(m.joinDate),
          contribution: m.contribution,
          status: m.status,
          relation: m.relation,
        })),
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
      onPressMember={(memberId) => navigation.navigate('TeamDetail', { memberId })}
    />
  )
}
