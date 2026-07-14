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
import './index.css'

const gradient = 'linear-gradient(135deg, #f8d486, #f2b04a)'

export default function VipIndexPage() {
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
      console.error('[vip/index] 获取VIP信息 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  const goPrivilege = useCallback(() => {
    Taro.navigateTo({ url: '/pages/vip/privilege' })
  }, [])

  const onSelectPlan = useCallback((opt: PriceOption) => {
    setSelectedPlan(opt)
  }, [])

  const onUpgradeClick = useCallback(() => {
    if (!selectedPlan) {
      Taro.showToast({ title: '请先选择套餐', icon: 'none' })
      return
    }
    setShowPayConfirm(true)
  }, [selectedPlan])

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
      console.error('[vip/index] 开通VIP failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [selectedPlan])

  const onBenefitsClick = useCallback(() => {
    setShowBenefits(true)
  }, [])

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
          {benefits.slice(0, 8).map((p) => (
            <View key={p.id} className="grid-item" onClick={onBenefitsClick}>
              <View className="gicon">★</View>
              <Text className="gtext">{p.title}</Text>
            </View>
          ))}
        </View>
        <View className="more-btn" onClick={onBenefitsClick}>
          <Text>查看全部权益 ›</Text>
        </View>
      </View>

      <View className="card">
        <View className="card-title">开通套餐</View>
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
          立即开通{selectedPlan ? ` ¥${selectedPlan.price}` : ''}
        </Button>
      </View>

      <View className="card">
        <View className="card-title">会员说明</View>
        <Text className="desc-text">
          · 会员有效期内在所有终端通用{'\n'}· 自动续费可随时取消{'\n'}· 已支付订单不支持退款
        </Text>
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
        desc="VIP 开通成功，特权已激活"
        onClose={() => setShowUpgradeToast(false)}
        onUpgrade={goPrivilege}
      />
    </View>
  )
}
