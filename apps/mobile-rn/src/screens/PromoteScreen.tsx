import { useCallback, useEffect, useRef, useState } from 'react'
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

interface PromoteInfo {
  referralCode: string
  referralLink: string
  inviteCount: number
  activeCount: number
  totalEarnings: number
  pendingEarnings: number
  rules: string[]
}

interface InviteRecord {
  id: string
  nickname: string
  joinDate: string
  contribution: number
  status: 'active' | 'inactive'
}

export function PromoteScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<PromoteInfo | null>(null)
  const [records, setRecords] = useState<InviteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const [infoRes, recordsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/promote/info`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      fetch(`${API_BASE_URL}/api/promote/records?page=1&pageSize=10`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    ])
    if (!infoRes.ok || !recordsRes.ok) {
      setError(t('promote.loadFailed'))
      setLoading(false)
      setRefreshing(false)
      return
    }
    const infoData = (await infoRes.json()) as { data?: PromoteInfo }
    const recordsData = (await recordsRes.json()) as { data?: { list: InviteRecord[] } }
    setInfo(infoData.data ?? null)
    setRecords(recordsData.data?.list ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [token, t])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    if (!info) return
    Alert.alert(t('promote.copyLink'), info.referralLink)
    setCopied(true)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false)
      copiedTimerRef.current = null
    }, 1500)
  }

  const handleShare = () => {
    Alert.alert(t('promote.shareBtn'), info?.referralLink ?? '')
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryBtnText}>{t('promote.retry')}</Text>
        </TouchableOpacity>
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
        <Text style={styles.title}>{t('promote.title')}</Text>
        <Text style={styles.subtitle}>{t('promote.subtitle')}</Text>
      </View>

      {info ? (
        <>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{info.inviteCount}</Text>
                <Text style={styles.statLabel}>{t('promote.inviteCount')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{info.activeCount}</Text>
                <Text style={styles.statLabel}>{t('promote.activeCount')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>¥{info.totalEarnings}</Text>
                <Text style={styles.statLabel}>{t('promote.totalEarnings')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.linkCard}>
            <Text style={styles.linkLabel}>{t('promote.referralLink')}</Text>
            <Text style={styles.linkText} numberOfLines={1}>{info.referralLink}</Text>
            <View style={styles.linkActions}>
              <TouchableOpacity style={[styles.linkBtn, styles.copyBtn]} onPress={handleCopy}>
                <Text style={styles.linkBtnText}>
                  {copied ? t('promote.copySuccess') : t('promote.copyLink')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.linkBtn, styles.shareBtn]} onPress={handleShare}>
                <Text style={styles.linkBtnText}>{t('promote.shareBtn')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.codeText}>{t('promote.referralCode')}: {info.referralCode}</Text>
          </View>

          <Text style={styles.sectionTitle}>{t('promote.rules')}</Text>
          <View style={styles.rulesCard}>
            {info.rules.length === 0 ? (
              <Text style={styles.emptyText}>{t('promote.empty')}</Text>
            ) : (
              info.rules.map((rule, idx) => (
                <Text key={idx} style={styles.ruleText}>• {rule}</Text>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>{t('promote.inviteRecords')}</Text>
          <View style={styles.recordsList}>
            {records.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('promote.empty')}</Text>
              </View>
            ) : (
              records.map((item) => (
                <View key={item.id} style={styles.recordCard}>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordName} numberOfLines={1}>{item.nickname}</Text>
                    <Text style={styles.recordDate}>{item.joinDate}</Text>
                  </View>
                  <View style={styles.recordRight}>
                    <Text style={styles.recordContribution}>+¥{item.contribution}</Text>
                    <View style={[styles.recordStatus, item.status === 'active' && styles.statusActive]}>
                      <Text style={styles.recordStatusText}>
                        {t(`promote.status_${item.status}`)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      ) : null}
    </ScrollView>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  errorText: { fontSize: 12, color: '#DC2626', textAlign: 'center', marginTop: 4 },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  statsCard: { marginHorizontal: 16, padding: 16, borderRadius: 8, backgroundColor: '#ECFDF5' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: '700', color: PRIMARY },
  statLabel: { marginTop: 4, fontSize: 11, color: '#065F46' },
  linkCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  linkLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  linkText: { marginTop: 6, fontSize: 13, color: PRIMARY },
  linkActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  linkBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  copyBtn: { backgroundColor: PRIMARY },
  shareBtn: { backgroundColor: '#F3F4F6' },
  linkBtnText: { fontSize: 13, color: '#FFFFFF' },
  codeText: { marginTop: 10, fontSize: 11, color: '#9CA3AF' },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 15, fontWeight: '600', color: '#111827' },
  rulesCard: { marginHorizontal: 16, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  ruleText: { fontSize: 12, color: '#6B7280', marginVertical: 3, lineHeight: 18 },
  recordsList: { marginHorizontal: 16, marginBottom: 24 },
  recordCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  recordInfo: { flex: 1, marginRight: 8 },
  recordName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  recordDate: { marginTop: 2, fontSize: 11, color: '#9CA3AF' },
  recordRight: { alignItems: 'flex-end' },
  recordContribution: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  recordStatus: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: '#F3F4F6' },
  statusActive: { backgroundColor: '#ECFDF5' },
  recordStatusText: { fontSize: 10, color: '#6B7280' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryBtnText: { color: '#FFFFFF', fontSize: 13 },
})
