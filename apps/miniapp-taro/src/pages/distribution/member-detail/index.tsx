// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/team/TeamScreen.tsx(团队**成员列表**共享屏)

import { useTt, useI18n } from '@/i18n'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  TeamScreen as SharedTeamScreen,
  type TeamMember,
  type TeamStats,
} from '@ihui/rn-app/features/team/TeamScreen'

const PAGE_SIZE = 20

/**
 * 手工迁移(批 4):原 242 行自绘列表 → 直载 team/TeamScreen 共享屏。
 * 缺的只是「紧凑 3 列统计卡 / 分区标题 / 分页尾」三件 → 共享屏以显式 props 承担
 * (statsLayout="compact" + compactStatsLabels + listTitle + footer 文案 + onEndReached)。
 * 数据腿与本端旧行为逐字同:GET /api/distribution/overview(3 个真实字段) +
 * GET /api/distribution/team 分页(pageSize 20);成员缺口字段(status/relation)不注入,
 * 共享屏按缺字段不渲染徽标。
 */
export default function MemberDetail() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const firstLoadRef = useRef(true)

  const loadStats = async () => {
    try {
      const info = (await api.getDistributionInfo()) as unknown as Record<string, unknown>
      setStats({
        totalMembers: (info.teamCount as number) ?? 0,
        monthNew: (info.monthNew as number) ?? 0,
        totalContribution: (info.totalCommission as number) ?? 0,
      })
    } catch (e) {
      logger.error('unknown', '加载团队统计', e)
    }
  }

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      setMembers([])
      setError('')
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    if (reset && firstLoadRef.current) setLoading(true)
    else if (!reset) setLoadingMore(true)
    try {
      const res = (await api.getDistributionTeam({
        page: pageRef.current,
        pageSize: PAGE_SIZE,
      })) as unknown as {
        list: Array<Record<string, unknown>>
        total: number
      }
      const items: TeamMember[] = (res.list || []).map((u) => ({
        id: String(u.id ?? ''),
        nickname:
          (u.nickname as string) ||
          (u.username as string) ||
          tt('distribution.memberDetail.member', '成员'),
        avatar: (u.avatar as string) ?? null,
        level: (u.level as number) ?? 1,
        joinDate: (u.createdAt as string) || (u.joinTime as string) || '',
        contribution: (u.contribution as number) ?? (u.commission as number) ?? 0,
      }))
      setMembers((prev) => (reset ? items : [...prev, ...items]))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch (e) {
      logger.error('unknown', '加载团队成员', e)
      setError(tt('distribution.memberDetail.error', '加载失败'))
    } finally {
      loadingRef.current = false
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }

  const reload = () => {
    setRefreshing(true)
    void loadStats()
    void load(true)
  }

  // G-933 冷启动抢跑门控:GET /api/distribution/overview 与 /distribution/team
  // 都在 distributionRoutes 统一 preHandler 之下(apps/api/src/routes/distribution.ts:24)⇒ 需鉴权。
  useDidShow(() => {
    gate.waitUntilReady(() => {
      void loadStats()
      void load(true)
    })
  })

  usePullDownRefresh(() => {
    Promise.all([loadStats(), load(true)]).finally(() => {
      setRefreshing(false)
      Taro.stopPullDownRefresh()
    })
  })

  return (
    <ThemeRoot className="min-h-screen bg-background">
      <SharedTeamScreen
        t={t}
        stats={stats}
        members={members}
        activeTab="all"
        loading={loading}
        refreshing={refreshing}
        error={error}
        onSelectTab={() => {}}
        onRefresh={reload}
        onBack={() => void Taro.navigateBack()}
        onRetry={reload}
        colorScheme={resolvedTheme}
        statsLayout="compact"
        compactStatsLabels={{
          totalMembers: tt('distribution.memberDetail.teamCount', '团队人数'),
          monthNew: tt('distribution.memberDetail.monthNew', '本月新增'),
          totalContribution: tt('distribution.memberDetail.totalCommission', '总佣金'),
        }}
        showHeader={false}
        showTabs={false}
        listTitle={tt('distribution.memberDetail.memberList', '成员列表')}
        onEndReached={() => void load()}
        loadingMore={loadingMore}
        hasMore={hasMore}
        footerLoadingText={tt('distribution.memberDetail.loading', '加载中…')}
        footerNoMoreText={tt('distribution.memberDetail.noMore', '没有更多了')}
        emptyText={tt('distribution.memberDetail.empty', '暂无成员')}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
