import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import './success.css'

export default function VipSuccessPage() {
  const { t } = useI18n()
  const router = useRouter()
  const orderNo = router.params.orderNo || ''
  const amount = Number(router.params.amount) || 0
  const planName = router.params.planName ? decodeURIComponent(router.params.planName) : ''
  const payTime = router.params.payTime
    ? decodeURIComponent(router.params.payTime)
    : new Date().toLocaleString('zh-CN')

  const goBenefits = () => {
    Taro.redirectTo({ url: '/pages/vip/index' })
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  return (
    <View className="vs-page">
      <View className="vs-icon-wrap">
        <Text className="vs-icon">✓</Text>
      </View>
      <Text className="vs-title">{t('vip.index.successTitle')}</Text>
      <Text className="vs-desc">{t('vip.success.desc')}</Text>

      <View className="vs-info-card">
        <View className="vs-info-row">
          <Text className="vs-info-label">{t('vip.success.planName')}</Text>
          <Text className="vs-info-value">
            {planName || t('vip.index.memberFallback')}
          </Text>
        </View>
        <View className="vs-info-row">
          <Text className="vs-info-label">{t('vip.success.amount')}</Text>
          <Text className="vs-info-value">¥{amount}</Text>
        </View>
        <View className="vs-info-row">
          <Text className="vs-info-label">{t('vip.success.payTime')}</Text>
          <Text className="vs-info-value">{payTime}</Text>
        </View>
        {orderNo ? (
          <View className="vs-info-row">
            <Text className="vs-info-label">{t('order.orderNo')}</Text>
            <Text className="vs-info-value vs-order-no">{orderNo}</Text>
          </View>
        ) : null}
      </View>

      <View className="vs-btn-group">
        <Button className="vs-btn-primary" onClick={goBenefits}>
          {t('vip.index.viewBenefits')}
        </Button>
        <Button className="vs-btn-outline" onClick={goHome}>
          {t('pay.backHome')}
        </Button>
      </View>
    </View>
  )
}
