import { View, Text, ScrollView } from '@tarojs/components'
import { useI18n } from '@/i18n'
import EmptyState from './EmptyState'

export interface WithdrawalRecord {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  method?: string
  createdAt?: string
  processedAt?: string
  remark?: string
}

export interface WithdrawalRecordsProps {
  records?: WithdrawalRecord[]
  loading?: boolean
  onViewDetail?: (record: WithdrawalRecord) => void
  onReachBottom?: () => void
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '审核中', color: 'text-[#f59e0b]' },
  approved: { label: '已通过', color: 'text-primary' },
  rejected: { label: '已驳回', color: 'text-destructive' },
  completed: { label: '已完成', color: 'text-primary' },
}

export default function WithdrawalRecords({
  records = [],
  loading = false,
  onViewDetail,
  onReachBottom,
}: WithdrawalRecordsProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  return (
    <View className="bg-card mx-3 my-3 rounded-xl overflow-hidden">
      <View className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-sm font-medium text-foreground">{tt('withdrawal.records', '提现记录')}</Text>
      </View>

      <ScrollView
        scrollY
        style={{ maxHeight: '50vh' }}
        onScrollToLower={onReachBottom}
        lowerThreshold={50}
      >
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">{tt('common.loadingShort', '加载中...')}</Text>
          </View>
        ) : records.length === 0 ? (
          <EmptyState text="暂无提现记录" />
        ) : (
          records.map((record) => {
            const status = STATUS_MAP[record.status] ?? { label: '未知', color: 'text-muted-foreground' }
            return (
              <View
                key={record.id}
                className="flex items-center px-4 py-3 border-b border-border"
                onClick={() => onViewDetail?.(record)}
              >
                <View className="flex-1">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-foreground">
                      ¥{record.amount.toFixed(2)}
                    </Text>
                    <Text className={`ml-2 text-xs ${status.color}`}>{status.label}</Text>
                  </View>
                  <View className="flex items-center mt-0.5">
                    {record.method && (
                      <Text className="text-xs text-muted-foreground mr-2">{record.method}</Text>
                    )}
                    {record.createdAt && (
                      <Text className="text-xs text-muted-foreground">{record.createdAt}</Text>
                    )}
                  </View>
                  {record.remark && (
                    <Text className="block text-xs text-muted-foreground mt-0.5 truncate">
                      {record.remark}
                    </Text>
                  )}
                </View>
                <Text className="text-xs text-muted-foreground">›</Text>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
