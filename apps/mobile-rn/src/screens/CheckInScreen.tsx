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

interface CheckInDay {
  date: string
  signed: boolean
  reward: number
}

interface CheckInInfo {
  todaySigned: boolean
  streak: number
  totalDays: number
  monthlyDays: number
  todayReward: number
  calendar: CheckInDay[]
}

export function CheckInScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<CheckInInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const resp = await fetch(`${API_BASE_URL}/api/check-in`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) {
      setError(t('checkIn.loadFailed'))
      setLoading(false)
      setRefreshing(false)
      return
    }
    const data = (await resp.json()) as { data?: CheckInInfo }
    setInfo(data.data ?? null)
    setLoading(false)
    setRefreshing(false)
  }, [token, t])

  useEffect(() => { void load() }, [load])

  const handleSign = async () => {
    if (!info || info.todaySigned) return
    setSigning(true)
    const resp = await fetch(`${API_BASE_URL}/api/check-in/sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    setSigning(false)
    if (resp.ok) {
      Alert.alert(t('checkIn.signSuccess'), `+${info.todayReward}`)
      void load(true)
    } else {
      Alert.alert(t('checkIn.signFailed'))
    }
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
          <Text style={styles.retryBtnText}>{t('checkIn.retry')}</Text>
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
        <Text style={styles.title}>{t('checkIn.title')}</Text>
        <Text style={styles.subtitle}>{t('checkIn.subtitle')}</Text>
      </View>

      {info ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{info.streak}</Text>
                <Text style={styles.summaryLabel}>{t('checkIn.streak')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{info.monthlyDays}</Text>
                <Text style={styles.summaryLabel}>{t('checkIn.monthlyDays')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{info.totalDays}</Text>
                <Text style={styles.summaryLabel}>{t('checkIn.totalDays')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.signBtn, info.todaySigned && styles.signedBtn]}
              onPress={handleSign}
              disabled={info.todaySigned || signing}
            >
              <Text style={[styles.signBtnText, info.todaySigned && styles.signedBtnText]}>
                {signing
                  ? t('common.loading')
                  : info.todaySigned
                    ? t('checkIn.checkedIn')
                    : `${t('checkIn.checkInBtn')} +${info.todayReward}`}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{t('checkIn.calendar')}</Text>
          <View style={styles.calendarGrid}>
            {info.calendar.map((day) => (
              <View
                key={day.date}
                style={[styles.dayCell, day.signed && styles.dayCellSigned]}
              >
                <Text style={[styles.dayText, day.signed && styles.dayTextSigned]}>
                  {day.date.slice(-2)}
                </Text>
                {day.signed ? (
                  <Text style={styles.dayCheck}>✓</Text>
                ) : (
                  <Text style={styles.dayReward}>+{day.reward}</Text>
                )}
              </View>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('checkIn.empty')}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 16 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4, textAlign: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  summaryCard: { marginHorizontal: 16, padding: 16, borderRadius: 8, backgroundColor: '#ECFDF5' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 22, fontWeight: '700', color: PRIMARY },
  summaryLabel: { marginTop: 4, fontSize: 11, color: '#065F46' },
  signBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  signedBtn: { backgroundColor: '#F3F4F6' },
  signBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  signedBtnText: { color: '#9CA3AF' },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 15, fontWeight: '600', color: '#111827' },
  calendarGrid: { marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: { width: '13%', aspectRatio: 1, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  dayCellSigned: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  dayText: { fontSize: 12, color: '#374151' },
  dayTextSigned: { color: '#FFFFFF' },
  dayReward: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  dayCheck: { fontSize: 12, color: '#FFFFFF', marginTop: 2 },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryBtnText: { color: '#FFFFFF', fontSize: 13 },
})
