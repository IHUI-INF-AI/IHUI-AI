// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTeamMembers, getTeamStats } from '@ihui/api-client'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import {
  TeamScreen as SharedTeamScreen,
  type TeamStats,
  type TeamMember,
  type TeamTab,
  type TeamSortTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 分页大小(对齐 Uniapp distribution_personnel_list pageSize: 10) */
const PAGE_SIZE = 10

export function TeamScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState<TeamTab>('all')
  // 搜索关键词(对齐 Uniapp distribution_personnel_list InputArea「搜索我的团友」)
  const [keyword, setKeyword] = useState('')
  // 排序方式 + 邀请时间筛选日期(对齐 Uniapp activeTab:成交订单数/邀请时间 + picker mode=date)
  const [sortTab, setSortTab] = useState<TeamSortTab>('orderNum')
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  // 分页状态(对齐 Uniapp pageNum/teamTotal:originalTeamList.length < teamTotal 时触底追加)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const totalRef = useRef(0)

  const load = useCallback(
    async (mode: 'refresh' | 'more' = 'refresh') => {
      if (mode === 'refresh') {
        if (refreshing) return
        setRefreshing(true)
      } else {
        setLoadingMore(true)
      }
      setError('')
      // 2026-08-21:历史 fetchApi('/team/stats'|'/team/members') 在后端不存在(404),
      // 迁移到真实端点 /distribution/team/*(对齐 Uniapp distribution_personnel_list)。
      const nextPage = mode === 'more' ? pageRef.current + 1 : 1
      const [statsRes, membersRes] = await Promise.all([
        getTeamStats(),
        getTeamMembers({ page: nextPage, pageSize: PAGE_SIZE }),
      ])
      if (!statsRes.success || !membersRes.success) {
        setError(t('team.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
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
      // 格式化日期字段,共享组件只负责渲染;业绩字段直传(分,展示层 formatToYuan)
      const rawMembers = membersRes.data?.list ?? []
      const mapped = rawMembers.map((m) => ({
        id: m.id,
        nickname: m.nickname,
        avatar: m.avatar,
        level: m.level,
        joinDate: formatDateOnly(m.joinDate),
        contribution: m.contribution,
        status: m.status,
        relation: m.relation,
        transactionVolume: m.transactionVolume,
        commission: m.commission,
        orderNum: m.orderNum,
      }))
      // 对齐 Uniapp listOrder:originalTeamList = originalTeamList.concat(res.data)
      setMembers((prev) => (mode === 'more' ? [...prev, ...mapped] : mapped))
      pageRef.current = nextPage
      // 对齐 Uniapp teamTotal + scrolltolower 守卫:originalTeamList.length < teamTotal
      totalRef.current =
        typeof membersRes.data?.total === 'number'
          ? membersRes.data.total
          : mode === 'more'
            ? totalRef.current
            : mapped.length
      setHasMore(nextPage * PAGE_SIZE < totalRef.current)
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    },
    [t, refreshing],
  )

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 排序+日期筛选(对齐 Uniapp updateDisplayList:纯客户端,排序 by orderNum/joinDate) */
  const displayMembers: TeamMember[] = (() => {
    let result = members
    if (sortTab === 'inviteTime' && selectedDate) {
      result = result.filter((m) => m.joinDate === selectedDate)
    }
    if (sortTab === 'orderNum') {
      result = [...result].sort((a, b) => (b.orderNum ?? 0) - (a.orderNum ?? 0))
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime(),
      )
    }
    return result
  })()

  /** 排序切换(对齐 Uniapp switchTab/onDateChange:选邀请时间时重置日期为空待选) */
  const handleSelectSortTab = (tab: TeamSortTab): void => {
    if (sortTab === tab) return
    setSortTab(tab)
    if (tab === 'inviteTime') setSelectedDate('')
  }

  return (
    <SharedTeamScreen
      t={t}
      stats={stats}
      members={displayMembers}
      activeTab={activeTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      sortTab={sortTab}
      onSelectSortTab={handleSelectSortTab}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onSelectTab={setActiveTab}
      onRefresh={() => void load('refresh')}
      onLoadMore={() => void load('more')}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onBack={() => navigation.goBack()}
      onPressMember={(memberId) => navigation.navigate('TeamDetail', { memberId })}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
