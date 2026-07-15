import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function AccountCancel() {
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
      title: '账号注销',
      content: '注销后账号数据将无法恢复，确定要注销吗？',
      success: (res) => {
        if (!res.confirm) return
        setSubmitting(true)
        api
          .accountCancel()
          .then(() => {
            Taro.showToast({ title: '已注销', icon: 'success' })
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
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">账号注销</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : info ? (
          <View>
            <Text>当前账号：{(info.nickname as string) || (info.phone as string) || '-'}</Text>
            <View className={`btn${submitting ? ' disabled' : ''}`} onClick={onConfirm}>
              <Text>确认注销</Text>
            </View>
          </View>
        ) : (
          <Text className="empty">无法获取账号信息</Text>
        )}
      </View>
    </View>
  )
}
