import { View, Text } from '@tarojs/components'
import { useState, useCallback, useEffect } from 'react'
import { useReachBottom } from '@tarojs/taro'
import { getIntegral } from '@/api'
import './integral.css'

interface IntegralItem {
  id: string
  type: string
  amount: number
  time: string
}

export default function IntegralPage() {
  const [list, setList] = useState<IntegralItem[]>([])
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<'all' | 'in' | 'out'>('all')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (reset = false) => {
    if (loading) return
    let curPage = page
    if (reset) { curPage = 1; setHasMore(true); setList([]); setPage(1) }
    if (!hasMore && !reset) return
    setLoading(true)
    try {
      const res = await getIntegral({ page: curPage, pageSize: 20 })
      setList(prev => reset ? (res.list || []) : [...prev, ...(res.list || [])])
      setTotal(res.total)
      setHasMore((reset ? (res.list || []).length : list.length + (res.list || []).length) < res.total)
      setPage(curPage + 1)
    } finally { setLoading(false) }
  }, [loading, page, hasMore, list.length])

  const switchType = useCallback((t: 'all' | 'in' | 'out') => {
    setType(t)
    load(true)
  }, [load])

  useReachBottom(() => load())
  useEffect(() => { load(true) }, [])

  return (
    <View className="page">
      <View className="summary">
        <Text className="sum-num">{total}</Text>
        <Text className="sum-label">当前积分</Text>
      </View>
      <View className="tabs">
        <Text className={`tab${type === 'all' ? ' active' : ''}`} onClick={() => switchType('all')}>全部</Text>
        <Text className={`tab${type === 'in' ? ' active' : ''}`} onClick={() => switchType('in')}>收入</Text>
        <Text className={`tab${type === 'out' ? ' active' : ''}`} onClick={() => switchType('out')}>支出</Text>
      </View>
      {list.length ? (
        <View className="list">
          {list.map(it => (
            <View key={it.id} className="item">
              <View className="item-body">
                <Text className="item-title">{it.type}</Text>
                <Text className="item-time">{it.time}</Text>
              </View>
              <Text className={`item-amt${it.amount > 0 ? ' in' : ''}`}>{it.amount > 0 ? '+' : ''}{it.amount}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !list.length ? (
        <View className="empty"><Text>暂无记录</Text></View>
      ) : null}
    </View>
  )
}
