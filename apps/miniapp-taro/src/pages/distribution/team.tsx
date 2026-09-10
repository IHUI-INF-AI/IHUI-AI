// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, Image, Input, Picker } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getDistributionTeam } from '@/api'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'

interface TeamMember {
  id: string
  nickname: string
  avatar?: string
  createdAt: number | string
  transactionVolume: number
  commission: number
  orderNum: number
}

type SortTab = 'orderNum' | 'date'

const PAGE_SIZE = 20

/** 分 → 元 */
const formatToYuan = (cents: number) => {
  if (!cents) return '0.00'
  return (cents / 100).toFixed(2)
}

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

  const [rawList, setRawList] = useState<TeamMember[]>([])
  const [displayList, setDisplayList] = useState<TeamMember[]>([])
  const [teamTotal, setTeamTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
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
      setError(false)
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getDistributionTeam({ page: pageRef.current, pageSize: PAGE_SIZE })
      const rows = (res.list || []) as Array<Record<string, unknown>>
      const items: TeamMember[] = rows.map((u) => ({
        id: String(u.id ?? ''),
        nickname:
          (u.nickname as string) ||
          (u.username as string) ||
          tt('distribution.team.member', '成员'),
        avatar: (u.avatar as string) || undefined,
        createdAt: (u.createdAt as number | string) ?? (u.joinTime as string) ?? '',
        transactionVolume: Number(u.transactionVolume ?? 0),
        commission: Number(u.commission ?? 0),
        orderNum: Number(u.orderNum ?? 0),
      }))
      setRawList((prev) => (reset ? items : [...prev, ...items]))
      setTeamTotal(res.total ?? (reset ? items.length : teamTotal))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch {
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useDidShow(() => {
    load(true)
  })

  useReachBottom(() => {
    load()
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
          formatToYuan(m.transactionVolume).includes(kw) ||
          formatToYuan(m.commission).includes(kw) ||
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

  /* 对齐原奖牌配色(已 token 化:--color-rank-gold/silver/bronze),转为 tailwind 任意值类 */
  const medalClass = (rank: number) => {
    if (rank === 1) return 'bg-[var(--color-rank-gold)] text-muted-foreground'
    if (rank === 2) return 'bg-[var(--color-rank-silver)] text-muted-foreground'
    if (rank === 3) return 'bg-[var(--color-rank-bronze)] text-foreground'
    return 'bg-[var(--color-muted)] text-muted-foreground'
  }

  const medalText = (rank: number) => (rank <= 3 ? `No.${rank}` : `${rank}`)

  /* 对齐 RN TeamScreen(packages/app 共享屏):搜索框 card 底 + 描边 24rpx 圆角 40dp→80rpx 高,
     tab 胶囊 24rpx 圆角 active 品牌底,成员卡 surface.bg 底 + 描边 + 44dp→88rpx 圆头像;
     奖牌/团队总人数行/查看下级按钮为小程序特有静态元素,按 RN 卡片与按钮语言收敛 */
  return (
    <ThemeRoot className="min-h-screen bg-background pb-[64rpx]">
      {/* 对齐 RN TeamScreen searchRow/searchInput:px 10dp→20rpx pb 8dp→16rpx;高 40dp→80rpx */}
      <View className="mx-[20rpx] mt-[20rpx] flex flex-row items-center h-[80rpx] px-[24rpx] rounded-[24rpx] border border-border bg-card">
        <LineIcon
          className="mr-[16rpx] flex-shrink-0"
          name="search"
          size={40}
          color="var(--color-muted-foreground)"
        />
        <Input
          className="flex-1 text-[28rpx] text-foreground"
          value={searchText}
          onInput={(e) => setSearchText(e.detail.value)}
          placeholder={tt('distribution.team.searchPlaceholder', '搜索我的团友')}
          placeholder-style="color: var(--color-text-tertiary)"
        />
      </View>

      {/* 团队总人数 — 小程序特有统计行,按 RN 文字层级着色 */}
      <View className="mx-[20rpx] mt-[16rpx]">
        <Text className="text-[28rpx] text-muted-foreground">
          {tt('distribution.team.totalMembers', '团队总人数')}:
          <Text className="font-semibold text-foreground">{teamTotal}</Text>
        </Text>
      </View>

      {/* 对齐 RN tabs:py 8dp→16rpx gap 6dp→12rpx;tab px 12dp→24rpx py 6dp→12rpx 圆角 24rpx */}
      <View className="px-[20rpx] py-[16rpx] flex flex-row gap-[12rpx]">
        <View
          className={`flex-1 flex items-center justify-center py-[12rpx] rounded-[24rpx] ${activeTab === 'orderNum' ? 'bg-primary' : 'bg-card'}`}
          onClick={() => setActiveTab('orderNum')}
          hoverClass="opacity-60"
        >
          <Text
            className={`text-[28rpx] ${activeTab === 'orderNum' ? 'text-[var(--color-primary-foreground)] font-semibold' : 'text-muted-foreground'}`}
          >
            {tt('distribution.team.sortByOrderNum', '成交订单数')}
          </Text>
        </View>
        <Picker
          mode="date"
          value={selectedDate}
          className="flex-1 min-w-0"
          onChange={(e) => {
            setSelectedDate(e.detail.value)
            setActiveTab('date')
          }}
        >
          <View
            className={`w-full flex items-center justify-center gap-[8rpx] py-[12rpx] rounded-[24rpx] ${activeTab === 'date' ? 'bg-primary' : 'bg-card'}`}
          >
            <Text
              className={`text-[28rpx] ${activeTab === 'date' ? 'text-[var(--color-primary-foreground)] font-semibold' : 'text-muted-foreground'}`}
            >
              {selectedDate || tt('distribution.team.sortByDate', '邀请时间')}
            </Text>
            <LineIcon
              name="chevron-down"
              size={24}
              color={
                activeTab === 'date'
                  ? 'var(--color-primary-foreground)'
                  : 'var(--color-muted-foreground)'
              }
            />
          </View>
        </Picker>
      </View>

      {/* 对齐 RN listBody:padding 14dp→28rpx + 卡片间 8dp→16rpx */}
      {displayList.length > 0 && (
        <View className="px-[20rpx] flex flex-col gap-[16rpx]">
          {displayList.map((m, idx) => {
            const rank = idx + 1
            return (
              <View
                key={m.id}
                className="flex flex-row items-start rounded-[24rpx] border border-border bg-background p-[28rpx]"
              >
                <View className="flex flex-col items-center flex-shrink-0 mr-[20rpx]">
                  <View className="relative w-[88rpx] h-[88rpx]">
                    {m.avatar ? (
                      <Image
                        className="w-[88rpx] h-[88rpx] rounded-full"
                        src={m.avatar}
                        mode="aspectFill"
                      />
                    ) : (
                      <View className="w-[88rpx] h-[88rpx] rounded-full bg-[var(--color-muted)] items-center justify-center">
                        <Text className="text-[36rpx] font-semibold text-muted-foreground">
                          {m.nickname.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <View
                      className={`absolute left-0 top-[-8rpx] min-w-[56rpx] h-[56rpx] px-[8rpx] flex items-center justify-center rounded-[8rpx] z-10 ${medalClass(rank)}`}
                    >
                      <Text className="text-[18rpx] font-bold">{medalText(rank)}</Text>
                    </View>
                  </View>
                  <Text className="mt-[12rpx] text-[24rpx] text-foreground max-w-[88rpx] truncate">
                    {m.nickname}
                  </Text>
                </View>

                <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
                  <View className="flex flex-row justify-between items-center">
                    <View className="flex flex-row items-baseline gap-[8rpx]">
                      <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                        {tt('distribution.team.transactionVolume', '成交额')}
                      </Text>
                      <Text className="text-[28rpx] font-semibold text-foreground">
                        ¥{formatToYuan(m.transactionVolume)}
                      </Text>
                    </View>
                    <View className="flex flex-row items-baseline gap-[8rpx]">
                      <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                        {tt('distribution.team.commission', '获取佣金')}
                      </Text>
                      <Text className="text-[28rpx] font-semibold text-foreground">
                        ¥{formatToYuan(m.commission)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex flex-row items-center">
                    <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                      {tt('distribution.team.orderNum', '成交订单数')}
                    </Text>
                    <Text className="ml-[8rpx] text-[28rpx] font-semibold text-foreground">
                      {m.orderNum}
                    </Text>
                  </View>
                  <View className="flex flex-row items-center justify-between">
                    <Text className="flex-1 text-[22rpx] text-[var(--color-text-tertiary)] truncate">
                      {tt('distribution.team.joinTime', '邀请时间')}:{' '}
                      {formatDateByTemplate(m.createdAt, 'YYYY-MM-DD') || '-'}
                    </Text>
                    <View
                      className="ml-[16rpx] px-[24rpx] h-[56rpx] rounded-[24rpx] bg-primary flex items-center justify-center flex-shrink-0"
                      onClick={() => goSubordinates(m.id)}
                      hoverClass="opacity-60"
                    >
                      <Text className="text-[24rpx] text-[var(--color-primary-foreground)]">
                        {tt('distribution.team.viewSubordinates', '查看下级')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* 状态文案 */}
      {displayList.length === 0 && !loading && !error && (
        <View className="py-[64rpx] text-center">
          <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">
            {tt('distribution.team.empty', '暂无团队成员')}
          </Text>
        </View>
      )}
      {error && !loading && (
        <View className="flex flex-col items-center py-[48rpx] gap-[24rpx]">
          <Text className="text-[28rpx] text-muted-foreground text-center">
            {tt('distribution.team.error', '加载失败')}
          </Text>
          <View
            className="px-[40rpx] h-[72rpx] rounded-[20rpx] bg-primary flex items-center justify-center"
            onClick={() => load(true)}
            hoverClass="opacity-60"
          >
            <Text className="text-[28rpx] font-medium text-[var(--color-primary-foreground)]">
              {tt('distribution.team.retry', '点击重试')}
            </Text>
          </View>
        </View>
      )}
      {loading && (
        <Text className="block text-center text-[28rpx] text-[var(--color-text-tertiary)] py-[48rpx]">
          {tt('distribution.team.loading', '加载中...')}
        </Text>
      )}
      {!loading && !hasMore && displayList.length > 0 && (
        <Text className="block text-center text-[28rpx] text-[var(--color-text-tertiary)] py-[48rpx]">
          {tt('distribution.team.noMore', '没有更多了')}
        </Text>
      )}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
