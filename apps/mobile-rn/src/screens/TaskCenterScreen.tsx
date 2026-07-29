import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  TaskCenterScreen as SharedTaskCenterScreen,
  type TaskCenterItem,
  type TaskCenterTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function TaskCenterScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [tasks, setTasks] = useState<TaskCenterItem[]>([])
  const [activeTab, setActiveTab] = useState<TaskCenterTab>('daily')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const resp = await fetchApi<TaskCenterItem[]>('/tasks', {
        params: { type: activeTab },
      })
      if (!resp.success) {
        setError(t('taskCenter.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setTasks(resp.data ?? [])
      setLoading(false)
      setRefreshing(false)
    },
    [activeTab, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleClaim = async (task: TaskCenterItem) => {
    setClaimingId(task.id)
    const resp = await fetchApi<unknown>(`/tasks/${task.id}/claim`, { method: 'POST' })
    setClaimingId(null)
    if (resp.success) {
      Alert.alert(t('taskCenter.claimed'), `+${task.reward}`)
      void load(true)
    } else {
      Alert.alert(t('taskCenter.claimFailed'))
    }
  }

  const handleAction = (task: TaskCenterItem) => {
    if (task.actionUrl === 'goBack') {
      navigation.goBack()
    }
  }

  return (
    <SharedTaskCenterScreen
      t={t}
      tasks={tasks}
      activeTab={activeTab}
      loading={loading}
      refreshing={refreshing}
      error={error}
      claimingId={claimingId}
      onTabChange={setActiveTab}
      onRefresh={() => load(true)}
      onRetry={() => load()}
      onClaim={handleClaim}
      onAction={handleAction}
      onBack={() => navigation.goBack()}
    />
  )
}
