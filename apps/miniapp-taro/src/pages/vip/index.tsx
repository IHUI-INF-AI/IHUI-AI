import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVipInfo, getVipPrivilege, upgradeVip, type VipInfo } from '@/api'
import {
  VipBenefitsPopup,
  VipUpgradeToast,
  VipPriceSelector,
  VipPayConfirm,
  type VipBenefit,
  type PriceOption,
} from '@/components'
import { useI18n } from '@/i18n'
import './index.css'

const gradient = 'linear-gradient(135deg, #f8d486, #f2b04a)'

export default function VipIndexPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<VipInfo>({} as VipInfo)
  const [benefits, setBenefits] = useState<VipBenefit[]>([])
  const [selectedPlan, setSelectedPlan] = useState<PriceOption | null>(null)
  const [showBenefits, setShowBenefits] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [showUpgradeToast, setShowUpgradeToast] = useState(false)
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat')

  const load = useCallback(async () => {
    try {
      const [i, p] = await Promise.all([getVipInfo(), getVipPrivilege()])
      setInfo(i)
      const list = (p.list || []).map((item) => ({
        id: String(item.id),
        title: item.title,
        desc: item.desc,
      })) as VipBenefit[]
      setBenefits(list)
    } catch (e) {
      logger.error('vip/index', '获取VIP信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  const goPrivilege = useCallback(() => {
    Taro.navigateTo({ url: '/pages/vip/privilege' })
  }, [])

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
      const res = await upgradeVip(Number(selectedPlan.id))
      setShowUpgradeToast(true)
      setTimeout(() => {
        Taro.navigateTo({ url: `/pages/pay/index?orderNo=${res.orderNo}` })
      }, 1500)
    } catch (e) {
      logger.error('vip/index', '开通VIP', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [selectedPlan, t])

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
          options={[
            { id: '1', name: '月度', price: 19, period: '1个月' },
            {
              id: '2',
              name: '季度',
              price: 49,
              originalPrice: 57,
              period: '3个月',
              popular: true,
              discount: '8.6折',
            },
            {
              id: '3',
              name: '年度',
              price: 158,
              originalPrice: 228,
              period: '12个月',
              discount: '6.9折',
            },
          ]}
          selectedId={selectedPlan?.id || '3'}
          onSelect={onSelectPlan}
        />
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

      <VipUpgradeToast
        visible={showUpgradeToast}
        desc={t('vip.upgradeSuccess')}
        onClose={() => setShowUpgradeToast(false)}
        onUpgrade={goPrivilege}
      />
    </View>
  )
}
