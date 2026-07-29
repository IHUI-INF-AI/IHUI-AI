import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { getGroups } from '@ihui/api-client'
import type { Group as ApiGroup } from '@ihui/api-client'
import {
  AiGroupScreen as SharedAiGroupScreen,
  type AiGroupItem,
  type AiGroupTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'

interface Member {
  id: string
  name: string
  role: string
}

function isMembers(v: unknown): v is Member[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        m !== null &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        typeof m.name === 'string',
    )
  )
}

function mapGroup(g: ApiGroup): AiGroupItem {
  const members = isMembers(g.members) ? g.members : []
  const messages = typeof g.messages === 'number' ? g.messages : 0
  const lastActive = typeof g.lastActive === 'string' ? g.lastActive : g.createdAt
  const tag = typeof g.tag === 'string' ? g.tag : (g.type ?? '')
  return {
    id: g.id,
    name: g.name,
    desc: g.description ?? '',
    members,
    messages,
    lastActive,
    tag,
  }
}

export default function AiGroupScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<AiGroupTab>('mine')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<AiGroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getGroups()
      if (res.success) {
        setItems(res.data.list.map(mapGroup))
      } else {
        setError(res.error || t('aiGroup.loadFailed'))
      }
    } catch {
      setError(t('aiGroup.loadFailed'))
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

  const selected = items.find((g) => g.id === selectedId) ?? null

  const handlePressItem = (g: AiGroupItem) => {
    if (tab === 'mine') {
      setSelectedId(g.id)
    } else {
      Alert.alert(t('aiGroup.join.title'), t('aiGroup.join.message', { name: g.name }))
    }
  }

  return (
    <SharedAiGroupScreen
      t={t}
      items={items}
      tab={tab}
      selectedItem={selected}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onTabChange={setTab}
      onPressItem={handlePressItem}
      onBackToList={() => setSelectedId(null)}
      onEnterChat={(g) => Alert.alert(t('aiGroup.enterChat.title'), t('aiGroup.enterChat.message', { name: g.name }))}
      onRefresh={onRefresh}
      onRetry={load}
    />
  )
}
