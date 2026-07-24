import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

/** n8n 工作流状态映射 */
function getStatusInfo(status: unknown, tt: (k: string, fb: string) => string): { label: string; cls: string } {
  const s = String(status || '').toLowerCase()
  if (s === 'active' || s === 'running' || s === '1' || s === 'published') {
    return { label: tt('aiAssistantN8n.statusActive', '运行中'), cls: 'text-success bg-[rgba(22,163,74,0.1)]' }
  }
  if (s === 'draft' || s === '0') {
    return { label: tt('aiAssistantN8n.statusDraft', '草稿'), cls: 'text-muted-foreground bg-[rgba(107,114,128,0.1)]' }
  }
  if (s === 'inactive' || s === 'stopped' || s === 'offline') {
    return { label: tt('aiAssistantN8n.statusInactive', '已停用'), cls: 'text-destructive bg-[rgba(220,38,38,0.1)]' }
  }
  return { label: tt('aiAssistantN8n.statusUnknown', '未知'), cls: 'text-muted-foreground bg-[rgba(107,114,128,0.1)]' }
}

export default function AiAssistantN8n() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }
  const [list, setList] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = (await api.getN8nWorkflows()) as { list?: Array<Record<string, unknown>> }
      setList(res?.list || [])
    } catch (e) {
      logger.error('unknown', '加载N8N助手', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((item: Record<string, unknown>) => {
    const url = String(item.url || item.webhookUrl || item.n8nUrl || '')
    if (!url) {
      Taro.showToast({ title: tt('aiAssistantN8n.noUrl', '暂无访问地址'), icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
  }, [tt])

  return (
    <View className="min-h-screen bg-background">
      <View className="p-[24rpx] bg-card">
        <Text className="text-[36rpx] font-semibold text-foreground">{t('aiAssistantN8n.title')}</Text>
      </View>
      <View className="p-[24rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{tt('aiAssistantN8n.loadFailed', '加载失败')}</Text>
            <View className="mt-[24rpx] py-[16rpx] px-[48rpx] bg-primary text-foreground text-center rounded-[12rpx] text-[26rpx]" onClick={loadData}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : list.length ? (
          <View className="flex flex-col gap-[16rpx]">
            {list.map((item, idx) => {
              const id = String(item.id || idx)
              const name = String(item.name || item.title || t('aiAssistantN8n.defaultName'))
              const desc = String(item.description || item.desc || '')
              const statusInfo = getStatusInfo(item.status, tt)
              return (
                <View key={id} className="p-[24rpx] bg-card rounded-[12rpx]" onClick={() => onItemClick(item)}>
                  <View className="flex items-center justify-between">
                    <Text className="text-[30rpx] font-semibold text-foreground flex-1 min-w-0 truncate">{name}</Text>
                    <Text className={`py-[4rpx] px-[16rpx] rounded-[6rpx] text-[22rpx] flex-shrink-0 ml-[16rpx] ${statusInfo.cls}`}>{statusInfo.label}</Text>
                  </View>
                  {desc ? <Text className="block mt-[12rpx] text-[24rpx] text-muted-foreground line-clamp-2">{desc}</Text> : null}
                  <View className="mt-[16rpx]">
                    <Text className="text-[24rpx] text-primary">
                      {tt('aiAssistantN8n.openWorkflow', '打开工作流')} →
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[80rpx]">
            <Text className="text-center text-muted-foreground text-[26rpx]">{t('aiAssistantN8n.empty')}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
