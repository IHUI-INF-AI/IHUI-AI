import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getMemberInfo, type MemberInfo } from '@/api'
import './index.css'

export default function MemberIndexPage() {
  const [info, setInfo] = useState<MemberInfo>({} as MemberInfo)

  const load = useCallback(async () => {
    try {
      setInfo(await getMemberInfo())
    } catch (e) {
      logger.error('member/index', '获取会员信息', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  useDidShow(load)

  return (
    <View className="page">
      <View className="head">
        <View className="level-tag">{info.level || '普通用户'}</View>
        <View className="stat-row">
          <View className="stat">
            <Text className="stat-num">{info.integral}</Text>
            <Text className="stat-label">积分</Text>
          </View>
          <View className="stat">
            <Text className="stat-num">{info.growth}</Text>
            <Text className="stat-label">成长值</Text>
          </View>
          <View className="stat">
            <Text className="stat-num">{info.coupons}</Text>
            <Text className="stat-label">优惠券</Text>
          </View>
        </View>
      </View>
      <View className="menu">
        <View className="menu-item" onClick={() => navigate('/pages/member/benefits')}>
          <Text>会员权益</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/member/integral')}>
          <Text>积分明细</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/member/coupon')}>
          <Text>我的优惠券</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/member/coupon-list')}>
          <Text>领券中心</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/vip/index')}>
          <Text>VIP会员</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
