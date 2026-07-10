import { View, Text } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getCommissionRecords } from '@/api'

interface CommissionRecord {
  id: string
  amount: number
  type: string
  time: string
  nickname?: string
}

type FilterType = 'all' | 'in' | 'out'

const TABS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'in', label: '收入' },
  { value: 'out', label: '支出' },
]

const PAGE_SIZE = 20

export default function DistributionCommission() {
  const [list, setList] = useState<CommissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<FilterType>('all')
  const typeRef = useRef<FilterType>('all')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getCommissionRecords({ page: pageRef.current, pageSize: PAGE_SIZE })
      let items = res.list || []
      if (typeRef.current === 'in') items = items.filter(i => i.amount > 0)
      if (typeRef.current === 'out') items = items.filter(i => i.amount < 0)
      setList(prev => (reset ? items : [...prev, ...items]))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch (e) {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const switchTab = (t: FilterType) => {
    typeRef.current = t
    setType(t)
    load(true)
  }

  useEffect(() => {
    load(true)
  }, [])

  useReachBottom(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="flex bg-white">
        {TABS.map(tab => (
          <Text
            key={tab.value}
            className={`flex-1 text-center text-[26rpx] py-[24rpx] ${type === tab.value ? 'text-[#ff6e3c] font-semibold' : 'text-[#666]'}`}
            onClick={() => switchTab(tab.value)}
          >
            {tab.label}
          </Text>
        ))}
      </View>
      {list.length > 0 && (
        <View className="p-[24rpx]">
          {list.map(r => (
            <View
              key={r.id}
              className="flex justify-between items-center bg-white p-[32rpx] mb-[24rpx] rounded-[16rpx]"
            >
              <View className="flex-1">
                <Text className="block text-[28rpx] text-[#333]">{r.type}</Text>
                <Text className="block text-[22rpx] text-[#999] mt-[8rpx]">
                  {r.time}
                  {r.nickname ? ` · ${r.nickname}` : ''}
                </Text>
              </View>
              <Text
                className={`text-[32rpx] font-semibold ${r.amount > 0 ? 'text-[#4caf50]' : 'text-[#dd524d]'}`}
              >
                {r.amount > 0 ? '+' : ''}¥{r.amount}
              </Text>
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[120rpx] text-[#999]">
          <Text>暂无记录</Text>
        </View>
      )}
    </View>
  )
}
