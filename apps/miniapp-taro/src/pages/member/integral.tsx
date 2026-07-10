import { View, Text } from '@tarojs/components'
import { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getIntegral, getMemberInfo } from '@/api'

interface IntegralItem {
  id: string
  type: string
  amount: number
  time: string
}

const PAGE_SIZE = 20

export default function IntegralPage() {
  const [list, setList] = useState<IntegralItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
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
      const res = await getIntegral({ page: pageRef.current, pageSize: PAGE_SIZE })
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

  const loadTotal = async () => {
    try {
      const info = await getMemberInfo()
      setTotal(info.integral || 0)
    } catch {
      // ignore
    }
  }

  useDidShow(() => {
    loadTotal()
    load(true)
  })
  useReachBottom(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="bg-gradient-to-b from-[#2c2c2c] to-[#1a1a1a] px-[24px] py-[40px] text-center">
        <Text className="block text-white text-[60px] font-bold">{total}</Text>
        <Text className="block text-[#d4af6a] text-[26px] mt-[8px]">当前积分</Text>
      </View>
      <View className="p-[12px]">
        {list.map(it => (
          <View key={it.id} className="bg-white rounded-[8px] p-[16px] mb-[12px] flex justify-between items-center">
            <View>
              <Text className="block text-[30px] text-[#333]">{it.type}</Text>
              <Text className="block text-[24px] text-[#999] mt-[8px]">{it.time}</Text>
            </View>
            <Text className={`text-[36px] font-semibold ${it.amount > 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
              {it.amount > 0 ? '+' : ''}{it.amount}
            </Text>
          </View>
        ))}
        {!loading && !list.length ? (
          <View className="text-center py-[120px] text-[#999]">
            <Text>暂无记录</Text>
          </View>
        ) : null}
        {loading ? (
          <View className="text-center py-[40px] text-[#999]">
            <Text>加载中...</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
