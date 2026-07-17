import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { upgradeVip, type VipPayInfo } from '@/api'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'
import './upgrade.css'

const plans = [
  { name: '月度VIP', price: 19, origin: 30, tag: '' },
  { name: '季度VIP', price: 49, origin: 90, tag: '推荐' },
  { name: '年度VIP', price: 158, origin: 360, tag: '超值' },
]
const rights = ['全部课程免费学', 'AI对话不限次', '专属客服服务', '会员专属折扣', '高清视频下载']

function dispatchVipPay(payInfo: VipPayInfo, orderNo: string) {
  if (
    payInfo.method === 'jsapi' &&
    payInfo.timeStamp &&
    payInfo.nonceStr &&
    payInfo.package &&
    payInfo.signType &&
    payInfo.paySign
  ) {
    requestWxPayment(payInfo as AnyPayParams)
      .then(() => Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` }))
      .catch(() => Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${orderNo}` }))
    return
  }
  if (payInfo.method === 'h5' && payInfo.h5Url && process.env.TARO_ENV === 'h5') {
    window.location.href = payInfo.h5Url
    return
  }
  if (payInfo.mock && payInfo.error) {
    Taro.showToast({ title: '支付配置未就绪,请联系管理员', icon: 'none' })
  }
  Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
}

export default function UpgradePage() {
  const [selected, setSelected] = useState(2)

  const onUpgrade = useCallback(async () => {
    try {
      const res = await upgradeVip(selected + 1)
      dispatchVipPay(res.payInfo, res.orderNo)
    } catch (e) {
      logger.error('vip/upgrade', '升级VIP', e)
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
