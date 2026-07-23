import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './index.css'

interface MemberItem {
  id: string
  nickname: string
  avatar?: string
  level: number
  joinTime: string
  contribution: number
}

interface Stats {
  teamCount: number
  monthNew: number
  totalCommission: number
}

const PAGE_SIZE = 20

export default function MemberDetail() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }
  const [list, setList] = useState<MemberItem[]>([])
  const [stats, setStats] = useState<Stats>({ teamCount: 0, monthNew: 0, totalCommission: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const loadStats = async () => {
    try {
      const info = (await api.getDistributionInfo()) as unknown as Record<string, unknown>
      setStats({
        teamCount: (info.teamCount as number) ?? 0,
        monthNew: (info.monthNew as number) ?? 0,
        totalCommission: (info.totalCommission as number) ?? 0,
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
      setList([])
      setError(false)
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = (await api.getDistributionTeam({
        page: pageRef.current,
        pageSize: PAGE_SIZE,
      })) as unknown as {
        list: Array<Record<string, unknown>>
        total: number
      }
      const items: MemberItem[] = (res.list || []).map((u) => ({
        id: String(u.id ?? ''),
        nickname:
          (u.nickname as string) ||
          (u.username as string) ||
          tt('distribution.memberDetail.member', '成员'),
        avatar: (u.avatar as string) ?? undefined,
        level: (u.level as number) ?? 1,
        joinTime: (u.createdAt as string) || (u.joinTime as string) || '',
        contribution:
          (u.contribution as number) ?? (u.commission as number) ?? 0,
      }))
      setList((prev) => (reset ? items : [...prev, ...items]))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch (e) {
      logger.error('unknown', '加载团队成员', e)
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useDidShow(() => {
    loadStats()
    load(true)
  })

  useReachBottom(() => {
    load()
  })

  usePullDownRefresh(() => {
    Promise.all([loadStats(), load(true)]).finally(() => Taro.stopPullDownRefresh())
  })

  return (
    <View className="md-page">
      <View className="md-stats">
        <View className="md-stat-item">
          <Text className="md-stat-value">{stats.teamCount}</Text>
          <Text className="md-stat-label">
            {tt('distribution.memberDetail.teamCount', '团队人数')}
          </Text>
        </View>
        <View className="md-stat-item">
          <Text className="md-stat-value">{stats.monthNew}</Text>
          <Text className="md-stat-label">
            {tt('distribution.memberDetail.monthNew', '本月新增')}
          </Text>
        </View>
        <View className="md-stat-item">
          <Text className="md-stat-value">¥{stats.totalCommission}</Text>
          <Text className="md-stat-label">
            {tt('distribution.memberDetail.totalCommission', '总佣金')}
          </Text>
        </View>
      </View>

      <View className="md-list-section">
        <Text className="md-list-title">
          {tt('distribution.memberDetail.memberList', '成员列表')}
        </Text>

        {list.length > 0 && (
          <View className="md-list">
            {list.map((m) => (
              <View key={m.id} className="md-member-card">
                {m.avatar ? (
                  <Image className="md-avatar" src={m.avatar} mode="aspectFill" />
                ) : (
                  <View className="md-avatar md-avatar-fallback">
                    <Text className="md-avatar-text">{m.nickname.charAt(0) || '?'}</Text>
                  </View>
                )}
                <View className="md-member-info">
                  <View className="md-member-top">
                    <Text className="md-member-name">{m.nickname}</Text>
                    <Text className="md-member-level">V{m.level}</Text>
                  </View>
                  <View className="md-member-bottom">
                    <Text className="md-member-time">
                      {tt('distribution.memberDetail.joinTime', '加入')}:{m.joinTime || '-'}
                    </Text>
                    <Text className="md-member-contribution">
                      {tt('distribution.memberDetail.contribution', '贡献')} ¥{m.contribution}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {list.length === 0 && !loading && !error && (
          <Text className="md-empty">{t('distribution.memberDetail.empty')}</Text>
        )}

        {error && !loading && (
          <View className="md-error" onClick={() => load(true)}>
            <Text className="md-error-text">
              {tt('distribution.memberDetail.error', '加载失败')}
            </Text>
            <Text className="md-error-retry">
              {tt('distribution.memberDetail.retry', '点击重试')}
            </Text>
          </View>
        )}

        {loading && (
          <Text className="md-loading">{t('distribution.memberDetail.loading')}</Text>
        )}

        {!loading && !hasMore && list.length > 0 && (
          <Text className="md-no-more">
            {tt('distribution.memberDetail.noMore', '没有更多了')}
          </Text>
        )}
      </View>
    </View>
  )
}
