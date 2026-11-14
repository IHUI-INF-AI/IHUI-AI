// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
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
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/** 考勤记录行(与后端 GET /hr-attendance/attendance/records 的 list 项对齐) */
export interface HrAttendanceRecord {
  id: string
  /** 业务日 YYYY-MM-DD */
  date: string
  status: string
  /** 原始时间戳(取不到写 null,由本屏按 HH:mm 截断显示) */
  checkInTime?: string | null
  checkOutTime?: string | null
}

/** 考勤屏 props(注入式:wrapper 保留 API 调用、登录态与提示通道) */
export interface HrAttendanceScreenProps {
  t: TFunction
  records: HrAttendanceRecord[]
  loading: boolean
  refreshing: boolean
  /** 签到请求在途(用于按钮文案切换) */
  busy: boolean
  employeeId: string
  departmentId: string
  /** 当前持有焦点的输入框(键入视觉反馈) */
  focusField?: 'employeeId' | 'departmentId' | null
  onEmployeeIdChange: (v: string) => void
  onDepartmentIdChange: (v: string) => void
  onFocusField: (f: 'employeeId' | 'departmentId' | null) => void
  onCheckIn: () => void
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 视为"正常出勤"的状态码(决定徽章用品牌色还是次级色) */
const STATUS_OK = new Set(['present', 'leave'])

/** 状态取词:词表未命中(后端新增协议码)原样回显,不吞数据。 */
function statusLabel(t: TFunction, status: string): string {
  const key = `hrAttendance.status${status.charAt(0).toUpperCase()}${status.slice(1)}`
  const v = t(key)
  return v === key ? status : v
}

/** 时间戳 → HH:mm;取不到写破折号,不拿当前时刻冒充。 */
function clockOf(ts: string | null | undefined): string {
  const s = String(ts ?? '')
  return s.length >= 16 ? s.slice(11, 16) : '—'
}

/**
 * 人事考勤共享屏 — props 注入式跨端组件。
 *
 * 平台无关:签到表单(工号 / 部门 + 提交)、记录列表(日期 + 状态徽章 + 上下班时刻)。
 * 平台特定(导航、fetchApi、登录态、appAlert)由 wrapper 注入。
 *
 * 业务日口径不在这里算:`date` 由 wrapper 用上海业务日送上去(后端 hrCheckIn 按
 * Asia/Shanghai 判 bad_date)。共享层若自己取 UTC 日,三端会同时错一天。
 */
export function HrAttendanceScreen({
  t,
  records,
  loading,
  refreshing,
  busy,
  employeeId,
  departmentId,
  focusField = null,
  onEmployeeIdChange,
  onDepartmentIdChange,
  onFocusField,
  onCheckIn,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: HrAttendanceScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const canCheckIn = employeeId.trim() !== '' && departmentId.trim() !== '' && !busy

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('hrAttendance.title')}</Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('hrAttendance.checkIn')}</Text>
          <TextInput
            style={[styles.input, focusField === 'employeeId' && styles.inputFocused]}
            placeholder={t('hrAttendance.colEmployeeNo')}
            value={employeeId}
            onChangeText={onEmployeeIdChange}
            onFocus={() => onFocusField('employeeId')}
            onBlur={() => onFocusField(null)}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, focusField === 'departmentId' && styles.inputFocused]}
            placeholder={t('hrAttendance.colDepartment')}
            value={departmentId}
            onChangeText={onDepartmentIdChange}
            onFocus={() => onFocusField('departmentId')}
            onBlur={() => onFocusField(null)}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.submit, !canCheckIn && styles.submitOff]}
            disabled={!canCheckIn}
            onPress={onCheckIn}
          >
            <Text style={styles.submitText}>
              {busy ? t('hrAttendance.loading') : t('hrAttendance.checkIn')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{t('hrAttendance.tabRecords')}</Text>
        {loading ? (
          <ActivityIndicator color={tk.brand.DEFAULT ?? tk.text.secondary} />
        ) : records.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t('hrAttendance.noData')}</Text>
          </View>
        ) : (
          records.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.cardTitle}>{r.date}</Text>
                <Text
                  style={[
                    styles.badge,
                    {
                      color: STATUS_OK.has(r.status)
                        ? (tk.brand.DEFAULT ?? tk.text.primary)
                        : tk.text.secondary,
                    },
                  ]}
                >
                  {statusLabel(t, r.status)}
                </Text>
              </View>
              <Text style={styles.muted}>
                {`${t('hrAttendance.colCheckIn')}: ${clockOf(r.checkInTime)}  ·  ${t('hrAttendance.colCheckOut')}: ${clockOf(r.checkOutTime)}`}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
    },
    title: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    body: { padding: rnSpacing.lg, gap: rnSpacing.md, paddingBottom: rnSpacing['4xl'] },
    card: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing['md-loose'],
      gap: rnSpacing.sm,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    sectionTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginTop: rnSpacing.sm,
    },
    muted: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      lineHeight: rnType.bodySm.lineHeight,
    },
    badge: { fontSize: rnType.caption.size, fontWeight: '600' },
    input: {
      marginTop: rnSpacing['2xs'],
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['xs-loose'],
    },
    // 聚焦态描边属场景例外位(输入框聚焦),用品牌色;常态描边一律走中性 border.light
    inputFocused: { borderColor: tk.brand.DEFAULT ?? tk.text.primary },
    submit: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    submitOff: { opacity: 0.5 },
    submitText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
