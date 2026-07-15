import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function AccountCancel() {
  const { t } = useI18n()
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getProfile()) as Record<string, unknown>
      setInfo(res)
    } catch (e) {
      logger.error('unknown', '加载用户信息', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onConfirm = useCallback(() => {
    Taro.showModal({
      title: t('accountCancel.title'),
      content: t('accountCancel.confirmContent'),
      success: (res) => {
        if (!res.confirm) return
        setSubmitting(true)
        api
          .accountCancel()
          .then(() => {
            Taro.showToast({ title: t('accountCancel.cancelled'), icon: 'success' })
            setTimeout(() => Taro.reLaunch({ url: '/pages/login/login' }), 800)
          })
          .catch((e) => {
            logger.error('unknown', '注销', e)
          })
          .finally(() => {
            setSubmitting(false)
          })
      },
    })
  }, [t])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('accountCancel.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : info ? (
          <View>
            <Text>
              {t('accountCancel.currentAccount', {
                name: (info.nickname as string) || (info.phone as string) || '-',
              })}
            </Text>
            <View className={`btn${submitting ? ' disabled' : ''}`} onClick={onConfirm}>
              <Text>{t('accountCancel.confirm')}</Text>
            </View>
          </View>
        ) : (
          <Text className="empty">{t('accountCancel.noInfo')}</Text>
        )}
      </View>
    </View>
  )
}
