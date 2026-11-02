// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getDistributionTree, getTeamMembers, getTeamStats } from '@ihui/api-client'
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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
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
      members={members}
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
