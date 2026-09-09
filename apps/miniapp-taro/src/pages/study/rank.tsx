// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { getStudyRank } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface RankUser {
  id: string
  nickname: string
  avatar?: string
  minutes: number
}

export default function StudyRank() {
  const { t } = useI18n()
  const [list, setList] = useState<RankUser[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getStudyRank()
      setList(res.list || [])
    } catch {
      // 统一提示
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    load()
  })

  return (
    <ThemeRoot>
      {/* 对齐 RN RankingScreen(共享屏):容器 bg surface.bg;header 标题 24dp→48rpx/700 + 副标题 14dp→28rpx(明暗语义色,替代原 bg-primary 反白块);
          领奖台 item bg surface.muted / 第一名 bg warning.amberLight;头像 48dp→96rpx 圆形 + 2dp→4rpx 描边;
          名次色对齐 RN rankColor:1=warning.amber / 2=text.tertiary / 3=warning.amberText(替代原 rank-gold/silver/bronze token) */}
      <View className="min-h-screen bg-background">
        <View className="px-[20rpx] pt-[96rpx] pb-[16rpx]">
          <Text className="block text-[48rpx] font-bold text-foreground">
            {t('study.rankPage.title')}
          </Text>
          <Text className="block text-[28rpx] text-muted-foreground mt-[16rpx]">
            {t('study.rankPage.subtitle')}
          </Text>
        </View>

        {list.length >= 3 && (
          <View className="flex items-stretch px-[20rpx] py-[24rpx] gap-[16rpx]">
            {/* 第 2 名:rankColor(2)= text.tertiary */}
            <View className="flex-1 flex flex-col items-center p-[28rpx] rounded-[24rpx] bg-muted">
              <Image
                className="w-[96rpx] h-[96rpx] rounded-full bg-background border-2 border-[var(--color-text-tertiary)]"
                src={list[1]!.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="text-[28rpx] font-semibold text-foreground mt-[16rpx]">
                {list[1]!.nickname}
              </Text>
              <Text className="text-[28rpx] text-success mt-[16rpx]">
                {t('study.rankPage.minutes', { n: list[1]!.minutes })}
              </Text>
              <Text className="mt-[16rpx] px-[12rpx] py-[4rpx] rounded-[16rpx] text-[22rpx] text-[var(--color-surface-light)] bg-[var(--color-text-tertiary)]">
                #2
              </Text>
            </View>
            {/* 第 1 名:rankColor(1)= warning.amber,底色 warning.amberLight */}
            <View className="flex-1 flex flex-col items-center p-[28rpx] rounded-[24rpx] bg-[var(--color-warning-amber-light)]">
              <Image
                className="w-[96rpx] h-[96rpx] rounded-full bg-background border-2 border-[var(--color-warning-amber)]"
                src={list[0]!.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="text-[28rpx] font-semibold text-foreground mt-[16rpx]">
                {list[0]!.nickname}
              </Text>
              <Text className="text-[28rpx] text-success mt-[16rpx]">
                {t('study.rankPage.minutes', { n: list[0]!.minutes })}
              </Text>
              <Text className="mt-[16rpx] px-[12rpx] py-[4rpx] rounded-[16rpx] text-[22rpx] text-[var(--color-surface-light)] bg-[var(--color-warning-amber)]">
                #1
              </Text>
            </View>
            {/* 第 3 名:rankColor(3)= warning.amberText */}
            <View className="flex-1 flex flex-col items-center p-[28rpx] rounded-[24rpx] bg-muted">
              <Image
                className="w-[96rpx] h-[96rpx] rounded-full bg-background border-2 border-[var(--color-warning-amber-text)]"
                src={list[2]!.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="text-[28rpx] font-semibold text-foreground mt-[16rpx]">
                {list[2]!.nickname}
              </Text>
              <Text className="text-[28rpx] text-success mt-[16rpx]">
                {t('study.rankPage.minutes', { n: list[2]!.minutes })}
              </Text>
              <Text className="mt-[16rpx] px-[12rpx] py-[4rpx] rounded-[16rpx] text-[22rpx] text-[var(--color-surface-light)] bg-[var(--color-warning-amber-text)]">
                #3
              </Text>
            </View>
          </View>
        )}

        {/* 榜单列表对齐 RN list card:行卡片 p14dp→28rpx / radius 12dp→24rpx / border light / bg surface.bg;头像 44dp→88rpx 圆形 + 1.5dp→3rpx 描边;积分 16dp→32rpx/700 success */}
        {list.length > 3 && (
          <View className="p-[28rpx] pb-[64rpx] flex flex-col gap-[16rpx]">
            {list.slice(3).map((u, i) => (
              <View
                key={u.id}
                className="flex items-center p-[28rpx] rounded-[24rpx] border border-border bg-background"
              >
                <Text className="w-[72rpx] text-[32rpx] font-bold text-muted-foreground">
                  #{i + 4}
                </Text>
                <Image
                  className="w-[88rpx] h-[88rpx] rounded-full bg-muted border-[3rpx] border-[var(--color-muted-foreground)]"
                  src={u.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <Text className="flex-1 ml-[20rpx] mr-[16rpx] text-[32rpx] font-semibold text-foreground">
                  {u.nickname}
                </Text>
                <Text className="text-[32rpx] font-bold text-success">
                  {t('study.rankPage.minutes', { n: u.minutes })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!loading && list.length === 0 && (
          <View className="flex items-center justify-center py-[64rpx]">
            <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">
              {t('study.rankPage.empty')}
            </Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
