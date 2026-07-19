import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLiveList, type Live } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

function durationText(start: string, end: string | null): string {
  if (!end) return '—'
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const mins = Math.max(0, Math.round(ms / 60000))
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  } catch {
    return '—'
  }
}

export function LivePlaybackScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState<Live | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await getLiveList({ pageSize: 30 })
      if (res.success) {
        // 仅展示已结束的直播(isLive=false 且 endTime 已过)
        const now = Date.now()
        const ended = (res.data.list ?? []).filter((l) => {
          if (l.isLive) return false
          if (l.endTime) return new Date(l.endTime).getTime() < now
          return true
        })
        setLives(ended)
      } else {
        setError(res.error || t('livePlayback.loadFailed'))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handlePlay = (live: Live) => {
    setActive(live)
  }

  const closePlayer = () => setActive(null)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && lives.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>{t('livePlayback.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('livePlayback.title')}</Text>
        <Text style={styles.subtitle}>{t('livePlayback.subtitle')}</Text>
        <Text style={styles.userText}>{user?.nickname ?? user?.username ?? ''}</Text>
      </View>

      <FlatList
        style={styles.list}
        data={lives}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('livePlayback.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.badgeEnded}>
                <Text style={styles.badgeText}>{t('livePlayback.ended')}</Text>
              </View>
            </View>
            {item.lecturerName ? (
              <Text style={styles.cardMeta}>
                {t('livePlayback.lecturer')}:{item.lecturerName}
              </Text>
            ) : null}
            <Text style={styles.cardMeta}>
              {t('livePlayback.startAt')}:{formatDateTime(item.startTime)}
            </Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMetaText}>
                {t('livePlayback.duration')}:{durationText(item.startTime, item.endTime)}
              </Text>
              <Text style={styles.cardMetaText}>
                {t('livePlayback.viewerCount', { count: item.viewCount })}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[
                  styles.playBtn,
                  !item.playUrl && styles.playBtnDisabled,
                ]}
                onPress={() => handlePlay(item)}
                disabled={!item.playUrl}
              >
                <Text style={styles.playBtnText}>
                  {item.playUrl ? t('livePlayback.play') : t('livePlayback.noReplay')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={!!active} animationType="slide" transparent onRequestClose={closePlayer}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{active?.title}</Text>
            <View style={styles.playerArea}>
              <Text style={styles.playerIcon}>▶</Text>
              <Text style={styles.playerHint}>{t('livePlayback.replayTitle')}</Text>
              {active?.playUrl ? (
                <Text style={styles.playerUrl} numberOfLines={1}>
                  {active.playUrl}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={closePlayer}>
              <Text style={styles.closeBtnText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingHorizontal: 16 },
  loadingText: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  userText: { marginTop: 4, fontSize: 11, color: '#9ca3af' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  badgeEnded: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 11, color: '#6b7280' },
  cardMeta: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  cardMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cardMetaText: { fontSize: 12, color: '#6b7280' },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  playBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  playBtnDisabled: { backgroundColor: '#d1d5db' },
  playBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryText: { color: '#fff', fontSize: 14 },
  errorText: { fontSize: 13, color: '#dc2626', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  playerArea: { aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  playerIcon: { fontSize: 36, color: '#fff' },
  playerHint: { marginTop: 8, fontSize: 13, color: '#9ca3af' },
  playerUrl: { marginTop: 4, fontSize: 10, color: '#6b7280', paddingHorizontal: 16 },
  closeBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
