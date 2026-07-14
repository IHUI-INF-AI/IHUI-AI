import { View, Text } from '@tarojs/components'
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
  const monthlyPercent = monthlyTarget > 0 ? (monthlyEarnings / monthlyTarget) * 100 : 0

  return (
    <View className="bg-white mx-3 my-3 rounded-xl p-4">
      <View className="flex items-center justify-between mb-3">
        <Text className="text-sm font-medium text-gray-800">收益概览</Text>
        <Text className="text-xs text-gray-400">本月</Text>
      </View>

      <View className="flex items-baseline mb-3">
        <Text className="text-xs text-gray-500 mr-1">¥</Text>
        <Text className="text-2xl font-bold text-gray-800">{totalEarnings.toFixed(2)}</Text>
        <Text className="text-xs text-gray-400 ml-2">累计收益</Text>
      </View>

      <View className="mb-3">
        <View className="flex justify-between mb-1">
          <Text className="text-xs text-gray-500">本月收益</Text>
          <Text className="text-xs text-gray-500">目标 ¥{monthlyTarget}</Text>
        </View>
        <ProgressBar percent={monthlyPercent} color="#10b981" height={6} />
      </View>

      <View className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
        <View>
          <Text className="block text-xs text-gray-400">可提现</Text>
          <Text className="text-sm font-medium text-green-600">
            ¥{availableWithdrawal.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text className="block text-xs text-gray-400">待结算</Text>
          <Text className="text-sm font-medium text-orange-500">
            ¥{pendingSettlement.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text className="block text-xs text-gray-400">已提现</Text>
          <Text className="text-sm font-medium text-gray-600">¥{withdrawnAmount.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  )
}
