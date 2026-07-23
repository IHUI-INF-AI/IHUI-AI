import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useI18n } from '@/i18n'
import './details.css'

// 权益对比数据(AI 平台场景)
interface Benefit {
  label: string
  normal: string
  vip: string
}

export default function VipDetailsPage() {
  const { t } = useI18n()

  const BENEFITS: Benefit[] = [
    { label: t('vip.details.features.chatCount'), normal: '有限', vip: '无限' },
    { label: t('vip.details.features.drawCount'), normal: '5次/天', vip: '100次/天' },
    { label: t('vip.details.features.videoDuration'), normal: '5分钟', vip: '60分钟' },
    { label: t('vip.details.features.modelAccess'), normal: '基础模型', vip: '全部模型' },
    { label: t('vip.details.features.prioritySupport'), normal: '—', vip: '✓ 专属' },
    { label: t('vip.details.features.exclusiveGroup'), normal: '—', vip: '✓' },
    { label: t('vip.details.features.adExperience'), normal: '有广告', vip: '免广告' },
  ]

  const goUpgrade = () => Taro.navigateTo({ url: '/pages/vip/upgrade' })

  return (
    <View className="page">
      <View className="banner">
        <Text className="banner-title">{t('vip.details.title')}</Text>
        <Text className="banner-desc">开通 VIP,解锁全部专属特权</Text>
      </View>

      <View className="compare">
        <View className="row head">
          <Text className="cell label">{t('vip.details.feature')}</Text>
          <Text className="cell normal">{t('vip.details.normal')}</Text>
          <Text className="cell vip">{t('vip.details.vipColumn')}</Text>
        </View>
        {BENEFITS.map((b) => (
          <View className="row" key={b.label}>
            <Text className="cell label">{b.label}</Text>
            <Text className="cell normal">{b.normal}</Text>
            <Text className="cell vip">{b.vip}</Text>
          </View>
        ))}
      </View>

      <Button className="btn" onClick={goUpgrade}>
        {t('vip.details.upgrade')}
      </Button>
    </View>
  )
}
