// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 第 5 批部分薄壳:档位/权益/刷新/返回下沉共享 VipScreen;支付方式+CTA 留页内(RN 侧为本地 PricePlan/pay 段,缺段表登记)。

import './upgrade.css'
import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVipLevels, upgradeVip, type VipPayInfo } from '@ihui/api-client'
import { unwrapApi } from '@/utils/api-bridge'
import { createAlipayMiniappPayment, post } from '@/api'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import { VipScreen as SharedVipScreen } from '@ihui/rn-app/features/vip/VipScreen'
import { buildUpgradeLevels, buildUpgradeRights } from './upgrade-props'
import type { TFunction, VipLevelItem2 } from '@ihui/types'

type PayMethod = 'wechat' | 'alipay'

export default function UpgradePage() {
  const tt = useTt()
  const { t, tList } = useI18n()
  const { resolvedTheme } = useTheme()
  const [levels, setLevels] = useState<VipLevelItem2[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await unwrapApi(getVipLevels())
      const list = buildUpgradeLevels(res.items || [])
      setLevels(list)
      setSelectedId((prev) =>
        prev && list.some((l) => l.id === prev) ? prev : (list[0]?.id ?? null),
      )
    } catch (e) {
      logger.error('vip/upgrade', t('vipUpgrade.q1'), e)
      setError(t('vip.upgrade.loadFailed'))
      onToast(t('vip.upgrade.loadFailed'), { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }, [t])

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
          .then(() =>
            Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=paid` }),
          )
          .catch(() =>
            Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` }),
          )
        return
      }
      if (payInfo.method === 'h5' && payInfo.h5Url && process.env.TARO_ENV === 'h5') {
        window.location.href = payInfo.h5Url
        return
      }
      if (payInfo.mock && payInfo.error) {
        onToast(t('vip.upgrade.configNotReady'), { kind: 'error' })
      }
      Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}` })
    },
    [t],
  )

  const pay = useCallback(
    async (plan: VipLevelItem2) => {
      if (payingId) return
      setPayingId(plan.id)
      try {
        if (payMethod === 'alipay') {
          try {
            // 支付宝小程序:先 my.getAuthCode 换 buyer_id(40006 需 product_code=JSAPI_PAY)
            let buyerId: string | undefined
            try {
              // @ts-expect-error my.getAuthCode 是支付宝小程序全局 API,Taro 类型未含
              const authRes = await my.getAuthCode({ scopes: 'auth_user' })
              if (authRes?.authCode) {
                const exData = await post<{ userId?: string; openId?: string }>(
                  '/payments/alipay/miniapp/exchange-buyer-id',
                  { authCode: authRes.authCode },
                )
                buyerId = exData.userId ?? exData.openId
              }
            } catch (authErr) {
              logger.warn(
                'vip/upgrade',
                tt('vipUpgrade.r1', 'my.getAuthCode 失败,降级 mock 模式'),
                authErr instanceof Error ? authErr.message : String(authErr),
              )
            }
            const res = await createAlipayMiniappPayment({
              amount: plan.price,
              subject: `${t('vip.upgrade.upgrade')} - ${plan.levelName}`,
              productId: plan.id,
              buyerId,
            })
            if (res.mock) {
              onToast(t('vip.upgrade.configNotReady'), { kind: 'error' })
              return
            }
            if (!res.tradeNo) {
              onToast(t('vip.upgrade.configNotReady'), { kind: 'error' })
              return
            }
            requestAliPayment({ tradeNO: res.tradeNo } as AnyPayParams)
              .then(() =>
                Taro.redirectTo({
                  url: `/pkg-shop/pay/result/index?orderNo=${res.outTradeNo}&status=paid`,
                }),
              )
              .catch(() =>
                Taro.redirectTo({
                  url: `/pkg-shop/pay/result/index?orderNo=${res.outTradeNo}&status=failed`,
                }),
              )
          } catch (e) {
            logger.error('vip/upgrade', t('vipUpgrade.q2'), e)
            onToast(t('vip.upgrade.operationFailed'), { kind: 'error' })
          }
          return
        }
        const res = await unwrapApi(upgradeVip(plan.id))
        dispatchVipPay(res.payInfo, res.orderNo)
      } catch (e) {
        logger.error('vip/upgrade', t('vipUpgrade.q3'), e)
        onToast(t('vip.upgrade.operationFailed'), { kind: 'error' })
      } finally {
        setPayingId(null)
      }
    },
    [dispatchVipPay, payingId, payMethod, t, tt],
  )

  useDidShow(load)

  const selectedPlan = levels.find((l) => l.id === selectedId) ?? null

  return (
    <ThemeRoot className="shell">
      <View className="banner">
        <View className="banner-title">{t('vip.upgrade.bannerTitle')}</View>
        <View className="banner-desc">{t('vip.upgrade.bannerDesc')}</View>
      </View>
      <SharedVipScreen
        t={t as unknown as TFunction}
        levels={levels}
        membership={null}
        loading={loading}
        refreshing={false}
        error={error}
        toast=""
        purchasingId={payingId}
        onRefresh={() => void load()}
        onPurchase={(level: VipLevelItem2) => {
          setSelectedId(level.id)
          void pay(level)
        }}
        onBack={() => {
          void Taro.navigateBack()
        }}
        colorScheme={resolvedTheme}
        onNavigate={() => {}}
        onToast={onToast}
        features={buildUpgradeRights(tList('vip.upgrade.rights'))}
      />
      <View className="rights">
        <View className="rights-title">{t('pay.selectMethod')}</View>
        <View className="pay-methods">
          <View
            className={`pay-method${payMethod === 'wechat' ? ' active' : ''}`}
            hoverClass="opacity-60"
            onClick={() => setPayMethod('wechat')}
          >
            <Text className="pay-method-text">{t('wallet.recharge.methodWechat')}</Text>
          </View>
          <View
            className={`pay-method${payMethod === 'alipay' ? ' active' : ''}`}
            hoverClass="opacity-60"
            onClick={() => setPayMethod('alipay')}
          >
            <Text className="pay-method-text">{t('wallet.recharge.methodAlipay')}</Text>
          </View>
        </View>
      </View>
      <Button className="btn" onClick={() => selectedPlan && void pay(selectedPlan)}>
        {t('vip.upgrade.upgrade')} {selectedPlan ? `¥${selectedPlan.price}` : ''}
      </Button>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
