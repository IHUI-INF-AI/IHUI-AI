import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow, navigateTo } from '@tarojs/taro'
import { getDeveloperAgents } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

// 开发者智能体项(getDeveloperAgents 后端未类型化,按页面使用字段定义)
interface DeveloperAgentItem {
  id: string
  avatar?: string
  name?: string
  uses?: number
  status?: string
}

// 开发者智能体列表响应
interface DeveloperAgentListResponse {
  list?: DeveloperAgentItem[]
}

export default function DeveloperIndex() {
  const { t } = useI18n()
  const [list, setList] = useState<DeveloperAgentItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperAgents()) as DeveloperAgentListResponse
      setList(res?.list || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="developer-page">
      <View className="page-header">
        <Text className="page-title">{t('developer.index.title')}</Text>
      </View>
      <View
        className="subscribe-entry"
        onClick={() => navigateTo({ url: '/pages/developer/subscribe' })}
      >
        <View className="subscribe-entry-body">
          <Text className="subscribe-entry-title">{t('developer.index.subscribeTitle')}</Text>
          <Text className="subscribe-entry-desc">{t('developer.index.subscribeDesc')}</Text>
        </View>
        <Text className="subscribe-entry-arrow">›</Text>
      </View>
      <View className="agent-list">
        {loading ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((agent) => (
            <View key={agent.id} className="agent-item">
              <Image
                className="agent-avatar"
                src={agent.avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="agent-body">
                <Text className="agent-name">
                  {agent.name || t('developer.index.unnamedAgent')}
                </Text>
                <Text className="agent-stat">
                  {t('developer.index.useCount', { n: agent.uses || 0 })}
                </Text>
              </View>
              <Text className="agent-status">
                {agent.status || t('developer.index.published')}
              </Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">{t('developer.index.empty')}</Text>
        )}
      </View>
    </View>
  )
}
