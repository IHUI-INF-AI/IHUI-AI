import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View } from '@tarojs/components'

export default function TopUpPage() {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/wallet/recharge/index' })
  }, [])

  return <View />
}
