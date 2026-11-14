// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LearnDevelopEntry, LearnDevelopScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { assertRequiredPort } from '../../host/ports'

export type { LearnDevelopEntry, LearnDevelopScreenProps }

/**
 * LearnDevelopScreen 学习导航页(共享层,平台无关 UI)
 *
 * 由端侧 wrapper 通过 props 注入真实学习功能入口(课程星球/学习计划/知识星球等卡片)与跳转,
 * 不再是「课程星球正在开发中」占位桩。卡片列表仅渲染端侧传入的 entries。
 */
export function LearnDevelopScreen({
  t,
  onBack,
  onContact,
  entries = [],
  colorScheme = 'light',
  onNavigate,
  hideHeader = false,
  entriesTitle,
  coursesTitle,
  courses,
  coursesSection = 'ready',
  onRetry,
  coursesEmptyLabel,
  onCoursePress,
}: LearnDevelopScreenProps) {
  assertRequiredPort('onNavigate', onNavigate)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      {hideHeader ? null : (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('learnDevelop.title', { fallback: '学习开发' })}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {entriesTitle ? <Text style={styles.sectionTitle}>{entriesTitle}</Text> : null}
        <View style={styles.grid}>
          {entries.map((entry: LearnDevelopEntry) => (
            // 按压态样式**不得写在 Pressable 的 style 上**(守门 131 那一型):Pressable 注册过
            // cssInterop,函数形态声明被 `{ ...declaration }` 清成 `{}`,卡面底色/描边/内边距静默消失。
            // width 47% 是外层在 grid(row + wrap)里"两列一排"的槽位档 ⇒ 留外层;
            // 面档落内层并撑满外层 —— grid 的 alignItems 默认 stretch,同一排里较矮的卡原本会被
            // 拉到本排最高者的高度,内层不写 height:100% 就会缩回自身内容高(观感会变),故补满。
            <Pressable
              key={entry.title}
              style={styles.entryCardBox}
              onPress={entry.onPress}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
            >
              {({ pressed }) => (
                <View style={[styles.entryCard, pressed ? styles.entryCardPressed : null]}>
                  {typeof entry.icon === 'string' ? (
                    <Text style={styles.entryIcon}>{entry.icon}</Text>
                  ) : entry.icon ? (
                    <entry.icon size={32} color={tk.text.primary} />
                  ) : null}
                  <Text style={styles.entryTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.entryDesc} numberOfLines={2}>
                    {entry.desc}
                  </Text>
                  {entry.meta ? <Text style={styles.entryMeta}>{entry.meta}</Text> : null}
                  {typeof entry.progress === 'number' ? (
                    <View style={styles.entryBar}>
                      <View
                        style={[
                          styles.entryBarFill,
                          { width: `${Math.min(100, Math.max(0, entry.progress))}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              )}
            </Pressable>
          ))}
        </View>
        {coursesTitle ? (
          <>
            <Text style={styles.sectionTitle}>{coursesTitle}</Text>
            {coursesSection === 'loading' ? (
              <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
            ) : coursesSection === 'error' ? (
              <ErrorState
                message={t('common.loadFailed')}
                onRetry={onRetry}
                retryLabel={t('common.retry')}
                colorScheme={colorScheme}
              />
            ) : coursesSection === 'empty' || !courses || courses.length === 0 ? (
              <EmptyState
                title={coursesEmptyLabel ?? t('common.empty')}
                colorScheme={colorScheme}
              />
            ) : (
              <View style={styles.courseList}>
                {courses.map((course) => (
                  <Pressable
                    key={course.id}
                    style={styles.courseCard}
                    onPress={() => onCoursePress?.(course.id)}
                    accessibilityRole="button"
                    accessibilityLabel={course.title}
                  >
                    {course.coverUrl ? (
                      <Image source={{ uri: course.coverUrl }} style={styles.courseCover} />
                    ) : null}
                    <View style={styles.courseBody}>
                      <Text style={styles.courseTitle} numberOfLines={2}>
                        {course.title}
                      </Text>
                      {course.teacher ? (
                        <Text style={styles.courseMeta}>
                          {t('courseScreen.instructor', { name: course.teacher })}
                        </Text>
                      ) : null}
                      <Text style={styles.coursePrice}>
                        {course.price === null || course.price === undefined || course.price <= 0
                          ? t('courseScreen.free')
                          : `¥${course.price.toFixed(2)}`}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : null}
        {onContact ? (
          // 同上(守门 131):alignSelf/width/height/marginTop 是外层在滚动列里占槽位的布局档
          // (width 187 × height 38 定义盒子) ⇒ 留外层;底色/胶囊圆角/投影/居中档 + 淡出落内层,
          // 内层按 100% 撑满那个固定尺寸盒 ⇒ 钮的尺寸、居中与投影范围逐像素不变。
          <Pressable
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}
            style={styles.detailsButtonBox}
          >
            {({ pressed }) => (
              <View style={[styles.detailsButton, pressed ? styles.detailsButtonPressed : null]}>
                <Text style={styles.detailsButtonText}>
                  {t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    } as ViewStyle,
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    scrollContent: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      paddingBottom: rnSpacing['2xl'],
    } as ViewStyle,
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.md } as ViewStyle,
    // 外层 = "两列一排"的槽位档(守门 131:按压态不得写在 Pressable 的 style 上);
    // 卡面档在下面的 entryCard,由内层 View 撑满外层(47% 宽 + 本排拉伸高)。数值逐字搬移未新增。
    entryCardBox: {
      width: '47%',
    } as ViewStyle,
    entryCard: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: rnSpacing['md-loose'],
      gap: rnSpacing['xs-loose'],
      alignItems: 'center',
    } as ViewStyle,
    entryCardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
    entryIcon: { fontSize: 32 } as TextStyle,
    entryTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    entryDesc: {
      fontSize: rnType.body.size,
      color: tk.text.medium,
      textAlign: 'center',
      lineHeight: rnType.label.lineHeight,
    } as TextStyle,
    // 同上:alignSelf/width/height/marginTop 是外层占槽位的布局档;钮面档在 detailsButton,
    // 内层按 100% 撑满那个固定尺寸盒 ⇒ 胶囊尺寸、居中与投影范围不变。数值逐字搬移未新增。
    detailsButtonBox: {
      alignSelf: 'center',
      width: 187,
      height: 38,
      marginTop: rnSpacing['2xl'],
    } as ViewStyle,
    detailsButton: {
      width: '100%',
      height: '100%',
      borderRadius: rnRadius.sm, // 订阅按钮是控件 ⇒ control 档 sm(项目不允许胶囊)
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.warning.amber,
      // 豁免类别:订阅按钮的琥珀色柔光(效果光:色取 warning.amberLight + 零偏移,不是层级投影)
      elevation: 3,
      shadowColor: tk.warning.amberLight,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
    } as ViewStyle,
    detailsButtonPressed: { opacity: 0.8 } as ViewStyle,
    detailsButtonText: {
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tk.gray.black,
    } as TextStyle,
    sectionTitle: {
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tk.text.primary,
      marginTop: rnSpacing.lg,
      marginBottom: rnSpacing.sm,
    } as TextStyle,
    entryMeta: { fontSize: rnType.caption.size, color: tk.text.secondary } as TextStyle,
    entryBar: {
      alignSelf: 'stretch',
      height: 6,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
      marginTop: rnSpacing['2xs'],
    } as ViewStyle,
    entryBarFill: { height: '100%', backgroundColor: tk.success.DEFAULT } as ViewStyle,
    courseList: { gap: rnSpacing.sm } as ViewStyle,
    courseCard: {
      flexDirection: 'row',
      gap: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    } as ViewStyle,
    courseCover: {
      width: 110,
      height: 110,
      borderRadius: rnRadius.md,
      backgroundColor: tk.border.light,
    } as ImageStyle,
    courseBody: { flex: 1, gap: rnSpacing.xs } as ViewStyle,
    courseTitle: { fontSize: rnType.subtitle.size, fontWeight: '600', color: tk.text.primary } as TextStyle,
    courseMeta: { fontSize: rnType.label.size, color: tk.text.secondary } as TextStyle,
    coursePrice: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
