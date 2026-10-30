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
import { AlertCircle, AlertTriangle, BookOpen, TrendingUp } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'eduGrades'

/** 趋势图一点(一门科目下的某次考试) */
export interface GradeTrendPointView {
  id: string
  /** 考试名(web X 轴 dataKey examName,PageClient.tsx:224) */
  examText: string
  /** 考试日期文本(web 未渲染,RN 补在点上以便识别 x 轴同名的多次考试) */
  dateText: string
  scoreText: string
  /** 得分率 0..100,用于条形长度;由薄壳按 score/totalScore 现算 */
  rate: number
}

/** 一条科目趋势线 */
export interface GradeTrendRowView {
  subject: string
  points: GradeTrendPointView[]
}

/** 科目得分率(web 雷达图 / PolarAngleAxis 的替代) */
export interface GradeSubjectRateView {
  subject: string
  rate: number
  rateText: string
}

/** 薄弱环节一行 */
export interface GradeWeaknessRowView {
  subject: string
  isWeak: boolean
  avgText: string
  rateText: string
  countText: string
}

export interface EduGradesTrendScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(端点要求登录 + edu 权限,未登录不发注定 401 的请求) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  onRetry: () => void
  /** 学生标识(web 取前 8 位填副标题,PageClient.tsx:172) */
  studentShortId: string
  subjects: string[]
  selectedSubject: string
  onSelectSubject: (value: string) => void
  trend: GradeTrendRowView[]
  subjectRates: GradeSubjectRateView[]
  weaknesses: GradeWeaknessRowView[]
}

/**
 * 成绩趋势共享屏 —— 承载 web /edu/edu-management/grades/trend/[studentId]。
 *
 * 后端面(证据见 endpoints/edu-grades-trend.ts 头注):
 *  - GET /exam-score/trend/:studentId?subject= → { list }(edu-ai-management.ts:4948-4977)
 *  - GET /exam-score/weakness/:studentId → { studentId, weaknesses }(:4980-5012)
 *
 * 与 web 的口径差(如实登记,不当"同款"宣称):
 *  - web 用 recharts 画折线(成绩趋势)+ 雷达(科目分布);RN 无该图表栈,落为
 *    「每科一条时间线 + 分数条」与「每科得分率条」——同一份后端数据、同一分组维度,
 *    只换可视编码(条形长度 = 得分率),不引入新图表依赖。
 *  - web 雷达图读 w.percentage,后端 weaknesses 行**没有该字段**(:5004-5010),
 *    线上雷达半径恒为 0;RN 用 avgScore/totalScore 现算得分率,取真值不抄 NaN。
 *  - web weakness 列表读 data.weakness,后端键名是 weaknesses,线上列表恒空;
 *    RN 按后端键名取值。且后端只回 weak=true 的科目(:5011),故「科目分布」与
 *    「薄弱环节」两段的科目集合相同 —— 这是后端语义,不是本屏漏字段。
 * 平台无关:取数 / 取词 / 日期与数字格式化 / 登录态判定由薄壳注入,本文件只管三态渲染。
 */
export function EduGradesTrendScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  onRetry,
  studentShortId,
  subjects,
  selectedSubject,
  onSelectSubject,
  trend,
  subjectRates,
  weaknesses,
}: EduGradesTrendScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <Text style={styles.title}>{t(`${NS}.trendTitle`)}</Text>
          <Text style={styles.subtitle}>
            {t(`${NS}.trendSubtitle`, { studentId: studentShortId })}
          </Text>
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
          <TouchableOpacity style={styles.outlineBtn} onPress={onRetry}>
            <Text style={styles.outlineBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, selectedSubject === 'all' && styles.chipActive]}
                onPress={() => onSelectSubject('all')}
              >
                <Text
                  style={[styles.chipText, selectedSubject === 'all' && styles.chipTextActive]}
                >
                  {t(`${NS}.allSubjects`)}
                </Text>
              </TouchableOpacity>
              {subjects.map((subject) => {
                const active = selectedSubject === subject
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onSelectSubject(subject)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <TrendingUp size={16} color={tk.text.secondary} />
              <Text style={styles.cardTitle}>{t(`${NS}.scoreTrend`)}</Text>
            </View>
            {trend.length === 0 ? (
              <View style={styles.emptyBlock}>
                <AlertCircle size={24} color={tk.text.tertiary} />
                <Text style={styles.muted}>{t(`${NS}.emptyScores`)}</Text>
              </View>
            ) : (
              trend.map((group) => (
                <View key={group.subject} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.subject}</Text>
                  {group.points.map((point) => (
                    <View key={point.id} style={styles.pointRow}>
                      <Text style={styles.pointExam} numberOfLines={1}>
                        {point.examText}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { flex: Math.max(1, point.rate) }]} />
                        <View style={{ flex: Math.max(0, 100 - point.rate) }} />
                      </View>
                      <Text style={styles.pointScore}>{point.scoreText}</Text>
                      <Text style={styles.pointDate}>{point.dateText}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <BookOpen size={16} color={tk.text.secondary} />
              <Text style={styles.cardTitle}>{t(`${NS}.subjectScoreDistribution`)}</Text>
            </View>
            {subjectRates.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.muted}>{t(`${NS}.emptySubjects`)}</Text>
              </View>
            ) : (
              subjectRates.map((row) => (
                <View key={row.subject} style={styles.rateRow}>
                  <Text style={styles.rateSubject} numberOfLines={1}>
                    {row.subject}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFillAlt, { flex: Math.max(1, row.rate) }]} />
                    <View style={{ flex: Math.max(0, 100 - row.rate) }} />
                  </View>
                  <Text style={styles.rateText}>{row.rateText}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <AlertTriangle size={16} color={tk.text.secondary} />
              <Text style={styles.cardTitle}>{t(`${NS}.weaknesses`)}</Text>
            </View>
            {weaknesses.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.muted}>{t(`${NS}.emptyData`)}</Text>
              </View>
            ) : (
              weaknesses.map((row) => (
                <View key={row.subject} style={styles.weakRow}>
                  <View style={styles.weakHead}>
                    <Text style={styles.weakSubject}>{row.subject}</Text>
                    {row.isWeak ? (
                      <Text style={styles.weakBadge}>{t(`${NS}.weakBadge`)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.weakMeta}>
                    <Text style={styles.weakMetaText}>{row.avgText}</Text>
                    <Text style={styles.weakMetaText}>{row.rateText}</Text>
                    <Text style={styles.weakMetaText}>{row.countText}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
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
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    muted: { fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    error: { fontSize: rnType.caption.size, color: tk.danger.DEFAULT, textAlign: 'center' },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    outlineBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    outlineBtnText: { fontSize: rnType.caption.size, color: tk.text.primary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    chipRow: { flexDirection: 'row', gap: rnSpacing.sm, paddingVertical: 2 },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.card },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    emptyBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.xl,
    },
    group: { gap: rnSpacing.xs },
    groupTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    pointRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    pointExam: { width: 88, fontSize: rnType.caption.size, color: tk.text.secondary },
    barTrack: {
      flex: 1,
      flexDirection: 'row',
      height: 8,
      borderRadius: rnRadius.sm,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
    },
    barFill: { backgroundColor: tk.brand.DEFAULT },
    barFillAlt: { backgroundColor: tk.brandAccent.deep },
    pointScore: {
      width: 44,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    pointDate: { width: 78, textAlign: 'right', fontSize: rnType.caption.size, color: tk.text.tertiary },
    rateRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    rateSubject: { width: 76, fontSize: rnType.caption.size, color: tk.text.secondary },
    rateText: {
      width: 52,
      textAlign: 'right',
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    weakRow: {
      gap: rnSpacing.xs,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    weakHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    weakSubject: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    weakBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '500',
      color: tk.danger.DEFAULT,
      backgroundColor: tk.danger.light,
    },
    weakMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    weakMetaText: { fontSize: rnType.caption.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
