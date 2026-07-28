import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateWithYear } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface InviteInfo {
  inviteCode: string
  inviteUrl: string
  totalInvited: number
  totalReward: number
}

interface InviteRecord {
  id: string
  nickname: string
  invitedAt: string
  reward: number
  status: 'pending' | 'completed'
}

export function InviteScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [records, setRecords] = useState<InviteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [infoRes, listRes] = await Promise.all([
        fetchApi<InviteInfo>('/distribution/overview'),
        fetchApi<InviteRecord[]>('/distribution/invited-users'),
      ])
      if (!infoRes.success || !listRes.success) throw new Error()
      setInfo(infoRes.data ?? null)
      setRecords(listRes.data ?? [])
    } catch {
      setError(t('invite.loadFailed'))
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

  const onShare = async () => {
    if (!info) return
    try {
      await Share.share({ message: `${t('invite.shareText')}: ${info.inviteUrl}` })
    } catch {
      // ignore
    }
  }

  if (loading && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('invite.title')}</Text>
      </View>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          info ? (
            <View>
              <Card style={styles.card}>
                <Text style={styles.label}>{t('invite.myCode')}</Text>
                <Text style={styles.codeText}>{info.inviteCode}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{info.totalInvited}</Text>
                    <Text style={styles.statLabel}>{t('invite.totalInvited')}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>¥{info.totalReward}</Text>
                    <Text style={styles.statLabel}>{t('invite.totalReward')}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onShare} style={styles.shareBtn}>
                  <Text style={styles.shareText}>{t('invite.share')}</Text>
                </TouchableOpacity>
              </Card>
              <Text style={styles.sectionTitle}>{t('invite.records')}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('invite.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {item.nickname}
              </Text>
              <Text style={styles.reward}>+¥{item.reward}</Text>
            </View>
            <Text style={styles.date}>{formatShortDateWithYear(item.invitedAt)}</Text>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  label: { fontSize: 12, color: '#6B7280' },
  codeText: { marginTop: 4, fontSize: 22, fontWeight: '700', color: '#10B981', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  statBox: { flex: 1, padding: 8, backgroundColor: '#F9FAFB', borderRadius: 8 },
  statValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  statLabel: { marginTop: 2, fontSize: 11, color: '#6B7280' },
  shareBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  shareText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  reward: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  date: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: '#6B7280' },
  errorText: { fontSize: 12, color: '#DC2626' },
})
