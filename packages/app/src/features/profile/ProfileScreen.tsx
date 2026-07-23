import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { TextLink } from 'solito/link'
import type { ProfileScreenProps, SharedUserStatistics } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * ProfileScreen — 跨端共享「个人资料」页。
 *
 * 平台无关:数据(user/stats/orderCount)、状态(loading/error)、导航(onNavigate/onLogout/onBack)
 * 全部通过 props 注入,组件只负责渲染。web/RN wrapper 各自实现数据获取与导航。
 * 配色:由 colorScheme prop('light' | 'dark',默认 'light')经 getTokens 解析为明/暗 token 集。
 */
export function ProfileScreen({
  t,
  user,
  stats,
  orderCount = 0,
  loading = false,
  error = '',
  menuSections = [],
  onNavigate,
  onLogout,
  onBack,
  colorScheme = 'light',
}: ProfileScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tk.brand.DEFAULT} />
      </View>
    )
  }

  const statsCells = buildStatsCells(t, stats, orderCount)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
        ) : (
          <TextLink href="/" textProps={{ style: styles.backText }}>
            {t('common.back')}
          </TextLink>
        )}
        <Text style={styles.title}>{t('profile.title')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.nickname)}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.nickname}>{user?.nickname || t('profile.nickname')}</Text>
            {user?.email ? <Text style={styles.subText}>{user.email}</Text> : null}
            {user?.phone ? <Text style={styles.subText}>{user.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.statsGrid}>
          {statsCells.map((cell) => (
            <View key={cell.key} style={styles.statsCell}>
              <Text style={styles.statsValue}>{cell.value}</Text>
              <Text style={styles.statsLabel}>{cell.label}</Text>
            </View>
          ))}
        </View>

        {menuSections.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.menuItem, idx > 0 && styles.menuItemGap]}
                  onPress={() => onNavigate?.(item.key)}
                >
                  {item.icon ? <Text style={styles.menuIcon}>{item.icon}</Text> : null}
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {onLogout ? (
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

function initials(name?: string): string {
  if (!name) return 'U'
  return name.trim().charAt(0).toUpperCase()
}

function buildStatsCells(
  t: ProfileScreenProps['t'],
  stats: SharedUserStatistics | null | undefined,
  orderCount: number,
) {
  return [
    { key: 'courses', label: t('profile.myCourses'), value: stats?.courseCount ?? 0 },
    { key: 'favorites', label: t('profile.myFavorites'), value: stats?.favoriteCount ?? 0 },
    { key: 'following', label: t('community.follow'), value: stats?.followingCount ?? 0 },
    { key: 'fans', label: t('community.follower'), value: stats?.fansCount ?? 0 },
    { key: 'orders', label: t('profile.myOrders'), value: orderCount },
    { key: 'points', label: t('wallet.points'), value: stats?.points ?? 0 },
  ]
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorBar: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: tk.error.bg },
    errorText: { fontSize: 12, color: tk.error.text },
    body: { padding: 16, gap: 12 },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      gap: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '700', color: tk.surface.light },
    userMeta: { flex: 1, gap: 2 },
    nickname: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    subText: { fontSize: 12, color: tk.text.secondary },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statsCell: {
      width: '31%',
      flexGrow: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
    },
    statsValue: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    statsLabel: { marginTop: 2, fontSize: 11, color: tk.text.secondary },
    menuSection: { gap: 8 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: tk.text.medium },
    menuCard: { borderRadius: 8, backgroundColor: tk.surface.muted, padding: 4 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, gap: 10 },
    menuItemGap: { marginTop: 4, backgroundColor: tk.surface.bg, borderRadius: 6 },
    menuIcon: { fontSize: 16 },
    menuLabel: { flex: 1, fontSize: 14, color: tk.text.primary },
    menuArrow: { fontSize: 18, color: tk.text.tertiary },
    logoutBtn: {
      marginTop: 8,
      padding: 14,
      borderRadius: 8,
      backgroundColor: tk.error.bg,
      alignItems: 'center',
    },
    logoutText: { fontSize: 14, fontWeight: '600', color: tk.error.text },
  })
}
