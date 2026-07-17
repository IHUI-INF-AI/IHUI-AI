import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import {
  getVipInfo,
  getVipPrivilege,
  getVipLevels,
  upgradeVip,
  signRecurringContract,
  type VipInfo,
  type VipPayInfo,
} from '@/api'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'
import {
  VipBenefitsPopup,
  VipPriceSelector,
  VipPayConfirm,
  type VipBenefit,
  type PriceOption,
} from '@/components'
import { useI18n } from '@/i18n'
import './index.css'

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

const gradient = 'linear-gradient(135deg, #f8d486, #f2b04a)'

export default function VipIndexPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<VipInfo>({} as VipInfo)
  const [benefits, setBenefits] = useState<VipBenefit[]>([])
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([])
  const [selectedPlan, setSelectedPlan] = useState<PriceOption | null>(null)
  const [showBenefits, setShowBenefits] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat')
  const [autoRenew, setAutoRenew] = useState(false)

  const load = useCallback(async () => {
    Taro.showLoading({ title: '加载中', mask: true })
    try {
      const [i, p, lv] = await Promise.all([getVipInfo(), getVipPrivilege(), getVipLevels()])
      setInfo(i)
      const list = (p.list || []).map((item) => ({
        id: String(item.id),
        title: item.title,
        desc: item.desc,
      })) as VipBenefit[]
      setBenefits(list)
      const opts = (lv.items || []).map((l) => ({
        id: String(l.id),
        name: l.levelName,
        price: l.price / 100,
        period: `${l.durationDays}天`,
      })) as PriceOption[]
      setPriceOptions(opts)
      setSelectedPlan((prev) => prev ?? opts[0] ?? null)
    } catch (e) {
      logger.error('vip/index', '获取VIP信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }, [t])

  const onSelectPlan = useCallback((opt: PriceOption) => {
    setSelectedPlan(opt)
  }, [])

  const onUpgradeClick = useCallback(() => {
    if (!selectedPlan) {
      Taro.showToast({ title: t('vip.selectPlanFirst'), icon: 'none' })
      return
    }
    setShowPayConfirm(true)
  }, [selectedPlan, t])

  const onConfirmPay = useCallback(async () => {
    if (!selectedPlan) return
    setShowPayConfirm(false)
    try {
      if (autoRenew) {
        const signRes = await signRecurringContract({ planId: selectedPlan.id })
        Taro.navigateTo({
          url: `/pages/webview/index?url=${encodeURIComponent(signRes.signUrl)}`,
        })
        return
      }
      const res = await upgradeVip(selectedPlan.id)
      dispatchVipPay(res.payInfo, res.orderNo)
    } catch (e) {
      logger.error('vip/index', '开通VIP', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [selectedPlan, autoRenew, t])

  const onBenefitsClick = useCallback(() => {
    setShowBenefits(true)
  }, [])

  useDidShow(load)

  return (
    <View className="page">
      <View className="header" style={{ background: info.level ? gradient : '#999' }}>
        <View className="level">{info.level ? info.name : t('vip.notOpened')}</View>
        {info.expireTime ? (
          <View className="expire">{t('vip.expireTime', { time: info.expireTime })}</View>
        ) : (
          <View className="expire">{t('vip.openHint')}</View>
        )}
      </View>

      <View className="card">
        <View className="card-title">{t('vip.privileges')}</View>
        <View className="grid">
          {benefits.slice(0, 8).map((p) => (
            <View key={p.id} className="grid-item" onClick={onBenefitsClick}>
              <View className="gicon">★</View>
              <Text className="gtext">{p.title}</Text>
            </View>
          ))}
        </View>
        <View className="more-btn" onClick={onBenefitsClick}>
          <Text>{t('vip.viewAllBenefits')}</Text>
        </View>
      </View>

      <View className="card">
        <View className="card-title">{t('vip.plans')}</View>
        <VipPriceSelector
          options={priceOptions}
          selectedId={selectedPlan?.id || ''}
          onSelect={onSelectPlan}
        />
        <View
          className="flex items-center mt-[24rpx] py-[8rpx]"
          onClick={() => setAutoRenew((v) => !v)}
        >
          <View
            className={`w-[36rpx] h-[36rpx] mr-[16rpx] flex items-center justify-center border-[2rpx] rounded-[8rpx] ${autoRenew ? 'bg-[#f2b04a] border-[#f2b04a]' : 'border-[#ccc] bg-white'}`}
          >
            {autoRenew && <Text className="text-white text-[24rpx] leading-none">✓</Text>}
          </View>
          <Text className="text-[24rpx] text-[#666]">开通自动续费(连续包月,可随时关闭)</Text>
        </View>
        <View
          className="mt-[12rpx] text-[22rpx] text-[#07c160]"
          onClick={() => Taro.navigateTo({ url: '/pages/subscription/contracts/index' })}
        >
          <Text>管理自动续费</Text>
        </View>
        <Button className="btn" onClick={onUpgradeClick}>
          {t('vip.subscribe')}
          {selectedPlan ? ` ¥${selectedPlan.price}` : ''}
        </Button>
      </View>

      <View className="card">
        <View className="card-title">{t('vip.memberDesc')}</View>
        <Text className="desc-text">{t('vip.memberDescText')}</Text>
      </View>

      <VipBenefitsPopup
        visible={showBenefits}
        benefits={benefits}
        onUpgrade={() => {
          setShowBenefits(false)
          setShowPayConfirm(true)
        }}
        onClose={() => setShowBenefits(false)}
      />

      <VipPayConfirm
        visible={showPayConfirm}
        planName={selectedPlan ? `${selectedPlan.name}VIP` : '会员'}
        price={selectedPlan?.price}
        originalPrice={selectedPlan?.originalPrice}
        paymentMethod={payMethod}
        onConfirm={onConfirmPay}
        onCancel={() => setShowPayConfirm(false)}
        onMethodChange={setPayMethod}
      />
    </View>
  )
}
