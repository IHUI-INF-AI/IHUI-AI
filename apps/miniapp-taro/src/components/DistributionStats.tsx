import { View, Text } from '@tarojs/components'
import { useTt } from '@/i18n'
import ProgressBar from './ProgressBar'

export type ColumnItemColor = 'default' | 'primary' | 'warning' | 'destructive'

export interface ColumnItem {
  label: string
  value: string | number
  color?: ColumnItemColor
}

export interface DistributionStatsProps {
  totalEarnings?: number
  availableWithdrawal?: number
  pendingSettlement?: number
  withdrawnAmount?: number
  monthlyEarnings?: number
  monthlyTarget?: number
  variant?: 'default' | 'column'
  columnTitle?: string
  columnItems?: ColumnItem[]
}

const COLUMN_VALUE_COLOR_CLASS: Record<ColumnItemColor, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  warning: 'text-warning',
  destructive: 'text-destructive',
}

export default function DistributionStats({
  totalEarnings = 0,
  availableWithdrawal = 0,
  pendingSettlement = 0,
  withdrawnAmount = 0,
  monthlyEarnings = 0,
  monthlyTarget = 100,
  variant = 'default',
  columnTitle,
  columnItems = [],
}: DistributionStatsProps) {
  const tt = useTt()

  if (variant === 'column') {
    const title = columnTitle ?? tt('distribution.columnTitle', '分销订单')
    return (
      <View className="bg-card mx-3 my-3 rounded-xl p-4">
        <View className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium text-foreground">{title}</Text>
        </View>
        <View className="flex flex-col gap-3">
          {columnItems.map((item, index) => {
            const colorClass = COLUMN_VALUE_COLOR_CLASS[item.color ?? 'default']
            return (
              <View key={`col-${index}-${item.label}`} className="flex items-center justify-between">
                <Text className="text-sm text-muted-foreground">{item.label}</Text>
                <Text className={`text-sm font-medium ${colorClass}`}>{item.value}</Text>
              </View>
            )
          })}
        </View>
      </View>
    )
  }

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
        <ProgressBar percent={monthlyPercent} color="var(--color-primary)" height={6} />
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
          <Text className="text-sm font-medium text-warning">
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
