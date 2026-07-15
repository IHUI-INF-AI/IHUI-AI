import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function Cart() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.selectGoods({ page: 1, pageSize: 20 })) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch (e) {
      logger.error('unknown', '加载购物车', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onCheckout = useCallback(() => {
    Taro.showToast({ title: t('cart.checkoutToast'), icon: 'none' })
  }, [t])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('cart.title')}</Text>
        <Text className="btn" onClick={onCheckout}>
          {t('cart.checkout')}
        </Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('cart.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id as string} className="list-item">
              <Text>{(item.title as string) || (item.name as string) || t('cart.product')}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('cart.empty')}</Text>
        )}
      </View>
    </View>
  )
}
