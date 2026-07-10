import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getCouponList } from '@/api'
import './coupon-list.css'

interface Coupon {
  id: string
  title: string
  amount: number
  threshold: number
  expireTime: string
  status: string
}

export default function CouponListPage() {
  const [list, setList] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setList((await getCouponList({ status: 'available' })).list || []) } finally { setLoading(false) }
  }, [])

  const onReceive = useCallback((_id: string) => {
    Taro.showToast({ title: '领取成功', icon: 'success' })
    load()
  }, [load])

  useDidShow(load)

  return (
    <View className="page">
      {list.length ? (
        <View className="list">
          {list.map(c => (
            <View key={c.id} className="coupon">
              <View className="coupon-left">
                <Text className="c-amt">{c.amount}</Text>
                <Text className="c-unit">元</Text>
              </View>
              <View className="coupon-right">
                <Text className="c-title">{c.title}</Text>
                <Text className="c-thres">满{c.threshold}可用</Text>
                <Text className="c-time">有效期至 {c.expireTime}</Text>
              </View>
              <View className="coupon-btn" onClick={() => onReceive(c.id)}>领取</View>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !list.length ? (
        <View className="empty"><Text>暂无可领取优惠券</Text></View>
      ) : null}
    </View>
  )
}
