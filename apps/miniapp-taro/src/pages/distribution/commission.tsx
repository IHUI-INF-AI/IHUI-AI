import { View, Text } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getCommissionRecords, getDistributionInfo } from '@/api'

interface CommissionRecord {
  id: string
  amount: number
  type: string
  time: string
  nickname?: string
}

const PAGE_SIZE = 20

export default function DistributionCommission() {
  const [list, setList] = useState<CommissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCommission, setTotalCommission] = useState(0)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const loadSummary = async () => {
    try {
      const info = await getDistributionInfo()
      setTotalCommission(info.totalCommission)
    } catch {
      // ignore
    }
  }

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
      const items = res.list || []
      setList(prev => (reset ? items : [...prev, ...items]))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    load(true)
  }, [])

  useReachBottom(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] bg-white rounded-[8px] p-[16px]">
        <Text className="text-[12px] text-[#999]">总佣金</Text>
        <Text className="block text-[32px] text-[#333] font-bold mt-[4px]">¥{totalCommission}</Text>
      </View>
      {list.length > 0 && (
        <View className="p-[12px]">
          {list.map(r => (
            <View
              key={r.id}
              className="flex justify-between items-center bg-white p-[12px] mb-[12px] rounded-[8px]"
            >
              <View className="flex-1">
                <Text className="block text-[14px] text-[#333]">{r.type}</Text>
                <Text className="block text-[12px] text-[#999] mt-[4px]">
                  {r.time}
                  {r.nickname ? ` · ${r.nickname}` : ''}
                </Text>
              </View>
              <Text
                className={`text-[16px] font-semibold ${r.amount > 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}
              >
                {r.amount > 0 ? '+' : ''}¥{r.amount}
              </Text>
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[60px] text-[#999]">
          <Text>暂无记录</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[20px] text-[#999]">
          <Text>加载中...</Text>
        </View>
      )}
    </View>
  )
}
