// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CalendarCheck, Users } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface HrRecord {
  id: string
  date: string
  employeeId: string
  checkInTime: string | null
  checkOutTime: string | null
  status: string
}

const STATUS_OK = new Set(['present', 'leave'])

/**
 * 人事部 · 考勤(移动端员工自助骨架,2026-11-09 立)。
 * 后端复用 @ihui/attendance-core 判定内核的 /api/hr-attendance/*。
 * 当前为骨架:签到所需的 employeeId / departmentId 由本地输入提供;
 * 正式接入时改为取登录态对应的在职员工上下文(operatedBy 已由后端取 userId)。
 */
export default function HrAttendanceScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [records, setRecords] = useState<HrRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  /** 哪个输入框持有焦点(G-978007:带 value 的裸 TextInput 必须有焦点态,不然键入无视觉反馈) */
  const [focusField, setFocusField] = useState<'employeeId' | 'departmentId' | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      try {
        const q = departmentId.trim()
          ? `?departmentId=${encodeURIComponent(departmentId.trim())}`
          : ''
        const res = await fetchApi<{ list: HrRecord[] }>(
          `/api/hr-attendance/attendance/records${q}`,
        )
        if (res.success) setRecords(res.data?.list ?? [])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [departmentId],
  )

  useEffect(() => {
    void load()
  }, [load])

  const checkIn = async () => {
    if (!employeeId.trim() || !departmentId.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetchApi('/api/hr-attendance/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: employeeId.trim(),
          departmentId: departmentId.trim(),
          date: new Date().toISOString().slice(0, 10),
          checkInMethod: 'self',
        }),
      })
      if (!res.success) appAlert(t('hrAttendance.title'), res.error)
      else {
        appAlert(t('hrAttendance.title'), t('hrAttendance.createSuccess'))
        void load(true)
      }
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = (status: string): string => {
    const key = `hrAttendance.status${status.charAt(0).toUpperCase()}${status.slice(1)}`
    const v = t(key)
    return v === key ? status : v
  }
  const statusColor = (status: string) =>
    STATUS_OK.has(status) ? (tokens.brand.DEFAULT ?? tokens.text.primary) : tokens.text.secondary

  const canCheckIn = employeeId.trim() && departmentId.trim() && !busy

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('hrAttendance.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        <View style={styles.card}>
          <View style={styles.rowHead}>
            <Users size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('hrAttendance.checkIn')}</Text>
          </View>
          <TextInput
            style={[styles.input, focusField === 'employeeId' && styles.inputFocused]}
            placeholder={t('hrAttendance.colEmployeeNo')}
            value={employeeId}
            onChangeText={setEmployeeId}
            onFocus={() => setFocusField('employeeId')}
            onBlur={() => setFocusField(null)}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, focusField === 'departmentId' && styles.inputFocused]}
            placeholder={t('hrAttendance.colDepartment')}
            value={departmentId}
            onChangeText={setDepartmentId}
            onFocus={() => setFocusField('departmentId')}
            onBlur={() => setFocusField(null)}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.submit, !canCheckIn && styles.submitOff]}
            disabled={!canCheckIn}
            onPress={() => void checkIn()}
          >
            <CalendarCheck size={16} color={tokens.brand.ctaForeground} />
            <Text style={styles.submitText}>
              {busy ? t('hrAttendance.loading') : t('hrAttendance.checkIn')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{t('hrAttendance.tabRecords')}</Text>
        {loading ? (
          <ActivityIndicator color={tokens.brand.DEFAULT ?? tokens.text.secondary} />
        ) : records.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t('hrAttendance.noData')}</Text>
          </View>
        ) : (
          records.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.cardTitle}>{r.date}</Text>
                <Text style={[styles.badge, { color: statusColor(r.status) }]}>
                  {statusLabel(r.status)}
                </Text>
              </View>
              <Text style={styles.muted}>
                {`${t('hrAttendance.colCheckIn')}: ${r.checkInTime ? r.checkInTime.slice(11, 16) : '—'}  ·  ${t('hrAttendance.colCheckOut')}: ${r.checkOutTime ? r.checkOutTime.slice(11, 16) : '—'}`}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.lg, gap: rnSpacing.md, paddingBottom: rnSpacing['4xl'] },
  card: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    padding: rnSpacing['md-loose'],
    gap: rnSpacing.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.sm,
  },
  cardTitle: {
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.text.primary,
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: rnType.body.size,
    fontWeight: '600',
    color: tokens.text.primary,
    marginTop: rnSpacing.sm,
  },
  muted: {
    fontSize: rnType.label.size,
    color: tokens.text.secondary,
    lineHeight: rnType.bodySm.lineHeight,
  },
  badge: {
    fontSize: rnType.caption.size,
    fontWeight: '600',
  },
  input: {
    marginTop: rnSpacing['2xs'],
    fontSize: rnType.body.size,
    color: tokens.text.primary,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.light,
    paddingHorizontal: rnSpacing['sm-loose'],
    paddingVertical: rnSpacing['xs-loose'],
  },
  inputFocused: {
    borderColor: tokens.brand.DEFAULT ?? tokens.text.primary,
  },
  submit: {
    marginTop: rnSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rnSpacing.xs,
    paddingVertical: rnSpacing['sm-loose'],
    borderRadius: rnRadius.md,
    backgroundColor: tokens.brand.cta,
  },
  submitOff: { opacity: 0.5 },
  submitText: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.brand.ctaForeground },
})
