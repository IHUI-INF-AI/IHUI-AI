import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { upgradeVip } from '@/api'
import './upgrade.css'

const plans = [
  { name: '月度VIP', price: 19, origin: 30, tag: '' },
  { name: '季度VIP', price: 49, origin: 90, tag: '推荐' },
  { name: '年度VIP', price: 158, origin: 360, tag: '超值' },
]
const rights = ['全部课程免费学', 'AI对话不限次', '专属客服服务', '会员专属折扣', '高清视频下载']

export default function UpgradePage() {
  const [selected, setSelected] = useState(2)

  const onUpgrade = useCallback(async () => {
    try {
      const res = await upgradeVip(selected + 1)
      Taro.navigateTo({ url: `/pages/pay/index?orderNo=${res.orderNo}` })
    } catch (e) {
      console.error('[vip/upgrade] 升级VIP failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [selected])

  return (
    <View className="page">
      <View className="banner">
        <View className="banner-title">升级VIP会员</View>
        <View className="banner-desc">解锁更多专属特权</View>
      </View>
      <View className="plans">
        {plans.map((p, i) => (
          <View
            key={i}
            className={`plan${selected === i ? ' active' : ''}`}
            onClick={() => setSelected(i)}
          >
            {p.tag ? <View className="plan-tag">{p.tag}</View> : null}
            <Text className="plan-name">{p.name}</Text>
            <Text className="plan-price">¥{p.price}</Text>
            {p.origin ? <Text className="plan-orig">原价¥{p.origin}</Text> : null}
          </View>
        ))}
      </View>
      <View className="rights">
        <View className="rights-title">会员权益</View>
        {rights.map((r, i) => (
          <View key={i} className="rights-item">
            · {r}
          </View>
        ))}
      </View>
      <Button className="btn" onClick={onUpgrade}>
        立即升级 ¥{plans[selected]!.price}
      </Button>
    </View>
  )
}
