import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getVipInfo, getVipPrivilege, upgradeVip, type VipInfo } from '@/api'
import './index.css'

const gradient = 'linear-gradient(135deg, #f8d486, #f2b04a)'

export default function VipIndexPage() {
  const [info, setInfo] = useState<VipInfo>({} as VipInfo)
  const [privileges, setPrivileges] = useState<Array<{ id: string; title: string; desc: string }>>([])
  const [selected, setSelected] = useState(3)

  const load = useCallback(async () => {
    try {
      const [i, p] = await Promise.all([getVipInfo(), getVipPrivilege()])
      setInfo(i)
      setPrivileges(p.list || [])
    } catch (e) {}
  }, [])

  const goPrivilege = useCallback(() => {
    Taro.navigateTo({ url: '/pages/vip/privilege' })
  }, [])

  const onUpgrade = useCallback(async () => {
    try {
      const res = await upgradeVip(selected)
      Taro.navigateTo({ url: `/pages/pay/index?orderNo=${res.orderNo}` })
    } catch (e) {}
  }, [selected])

  useDidShow(load)

  return (
    <View className="page">
      <View className="header" style={{ background: info.level ? gradient : '#999' }}>
        <View className="level">{info.level ? info.name : '未开通VIP'}</View>
        {info.expireTime ? (
          <View className="expire">到期时间：{info.expireTime}</View>
        ) : (
          <View className="expire">开通VIP享更多特权</View>
        )}
      </View>

      <View className="card">
        <View className="card-title">VIP特权</View>
        <View className="grid">
          {privileges.map(p => (
            <View key={p.id} className="grid-item" onClick={goPrivilege}>
              <View className="gicon">★</View>
              <Text className="gtext">{p.title}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="card">
        <View className="card-title">开通套餐</View>
        <View className="plans">
          {[1, 2, 3].map(lv => (
            <View
              key={lv}
              className={`plan${selected === lv ? ' active' : ''}`}
              onClick={() => setSelected(lv)}
            >
              <Text className="plan-name">{['月度', '季度', '年度'][lv - 1]}VIP</Text>
              <Text className="plan-price">¥{[19, 49, 158][lv - 1]}</Text>
            </View>
          ))}
        </View>
        <Button className="btn" onClick={onUpgrade}>立即开通</Button>
      </View>
    </View>
  )
}
