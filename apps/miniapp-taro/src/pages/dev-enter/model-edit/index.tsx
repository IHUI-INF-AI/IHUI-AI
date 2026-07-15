import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function ModelEdit() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getDeveloperAgents()) as Record<string, unknown>
      setList((Array.isArray(res) ? res : res?.list || []) as Record<string, unknown>[])
    } catch (e) {
      logger.error('unknown', '加载模型', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onSave = useCallback(() => {
    Taro.showToast({ title: t('devEnter.modelEdit.saved'), icon: 'success' })
  }, [t])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('devEnter.modelEdit.title')}</Text>
        <Text className="btn" onClick={onSave}>
          {t('common.save')}
        </Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={(item.id as string) || (item.name as string)} className="list-item">
              <Text>
                {(item.name as string) || (item.title as string) || t('devEnter.modelEdit.model')}
              </Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('devEnter.modelEdit.empty')}</Text>
        )}
      </View>
    </View>
  )
}
