// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getDistributionTree,
  getTeamMembers,
  getTeamStats,
  type TeamMemberItem,
} from '@ihui/api-client'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import {
  TeamScreen as SharedTeamScreen,
  type TeamStats,
  type TeamMember,
  type TeamTreeNode,
  type TeamTab,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/** 接口行 → 共享屏 TeamMember(日期格式化在数据层完成,共享屏只渲染) */
function toMember(m: TeamMemberItem): TeamMember {
  return {
    id: m.id,
    nickname: m.nickname,
    avatar: m.avatar,
    level: m.level,
    joinDate: formatDateOnly(m.joinDate),
    contribution: m.contribution,
    status: m.status,
    relation: m.relation,
    transactionVolume: m.transactionVolume,
    orderNum: m.orderNum,
    createdAtLabel: formatDateOnly(m.joinDate),
  }
}

export function TeamScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activeTab, setActiveTab] = useState<TeamTab>('all')
  // 搜索关键词(对齐 Uniapp distribution_personnel_list InputArea「搜索我的团友」)
  const [keyword, setKeyword] = useState('')
  // 排序/日期筛选:数据层留在本屏,共享屏只渲染
  const [sortBy, setSortBy] = useState<'orderNum' | 'date'>('orderNum')
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  // 分页:与小程序 distribution/team 同语义(page 从 1 起、PAGE_SIZE=20、按 total 决定 hasMore)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingMoreRef = useRef(false)
  // 分销层级树(未登录保持 undefined ⇒ 共享屏不渲染树区块)
  const [tree, setTree] = useState<TeamTreeNode[] | undefined>(undefined)
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeFailed, setTreeFailed] = useState(false)
  const [treeTotalLevels, setTreeTotalLevels] = useState(0)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      // 2026-08-21:历史 fetchApi('/team/stats'|'/team/members') 在后端不存在(404),
      // 迁移到真实端点 /distribution/team/*(对齐 Uniapp distribution_personnel_list)。
      const [statsRes, membersRes] = await Promise.all([
        getTeamStats(),
        getTeamMembers({ page: 1, pageSize: PAGE_SIZE }),
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
          monthNew: raw.monthNew,
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
      setMembers(rawMembers.map(toMember))
      const more = PAGE_SIZE < (membersRes.data?.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  /** 触底翻页:loadingMore/无更多时防重入,成功后 page+1 并追加成员 */
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      const res = await getTeamMembers({ page: nextPage, pageSize: PAGE_SIZE })
      if (!res.success) {
        setError(t('team.loadFailed'))
        return
      }
      const rawMembers = res.data?.list ?? []
      setMembers((prev) => [...prev, ...rawMembers.map(toMember)])
      pageRef.current = nextPage
      const more = nextPage * PAGE_SIZE < (res.data?.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
    } catch {
      setError(t('team.loadFailed'))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  /** 日期弹层选项:成员 createdAtLabel(YYYY-MM-DD)去重升序,最多 12 个 */
  const dateOptions = useMemo(() => {
    const dates = new Set<string>()
    members.forEach((m) => {
      if (m.createdAtLabel) dates.add(m.createdAtLabel)
    })
    return Array.from(dates).sort().slice(0, 12)
  }, [members])

  /** 排序/日期过滤后的成员列表 */
  const sortedMembers = useMemo(() => {
    let result = [...members]
    if (sortBy === 'date' && selectedDate) {
      result = result.filter((m) => m.createdAtLabel === selectedDate)
    }
    if (sortBy === 'orderNum') {
      result.sort((a, b) => (b.orderNum ?? 0) - (a.orderNum ?? 0))
    } else {
      result.sort((a, b) => (b.createdAtLabel ?? '').localeCompare(a.createdAtLabel ?? ''))
    }
    return result
  }, [members, sortBy, selectedDate])

  // 层级树独立请求:失败只置树区块错误态,不影响统计区/成员列表
  const loadTree = useCallback(async () => {
    setTreeLoading(true)
    setTreeFailed(false)
    try {
      const res = await getDistributionTree()
      if (!res.success) {
        setTreeFailed(true)
        return
      }
      setTree(res.data?.tree ?? [])
      setTreeTotalLevels(res.data?.totalLevels ?? 0)
    } catch {
      setTreeFailed(true)
    } finally {
      setTreeLoading(false)
    }
  }, [])

  useEffect(() => {
    // 未登录:清零所有树状态且不发注定 401 的请求(共享屏据此不渲染树区块)
    if (!user) {
      setTree(undefined)
      setTreeTotalLevels(0)
      setTreeFailed(false)
      setTreeLoading(false)
      return
    }
    void loadTree()
  }, [user, loadTree])

  return (
    <SharedTeamScreen
      t={t}
      stats={stats}
      members={sortedMembers}
      statsLayout="full"
      sortBar={{
        orderLabel: t('teamDetail.orderNum'),
        dateLabel: t('team.joinDate'),
        active: sortBy,
        dateValue: selectedDate,
        onSelectOrder: () => setSortBy('orderNum'),
      }}
      dateOptions={dateOptions}
      showRankBadge
      onSelectDate={(date) => {
        setSelectedDate(date)
        setSortBy(date ? 'date' : 'orderNum')
      }}
      memberMetrics={{
        transactionVolume: t('teamDetail.transactionVolume'),
        commission: t('teamDetail.commission'),
        orderNum: t('teamDetail.orderNum'),
        joinTime: t('team.joinDate'),
        viewSubordinates: t('distributionCompany.subordinates'),
      }}
      activeTab={activeTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onSelectTab={setActiveTab}
      onRefresh={() => {
        void load(true)
        if (user) void loadTree()
      }}
      onBack={() => navigation.goBack()}
      onPressMember={(memberId) => navigation.navigate('TeamDetail', { memberId })}
      onEndReached={() => void loadMore()}
      loadingMore={loadingMore}
      hasMore={hasMore}
      tree={user ? tree : undefined}
      treeLoading={user ? treeLoading : false}
      treeFailed={user ? treeFailed : false}
      treeTotalLevels={user ? treeTotalLevels : undefined}
      onRetryTree={user ? () => void loadTree() : undefined}
      onPressTreeMember={(memberId) => navigation.navigate('TeamDetail', { memberId })}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
