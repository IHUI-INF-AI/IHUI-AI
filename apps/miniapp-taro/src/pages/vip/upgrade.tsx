import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVipLevels, upgradeVip, createAlipayMiniappPayment, type VipPayInfo } from '@/api'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import { useI18n } from '@/i18n'
import './upgrade.css'

type PayMethod = 'wechat' | 'alipay'

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
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')

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
    if (payMethod === 'alipay') {
      try {
        // 2026-07-24 小程序支付链路修复:先 my.getAuthCode 拿 authCode,后端兑换 buyer_id
        // 解决 40006 Insufficient Permissions(product_code=JSAPI_PAY 必传 buyer_id)
        let buyerId: string | undefined
        try {
          // @ts-ignore my.getAuthCode 是支付宝小程序全局 API,Taro 类型未含
          const authRes = await my.getAuthCode({ scopes: 'auth_user' })
          if (authRes?.authCode) {
            const exRes = await Taro.request({
              url: '/api/payments/alipay/miniapp/exchange-buyer-id',
              method: 'POST',
              data: { authCode: authRes.authCode },
            })
            const exData = (exRes.data as { code?: number; data?: { userId?: string; openId?: string } }) ?? {}
            buyerId = exData.data?.userId ?? exData.data?.openId
          }
        } catch (authErr) {
          logger.warn('vip/upgrade', 'my.getAuthCode 失败,降级 mock 模式', String(authErr))
        }
        const res = await createAlipayMiniappPayment({
          amount: plan.price,
          subject: `${t('vip.upgrade.upgrade')} - ${plan.name}`,
          productId: plan.id,
          buyerId,
        })
        if (res.mock) {
          Taro.showToast({ title: t('vip.upgrade.configNotReady'), icon: 'none' })
          return
        }
        if (!res.tradeNo) {
          Taro.showToast({ title: t('vip.upgrade.configNotReady'), icon: 'none' })
          return
        }
        requestAliPayment({ orderInfo: res.tradeNo } as AnyPayParams)
          .then(() => Taro.redirectTo({ url: `/pages/pay/result?orderNo=${res.outTradeNo}` }))
          .catch(() => Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${res.outTradeNo}` }))
      } catch (e) {
        logger.error('vip/upgrade', '支付宝升级VIP', e)
        Taro.showToast({ title: t('vip.upgrade.operationFailed'), icon: 'none' })
      }
      return
    }
    try {
      const res = await upgradeVip(plan.id)
      dispatchVipPay(res.payInfo, res.orderNo)
    } catch (e) {
      logger.error('vip/upgrade', '升级VIP', e)
      Taro.showToast({ title: t('vip.upgrade.operationFailed'), icon: 'none' })
    }
  }, [plans, selected, payMethod, dispatchVipPay, t])

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
      <View className="rights" style={{ marginTop: '24rpx' }}>
        <View className="rights-title">{t('pay.selectMethod')}</View>
        <View style={{ display: 'flex', gap: '16rpx', marginTop: '16rpx' }}>
          <View
            style={{
              flex: 1,
              padding: '20rpx 0',
              textAlign: 'center',
              borderRadius: '12rpx',
              border: `2rpx solid ${payMethod === 'wechat' ? 'var(--color-warning)' : 'var(--color-border)'}`,
              background: payMethod === 'wechat' ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-card)',
            }}
            onClick={() => setPayMethod('wechat')}
          >
            <Text style={{ fontSize: '28rpx' }}>{t('wallet.recharge.methodWechat')}</Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: '20rpx 0',
              textAlign: 'center',
              borderRadius: '12rpx',
              border: `2rpx solid ${payMethod === 'alipay' ? 'var(--color-warning)' : 'var(--color-border)'}`,
              background: payMethod === 'alipay' ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-card)',
            }}
            onClick={() => setPayMethod('alipay')}
          >
            <Text style={{ fontSize: '28rpx' }}>{t('wallet.recharge.methodAlipay')}</Text>
          </View>
        </View>
      </View>
      <Button className="btn" onClick={onUpgrade}>
        {t('vip.upgrade.upgrade')} {plans[selected] ? `¥${plans[selected].price}` : ''}
      </Button>
    </View>
  )
}
