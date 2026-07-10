import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getCouponList } from '@/api'
import './coupon.css'

interface Coupon {
  id: string
  title: string
  amount: number
  threshold: number
  expireTime: string
  status: string
}

export default function CouponPage() {
  const [list, setList] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('unused')

  const load = useCallback(async (s?: string) => {
    setLoading(true)
    try { setList((await getCouponList({ status: s ?? status })).list || []) } finally { setLoading(false) }
  }, [status])

  const switchTab = useCallback((s: string) => {
    setStatus(s)
    load(s)
  }, [load])

  const goList = useCallback(() => {
    Taro.navigateTo({ url: '/pages/member/coupon-list' })
  }, [])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="tabs">
        <Text className={`tab${status === 'unused' ? ' active' : ''}`} onClick={() => switchTab('unused')}>未使用</Text>
        <Text className={`tab${status === 'used' ? ' active' : ''}`} onClick={() => switchTab('used')}>已使用</Text>
        <Text className={`tab${status === 'expired' ? ' active' : ''}`} onClick={() => switchTab('expired')}>已过期</Text>
      </View>
      {list.length ? (
        <View className="list">
          {list.map(c => (
            <View key={c.id} className={`coupon${c.status !== 'unused' ? ' disabled' : ''}`}>
              <View className="coupon-left">
                <Text className="c-amt">{c.amount}</Text>
                <Text className="c-unit">元</Text>
              </View>
              <View className="coupon-right">
                <Text className="c-title">{c.title}</Text>
                <Text className="c-thres">满{c.threshold}可用</Text>
                <Text className="c-time">{c.expireTime}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !list.length ? (
        <View className="empty"><Text>暂无优惠券</Text></View>
      ) : null}
      <Button className="btn" onClick={goList}>领券中心</Button>
    </View>
  )
}
