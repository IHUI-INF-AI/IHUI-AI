import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getN8nWorkflows, type N8nWorkflow } from '@ihui/api-client'
import {
  N8nModelScreen as SharedN8nModelScreen,
  type N8nModelItem,
  type N8nModelTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function toString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function mapWorkflow(w: N8nWorkflow): N8nModelItem {
  return {
    id: w.id,
    name: w.name,
    desc: w.description ?? '',
    url: toString(w.url),
    status: w.active ? 'running' : 'stopped',
    calls: toNumber(w.calls),
    updatedAt: w.updatedAt ?? w.createdAt ?? '',
    paramsIn: toNumber(w.paramsIn),
    paramsOut: toNumber(w.paramsOut),
  }
}

export default function N8nModelScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<N8nModelTab>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<N8nModelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getN8nWorkflows()
      if (res.success) {
        setItems((res.data?.list ?? []).map(mapWorkflow))
      } else {
        setError(res.error || t('n8nModel.loadFailed'))
      }
    } catch {
      setError(t('n8nModel.loadFailed'))
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

  const handleToggle = (m: N8nModelItem) => {
    Alert.alert(
      m.status === 'running' ? t('n8nModel.toggle.stopTitle') : t('n8nModel.toggle.startTitle'),
      m.status === 'running'
        ? t('n8nModel.toggle.stopMessage', { name: m.name })
        : t('n8nModel.toggle.startMessage', { name: m.name }),
      [
        { text: t('common.cancel') },
        { text: t('common.confirm'), onPress: () => Alert.alert(t('n8nModel.toggle.success')) },
      ],
    )
  }

  const handleEdit = (m: N8nModelItem) => {
    Alert.alert(t('n8nModel.actionEdit'), m.name)
  }

  const handleCreate = () => {
    Alert.alert(t('n8nModel.create'), t('common.comingSoon'))
  }

  return (
    <SharedN8nModelScreen
      t={t}
      items={items}
      tab={tab}
      keyword={keyword}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onSelectTab={setTab}
      onKeywordChange={setKeyword}
      onRefresh={onRefresh}
      onRetry={() => void load()}
      onToggle={handleToggle}
      onEdit={handleEdit}
      onCreate={handleCreate}
      onBack={() => navigation.goBack()}
    />
  )
}
