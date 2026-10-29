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
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ClipboardList, Clock, Upload } from 'lucide-react-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type { CourseHomeworkItem, CourseHomeworkScreenProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'

export type { CourseHomeworkItem, CourseHomeworkScreenProps }

/**
 * ISO → `YYYY-MM-DD HH:mm`。
 *
 * web 用 `Intl.DateTimeFormat(locale, …)` 输出本地化长日期;RN 侧不取 Intl(不同 Hermes
 * 构建的 ICU 覆盖不一致,同一串会在一部分机型上退成英文月名),统一走定长数字格式,
 * 与本包其它屏(KnowledgeEntryReading / KnowledgeBase)的短日期口径一致。
 */
function formatDueDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

/** 截止时间是否已过(无 dueDate / 非法串一律不算过期,不替用户猜) */
function isOverdue(value?: string | null): boolean {
  if (!value) return false
  const at = new Date(value).getTime()
  return !Number.isNaN(at) && at < Date.now()
}

/**
 * CourseHomeworkScreen 课程作业屏(共享层,受控/presentational)
 *
 * 2026-10-28 补屏立,承载 web `/learn/[id]/homework`
 * (apps/web/app/(main)/learn/[id]/homework/PageClient.tsx):
 * - 结构:顶栏(返回 / 标题)→ 作业列表(标题 + 说明 + 截止时间 + 提交徽标)
 *   → 选中项就地展开「作答链接 + 提交」;空列表整块空态
 * - 与 SRS 复习屏(`LearnReviewScreen` / `/api/srs-review/*`)**不是同一物**,
 *   数据源、交互、语义都不同,不复用
 * - 提交必须带 `url`(后端 `submitHomeworkSchema` 要求 1..3000 字符),所以作答区是
 *   显式输入框,不是 web 那个裸发 POST 的按钮(那一个在后端恒 400)
 * - 平台无关:取数 / 提交 / 导航全由 wrapper 注入;样式走 getTokens 语义 token,
 *   零 hex,间距走 rnSpacing / rnType / rnRadius
 * - i18n:`learnHomework.*`(5 语言同批)+ 复用 `common.back` / `common.cancel` /
 *   `common.submitting`
 */
export function CourseHomeworkScreen({
  t,
  items,
  loading,
  error,
  selectedId,
  answerUrl,
  submittingId,
  submitError,
  onSelect,
  onChangeAnswer,
  onSubmit,
  onBack,
  onRetry,
  colorScheme = 'light',
}: CourseHomeworkScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('learnHomework.title')}</Text>
      {/* 右侧占位:与左侧返回键等宽,标题才是真居中而不是被按钮挤偏 */}
      <View style={styles.headerSpacer} />
    </View>
  )

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <ClipboardList size={28} color={tk.text.tertiary} strokeWidth={1.6} />
            <Text style={styles.emptyText}>{t('learnHomework.empty')}</Text>
          </View>
        ) : (
          items.map((item) => {
            const selected = item.id === selectedId
            const submitting = submittingId === item.id
            const due = formatDueDate(item.dueDate)
            const overdue = isOverdue(item.dueDate)
            const submitted = item.submitted === true
            return (
              <View key={item.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardHead}
                  onPress={() => onSelect(item.id)}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                >
                  <View style={styles.cardMain}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                      {due ? (
                        <View style={styles.metaInline}>
                          <Clock size={12} color={tk.text.tertiary} strokeWidth={2} />
                          <Text style={styles.metaText}>
                            {t('learnHomework.deadlineLabel', { deadline: due })}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.metaText}>{t('learnHomework.noDeadline')}</Text>
                      )}
                      {overdue ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{t('learnHomework.expired')}</Text>
                        </View>
                      ) : null}
                      {/* 后端列表没有按人的提交态 ⇒ 未知(undefined)就不出徽标,不假装未提交 */}
                      {typeof item.submitted === 'boolean' ? (
                        <View style={[styles.badge, submitted ? styles.badgeDone : null]}>
                          <Text style={[styles.badgeText, submitted ? styles.badgeTextDone : null]}>
                            {submitted
                              ? t('learnHomework.submitted')
                              : t('learnHomework.notSubmitted')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {!selected ? (
                    <View style={styles.answerEntry}>
                      <Upload size={13} color={tk.brand.DEFAULT} strokeWidth={2} />
                      <Text style={styles.answerEntryText}>{t('learnHomework.answerAction')}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                {selected ? (
                  <View style={styles.answerBox}>
                    <Text style={styles.answerLabel}>{t('learnHomework.answerLabel')}</Text>
                    <TextField
                      colorScheme={colorScheme}
                      style={styles.answerInput}
                      value={answerUrl}
                      onChangeText={onChangeAnswer}
                      placeholder={t('learnHomework.answerPlaceholder')}
                      placeholderTextColor={tk.text.tertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      maxLength={3000}
                      editable={!submitting}
                    />
                    {submitError ? (
                      <Text style={styles.error} accessibilityRole="text">
                        {submitError}
                      </Text>
                    ) : null}
                    <View style={styles.answerActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => onSelect(item.id)}
                        accessibilityRole="button"
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.submitBtn, submitting ? styles.submitBtnDisabled : null]}
                        onPress={() => onSubmit(item.id)}
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: submitting }}
                        activeOpacity={0.8}
                      >
                        {submitting ? (
                          <ActivityIndicator color={tk.brand.ctaForeground} size="small" />
                        ) : (
                          <Upload size={14} color={tk.brand.ctaForeground} strokeWidth={2} />
                        )}
                        <Text style={styles.submitText}>
                          {submitting ? t('common.submitting') : t('learnHomework.submit')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      fontSize: rnType.title.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    scroll: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
      gap: rnSpacing.md,
    },
    /* 空态 */
    emptyCard: {
      marginTop: rnSpacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tk.border.medium,
    },
    emptyText: {
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
    },
    /* 作业卡 */
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      overflow: 'hidden',
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
    },
    /* space-between 行内的可点读数必须先被压缩 ⇒ 锁 flexShrink:1,否则标题完整、右侧入口被挤扁 */
    cardMain: {
      flex: 1,
      flexShrink: 1,
      gap: rnSpacing.xs,
    },
    cardTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardDesc: {
      fontSize: rnType.label.size,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaText: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    badge: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.surface.muted,
    },
    badgeDone: {
      backgroundColor: tk.surface.light,
    },
    badgeText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    badgeTextDone: {
      color: tk.brandAccent.deep,
    },
    answerEntry: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      minHeight: 32,
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.light,
    },
    answerEntryText: {
      fontSize: rnType.caption.size,
      color: tk.brand.DEFAULT,
    },
    /* 作答区 */
    answerBox: {
      /* 与上方信息区的分隔靠间距与背景对比,不用单边描边(AGENTS §4 禁分割线) */
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.md,
      paddingBottom: rnSpacing.md,
      paddingTop: rnSpacing.sm,
    },
    answerLabel: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    answerInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    error: {
      fontSize: rnType.caption.size,
      color: tk.error.text,
    },
    answerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: rnSpacing.sm,
    },
    cancelBtn: {
      minHeight: 36,
      paddingHorizontal: rnSpacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
    },
    cancelText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      minHeight: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
