'use client'

import { Text, View } from 'react-native'

/**
 * 离线 Banner 组件(2026-07-22 P0 Round 5 鲁棒性加固)。
 *
 * 当网络探测失败时显示顶部红色横条,提示用户网络已断开。
 * 使用 fetch 探测而非 @react-native-community/netinfo,避免引入新原生依赖。
 */
export interface OfflineBannerProps {
  isOnline: boolean
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline) return null
  return (
    <View className="bg-red-500 py-1.5 px-3 items-center" accessibilityRole="alert">
      <Text className="text-white text-[13px] font-medium">网络已断开,部分功能不可用</Text>
    </View>
  )
}
