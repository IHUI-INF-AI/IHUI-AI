import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

/** n8n 工作流状态映射 */
function getStatusInfo(status: unknown, tt: (k: string, fb: string) => string): { label: string; cls: string } {
  const s = String(status || '').toLowerCase()
  if (s === 'active' || s === 'running' || s === '1' || s === 'published') {
    return { label: tt('aiAssistantN8n.statusActive', '运行中'), cls: 'status-active' }
  }
  if (s === 'draft' || s === '0') {
    return { label: tt('aiAssistantN8n.statusDraft', '草稿'), cls: 'status-draft' }
  }
  if (s === 'inactive' || s === 'stopped' || s === 'offline') {
    return { label: tt('aiAssistantN8n.statusInactive', '已停用'), cls: 'status-inactive' }
  }
  return { label: tt('aiAssistantN8n.statusUnknown', '未知'), cls: 'status-unknown' }
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
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('aiAssistantN8n.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <View className="state-box">
            <Text className="state-text">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="state-box">
            <Text className="state-text">{tt('aiAssistantN8n.loadFailed', '加载失败')}</Text>
            <View className="retry-btn" onClick={loadData}>
              <Text>{t('common.retry')}</Text>
            </View>
          </View>
        ) : list.length ? (
          <View className="card-list">
            {list.map((item, idx) => {
              const id = String(item.id || idx)
              const name = String(item.name || item.title || t('aiAssistantN8n.defaultName'))
              const desc = String(item.description || item.desc || '')
              const statusInfo = getStatusInfo(item.status, tt)
              return (
                <View key={id} className="workflow-card" onClick={() => onItemClick(item)}>
                  <View className="card-header">
                    <Text className="workflow-name">{name}</Text>
                    <Text className={`status-tag ${statusInfo.cls}`}>{statusInfo.label}</Text>
                  </View>
                  {desc ? <Text className="workflow-desc">{desc}</Text> : null}
                  <View className="card-footer">
                    <Text className="open-link">
                      {tt('aiAssistantN8n.openWorkflow', '打开工作流')} →
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className="state-box">
            <Text className="state-text">{t('aiAssistantN8n.empty')}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
