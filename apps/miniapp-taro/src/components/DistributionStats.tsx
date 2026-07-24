import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import ProgressBar from './ProgressBar'

export interface DistributionStatsProps {
  totalEarnings?: number
  availableWithdrawal?: number
  pendingSettlement?: number
  withdrawnAmount?: number
  monthlyEarnings?: number
  monthlyTarget?: number
}

export default function DistributionStats({
  totalEarnings = 0,
  availableWithdrawal = 0,
  pendingSettlement = 0,
  withdrawnAmount = 0,
  monthlyEarnings = 0,
  monthlyTarget = 100,
}: DistributionStatsProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const monthlyPercent = monthlyTarget > 0 ? (monthlyEarnings / monthlyTarget) * 100 : 0

  return (
    <View className="bg-card mx-3 my-3 rounded-xl p-4">
      <View className="flex items-center justify-between mb-3">
        <Text className="text-sm font-medium text-foreground">{tt('distribution.statsTitle', '收益概览')}</Text>
        <Text className="text-xs text-muted-foreground">{tt('distribution.thisMonth', '本月')}</Text>
      </View>

      <View className="flex items-baseline mb-3">
        <Text className="text-xs text-muted-foreground mr-1">¥</Text>
        <Text className="text-2xl font-bold text-foreground">{totalEarnings.toFixed(2)}</Text>
        <Text className="text-xs text-muted-foreground ml-2">{tt('distribution.totalRevenue', '累计收益')}</Text>
      </View>

      <View className="mb-3">
        <View className="flex justify-between mb-1">
          <Text className="text-xs text-muted-foreground">{tt('distribution.monthRevenue', '本月收益')}</Text>
          <Text className="text-xs text-muted-foreground">{tt('distribution.monthlyTarget', '目标')} ¥{monthlyTarget}</Text>
        </View>
        <ProgressBar percent={monthlyPercent} color="#00f2ff" height={6} />
      </View>

      <View className="grid grid-cols-3 gap-2 pt-3">
        <View>
          <Text className="block text-xs text-muted-foreground">{tt('distribution.withdrawable', '可提现')}</Text>
          <Text className="text-sm font-medium text-primary">
            ¥{availableWithdrawal.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text className="block text-xs text-muted-foreground">{tt('distribution.pendingSettle', '待结算')}</Text>
          <Text className="text-sm font-medium text-[#f59e0b]">
            ¥{pendingSettlement.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text className="block text-xs text-muted-foreground">{tt('distribution.withdrawn', '已提现')}</Text>
          <Text className="text-sm font-medium text-muted-foreground">¥{withdrawnAmount.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  )
}
