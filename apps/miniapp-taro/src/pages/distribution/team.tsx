import { View, Text, Image, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getDistributionTeam } from '@/api'
import { useI18n } from '@/i18n'
import './team.css'

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

/** 时间戳 → YYYY-MM-DD(与 date-picker 输出格式一致,便于按日筛选) */
const formatDate = (v: number | string): string => {
  const ms = toMs(v)
  if (!ms) return ''
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DistributionTeam() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

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
      result = result.filter((m) => formatDate(m.createdAt) === selectedDate)
    }
    const kw = searchText.trim().toLowerCase()
    if (kw) {
      result = result.filter(
        (m) =>
          m.nickname.toLowerCase().includes(kw) ||
          String(m.orderNum).includes(kw) ||
          formatToYuan(m.transactionVolume).includes(kw) ||
          formatToYuan(m.commission).includes(kw) ||
          formatDate(m.createdAt).includes(kw),
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

  const medalClass = (rank: number) => {
    if (rank === 1) return 'team-medal team-medal-gold'
    if (rank === 2) return 'team-medal team-medal-silver'
    if (rank === 3) return 'team-medal team-medal-bronze'
    return 'team-medal team-medal-normal'
  }

  const medalText = (rank: number) => (rank <= 3 ? `No.${rank}` : `${rank}`)

  return (
    <View className="team-page">
      {/* 搜索栏 */}
      <View className="team-search">
        <Text className="team-search-icon">🔍</Text>
        <Input
          className="team-search-input"
          value={searchText}
          onInput={(e) => setSearchText(e.detail.value)}
          placeholder={tt('distribution.team.searchPlaceholder', '搜索我的团友')}
        />
      </View>

      {/* 团队总人数 */}
      <View className="team-total">
        <Text>{tt('distribution.team.totalMembers', '团队总人数')}:</Text>
        <Text className="team-total-num">{teamTotal}</Text>
      </View>

      {/* 排序 tab */}
      <View className="team-sort">
        <View
          className={`team-sort-btn ${activeTab === 'orderNum' ? 'team-sort-btn-active' : ''}`}
          onClick={() => setActiveTab('orderNum')}
        >
          <Text>{tt('distribution.team.sortByOrderNum', '成交订单数')}</Text>
        </View>
        <Picker
          mode="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.detail.value)
            setActiveTab('date')
          }}
        >
          <View
            className={`team-sort-btn ${activeTab === 'date' ? 'team-sort-btn-active' : ''}`}
          >
            <Text>{selectedDate || tt('distribution.team.sortByDate', '邀请时间')}</Text>
            <Text className="team-sort-arrow">▾</Text>
          </View>
        </Picker>
      </View>

      {/* 成员列表 */}
      {displayList.length > 0 && (
        <View className="team-list">
          {displayList.map((m, idx) => {
            const rank = idx + 1
            return (
              <View key={m.id} className="team-card">
                <View className="team-card-left">
                  <View className="team-avatar-wrap">
                    {m.avatar ? (
                      <Image className="team-avatar" src={m.avatar} mode="aspectFill" />
                    ) : (
                      <View className="team-avatar team-avatar-fallback">
                        <Text className="team-avatar-text">{m.nickname.charAt(0) || '?'}</Text>
                      </View>
                    )}
                    <View className={medalClass(rank)}>
                      <Text>{medalText(rank)}</Text>
                    </View>
                  </View>
                  <Text className="team-nickname">{m.nickname}</Text>
                </View>

                <View className="team-info">
                  <View className="team-info-row">
                    <View className="team-info-group">
                      <Text className="team-info-label">
                        {tt('distribution.team.transactionVolume', '成交额')}
                      </Text>
                      <Text className="team-info-value">¥{formatToYuan(m.transactionVolume)}</Text>
                    </View>
                    <View className="team-info-group">
                      <Text className="team-info-label">
                        {tt('distribution.team.commission', '获取佣金')}
                      </Text>
                      <Text className="team-info-value">¥{formatToYuan(m.commission)}</Text>
                    </View>
                  </View>
                  <View className="team-info-row">
                    <View className="team-info-group">
                      <Text className="team-info-label">
                        {tt('distribution.team.orderNum', '成交订单数')}
                      </Text>
                      <Text className="team-info-value">{m.orderNum}</Text>
                    </View>
                  </View>
                  <View className="team-info-row">
                    <Text className="team-info-time">
                      {tt('distribution.team.joinTime', '邀请时间')}: {formatDate(m.createdAt) || '-'}
                    </Text>
                    <Text className="team-sub-btn" onClick={() => goSubordinates(m.id)}>
                      {tt('distribution.team.viewSubordinates', '查看下级')}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* 状态文案 */}
      {displayList.length === 0 && !loading && !error && (
        <Text className="team-empty">{tt('distribution.team.empty', '暂无团队成员')}</Text>
      )}
      {error && !loading && (
        <View className="team-error" onClick={() => load(true)}>
          <Text className="team-error-text">{tt('distribution.team.error', '加载失败')}</Text>
          <Text className="team-error-retry">{tt('distribution.team.retry', '点击重试')}</Text>
        </View>
      )}
      {loading && (
        <Text className="team-loading">{tt('distribution.team.loading', '加载中...')}</Text>
      )}
      {!loading && !hasMore && displayList.length > 0 && (
        <Text className="team-no-more">{tt('distribution.team.noMore', '没有更多了')}</Text>
      )}
    </View>
  )
}
