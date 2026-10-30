// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CalendarDays, Clock, MapPin } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'eduSchedulePage'

/** 一节课的展示态(时间/教师/地点/kind 文案由薄壳按 web 同参格式好后注入) */
export interface EduScheduleItemView {
  id: string
  /** 课程名 / 考试名(:title) */
  title: string
  /** 已格式化的时段;web 是 `start-end` 直拼,考试项 end 为空时只剩 start */
  timeText: string
  /** 教师;后端考试报名项为空串,薄壳已落 '-' */
  instructorText: string
  /** 地点;无该字段时为 null(考试项无 location) */
  locationText: string | null
  /** 'exam' / 'class' 原值,web 不渲染,这里仅在行首留色条用 */
  kind: string
}

/** 一天的课表块;label 由薄壳按 locale 取 eduSchedule.weekday.* 注入 */
export interface EduScheduleDayView {
  key: string
  label: string
  isToday: boolean
  items: EduScheduleItemView[]
}

export interface EduClassScheduleScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  days: EduScheduleDayView[]
  onRetry: () => void
}

/**
 * 我的课程表共享屏 —— 承载 web /edu/schedule(GET /api/edu/schedule)。
 *
 * 与 web 的口径差(如实登记):
 *  - web 是 `min-[1280px]:grid-cols-7` 的七列并排周视图,RN 落为「按天纵向分节」——
 *    同一份 byDay 分组、同一 weekday 语义(0=周一),窄屏下只换排版不换数据。
 *  - web 卡片标题取 `t.raw('weekdays')`(该键在五语 web 包里**都是空数组**,
 *    apps/web/app/(main)/edu/schedule/page.tsx:42 ⇒ 线上七天标题实为空串);
 *    RN 不复制这个空值坑,改取同域既有 key `eduSchedule.weekday.mon..sun`
 *    (packages/i18n/messages/mobile-rn/*.json 五语全有值),由薄壳传入。
 *  - web 的「今天」高亮用 `border-brand-accent-deep + ring-primary/20`,RN 取
 *    tk.brandAccent.deep 描边 + tk.brand.DEFAULT 的 today 胶囊,同一语义档。
 * 平台无关:取数 / weekday 取词 / 登录态判定由薄壳注入,本文件只管渲染三态。
 */
export function EduClassScheduleScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  days,
  onRetry,
}: EduClassScheduleScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const total = days.reduce((sum, day) => sum + day.items.length, 0)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <CalendarDays size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBlock}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : total === 0 ? (
        <View style={styles.centerBlock}>
          <CalendarDays size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {days.map((day) => (
            <View key={day.key} style={[styles.dayCard, day.isToday && styles.dayCardToday]}>
              <View style={styles.dayHead}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                {day.isToday ? (
                  <Text style={styles.todayBadge}>{t(`${NS}.today`)}</Text>
                ) : null}
              </View>
              {day.items.length === 0 ? (
                <Text style={styles.noClass}>{t(`${NS}.noClass`)}</Text>
              ) : (
                day.items.map((item) => (
                  <View key={item.id} style={styles.item}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.itemMetaRow}>
                      <Clock size={12} color={tk.text.tertiary} />
                      <Text style={styles.itemMeta}>{item.timeText}</Text>
                    </View>
                    <Text style={styles.itemMeta}>{item.instructorText}</Text>
                    {item.locationText ? (
                      <View style={styles.itemMetaRow}>
                        <MapPin size={12} color={tk.text.tertiary} />
                        <Text style={styles.itemMeta}>{item.locationText}</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    error: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, textAlign: 'center' },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    retryBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    retryText: { fontSize: rnType.label.size, color: tk.text.primary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    dayCard: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    dayCardToday: { borderColor: tk.brandAccent.deep },
    dayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    dayLabel: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    todayBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
      color: tk.brand.DEFAULT,
      backgroundColor: tk.surface.muted,
    },
    noClass: {
      paddingVertical: rnSpacing.sm,
      textAlign: 'center',
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    item: {
      gap: 2,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    itemTitle: { fontSize: rnType.label.size, fontWeight: '500', color: tk.text.primary },
    itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    itemMeta: { fontSize: rnType.caption.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
