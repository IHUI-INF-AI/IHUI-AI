import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getModelPlazaList } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function ModelPlazaIndex() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getModelPlazaList()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="model-plaza-page">
      <View className="page-header">
        <Text className="page-title">{t('modelPlaza.title')}</Text>
      </View>
      <View className="model-list">
        {loading ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((model) => (
            <View key={model.id as string} className="model-item">
              <View className="model-head">
                <Text className="model-name">
                  {(model.name as string) || t('modelPlaza.unnamed')}
                </Text>
                <Text className="model-tag">{(model.provider as string) || ''}</Text>
              </View>
              <Text className="model-desc">{(model.desc as string) || t('modelPlaza.noDesc')}</Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">{t('modelPlaza.empty')}</Text>
        )}
      </View>
    </View>
  )
}
