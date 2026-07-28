import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface TaskItem {
  id: string
  title: string
  description: string
  type: 'daily' | 'weekly' | 'newbie'
  reward: number
  progress: number
  target: number
  completed: boolean
  claimed: boolean
  actionUrl: string | null
}

type TabKey = 'daily' | 'weekly' | 'newbie'

const TABS: TabKey[] = ['daily', 'weekly', 'newbie']

const TASK_CENTER_TAB_KEYS: Record<TabKey, string> = {
  daily: 'taskCenter.tab_daily',
  weekly: 'taskCenter.tab_weekly',
  newbie: 'taskCenter.tab_newbie',
}

export function TaskCenterScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('daily')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const resp = await fetchApi<TaskItem[]>('/tasks', { params: { type: activeTab } })
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

  const handleClaim = async (task: TaskItem) => {
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

  const handleAction = (task: TaskItem) => {
    if (task.actionUrl === 'goBack') {
      navigation.goBack()
    }
  }

  const filtered = tasks.filter((task) => task.type === activeTab)

  if (loading) {
    return (
      <View style={styles.center}>
        <Loading />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('taskCenter.title')}</Text>
        <Text style={styles.subtitle}>{t('taskCenter.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setActiveTab(s)}
            style={[styles.tab, activeTab === s && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === s && styles.tabTextActive]}>
              {t(TASK_CENTER_TAB_KEYS[s])}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={styles.retryText}>{t('taskCenter.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('taskCenter.empty')}</Text>
          </View>
        ) : (
          filtered.map((task) => {
            const progressPct =
              task.target > 0 ? Math.min(100, Math.round((task.progress / task.target) * 100)) : 0
            return (
              <View key={task.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardText}>+{task.reward}</Text>
                  </View>
                </View>
                <Text style={styles.taskDesc}>{task.description}</Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {t('taskCenter.progress', { current: task.progress, target: task.target })}
                  </Text>
                </View>
                {task.claimed ? (
                  <View style={[styles.actionBtn, styles.claimedBtn]}>
                    <Text style={styles.claimedBtnText}>{t('taskCenter.claimed')}</Text>
                  </View>
                ) : task.completed ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleClaim(task)}
                    disabled={claimingId === task.id}
                  >
                    <Text style={styles.actionBtnText}>
                      {claimingId === task.id ? t('common.loading') : t('taskCenter.claim')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.goBtn]}
                    onPress={() => handleAction(task)}
                  >
                    <Text style={styles.actionBtnText}>{t('taskCenter.goToDo')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: tokens.text.tertiary, marginTop: 8 },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: tokens.surface.card },
  tabActive: { backgroundColor: tokens.success.DEFAULT },
  tabText: { fontSize: 12, color: tokens.text.secondary },
  tabTextActive: { color: tokens.surface.light },
  errorBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retryText: { fontSize: 12, color: tokens.success.DEFAULT },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    marginBottom: 10,
    backgroundColor: tokens.surface.bg,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: tokens.text.primary, marginRight: 8 },
  rewardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: tokens.success.light,
  },
  rewardText: { fontSize: 12, fontWeight: '600', color: tokens.success.DEFAULT },
  taskDesc: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 8, backgroundColor: tokens.surface.card },
  progressBarFill: { height: 6, borderRadius: 8, backgroundColor: tokens.success.DEFAULT },
  progressText: { fontSize: 11, color: tokens.text.tertiary },
  actionBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
    alignItems: 'center',
  },
  goBtn: { backgroundColor: tokens.surface.card },
  claimedBtn: { backgroundColor: tokens.surface.card },
  actionBtnText: { fontSize: 13, color: tokens.surface.light },
  claimedBtnText: { fontSize: 13, color: tokens.text.tertiary },
})
