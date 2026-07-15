import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow, navigateTo } from '@tarojs/taro'
import { getDeveloperAgents } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function DeveloperIndex() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperAgents()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
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
            <View key={agent.id as string} className="agent-item">
              <Image
                className="agent-avatar"
                src={(agent.avatar as string) || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="agent-body">
                <Text className="agent-name">
                  {(agent.name as string) || t('developer.index.unnamedAgent')}
                </Text>
                <Text className="agent-stat">
                  {t('developer.index.useCount', { n: (agent.uses as number) || 0 })}
                </Text>
              </View>
              <Text className="agent-status">
                {(agent.status as string) || t('developer.index.published')}
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
