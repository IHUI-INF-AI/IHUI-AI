import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionInfo, type DistributionInfo } from '@/api'
import {
  DistributionStats,
  TeamManager,
  WithdrawalRecords,
  InvitePoster,
  LevelBadge,
  type TeamMember,
  type WithdrawalRecord,
} from '@/components'

const DEFAULT_INFO: DistributionInfo = {
  level: 0,
  totalCommission: 0,
  available: 0,
  withdrawn: 0,
  teamCount: 0,
}

const MENU_ITEMS = [
  { icon: '👥', label: '我的团队', url: '/pages/distribution/team' },
  { icon: '💰', label: '佣金记录', url: '/pages/distribution/commission' },
  { icon: '💸', label: '提现', url: '/pages/distribution/withdraw' },
  { icon: '🏆', label: '排行榜', url: '/pages/distribution/rank' },
]

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: '张三', level: 1, joinedAt: '2026-06-01', earnings: 128.5, status: 'active' },
  { id: '2', name: '李四', level: 2, joinedAt: '2026-06-15', earnings: 89.0, status: 'active' },
]

const MOCK_WITHDRAWALS: WithdrawalRecord[] = [
  {
    id: 'w1',
    amount: 100,
    status: 'completed',
    method: '微信',
    createdAt: '2026-07-10',
  },
  {
    id: 'w2',
    amount: 50,
    status: 'pending',
    method: '支付宝',
    createdAt: '2026-07-13',
  },
]

export default function DistributionIndex() {
  const [info, setInfo] = useState<DistributionInfo>(DEFAULT_INFO)

  const load = useCallback(async () => {
    try {
      setInfo(await getDistributionInfo())
    } catch {
      // ignore
    }
  }, [])

  const navigate = (url: string) => Taro.navigateTo({ url })

  useDidShow(() => {
    load()
  })

  const onViewTeamMember = (m: TeamMember) => {
    Taro.navigateTo({ url: `/pages/distribution/member-detail/index?id=${m.id}` })
  }

  const onViewWithdrawal = (r: WithdrawalRecord) => {
    Taro.showToast({ title: `查看 ${r.id}`, icon: 'none' })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="bg-gradient-to-b from-[#ff6b35] to-[#ff8e53] px-[16px] pt-[24px] pb-[20px] text-white">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <Text className="block text-[14px] opacity-90">分销等级</Text>
            <View className="ml-2">
              <LevelBadge level={info.level} size="sm" />
            </View>
          </View>
          <Text
            className="text-[12px] px-3 py-1 rounded-full bg-white/20"
            onClick={() => navigate('/pages/distribution/rank')}
          >
            排行榜 ›
          </Text>
        </View>
        <Text className="block text-[40px] font-bold mt-[8px]">¥{info.totalCommission}</Text>
        <Text className="block text-[12px] opacity-90 mt-[4px]">累计佣金</Text>
        <View className="flex mt-[16px]">
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">¥{info.available}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">可提现</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">¥{info.withdrawn}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">已提现</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">{info.teamCount}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">团队人数</Text>
          </View>
        </View>
      </View>

      <View className="mx-[12px] mt-[12px] bg-white rounded-[8px] p-[16px]">
        <View className="grid grid-cols-4 gap-[12px]">
          {MENU_ITEMS.map((item) => (
            <View
              key={item.url}
              className="flex flex-col items-center"
              onClick={() => navigate(item.url)}
            >
              <Text className="text-[32px]">{item.icon}</Text>
              <Text className="text-[12px] text-[#333] mt-[6px]">{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <DistributionStats
        totalEarnings={info.totalCommission}
        availableWithdrawal={info.available}
        withdrawnAmount={info.withdrawn}
        pendingSettlement={Math.max(0, info.totalCommission - info.available - info.withdrawn)}
        monthlyEarnings={info.available * 0.3}
        monthlyTarget={500}
      />

      <TeamManager
        members={MOCK_TEAM}
        totalCount={info.teamCount}
        onViewDetail={onViewTeamMember}
      />

      <WithdrawalRecords records={MOCK_WITHDRAWALS} onViewDetail={onViewWithdrawal} />

      <InvitePoster
        inviteCode={`IHUI${info.level}${info.teamCount}`}
        inviteUrl="https://ihui.ai/invite/abc123"
        reward="邀请好友得 30% 佣金"
        inviterName="我"
        onSave={() => Taro.showToast({ title: '已保存海报', icon: 'success' })}
        onShare={() => Taro.showShareMenu({ withShareTicket: true })}
      />
    </View>
  )
}
