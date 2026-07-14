import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionInfo, getDistributionTeam } from '@/api'

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
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="bg-gradient-to-b from-[#1f2937] to-[#374151] px-4 pt-8 pb-6 text-white">
        <Text className="block text-sm opacity-80">我的公司</Text>
        <Text className="block text-2xl font-bold mt-2">分销等级 V{info.level}</Text>
        <View className="flex mt-5">
          <View className="flex-1 text-center">
            <Text className="block text-lg font-bold">¥{info.totalCommission}</Text>
            <Text className="block text-xs opacity-70 mt-1">总收益</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-lg font-bold">¥{info.available}</Text>
            <Text className="block text-xs opacity-70 mt-1">可提现</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-lg font-bold">{info.teamCount}</Text>
            <Text className="block text-xs opacity-70 mt-1">团队成员</Text>
          </View>
        </View>
      </View>

      <View className="mx-3 mt-3 bg-white rounded-xl p-4">
        <View className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-gray-800">团队成员</Text>
          <Text className="text-xs text-gray-400">{members.length}人</Text>
        </View>
        {loading ? (
          <View className="py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} className="flex items-center py-2 animate-pulse">
                <View className="w-9 h-9 mr-3 rounded-full bg-gray-100" />
                <View className="flex-1 h-3 bg-gray-100 rounded" />
              </View>
            ))}
          </View>
        ) : members.length === 0 ? (
          <View className="flex items-center justify-center py-8">
            <Text className="text-sm text-gray-400">暂无成员</Text>
          </View>
        ) : (
          members.map((m) => (
            <View
              key={m.id}
              className="flex items-center py-2.5 border-b border-gray-50 last:border-0"
              onClick={() => navigateTo(`/pages/distribution/member-detail/index?id=${m.id}`)}
            >
              {m.avatar ? (
                <Image
                  className="w-9 h-9 mr-3 rounded-full bg-gray-50"
                  src={m.avatar}
                  mode="aspectFill"
                />
              ) : (
                <View className="flex items-center justify-center w-9 h-9 mr-3 rounded-full bg-gray-50">
                  <Text className="text-xs text-gray-500">{m.nickname.charAt(0)}</Text>
                </View>
              )}
              <View className="flex-1 min-w-0">
                <Text className="block text-sm text-gray-700 truncate">{m.nickname}</Text>
                <Text className="block text-xs text-gray-400 mt-0.5">加入时间: {m.joinTime}</Text>
              </View>
              <Text className="text-xs text-gray-400">V{m.level}</Text>
            </View>
          ))
        )}
      </View>

      <View className="mx-3 mt-3 bg-white rounded-xl p-4">
        <View className="grid grid-cols-3 gap-3">
          <View
            className="flex flex-col items-center py-3 rounded-lg bg-gray-50"
            onClick={() => navigateTo('/pages/distribution/team')}
          >
            <Text className="text-xl">👥</Text>
            <Text className="text-xs text-gray-600 mt-1">团队管理</Text>
          </View>
          <View
            className="flex flex-col items-center py-3 rounded-lg bg-gray-50"
            onClick={() => navigateTo('/pages/distribution/commission')}
          >
            <Text className="text-xl">💰</Text>
            <Text className="text-xs text-gray-600 mt-1">佣金记录</Text>
          </View>
          <View
            className="flex flex-col items-center py-3 rounded-lg bg-gray-50"
            onClick={() => navigateTo('/pages/distribution/withdraw')}
          >
            <Text className="text-xl">💸</Text>
            <Text className="text-xs text-gray-600 mt-1">提现</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
