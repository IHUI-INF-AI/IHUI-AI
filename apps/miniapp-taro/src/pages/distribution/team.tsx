// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/team/TeamScreen.tsx(团队**成员列表**共享屏)

import { useTt, useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useEffect, useMemo } from 'react'
import { getDistributionTeam } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { formatDateByTemplate } from '@ihui/shared'
import { formatPrice } from '@ihui/shared/utils/format'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  TeamScreen as SharedTeamScreen,
  type TeamMember,
} from '@ihui/rn-app/features/team/TeamScreen'

/** 页面数据层行:共享 TeamMember 的必需字段 + 本页筛选/排序/指标展示所需字段 */
interface TeamMemberRow extends TeamMember {
  createdAt: number | string
  transactionVolume: number
  orderNum: number
}

type SortTab = 'orderNum' | 'date'

const PAGE_SIZE = 20

/** 时间戳(秒/毫秒)或 ISO 字符串 → 毫秒数 */
const toMs = (v: number | string): number => {
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000
  const n = Number(v)
  if (!isNaN(n) && n > 0) return n > 1e12 ? n : n * 1000
  const d = Date.parse(v)
  return isNaN(d) ? 0 : d
}

export default function DistributionTeam() {
  const tt = useTt()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()

  const [rawList, setRawList] = useState<TeamMemberRow[]>([])
  const [displayList, setDisplayList] = useState<TeamMemberRow[]>([])
  const [teamTotal, setTeamTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<SortTab>('orderNum')
  const [selectedDate, setSelectedDate] = useState('')

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      setError(null)
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getDistributionTeam({ page: pageRef.current, pageSize: PAGE_SIZE })
      const rows = (res.list || []) as Array<Record<string, unknown>>
      const items: TeamMemberRow[] = rows.map((u) => {
        const createdAt = (u.createdAt as number | string) ?? (u.joinTime as string) ?? ''
        return {
          id: String(u.id ?? ''),
          nickname:
            (u.nickname as string) ||
            (u.username as string) ||
            tt('distribution.team.member', '成员'),
          avatar: (u.avatar as string) || null,
          level: Number(u.level ?? 1),
          joinDate: formatDateByTemplate(createdAt, 'YYYY-MM-DD'),
          contribution: Number(u.commission ?? 0),
          createdAt,
          createdAtLabel: formatDateByTemplate(createdAt, 'YYYY-MM-DD'),
          transactionVolume: Number(u.transactionVolume ?? 0),
          orderNum: Number(u.orderNum ?? 0),
        }
      })
      setRawList((prev) => (reset ? items : [...prev, ...items]))
      setTeamTotal(res.total ?? (reset ? items.length : teamTotal))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch {
      setError(tt('distribution.team.error', '加载失败'))
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  // G-933 冷启动抢跑门控:GET /api/distribution/invited-users 属需鉴权端点
  // (`apps/api/src/routes/distribution.ts:24` addHook authenticate)。
  // 触底翻页是用户动作,那时早已落定,不加门;由共享屏 onEndReached 承接。
  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load(true)
    })
  })

  // 客户端:日期筛选 + 关键词搜索 + 排序(对齐原 uniapp updateDisplayList)
  useEffect(() => {
    let result = [...rawList]
    if (activeTab === 'date' && selectedDate) {
      result = result.filter(
        (m) => formatDateByTemplate(m.createdAt, 'YYYY-MM-DD') === selectedDate,
      )
    }
    const kw = searchText.trim().toLowerCase()
    if (kw) {
      result = result.filter(
        (m) =>
          m.nickname.toLowerCase().includes(kw) ||
          String(m.orderNum).includes(kw) ||
          formatPrice(m.transactionVolume).includes(kw) ||
          formatPrice(m.contribution).includes(kw) ||
          formatDateByTemplate(m.createdAt, 'YYYY-MM-DD').includes(kw),
      )
    }
    if (activeTab === 'orderNum') {
      result.sort((a, b) => b.orderNum - a.orderNum)
    } else {
      result.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
    }
    setDisplayList(result)
  }, [rawList, activeTab, selectedDate, searchText])

  const goSubordinates = (id: string) => {
    Taro.navigateTo({ url: `/pages/distribution/member-detail/index?id=${id}` })
  }

  /** 日期弹层选项:由已算好的 createdAtLabel(YYYY-MM-DD)去重升序得出 */
  const dateOptions = useMemo(() => {
    const dates = new Set<string>()
    rawList.forEach((m) => {
      if (m.createdAtLabel) dates.add(m.createdAtLabel)
    })
    return Array.from(dates).sort()
  }, [rawList])

  /**
   * 手工迁移(批 5, A 方案):原 339 行复制页 → 直载 team/TeamScreen 共享屏。
   * 团队总人数行留在本页(共享屏统计卡已有团队人数);排序胶囊/日期弹层/成员指标/名次徽标
   * 以显式 props 注入 —— 这些数据 RN 同样拿得到并真消费,不是小程序独有代码搬进共享包。
   */
  return (
    <ThemeRoot className="min-h-screen bg-background">
      {/* 团队总人数 — 小程序特有统计行(本页内渲染,不进共享屏) */}
      <View className="mx-[20rpx] mt-[16rpx]">
        <Text className="text-body text-muted-foreground">
          {tt('distribution.team.totalMembers', '团队总人数')}:
          <Text className="font-semibold text-foreground">{teamTotal}</Text>
        </Text>
      </View>
      <SharedTeamScreen
        t={t}
        stats={undefined}
        members={displayList}
        activeTab="all"
        loading={loading && displayList.length === 0}
        refreshing={false}
        error={error ?? ''}
        onSelectTab={() => {}}
        onRefresh={() => void load(true)}
        onBack={() => void Taro.navigateBack()}
        onRetry={() => void load(true)}
        keyword={searchText}
        onKeywordChange={setSearchText}
        onEndReached={() => void load()}
        loadingMore={loading && displayList.length > 0}
        hasMore={hasMore}
        footerLoadingText={tt('distribution.team.loading', '加载中...')}
        footerNoMoreText={tt('distribution.team.noMore', '没有更多了')}
        emptyText={tt('distribution.team.empty', '暂无团队成员')}
        colorScheme={resolvedTheme}
        showHeader={false}
        showTabs={false}
        sortBar={{
          orderLabel: tt('distribution.team.sortByOrderNum', '成交订单数'),
          dateLabel: tt('distribution.team.sortByDate', '邀请时间'),
          active: activeTab,
          dateValue: selectedDate,
          onSelectOrder: () => setActiveTab('orderNum'),
        }}
        dateOptions={dateOptions}
        showRankBadge
        onSelectDate={(date) => {
          setSelectedDate(date)
          setActiveTab(date ? 'date' : 'orderNum')
        }}
        memberMetrics={{
          transactionVolume: tt('distribution.team.transactionVolume', '成交额'),
          commission: tt('distribution.team.commission', '获取佣金'),
          orderNum: tt('distribution.team.orderNum', '成交订单数'),
          joinTime: tt('distribution.team.joinTime', '邀请时间'),
          viewSubordinates: tt('distribution.team.viewSubordinates', '查看下级'),
        }}
        onPressMember={(memberId) => goSubordinates(memberId)}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
