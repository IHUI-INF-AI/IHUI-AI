import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyRank } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background">
      <View className="p-6 text-center bg-primary">
        <Text className="block text-primary-foreground text-lg font-bold">{t('study.rankPage.title')}</Text>
        <Text className="block text-primary-foreground/90 text-xs mt-1">{t('study.rankPage.subtitle')}</Text>
      </View>

      {/* 排名奖牌金/银/铜色已接入 token:var(--color-rank-gold/silver/bronze)(#ffd700/#c0c0c0/#cd7f32) */}
      {list.length >= 3 && (
        <View className="flex items-end justify-center py-4 bg-card">
          <View className="flex flex-col items-center mx-2 relative">
            <Image
              className="w-[110rpx] h-[110rpx] rounded-md bg-muted border-2 border-[var(--color-rank-silver)]"
              src={list[1]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-xs text-foreground mt-1">{list[1]!.nickname}</Text>
            <Text className="text-xs text-primary mt-0.5">
              {t('study.rankPage.minutes', { n: list[1]!.minutes })}
            </Text>
            <Text className="absolute -top-2 w-5 h-5 leading-5 text-center rounded-md text-white text-xs bg-[var(--color-rank-silver)]">
              2
            </Text>
          </View>
          <View className="flex flex-col items-center mx-2 relative">
            <Image
              className="w-[140rpx] h-[140rpx] rounded-md bg-muted border-2 border-[var(--color-rank-gold)]"
              src={list[0]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-xs text-foreground mt-1">{list[0]!.nickname}</Text>
            <Text className="text-xs text-primary mt-0.5">
              {t('study.rankPage.minutes', { n: list[0]!.minutes })}
            </Text>
            <Text className="absolute -top-2 w-5 h-5 leading-5 text-center rounded-md text-white text-xs bg-[var(--color-rank-gold)]">
              1
            </Text>
          </View>
          <View className="flex flex-col items-center mx-2 relative">
            <Image
              className="w-[110rpx] h-[110rpx] rounded-md bg-muted border-2 border-[var(--color-rank-bronze)]"
              src={list[2]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-xs text-foreground mt-1">{list[2]!.nickname}</Text>
            <Text className="text-xs text-primary mt-0.5">
              {t('study.rankPage.minutes', { n: list[2]!.minutes })}
            </Text>
            <Text className="absolute -top-2 w-5 h-5 leading-5 text-center rounded-md text-white text-xs bg-[var(--color-rank-bronze)]">
              3
            </Text>
          </View>
        </View>
      )}

      {list.length > 3 && (
        <View className="m-3 bg-card rounded-2xl p-2 flex flex-col gap-1">
          {list.slice(3).map((u, i) => (
            <View key={u.id} className="flex items-center p-3">
              <Text className="w-8 text-sm text-muted-foreground">{i + 4}</Text>
              <Image
                className="w-[60rpx] h-[60rpx] rounded-md bg-muted"
                src={u.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="flex-1 ml-3 text-sm text-foreground">{u.nickname}</Text>
              <Text className="text-sm text-primary font-semibold">
                {t('study.rankPage.minutes', { n: u.minutes })}
              </Text>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-muted-foreground">
          <Text>{t('study.rankPage.empty')}</Text>
        </View>
      )}
    </View>
  )
}
