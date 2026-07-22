import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import {
  getDistributionInfo,
  getDistributionTeam,
  getWithdrawalRecords,
  type DistributionInfo,
} from '@/api'
import {
  DistributionStats,
  TeamManager,
  WithdrawalRecords,
  InvitePoster,
  LevelBadge,
  type TeamMember,
  type WithdrawalRecord,
} from '@/components'
import { useI18n } from '@/i18n'

const DEFAULT_INFO: DistributionInfo = {
  level: 0,
  totalCommission: 0,
  available: 0,
  withdrawn: 0,
  teamCount: 0,
}

const DEFAULT_TEAM: TeamMember[] = []
const DEFAULT_WITHDRAWALS: WithdrawalRecord[] = []

const WITHDRAWAL_STATUS_MAP: Record<number, 'pending' | 'approved' | 'rejected' | 'completed'> = {
  0: 'pending',
  1: 'approved',
  2: 'completed',
  3: 'rejected',
}

export default function DistributionIndex() {
  const { t } = useI18n()
  const [info, setInfo] = useState<DistributionInfo>(DEFAULT_INFO)
  const [inviteCode, setInviteCode] = useState<string>('')
  const [team, setTeam] = useState<TeamMember[]>(DEFAULT_TEAM)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>(DEFAULT_WITHDRAWALS)

  const methodLabel = useCallback(
    (method: string) => {
      const map: Record<string, string> = {
        wechat: t('distribution.withdraw.methodWechat'),
        alipay: t('distribution.withdraw.methodAlipay'),
        bank: t('distribution.withdraw.methodBank'),
      }
      return map[method] || method
    },
    [t],
  )

  const menuItems = [
    { icon: '👥', label: t('distribution.index.menuTeam'), url: '/pages/distribution/team' },
    {
      icon: '💰',
      label: t('distribution.index.menuCommission'),
      url: '/pages/distribution/commission',
    },
    {
      icon: '💸',
      label: t('distribution.index.menuWithdraw'),
      url: '/pages/distribution/withdraw',
    },
    { icon: '🏆', label: t('distribution.index.menuRank'), url: '/pages/distribution/rank' },
  ]

  const load = useCallback(async () => {
    try {
      const res = await getDistributionInfo()
      setInfo(res)
      if ((res as DistributionInfo & { inviteCode?: string | null }).inviteCode) {
        setInviteCode((res as DistributionInfo & { inviteCode?: string | null }).inviteCode!)
      }
    } catch {
      // ignore
    }
    try {
      const teamRes = await getDistributionTeam({ page: 1, pageSize: 20 })
      const members: TeamMember[] = (teamRes.list || []).map((u) => ({
        id: u.id,
        name: u.nickname || u.username,
        level: 1,
        joinedAt: u.createdAt,
        earnings: 0,
        status: 'active',
      }))
      setTeam(members)
      setInfo((prev) => ({ ...prev, teamCount: teamRes.total || members.length }))
    } catch {
      // ignore
    }
    try {
      const wRes = await getWithdrawalRecords({ page: 1, pageSize: 20 })
      const records: WithdrawalRecord[] = (wRes.list || []).map((w) => ({
        id: w.id,
        amount: w.originalAmount / 100,
        status: WITHDRAWAL_STATUS_MAP[w.status] || 'pending',
        method: methodLabel(w.method),
        createdAt: w.createdAt,
      }))
      setWithdrawals(records)
    } catch {
      // ignore
    }
  }, [methodLabel])

  const navigate = (url: string) => Taro.navigateTo({ url })

  useDidShow(() => {
    load()
  })

  const onViewTeamMember = (m: TeamMember) => {
    Taro.navigateTo({ url: `/pages/distribution/member-detail/index?id=${m.id}` })
  }

  const onViewWithdrawal = (r: WithdrawalRecord) => {
    Taro.showToast({ title: t('distribution.index.viewWithdrawal', { id: r.id }), icon: 'none' })
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="bg-gradient-to-b from-[#ff6b35] to-[#ff8e53] px-[16px] pt-[24px] pb-[20px] text-white">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <Text className="block text-[14px] opacity-90">{t('distribution.index.level')}</Text>
            <View className="ml-2">
              <LevelBadge level={info.level} size="sm" />
            </View>
          </View>
          <Text
            className="text-[12px] px-3 py-1 rounded-md bg-white/20"
            onClick={() => navigate('/pages/distribution/rank')}
          >
            {t('distribution.index.rank')}
          </Text>
        </View>
        <Text className="block text-[40px] font-bold mt-[8px]">¥{info.totalCommission}</Text>
        <Text className="block text-[12px] opacity-90 mt-[4px]">
          {t('distribution.index.totalCommission')}
        </Text>
        <View className="flex mt-[16px]">
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">¥{info.available}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">
              {t('distribution.index.available')}
            </Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">¥{info.withdrawn}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">
              {t('distribution.index.withdrawn')}
            </Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">{info.teamCount}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">
              {t('distribution.index.teamCount')}
            </Text>
          </View>
        </View>
      </View>

      <View className="mx-[12px] mt-[12px] bg-card rounded-[8px] p-[16px]">
        <View className="grid grid-cols-4 gap-[12px]">
          {menuItems.map((item) => (
            <View
              key={item.url}
              className="flex flex-col items-center"
              onClick={() => navigate(item.url)}
            >
              <Text className="text-[32px]">{item.icon}</Text>
              <Text className="text-[12px] text-foreground mt-[6px]">{item.label}</Text>
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

      <TeamManager members={team} totalCount={info.teamCount} onViewDetail={onViewTeamMember} />

      <WithdrawalRecords records={withdrawals} onViewDetail={onViewWithdrawal} />

      <InvitePoster
        inviteCode={inviteCode || `IHUI${info.level}${info.teamCount}`}
        inviteUrl="https://ihui.ai/invite/abc123"
        reward={t('distribution.index.inviteReward')}
        inviterName={t('distribution.index.inviterName')}
        onSave={() =>
          Taro.showToast({ title: t('distribution.index.posterSaved'), icon: 'success' })
        }
        onShare={() => Taro.showShareMenu({ withShareTicket: true })}
      />
    </View>
  )
}
