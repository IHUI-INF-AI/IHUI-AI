// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { Bell, BookOpen, Video } from 'lucide-react-native'
import type {
  HomeRecommendItem,
  HomeLiveItem,
  HomeProgressItem,
  HomeMenuItem,
  HomeScreenProps,
} from '../../types'
import { MoreLink, useFontMultiplier } from '../../components/MoreLink'
import { ScreenSkeleton } from '../../components/ScreenStates'

import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'

export type { HomeRecommendItem, HomeLiveItem, HomeProgressItem, HomeMenuItem, HomeScreenProps }

function getGreetingKey():
  'home.greetingMorning' | 'home.greetingNoon' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const h = new Date().getHours()
  if (h < 11) return 'home.greetingMorning'
  if (h < 13) return 'home.greetingNoon'
  if (h < 18) return 'home.greetingAfternoon'
  return 'home.greetingEvening'
}

/**
 * 首页共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染问候语 + 通知铃铛 + 学习进度 + 直播预览 + 推荐课程 + 发现菜单。
 * 所有平台特定(useAuth/useNotificationStore/getCourses 等)由 wrapper 注入。
 * 问候语时段由共享层基于 new Date() 计算(纯 JS,平台无关)。
 */
export function HomeScreen({
  t,
  userNickname,
  connected,
  unreadCount,
  recommends,
  lives,
  progress,
  menuItems,
  loading,
  refreshing,
  error,
  onRefresh,
  onOpenNotifications,
  onPressProgress,
  onPressLive,
  onPressCourse,
  onPressMenu,
  onNavigateCourses,
  onNavigateLives,
  colorScheme = 'light',
}: HomeScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const fontMultiplier = useFontMultiplier()

  if (loading) {
    return <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
  }

  const firstProgress = progress[0]
  const moreLabel = t('common.more')
  // 三块内容全空时不再各摆一张同形空卡(整屏就成三个空盒),合并成一枚引导卡
  const nothingToShow = !firstProgress && lives.length === 0 && recommends.length === 0

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: rnSpacing['3xl'] }}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting} numberOfLines={1}>
            {t(getGreetingKey())},{userNickname || t('home.guest')}
          </Text>
          <Text style={styles.welcome}>{t('home.welcome')}</Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[styles.dot, connected ? styles.dotOn : styles.dotOff]}
            accessibilityLabel={connected ? 'connected' : 'disconnected'}
          />
          <TouchableOpacity
            onPress={onOpenNotifications}
            style={styles.bellBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Bell size={18} color={tk.text.medium} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : String(unreadCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.errorRetry}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.errorRetryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {nothingToShow ? (
        <View style={styles.section}>
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={[styles.mutedText, styles.emptyText]}>{t('home.progressEmpty')}</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onNavigateCourses}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>{t('nav.courses')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.learningProgress')}</Text>
            {firstProgress ? (
              <TouchableOpacity
                onPress={() => onPressProgress(firstProgress.courseId)}
                activeOpacity={0.7}
              >
                <View style={styles.card}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {firstProgress.courseTitle || firstProgress.courseId}
                  </Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.round((firstProgress.progress ?? 0) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.metaText}>
                    {t('home.progressLessons', {
                      completed: firstProgress.completedLessons,
                      total: firstProgress.totalLessons,
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={[styles.mutedText, styles.emptyText]}>{t('home.progressEmpty')}</Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={onNavigateCourses}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>{t('nav.courses')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, styles.sectionHeaderTitle]}>
                {t('home.livePreview')}
              </Text>
              <MoreLink label={moreLabel} onPress={onNavigateLives} colorScheme={colorScheme} />
            </View>
            {lives.length === 0 ? (
              <View style={[styles.card, styles.emptyCenter]}>
                <Video size={18} color={tk.text.tertiary} />
                <Text style={styles.emptyHint}>{t('live.empty')}</Text>
              </View>
            ) : (
              lives.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => onPressLive(l.id)}
                  style={styles.cardSpacing}
                  activeOpacity={0.7}
                >
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {l.title}
                      </Text>
                      <View style={[styles.tag, l.isLive ? styles.tagLive : styles.tagUpcoming]}>
                        <Text style={[styles.tagText, l.isLive ? null : styles.tagUpcomingText]}>
                          {l.isLive ? t('live.ongoing') : t('live.upcoming')}
                        </Text>
                      </View>
                    </View>
                    {l.lecturerName ? (
                      <Text style={styles.metaText}>
                        {t('live.lecturer')}:{l.lecturerName}
                      </Text>
                    ) : null}
                    <Text style={styles.metaTertiary}>
                      {t('live.startAt')}:{l.startTimeText}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, styles.sectionHeaderTitle]}>
                {t('home.recommend')}
              </Text>
              <MoreLink label={moreLabel} onPress={onNavigateCourses} colorScheme={colorScheme} />
            </View>
            {recommends.length === 0 ? (
              <View style={[styles.card, styles.emptyCenter]}>
                <BookOpen size={18} color={tk.text.tertiary} />
                <Text style={styles.emptyHint}>{t('course.empty')}</Text>
              </View>
            ) : (
              recommends.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => onPressCourse(c.id)}
                  style={styles.cardSpacing}
                  activeOpacity={0.7}
                >
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={styles.priceText}>
                        {c.isFree ? t('course.free') : `¥${c.price.toFixed(2)}`}
                      </Text>
                    </View>
                    <Text style={styles.metaText}>
                      {c.instructor} · {c.level} ·{' '}
                      {t('course.studentCount', { count: c.studentCount })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('menu.sectionDiscover')}</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((m) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => onPressMenu(m.key)}
              activeOpacity={0.7}
              style={styles.menuCell}
            >
              {typeof m.icon === 'string' ? (
                <Text style={styles.menuIcon}>{m.icon}</Text>
              ) : m.icon ? (
                <m.icon size={22} color={tk.text.medium} />
              ) : null}
              <Text
                style={styles.menuLabel}
                numberOfLines={1}
                maxFontSizeMultiplier={fontMultiplier}
              >
                {t(m.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    // 页面背景必须用 surface.bg(明暗自适应);gray[100] 是明暗同值浅灰(#f5f5f5),暗色下会铺白底
    container: { flex: 1, backgroundColor: tk.surface.bg },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
    },
    headerLeft: { flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    greeting: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    welcome: { marginTop: 6, fontSize: 13, color: tk.text.secondary },
    dot: { marginRight: rnSpacing.sm, width: 8, height: 8, borderRadius: rnRadius.xs },
    dotOn: { backgroundColor: tk.success.DEFAULT },
    dotOff: { backgroundColor: tk.text.tertiary },
    bellBtn: { position: 'relative', padding: rnSpacing.xs },
    badge: {
      position: 'absolute',
      right: -4,
      top: -4,
      minWidth: 16,
      height: 16,
      paddingHorizontal: rnSpacing.xs,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
    errorWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: rnSpacing.md,
      marginHorizontal: rnSpacing.lg,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 10,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.error.bg,
    },
    errorText: { flex: 1, fontSize: 13, color: tk.danger.DEFAULT },
    errorRetry: {
      marginLeft: rnSpacing.md,
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.danger.DEFAULT,
    },
    errorRetryText: { fontSize: rnType.label.size, fontWeight: '600', color: '#FFFFFF' },
    section: { paddingHorizontal: rnSpacing.lg, marginTop: rnSpacing['2xl'] },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      marginBottom: 10,
      fontSize: 17,
      fontWeight: '600',
      color: tk.text.primary,
    },
    sectionHeaderTitle: { marginBottom: 0 },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      // 暗色下 surface.light 是 #262626、页面底 #242424,只差 2 阶卡片融进背景;
      // surface.card 亮色同为白、暗色降到 #1A1A1A(与 web 暗色 --color-card 同值),层次才成立。
      // 不再叠 1px 硬边框:底色已分区,描边会把卡片读成"凹下去的洞"
      backgroundColor: tk.surface.card,
    },
    emptyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    emptyText: { flex: 1, marginRight: rnSpacing.md },
    emptyCenter: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rnSpacing.xl,
      gap: 6,
    },
    emptyHint: { fontSize: 13, color: tk.text.secondary },
    cardSpacing: { marginTop: 10 },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: { flex: 1, fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    tag: {
      marginLeft: rnSpacing.sm,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
    },
    tagLive: { backgroundColor: tk.danger.DEFAULT },
    tagUpcoming: { backgroundColor: tk.warning.DEFAULT },
    tagText: { fontSize: rnType.label.size, fontWeight: '600', color: '#FFFFFF' },
    tagUpcomingText: { color: '#1A1A1A' },
    metaText: { marginTop: rnSpacing.xs, fontSize: 13, color: tk.text.secondary },
    metaTertiary: { marginTop: rnSpacing.xs, fontSize: rnType.label.size, color: tk.text.tertiary },
    priceText: {
      marginLeft: rnSpacing.sm,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    },
    mutedText: { fontSize: 13, lineHeight: 19, color: tk.text.secondary },
    progressBar: {
      marginTop: 10,
      height: 6,
      borderRadius: rnRadius.xs,
      backgroundColor: tk.border.light,
      overflow: 'hidden',
    },
    progressFill: { height: 6, backgroundColor: tk.success.DEFAULT },
    primaryBtn: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    menuGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    menuCell: {
      width: '33.333%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      gap: rnSpacing.sm,
    },
    menuIcon: { fontSize: 22, lineHeight: 26 },
    menuLabel: { fontSize: 13, color: tk.text.secondary, textAlign: 'center' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
