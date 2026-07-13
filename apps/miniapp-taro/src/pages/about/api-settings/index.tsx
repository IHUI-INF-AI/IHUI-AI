import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { BASE_URL } from '@/utils/request'
import { get } from '@/api'
import './index.css'

interface ApiConfig {
  version: string
  environment: string
  timeout: string
}

export default function ApiSettings() {
  const [config, setConfig] = useState<ApiConfig>({
    version: '-',
    environment: '-',
    timeout: '15000ms',
  })

  const load = useCallback(async () => {
    try {
      const res = await get<ApiConfig>('/about/api-config')
      if (res) setConfig(res)
    } catch {
      // 接口不可用时使用默认值
    }
  }, [])

  const copy = useCallback((text: string) => {
    Taro.setClipboardData({ data: text })
  }, [])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="card">
        <View className="row" onClick={() => copy(BASE_URL)}>
          <Text className="label">API 地址</Text>
          <Text className="value link">{BASE_URL}</Text>
        </View>
        <View className="row">
          <Text className="label">API 版本</Text>
          <Text className="value">{config.version}</Text>
        </View>
        <View className="row">
          <Text className="label">运行环境</Text>
          <Text className="value">{config.environment}</Text>
        </View>
        <View className="row last">
          <Text className="label">请求超时</Text>
          <Text className="value">{config.timeout}</Text>
        </View>
      </View>

      <View className="card">
        <View className="row last">
          <Text className="label">网络诊断</Text>
          <Text className="value link" onClick={load}>
            点击测试
          </Text>
        </View>
      </View>

      <View className="tips">
        <Text>如遇网络异常，请检查网络连接或联系客服。</Text>
      </View>
    </View>
  )
}
