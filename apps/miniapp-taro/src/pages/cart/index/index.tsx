import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function Cart() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.selectGoods({ page: 1, pageSize: 20 })) as any
      setList(res?.list || [])
    } catch (e) {
      console.error('加载购物车失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onCheckout = useCallback(() => {
    Taro.showToast({ title: '前往结算', icon: 'none' })
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">购物车</Text>
        <Text className="btn" onClick={onCheckout}>
          结算
        </Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id} className="list-item">
              <Text>{item.title || item.name || '商品'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">购物车为空</Text>
        )}
      </View>
    </View>
  )
}
