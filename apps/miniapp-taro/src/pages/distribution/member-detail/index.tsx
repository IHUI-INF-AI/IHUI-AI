// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'

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
  const tt = useTt()
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
        contribution: (u.contribution as number) ?? (u.commission as number) ?? 0,
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

  /* 对齐 RN TeamDetailScreen(packages/app 共享屏):scrollContent padding 14dp→28rpx + gap 12dp→24rpx,
     统计行 18dp→36rpx 品牌色数值 + 14dp→28rpx 标签;列表项复用 memberCard 语言(24rpx 圆角 + 28rpx padding)。
     RN memberCard 用 surface.light(恒白),暗色下不可读,按语义 token 修正为 bg-card */
  return (
    <ThemeRoot className="min-h-screen bg-background pb-[64rpx]">
      <View className="p-[28rpx] flex flex-col gap-[24rpx]">
        {/* 对齐 RN TeamDetailScreen statsRow:card 底 + 24rpx 圆角 + 品牌色数值 */}
        <View className="flex flex-row rounded-[24rpx] bg-card p-[28rpx] gap-[16rpx]">
          <View className="flex-1 flex flex-col items-center gap-[8rpx]">
            <Text className="text-[36rpx] font-semibold text-[var(--color-primary)]">
              {stats.teamCount}
            </Text>
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('distribution.memberDetail.teamCount', '团队人数')}
            </Text>
          </View>
          <View className="flex-1 flex flex-col items-center gap-[8rpx]">
            <Text className="text-[36rpx] font-semibold text-[var(--color-primary)]">
              {stats.monthNew}
            </Text>
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('distribution.memberDetail.monthNew', '本月新增')}
            </Text>
          </View>
          <View className="flex-1 flex flex-col items-center gap-[8rpx]">
            <Text className="text-[36rpx] font-semibold text-[var(--color-primary)]">
              ¥{stats.totalCommission}
            </Text>
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('distribution.memberDetail.totalCommission', '总佣金')}
            </Text>
          </View>
        </View>

        <View className="flex flex-col gap-[24rpx]">
          <Text className="text-[28rpx] text-muted-foreground">
            {tt('distribution.memberDetail.memberList', '成员列表')}
          </Text>

          {list.length > 0 && (
            <View className="flex flex-col gap-[16rpx]">
              {list.map((m) => (
                <View
                  key={m.id}
                  className="flex flex-row items-center rounded-[24rpx] bg-card p-[28rpx] gap-[24rpx]"
                >
                  {m.avatar ? (
                    <Image
                      className="w-[96rpx] h-[96rpx] rounded-full flex-shrink-0"
                      src={m.avatar}
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary items-center justify-center flex-shrink-0">
                      <Text className="text-[44rpx] font-semibold text-[var(--color-primary-foreground)]">
                        {m.nickname.charAt(0) || '?'}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
                    <View className="flex flex-row items-center gap-[12rpx]">
                      <Text className="flex-1 text-[32rpx] font-semibold text-foreground truncate">
                        {m.nickname}
                      </Text>
                      <Text className="flex-shrink-0 px-[12rpx] py-[2rpx] rounded-[16rpx] bg-[var(--color-muted)] text-[20rpx] text-muted-foreground">
                        V{m.level}
                      </Text>
                    </View>
                    <View className="flex flex-row items-center justify-between gap-[16rpx]">
                      <Text className="flex-1 text-[22rpx] text-[var(--color-text-tertiary)] truncate">
                        {tt('distribution.memberDetail.joinTime', '加入')}:{m.joinTime || '-'}
                      </Text>
                      <Text className="flex-shrink-0 text-[28rpx] font-semibold text-[var(--color-success)]">
                        {tt('distribution.memberDetail.contribution', '贡献')} ¥{m.contribution}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {list.length === 0 && !loading && !error && (
            <View className="py-[48rpx] text-center">
              <Text className="text-[28rpx] text-muted-foreground">
                {t('distribution.memberDetail.empty')}
              </Text>
            </View>
          )}

          {error && !loading && (
            <View className="flex flex-col items-center py-[48rpx] gap-[24rpx]">
              <Text className="text-[28rpx] text-muted-foreground text-center">
                {tt('distribution.memberDetail.error', '加载失败')}
              </Text>
              <View
                className="px-[40rpx] h-[72rpx] rounded-[20rpx] bg-primary flex items-center justify-center"
                onClick={() => load(true)}
                hoverClass="opacity-60"
              >
                <Text className="text-[28rpx] font-medium text-[var(--color-primary-foreground)]">
                  {tt('distribution.memberDetail.retry', '点击重试')}
                </Text>
              </View>
            </View>
          )}

          {loading && (
            <Text className="block text-center text-[28rpx] text-[var(--color-text-tertiary)] py-[48rpx]">
              {t('distribution.memberDetail.loading')}
            </Text>
          )}

          {!loading && !hasMore && list.length > 0 && (
            <Text className="block text-center text-[28rpx] text-[var(--color-text-tertiary)] py-[48rpx]">
              {tt('distribution.memberDetail.noMore', '没有更多了')}
            </Text>
          )}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
