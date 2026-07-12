import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProtocol } from '@/api'

export default function ProtocolPage() {
  const [content, setContent] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await getProtocol()
      setContent(res.content)
    } catch (e) {
      console.error('[about/protocol] 获取协议内容 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-white p-[16px]">
      <Text className="text-[14px] text-[#333] leading-[24px]">{content}</Text>
    </View>
  )
}
