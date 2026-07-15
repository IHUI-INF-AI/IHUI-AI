import { View, Button, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'

export interface CustomerServiceFloatProps {
  visible?: boolean
}

export default function CustomerServiceFloat({ visible = true }: CustomerServiceFloatProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!visible) {
      setShow(false)
      return
    }
    const currentPage = Taro.getCurrentInstance().router?.path || ''
    const tabBarPaths = [
      'pages/index/index',
      'pages/course/list',
      'pages/live/list',
      'pages/ai/chat',
      'pages/user/index',
    ]
    const normalized = currentPage.startsWith('/') ? currentPage.slice(1) : currentPage
    setShow(!tabBarPaths.includes(normalized))
  }, [visible])

  if (!show) return null

  return (
    <View className="cs-float">
      <Button
        className="cs-float-btn"
        openType="contact"
        sessionFrom="global_float"
        showMessageCard
        sendMessageTitle="客服咨询"
        sendMessagePath="/pages/index/index"
      >
        <Text className="cs-float-icon">💬</Text>
        <Text className="cs-float-label">咨询</Text>
      </Button>
    </View>
  )
}
