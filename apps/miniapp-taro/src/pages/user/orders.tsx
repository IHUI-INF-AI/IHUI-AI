import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getOrderList, type Order } from '@/api'

const statusColors: Record<Order['status'], string> = {
  paid: 'text-[#4cd964]',
  pending: 'text-[#f0ad4e]',
  cancelled: 'text-[#999]',
  refunded: 'text-[#dd524d]',
}

function statusText(s: Order['status']) {
  const map: Record<Order['status'], string> = {
    pending: '待付款',
    paid: '已付款',
    cancelled: '已取消',
    refunded: '已退款',
  }
  return map[s] || s
}

export default function Orders() {
  const [list, setList] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 10

  const load = useCallback(
    async (reset = false) => {
      if (loading) return
      let curPage = page
      let curList = list
      if (reset) {
        curPage = 1
        curList = []
        setList([])
        setHasMore(true)
      }
      if (!hasMore && !reset) return
      setLoading(true)
      try {
        const res = await getOrderList({ page: curPage, pageSize, status })
        const newList = [...curList, ...(res.list || [])]
        setList(newList)
        setHasMore(newList.length < res.total)
        setPage(curPage + 1)
      } catch {
        // 统一提示
      } finally {
        setLoading(false)
      }
    },
    [loading, page, hasMore, status, list, pageSize],
  )

  function switchStatus(s: string) {
    setStatus(s)
    setTimeout(() => load(true), 0)
  }

  function handlePay(item: Order) {
    Taro.showToast({ title: `支付订单 ${item.orderNo}`, icon: 'none' })
  }

  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    load(true)
  }, [load])

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    load()
  })

  const tabs = [
    { key: '', label: '全部' },
    { key: 'pending', label: '待付款' },
    { key: 'paid', label: '已付款' },
    { key: 'cancelled', label: '已取消' },
  ]

  return (
    <View className="min-h-screen px-[16px] py-[12px]">
      {/* 状态筛选 */}
      <View className="flex mb-[12px] bg-white rounded-[6px]">
        {tabs.map((tab) => (
          <View
            key={tab.key}
            className={`flex-1 text-center py-[10px] text-[13px] ${
              status === tab.key ? 'text-[#07c160] font-semibold' : 'text-[#666]'
            }`}
            onClick={() => switchStatus(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      {/* 订单列表 */}
      {list.length > 0 ? (
        <View>
          {list.map((item) => (
            <View key={item.id} className="bg-white rounded-[8px] px-[12px] py-[12px] mb-[12px]">
              <View className="flex justify-between items-center">
                <Text className="text-[12px] text-[#999]">订单号：{item.orderNo}</Text>
                <Text className={`text-[13px] ${statusColors[item.status]}`}>
                  {statusText(item.status)}
                </Text>
              </View>
              <View className="flex flex-col my-[10px]">
                <Text className="text-[15px] text-[#333] font-semibold">{item.title}</Text>
                <Text className="mt-[4px] text-[12px] text-[#999]">{item.type}</Text>
              </View>
              <View className="flex items-center pt-[10px] border-t-[1px] border-solid border-[#f5f5f5]">
                <Text className="flex-1 text-[12px] text-[#999]">{item.createTime}</Text>
                <View className="mr-[12px]">
                  <Text className="text-[12px] text-[#dd524d]">¥</Text>
                  <Text className="text-[17px] text-[#dd524d] font-bold">{item.amount}</Text>
                </View>
                {item.status === 'pending' ? (
                  <View
                    className="px-[16px] py-[5px] bg-[#07c160] text-white rounded-[15px] text-[13px]"
                    onClick={() => handlePay(item)}
                  >
                    <Text>去支付</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && list.length === 0 ? (
        <View className="text-center py-[60px] text-[#999] text-[13px]">
          <Text>暂无订单</Text>
        </View>
      ) : null}
      {loading ? (
        <View className="text-center py-[60px] text-[#999] text-[13px]">
          <Text>加载中...</Text>
        </View>
      ) : null}
    </View>
  )
}
