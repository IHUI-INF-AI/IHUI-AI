import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { getAgents, type Agent } from '@ihui/api-client'
import {
  AssistantScreen as SharedAssistantScreen,
  type AssistantItem,
  type AssistantSubTab,
  type AssistantTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'

export default function AssistantScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<AssistantTab>('draft')
  const [subTab, setSubTab] = useState<AssistantSubTab>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<AssistantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await getAgents({ pageSize: 100 })
      if (!resp.success) throw new Error(resp.error)
      const mapped: AssistantItem[] = (resp.data.list ?? []).map((a: Agent) => ({
        id: a.id,
        name: a.name,
        prologue: a.description,
        status: a.status === 'pending' ? 'reviewing' : a.status,
        category: a.category || a.tags.join(','),
        price: 0,
        cycle: '',
        audience: a.isVipExclusive ? t('assistant.audienceVip') : t('assistant.audienceAll'),
        publishTime: a.createdAt ? a.createdAt.slice(0, 10) : '-',
      }))
      setItems(mapped)
    } catch {
      setError(t('assistant.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const handleEdit = (a: AssistantItem) =>
    Alert.alert(t('assistant.edit.title'), t('assistant.edit.message', { name: a.name }))

  const handleOffline = (a: AssistantItem) =>
    Alert.alert(
      t('assistant.offline.title'),
      t('assistant.offline.message', { name: a.name }),
      [
        { text: t('common.cancel') },
        {
          text: t('assistant.offline.confirmBtn'),
          style: 'destructive',
          onPress: () => Alert.alert(t('assistant.offline.done')),
        },
      ],
    )

  return (
    <SharedAssistantScreen
      t={t}
      items={items}
      tab={tab}
      subTab={subTab}
      keyword={keyword}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onTabChange={setTab}
      onSubTabChange={setSubTab}
      onKeywordChange={setKeyword}
      onRefresh={onRefresh}
      onEdit={handleEdit}
      onOffline={handleOffline}
    />
  )
}
