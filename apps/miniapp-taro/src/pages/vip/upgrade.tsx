import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVipLevels, upgradeVip, type VipPayInfo } from '@/api'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'
import './upgrade.css'

interface Plan {
  id: string
  name: string
  price: number
  origin: number
  tag: string
}

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
  const [plans, setPlans] = useState<Plan[]>([])
  const [selected, setSelected] = useState(0)

  const load = useCallback(async () => {
    Taro.showLoading({ title: '加载中', mask: true })
    try {
      const res = await getVipLevels()
      const list: Plan[] = (res.items || []).map((l) => ({
        id: String(l.id),
        name: l.levelName,
        price: l.price / 100,
        origin: 0,
        tag: '',
      }))
      setPlans(list)
      if (list.length && selected >= list.length) setSelected(0)
    } catch (e) {
      logger.error('vip/upgrade', '获取VIP等级', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }, [selected])

  const onUpgrade = useCallback(async () => {
    const plan = plans[selected]
    if (!plan) return
    try {
      const res = await upgradeVip(plan.id)
      dispatchVipPay(res.payInfo, res.orderNo)
    } catch (e) {
      logger.error('vip/upgrade', '升级VIP', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [plans, selected])

  useDidShow(load)

  return (
    <View className="page">
      <View className="banner">
        <View className="banner-title">升级VIP会员</View>
        <View className="banner-desc">解锁更多专属特权</View>
      </View>
      <View className="plans">
        {plans.map((p, i) => (
          <View
            key={p.id}
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
        立即升级 {plans[selected] ? `¥${plans[selected].price}` : ''}
      </Button>
    </View>
  )
}
