import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVipLevels, upgradeVip, type VipPayInfo } from '@/api'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'
import { useI18n } from '@/i18n'
import './upgrade.css'

interface Plan {
  id: string
  name: string
  price: number
  origin: number
  tag: string
}

export default function UpgradePage() {
  const { t, tList } = useI18n()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selected, setSelected] = useState(0)

  const rights = tList('vip.upgrade.rights')

  const load = useCallback(async () => {
    Taro.showLoading({ title: t('common.loading'), mask: true })
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
      Taro.showToast({ title: t('vip.upgrade.loadFailed'), icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }, [selected, t])

  const dispatchVipPay = useCallback(
    (payInfo: VipPayInfo, orderNo: string) => {
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
        Taro.showToast({ title: t('vip.upgrade.configNotReady'), icon: 'none' })
      }
      Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
    },
    [t],
  )

  const onUpgrade = useCallback(async () => {
    const plan = plans[selected]
    if (!plan) return
    try {
      const res = await upgradeVip(plan.id)
      dispatchVipPay(res.payInfo, res.orderNo)
    } catch (e) {
      logger.error('vip/upgrade', '升级VIP', e)
      Taro.showToast({ title: t('vip.upgrade.operationFailed'), icon: 'none' })
    }
  }, [plans, selected, dispatchVipPay, t])

  useDidShow(load)

  return (
    <View className="page">
      <View className="banner">
        <View className="banner-title">{t('vip.upgrade.bannerTitle')}</View>
        <View className="banner-desc">{t('vip.upgrade.bannerDesc')}</View>
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
            {p.origin ? (
              <Text className="plan-orig">{t('vip.upgrade.originalPrice', { n: p.origin })}</Text>
            ) : null}
          </View>
        ))}
      </View>
      <View className="rights">
        <View className="rights-title">{t('vip.upgrade.rightsTitle')}</View>
        {rights.map((r, i) => (
          <View key={i} className="rights-item">
            · {r}
          </View>
        ))}
      </View>
      <Button className="btn" onClick={onUpgrade}>
        {t('vip.upgrade.upgrade')} {plans[selected] ? `¥${plans[selected].price}` : ''}
      </Button>
    </View>
  )
}
