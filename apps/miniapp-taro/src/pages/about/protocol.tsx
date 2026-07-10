import { View, Text, RichText } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProtocol } from '@/api'
import './protocol.css'

export default function ProtocolPage() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getProtocol()
      setContent(res.content)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())

  return (
    <View className="page">
      {loading ? (
        <View className="loading"><Text>加载中...</Text></View>
      ) : (
        <View className="content">
          <RichText nodes={content} />
        </View>
      )}
    </View>
  )
}
