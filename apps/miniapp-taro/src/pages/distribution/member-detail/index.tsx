import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'

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
    <View className="min-h-screen bg-background p-[24rpx] pb-[60rpx]">
      <View className="flex gap-[16rpx]">
        <View className="flex-1 py-[28rpx] px-[12rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.15)] rounded-[12rpx] text-center">
          <Text className="block text-[34rpx] font-bold text-[#00f2ff]">{stats.teamCount}</Text>
          <Text className="block text-[22rpx] text-muted-foreground mt-[8rpx]">
            {tt('distribution.memberDetail.teamCount', '团队人数')}
          </Text>
        </View>
        <View className="flex-1 py-[28rpx] px-[12rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.15)] rounded-[12rpx] text-center">
          <Text className="block text-[34rpx] font-bold text-[#00f2ff]">{stats.monthNew}</Text>
          <Text className="block text-[22rpx] text-muted-foreground mt-[8rpx]">
            {tt('distribution.memberDetail.monthNew', '本月新增')}
          </Text>
        </View>
        <View className="flex-1 py-[28rpx] px-[12rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.15)] rounded-[12rpx] text-center">
          <Text className="block text-[34rpx] font-bold text-[#00f2ff]">¥{stats.totalCommission}</Text>
          <Text className="block text-[22rpx] text-muted-foreground mt-[8rpx]">
            {tt('distribution.memberDetail.totalCommission', '总佣金')}
          </Text>
        </View>
      </View>

      <View className="mt-[28rpx]">
        <Text className="block text-[30rpx] font-semibold text-foreground mb-[16rpx]">
          {tt('distribution.memberDetail.memberList', '成员列表')}
        </Text>

        {list.length > 0 && (
          <View className="flex flex-col gap-[16rpx]">
            {list.map((m) => (
              <View key={m.id} className="flex items-center p-[24rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]">
                {m.avatar ? (
                  <Image className="w-[80rpx] h-[80rpx] rounded-[8rpx] bg-muted flex-shrink-0" src={m.avatar} mode="aspectFill" />
                ) : (
                  <View className="w-[80rpx] h-[80rpx] rounded-[8rpx] bg-muted flex-shrink-0 flex items-center justify-center">
                    <Text className="text-[28rpx] font-semibold text-primary">{m.nickname.charAt(0) || '?'}</Text>
                  </View>
                )}
                <View className="flex-1 ml-[20rpx] min-w-0">
                  <View className="flex items-center justify-between">
                    <Text className="text-[28rpx] font-medium text-foreground truncate flex-1 min-w-0">{m.nickname}</Text>
                    <Text className="text-[24rpx] font-semibold text-[#8b5cf6] ml-[16rpx] flex-shrink-0">V{m.level}</Text>
                  </View>
                  <View className="flex items-center justify-between mt-[10rpx]">
                    <Text className="text-[22rpx] text-muted-foreground truncate flex-1 min-w-0">
                      {tt('distribution.memberDetail.joinTime', '加入')}:{m.joinTime || '-'}
                    </Text>
                    <Text className="text-[24rpx] font-semibold text-[#22c55e] ml-[16rpx] flex-shrink-0">
                      {tt('distribution.memberDetail.contribution', '贡献')} ¥{m.contribution}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {list.length === 0 && !loading && !error && (
          <Text className="block text-center text-[26rpx] text-muted-foreground py-[80rpx]">{t('distribution.memberDetail.empty')}</Text>
        )}

        {error && !loading && (
          <View className="flex flex-col items-center py-[60rpx]" onClick={() => load(true)}>
            <Text className="text-[26rpx] text-destructive">
              {tt('distribution.memberDetail.error', '加载失败')}
            </Text>
            <Text className="text-[26rpx] text-[#00f2ff] mt-[12rpx]">
              {tt('distribution.memberDetail.retry', '点击重试')}
            </Text>
          </View>
        )}

        {loading && (
          <Text className="block text-center text-[26rpx] text-muted-foreground py-[80rpx]">{t('distribution.memberDetail.loading')}</Text>
        )}

        {!loading && !hasMore && list.length > 0 && (
          <Text className="block text-center text-[26rpx] text-muted-foreground py-[80rpx]">
            {tt('distribution.memberDetail.noMore', '没有更多了')}
          </Text>
        )}
      </View>
    </View>
  )
}
