import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getMemberInfo, type MemberInfo } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function MemberIndexPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<MemberInfo>({} as MemberInfo)

  const load = useCallback(async () => {
    try {
      setInfo(await getMemberInfo())
    } catch (e) {
      logger.error('member/index', '获取会员信息', e)
      Taro.showToast({ title: t('member.index.loadFailed'), icon: 'none' })
    }
  }, [t])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  useDidShow(load)

  return (
    <View className="page">
      <View className="head">
        <View className="level-tag">{info.level || t('member.index.defaultLevel')}</View>
        <View className="stat-row">
          <View className="stat">
            <Text className="stat-num">{info.integral}</Text>
            <Text className="stat-label">{t('member.index.integral')}</Text>
          </View>
          <View className="stat">
            <Text className="stat-num">{info.growth}</Text>
            <Text className="stat-label">{t('member.index.growth')}</Text>
          </View>
          <View className="stat">
            <Text className="stat-num">{info.coupons}</Text>
            <Text className="stat-label">{t('member.index.coupons')}</Text>
          </View>
        </View>
      </View>
      <View className="menu">
        <View className="menu-item" onClick={() => navigate('/pages/member/benefits')}>
          <Text>{t('member.index.benefits')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/member/integral')}>
          <Text>{t('member.index.integralDetail')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/member/coupon')}>
          <Text>{t('member.index.myCoupons')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/member/coupon-list')}>
          <Text>{t('member.index.couponCenter')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/vip/index')}>
          <Text>{t('member.index.vip')}</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
