import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionInfo, getDistributionTeam } from '@/api'
import { useI18n } from '@/i18n'

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

  return (
    <View className="min-h-screen bg-background">
      <View className="bg-gradient-to-b from-[#1f2937] to-[#374151] px-4 pt-8 pb-6 text-white">
        <Text className="block text-sm opacity-80">{t('distribution.company.title')}</Text>
        <Text className="block text-2xl font-bold mt-2">
          {t('distribution.company.level', { n: info.level })}
        </Text>
        <View className="flex mt-5">
          <View className="flex-1 text-center">
            <Text className="block text-lg font-bold">¥{info.totalCommission}</Text>
            <Text className="block text-xs opacity-70 mt-1">
              {t('distribution.company.totalEarnings')}
            </Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-lg font-bold">¥{info.available}</Text>
            <Text className="block text-xs opacity-70 mt-1">
              {t('distribution.company.available')}
            </Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-lg font-bold">{info.teamCount}</Text>
            <Text className="block text-xs opacity-70 mt-1">
              {t('distribution.company.teamMembers')}
            </Text>
          </View>
        </View>
      </View>

      <View className="mx-3 mt-3 bg-card rounded-xl p-4">
        <View className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-foreground">
            {t('distribution.company.teamMembers')}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {t('distribution.company.memberCount', { n: members.length })}
          </Text>
        </View>
        {loading ? (
          <View className="py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} className="flex items-center py-2 animate-pulse">
                <View className="w-9 h-9 mr-3 rounded-lg bg-muted" />
                <View className="flex-1 h-3 bg-muted rounded" />
              </View>
            ))}
          </View>
        ) : members.length === 0 ? (
          <View className="flex items-center justify-center py-8">
            <Text className="text-sm text-muted-foreground">{t('distribution.company.empty')}</Text>
          </View>
        ) : (
          members.map((m) => (
            <View
              key={m.id}
              className="flex items-center py-2.5 mb-2 last:mb-0"
              onClick={() => navigateTo(`/pages/distribution/member-detail/index?id=${m.id}`)}
            >
              {m.avatar ? (
                <Image
                  className="w-9 h-9 mr-3 rounded-lg bg-muted"
                  src={m.avatar}
                  mode="aspectFill"
                />
              ) : (
                <View className="flex items-center justify-center w-9 h-9 mr-3 rounded-lg bg-muted">
                  <Text className="text-xs text-muted-foreground">{m.nickname.charAt(0)}</Text>
                </View>
              )}
              <View className="flex-1 min-w-0">
                <Text className="block text-sm text-foreground truncate">{m.nickname}</Text>
                <Text className="block text-xs text-muted-foreground mt-0.5">
                  {t('distribution.company.joinTime', { time: m.joinTime })}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">V{m.level}</Text>
            </View>
          ))
        )}
      </View>

      <View className="mx-3 mt-3 bg-card rounded-xl p-4">
        <View className="grid grid-cols-3 gap-3">
          <View
            className="flex flex-col items-center py-3 rounded-lg bg-muted"
            onClick={() => navigateTo('/pages/distribution/team')}
          >
            <Text className="text-xl">👥</Text>
            <Text className="text-xs text-foreground mt-1">{t('distribution.company.menuTeam')}</Text>
          </View>
          <View
            className="flex flex-col items-center py-3 rounded-lg bg-muted"
            onClick={() => navigateTo('/pages/distribution/commission')}
          >
            <Text className="text-xl">💰</Text>
            <Text className="text-xs text-foreground mt-1">
              {t('distribution.company.menuCommission')}
            </Text>
          </View>
          <View
            className="flex flex-col items-center py-3 rounded-lg bg-muted"
            onClick={() => navigateTo('/pages/distribution/withdraw')}
          >
            <Text className="text-xl">💸</Text>
            <Text className="text-xs text-foreground mt-1">
              {t('distribution.company.menuWithdraw')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
