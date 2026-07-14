import { View, Text, ScrollView } from '@tarojs/components'
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
  pending: { label: '审核中', color: 'text-orange-500' },
  approved: { label: '已通过', color: 'text-blue-500' },
  rejected: { label: '已驳回', color: 'text-red-500' },
  completed: { label: '已完成', color: 'text-green-500' },
}

export default function WithdrawalRecords({
  records = [],
  loading = false,
  onViewDetail,
  onReachBottom,
}: WithdrawalRecordsProps) {
  return (
    <View className="bg-white mx-3 my-3 rounded-xl overflow-hidden">
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <Text className="text-sm font-medium text-gray-800">提现记录</Text>
      </View>

      <ScrollView
        scrollY
        style={{ maxHeight: '50vh' }}
        onScrollToLower={onReachBottom}
        lowerThreshold={50}
      >
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">加载中...</Text>
          </View>
        ) : records.length === 0 ? (
          <EmptyState text="暂无提现记录" />
        ) : (
          records.map((record) => {
            const status = STATUS_MAP[record.status] ?? { label: '未知', color: 'text-gray-500' }
            return (
              <View
                key={record.id}
                className="flex items-center px-4 py-3 border-b border-gray-50"
                onClick={() => onViewDetail?.(record)}
              >
                <View className="flex-1">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-gray-800">
                      ¥{record.amount.toFixed(2)}
                    </Text>
                    <Text className={`ml-2 text-xs ${status.color}`}>{status.label}</Text>
                  </View>
                  <View className="flex items-center mt-0.5">
                    {record.method && (
                      <Text className="text-xs text-gray-400 mr-2">{record.method}</Text>
                    )}
                    {record.createdAt && (
                      <Text className="text-xs text-gray-400">{record.createdAt}</Text>
                    )}
                  </View>
                  {record.remark && (
                    <Text className="block text-xs text-gray-400 mt-0.5 truncate">
                      {record.remark}
                    </Text>
                  )}
                </View>
                <Text className="text-xs text-gray-300">›</Text>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
