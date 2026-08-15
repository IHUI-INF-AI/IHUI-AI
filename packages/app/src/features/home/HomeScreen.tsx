import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  HomeRecommendItem,
  HomeLiveItem,
  HomeProgressItem,
  HomeMenuItem,
  HomeScreenProps,
} from '../../types'

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.success.DEFAULT} />
      </View>
    )
  }

  const firstProgress = progress[0]

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 32 }}
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
            <Text style={styles.bellIcon}>🔔</Text>
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
        </View>
      ) : null}

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
          <View style={styles.card}>
            <Text style={styles.mutedText}>{t('home.progressEmpty')}</Text>
            <TouchableOpacity style={styles.outlineBtn} onPress={onNavigateCourses}>
              <Text style={styles.outlineBtnText}>{t('nav.courses')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.livePreview')}</Text>
          <TouchableOpacity
            onPress={onNavigateLives}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.linkText}>{t('home.livePreviewMore')}</Text>
          </TouchableOpacity>
        </View>
        {lives.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>{t('live.empty')}</Text>
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
                    <Text style={styles.tagText}>
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
          <Text style={styles.sectionTitle}>{t('home.recommend')}</Text>
          <TouchableOpacity
            onPress={onNavigateCourses}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.linkText}>{t('home.livePreviewMore')}</Text>
          </TouchableOpacity>
        </View>
        {recommends.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>{t('course.empty')}</Text>
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
                  {c.instructor} · {c.level} · {t('course.studentCount', { count: c.studentCount })}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('menu.sectionDiscover')}</Text>
        <View style={styles.menuWrap}>
          {menuItems.map((m) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => onPressMenu(m.key)}
              activeOpacity={0.7}
              style={styles.menuItem}
            >
              <View style={styles.menuRow}>
                <Text style={styles.menuIcon}>{m.icon}</Text>
                <Text style={styles.menuLabel}>{t(m.labelKey)}</Text>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.gray[100] },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.gray[100],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingTop: 48,
    },
    headerLeft: { flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    greeting: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    welcome: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    dot: { marginRight: 8, width: 8, height: 8, borderRadius: 2 },
    dotOn: { backgroundColor: tk.success.DEFAULT },
    dotOff: { backgroundColor: tk.text.tertiary },
    bellBtn: { position: 'relative', padding: 4 },
    bellIcon: { fontSize: 18 },
    badge: {
      position: 'absolute',
      right: -4,
      top: -4,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontSize: 10, fontWeight: '700', color: tk.surface.light },
    errorWrap: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    section: { paddingHorizontal: 12, marginTop: 12 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      marginBottom: 8,
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
    },
    linkText: { fontSize: 12, color: tk.success.DEFAULT },
    card: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EBEEF5',
      backgroundColor: tk.surface.light,
    },
    cardSpacing: { marginTop: 8 },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    tag: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    tagLive: { backgroundColor: tk.danger.DEFAULT },
    tagUpcoming: { backgroundColor: tk.warning?.DEFAULT ?? '#f59e0b' },
    tagText: { fontSize: 12, color: tk.surface.light },
    metaText: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    metaTertiary: { marginTop: 4, fontSize: 12, color: tk.text.tertiary },
    priceText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: tk.success.DEFAULT },
    mutedText: { fontSize: 13, color: tk.text.secondary },
    progressBar: {
      marginTop: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: tk.border.light,
      overflow: 'hidden',
    },
    progressFill: { height: 8, backgroundColor: tk.success.DEFAULT },
    outlineBtn: {
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.success.DEFAULT,
      alignSelf: 'flex-start',
    },
    outlineBtnText: { fontSize: 13, color: tk.success.DEFAULT },
    menuWrap: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e0e8ff',
      backgroundColor: tk.surface.light,
      padding: 4,
    },
    menuItem: { padding: 12 },
    menuRow: { flexDirection: 'row', alignItems: 'center' },
    menuIcon: { fontSize: 18 },
    menuLabel: { marginLeft: 12, flex: 1, fontSize: 14, color: tk.text.primary },
    menuArrow: { color: tk.text.tertiary },
  })
}
