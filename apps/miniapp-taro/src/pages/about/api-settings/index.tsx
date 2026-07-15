import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { BASE_URL } from '@/utils/request'
import { get } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface ApiConfig {
  version: string
  environment: string
  timeout: string
}

export default function ApiSettings() {
  const { t } = useI18n()
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
          <Text className="label">{t('about.apiSettings.apiUrl')}</Text>
          <Text className="value link">{BASE_URL}</Text>
        </View>
        <View className="row">
          <Text className="label">{t('about.apiSettings.apiVersion')}</Text>
          <Text className="value">{config.version}</Text>
        </View>
        <View className="row">
          <Text className="label">{t('about.apiSettings.environment')}</Text>
          <Text className="value">{config.environment}</Text>
        </View>
        <View className="row last">
          <Text className="label">{t('about.apiSettings.timeout')}</Text>
          <Text className="value">{config.timeout}</Text>
        </View>
      </View>

      <View className="card">
        <View className="row last">
          <Text className="label">{t('about.apiSettings.diagnose')}</Text>
          <Text className="value link" onClick={load}>
            {t('about.apiSettings.test')}
          </Text>
        </View>
      </View>

      <View className="tips">
        <Text>{t('about.apiSettings.footer')}</Text>
      </View>
    </View>
  )
}
