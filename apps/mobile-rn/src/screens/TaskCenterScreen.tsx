import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
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
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

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

export function TaskCenterScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('daily')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const resp = await fetch(`${API_BASE_URL}/api/tasks?type=${activeTab}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) {
      setError(t('taskCenter.loadFailed'))
      setLoading(false)
      setRefreshing(false)
      return
    }
    const data = (await resp.json()) as { data?: TaskItem[] }
    setTasks(data.data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [token, activeTab, t])

  useEffect(() => { void load() }, [load])

  const handleClaim = async (task: TaskItem) => {
    setClaimingId(task.id)
    const resp = await fetch(`${API_BASE_URL}/api/tasks/${task.id}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    setClaimingId(null)
    if (resp.ok) {
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
        <ActivityIndicator />
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
              {t(`taskCenter.tab_${s}`)}
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
            const progressPct = task.target > 0 ? Math.min(100, Math.round((task.progress / task.target) * 100)) : 0
            return (
              <View key={task.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
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

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 12, color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  retryText: { fontSize: 12, color: PRIMARY },
  list: { padding: 16, paddingBottom: 32 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, backgroundColor: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  rewardBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#ECFDF5' },
  rewardText: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  taskDesc: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  progressBarFill: { height: 6, borderRadius: 8, backgroundColor: PRIMARY },
  progressText: { fontSize: 11, color: '#9CA3AF' },
  actionBtn: { marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  goBtn: { backgroundColor: '#F3F4F6' },
  claimedBtn: { backgroundColor: '#F3F4F6' },
  actionBtnText: { fontSize: 13, color: '#FFFFFF' },
  claimedBtnText: { fontSize: 13, color: '#9CA3AF' },
})
