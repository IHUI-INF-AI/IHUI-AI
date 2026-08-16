import { useMemo } from 'react'
import {
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CheckInDay, CheckInInfo, CheckInScreenProps } from '../../types'

/** 签到/Props 类型 re-export(单一来源 @ihui/types) */
export type { CheckInDay, CheckInInfo, CheckInScreenProps }

/**
 * 签到共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 三列统计卡(连续/本月/累计)+ 签到按钮 + 日历网格。
 * 签到按钮:todaySigned 灰色禁用,否则品牌色显示"签到 +今日积分";signing 时显示 loading 文案。
 * 日历项:已签到品牌色背景 + ✓,未签到卡片背景 + reward。
 * 平台特定(导航 / API 调用 / Alert 成功失败提示)由 wrapper 通过 props 注入。
 */
export function CheckInScreen({
  t,
  info,
  loading,
  refreshing,
  signing,
  error,
  onSign,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: CheckInScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryBtnText}>{t('checkIn.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('checkIn.title')}</Text>
        <Text style={styles.subtitle}>{t('checkIn.subtitle')}</Text>
      </View>

      {info ? (
        <>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statsCol}>
                <Text style={styles.statsValue}>{info.streak}</Text>
                <Text style={styles.statsLabel}>{t('checkIn.streak')}</Text>
              </View>
              <View style={styles.statsCol}>
                <Text style={styles.statsValue}>{info.monthlyDays}</Text>
                <Text style={styles.statsLabel}>{t('checkIn.monthlyDays')}</Text>
              </View>
              <View style={styles.statsCol}>
                <Text style={styles.statsValue}>{info.totalDays}</Text>
                <Text style={styles.statsLabel}>{t('checkIn.totalDays')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.signBtn, info.todaySigned && styles.signBtnDisabled]}
              onPress={onSign}
              disabled={info.todaySigned || signing}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.signBtnText, info.todaySigned && styles.signBtnTextDisabled]}
              >
                {signing
                  ? t('common.loading')
                  : info.todaySigned
                    ? t('checkIn.checkedIn')
                    : `${t('checkIn.checkInBtn')} +${info.todayReward}`}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.calendarTitle}>{t('checkIn.calendar')}</Text>
          <View style={styles.calendarGrid}>
            {info.calendar.map((day) => (
              <View
                key={day.date}
                style={[
                  styles.calendarCell,
                  day.signed ? styles.calendarCellSigned : styles.calendarCellUnsigned,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDate,
                    day.signed ? styles.calendarDateSigned : styles.calendarDateUnsigned,
                  ]}
                >
                  {day.date.slice(-2)}
                </Text>
                {day.signed ? (
                  <Text style={styles.calendarMarkSigned}>✓</Text>
                ) : (
                  <Text style={styles.calendarMarkReward}>+{day.reward}</Text>
                )}
              </View>
            ))}
          </View>

          {error ? <Text style={styles.errorInline}>{error}</Text> : null}
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('checkIn.empty')}</Text>
        </View>
      )}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 14,
    },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      height: 44,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryBtnText: { color: tk.surface.light, fontSize: 16 },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary, marginBottom: 8 },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    statsCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statsCol: { flex: 1, alignItems: 'center' },
    statsValue: { fontSize: 22, fontWeight: '700', color: tk.brand.DEFAULT },
    statsLabel: { marginTop: 8, fontSize: 11, color: tk.brand.DEFAULT },
    signBtn: {
      marginTop: 14,
      height: 50,
      justifyContent: 'center',
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: tk.brand.DEFAULT,
    },
    signBtnDisabled: { backgroundColor: tk.surface.muted },
    signBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
    signBtnTextDisabled: { color: tk.text.secondary },
    calendarTitle: {
      paddingHorizontal: 10,
      paddingTop: 16,
      paddingBottom: 8,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    calendarGrid: {
      marginHorizontal: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    calendarCell: {
      width: '13%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
    },
    calendarCellSigned: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.brand.DEFAULT,
    },
    calendarCellUnsigned: {
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    calendarDate: { fontSize: 14 },
    calendarDateSigned: { color: tk.surface.light },
    calendarDateUnsigned: { color: tk.text.primary },
    calendarMarkSigned: {
      marginTop: 8,
      fontSize: 14,
      color: tk.surface.light,
    },
    calendarMarkReward: {
      marginTop: 8,
      fontSize: 10,
      color: tk.text.secondary,
    },
    errorInline: {
      marginTop: 8,
      textAlign: 'center',
      fontSize: 14,
      color: tk.danger.DEFAULT,
    },
  })
}
