// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionInfo, getDistributionTeam } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface CompanyInfo {
  level: number
  totalCommission: number
  available: number
  withdrawn: number
  teamCount: number
}

interface Member {
  id: string
  nickname: string
  avatar?: string
  joinTime: string
  level: number
}

const DEFAULT_INFO: CompanyInfo = {
  level: 0,
  totalCommission: 0,
  available: 0,
  withdrawn: 0,
  teamCount: 0,
}

export default function CompanyPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<CompanyInfo>(DEFAULT_INFO)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [infoRes, teamRes] = await Promise.all([
        getDistributionInfo(),
        getDistributionTeam({ page: 1, pageSize: 20 }),
      ])
      setInfo(infoRes)
      const mapped: Member[] = (teamRes?.list || []).map((u) => ({
        id: u.id,
        nickname: u.nickname || u.username,
        avatar: u.avatar ?? undefined,
        joinTime: u.createdAt,
        level: 1,
      }))
      setMembers(mapped)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const navigateTo = (url: string) => Taro.navigateTo({ url })

  /* 对齐 RN TeamScreen(packages/app 共享屏):标题 24dp→48rpx bold、统计卡 success.light 底、
     成员卡 surface.bg 底 + 描边 24rpx 圆角 + 44dp→88rpx 圆头像;小程序特有菜单卡沿用 RN 卡片语言 */
  return (
    <ThemeRoot className="min-h-screen bg-background pb-[64rpx]">
      {/* 对齐 RN TeamScreen header:title 24dp→48rpx bold + 副标题 14dp→28rpx secondary */}
      <View className="px-[20rpx] pt-[20rpx] pb-[24rpx]">
        <Text className="block text-[48rpx] font-bold text-foreground">
          {t('distribution.company.title')}
        </Text>
        <Text className="block text-[28rpx] text-muted-foreground mt-[16rpx]">
          {t('distribution.company.level', { n: info.level })}
        </Text>
      </View>

      {/* 对齐 RN TeamScreen statsCard:success.light 底 + 20dp→40rpx bold success 数值 + deepText 标签 */}
      <View className="mx-[20rpx] rounded-[24rpx] p-[28rpx] bg-[var(--color-success-light)]">
        <View className="flex flex-row justify-between">
          <View className="flex-1 flex flex-col items-center">
            <Text className="text-[40rpx] font-bold text-[var(--color-success)]">
              ¥{info.totalCommission}
            </Text>
            <Text className="text-[20rpx] text-[var(--color-success-deep-text)] mt-[16rpx] text-center">
              {t('distribution.company.totalEarnings')}
            </Text>
          </View>
          <View className="flex-1 flex flex-col items-center">
            <Text className="text-[40rpx] font-bold text-[var(--color-success)]">
              ¥{info.available}
            </Text>
            <Text className="text-[20rpx] text-[var(--color-success-deep-text)] mt-[16rpx] text-center">
              {t('distribution.company.available')}
            </Text>
          </View>
          <View className="flex-1 flex flex-col items-center">
            <Text className="text-[40rpx] font-bold text-[var(--color-success)]">
              {info.teamCount}
            </Text>
            <Text className="text-[20rpx] text-[var(--color-success-deep-text)] mt-[16rpx] text-center">
              {t('distribution.company.teamMembers')}
            </Text>
          </View>
        </View>
      </View>

      {/* 对齐 RN TeamScreen listBody:padding 14dp→28rpx + 卡片间 8dp→16rpx */}
      <View className="px-[20rpx] pt-[32rpx]">
        <View className="flex flex-row items-center justify-between mb-[16rpx]">
          <Text className="text-[28rpx] font-medium text-foreground">
            {t('distribution.company.teamMembers')}
          </Text>
          <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
            {t('distribution.company.memberCount', { n: members.length })}
          </Text>
        </View>
        {loading ? (
          <View className="flex flex-col gap-[16rpx]">
            {Array.from({ length: 3 }).map((_, i) => (
              <View
                key={i}
                className="flex flex-row items-center rounded-[24rpx] border border-border p-[28rpx]"
              >
                <View className="w-[88rpx] h-[88rpx] rounded-full bg-[var(--color-muted)] flex-shrink-0" />
                <View className="flex-1 ml-[20rpx] mr-[16rpx]">
                  <View className="h-[24rpx] w-[60%] rounded-[8rpx] bg-[var(--color-muted)]" />
                  <View className="h-[20rpx] w-[40%] rounded-[8rpx] bg-[var(--color-muted)] mt-[16rpx]" />
                </View>
              </View>
            ))}
          </View>
        ) : members.length === 0 ? (
          <View className="py-[64rpx] text-center">
            <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('distribution.company.empty')}
            </Text>
          </View>
        ) : (
          <View className="flex flex-col gap-[16rpx]">
            {members.map((m) => (
              <View
                key={m.id}
                className="flex flex-row items-center rounded-[24rpx] border border-border bg-background p-[28rpx]"
                onClick={() => navigateTo(`/pages/distribution/member-detail/index?id=${m.id}`)}
                hoverClass="opacity-60">
                {m.avatar ? (
                  <Image
                    className="w-[88rpx] h-[88rpx] rounded-full flex-shrink-0"
                    src={m.avatar}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-[88rpx] h-[88rpx] rounded-full bg-[var(--color-muted)] items-center justify-center flex-shrink-0">
                    <Text className="text-[36rpx] font-semibold text-muted-foreground">
                      {m.nickname.charAt(0)}
                    </Text>
                  </View>
                )}
                <View className="flex-1 ml-[20rpx] mr-[16rpx] min-w-0">
                  <Text className="block text-[32rpx] font-semibold text-foreground truncate">
                    {m.nickname}
                  </Text>
                  <Text className="block text-[22rpx] text-[var(--color-text-tertiary)] mt-[16rpx] truncate">
                    {t('distribution.company.joinTime', { time: m.joinTime })}
                  </Text>
                </View>
                <Text className="px-[12rpx] py-[2rpx] rounded-[16rpx] bg-card text-[20rpx] text-muted-foreground flex-shrink-0">
                  V{m.level}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 菜单卡 — 小程序特有导航入口(无 RN 对应),按 RN 卡片语言:白卡 + 描边 + 24rpx 圆角 */}
      <View className="mx-[20rpx] mt-[24rpx] rounded-[24rpx] border border-border bg-card p-[28rpx]">
        <View className="flex flex-row gap-[16rpx]">
          <View
            className="flex-1 flex flex-col items-center gap-[8rpx] py-[24rpx] rounded-[24rpx] bg-[var(--color-muted)]"
            onClick={() => navigateTo('/pages/distribution/team')}
            hoverClass="opacity-60">
            <LineIcon name="users" size={40} color="var(--color-muted-foreground)" />
            <Text className="text-[24rpx] text-foreground">
              {t('distribution.company.menuTeam')}
            </Text>
          </View>
          <View
            className="flex-1 flex flex-col items-center gap-[8rpx] py-[24rpx] rounded-[24rpx] bg-[var(--color-muted)]"
            onClick={() => navigateTo('/pages/distribution/commission')}
            hoverClass="opacity-60">
            <LineIcon name="wallet" size={40} color="var(--color-muted-foreground)" />
            <Text className="text-[24rpx] text-foreground">
              {t('distribution.company.menuCommission')}
            </Text>
          </View>
          <View
            className="flex-1 flex flex-col items-center gap-[8rpx] py-[24rpx] rounded-[24rpx] bg-[var(--color-muted)]"
            onClick={() => navigateTo('/pages/distribution/withdraw')}
            hoverClass="opacity-60">
            <LineIcon name="wallet" size={40} color="var(--color-muted-foreground)" />
            <Text className="text-[24rpx] text-foreground">
              {t('distribution.company.menuWithdraw')}
            </Text>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
