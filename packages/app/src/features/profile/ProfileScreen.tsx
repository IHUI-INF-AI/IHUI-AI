// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import type { ProfileScreenProps, SharedUserStatistics } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { ChevronRight } from 'lucide-react-native'
import { useFontMultiplier } from '../../components/MoreLink'

import { rnRadius } from '@ihui/design-tokens'

/**
 * ProfileScreen — 跨端共享「个人资料」页。
 *
 * 平台无关:数据(user/stats/orderCount)、状态(loading/error)、导航(onNavigate/onLogout/onBack)
 * 全部通过 props 注入,组件只负责渲染。web/RN wrapper 各自实现数据获取与导航。
 * 配色:由 colorScheme prop('light' | 'dark',默认 'light')经 getTokens 解析为明/暗 token 集。
 *
 * 页头归属(2026-09-27,双层页头收敛,同 SettingsScreen 先例):本组件**不渲染内置页头/返回键**,
 * 页头(标题 + 返回 + 右侧动作)由宿主提供 —— RN 端生产页(apps/mobile-rn/src/screens/ProfileScreen.tsx)
 * 渲染 NavBar(标题 + 反馈 + Drawer 菜单入口),demo 页(SharedDemoScreen)有常驻 tab 栏。
 * 此前组件自带 BackChevron + 标题,在生产页里悬在滚动区中段、与宿主 NavBar 同屏两条返回键
 * (守门 102 GA7 / 守门 145 DH2 判定型)。onBack 仍留在 ProfileScreenProps 契约中
 * (packages/types,本轮不可改),运行时不再消费。
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
  colorScheme = 'light',
}: ProfileScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const fontMultiplier = useFontMultiplier()

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
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  onPress={() => onNavigate?.(item.key)}
                >
                  {typeof item.icon === 'string' ? (
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  ) : item.icon ? (
                    <item.icon size={20} color={tk.text.primary} />
                  ) : null}
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <ChevronRight size={Math.round(16 * fontMultiplier)} color={tk.text.tertiary} />
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
    errorBar: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 10,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.error.bg,
    },
    errorText: { fontSize: 14, color: tk.error.text },
    body: { paddingHorizontal: 10, paddingVertical: 16, gap: 12 },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: rnRadius.lg, // 原 10,R1 吸附至 lg(8)
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      gap: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 56 / 2,
      backgroundColor: tk.brandAccent.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 28, fontWeight: '700', color: tk.brandAccent.foreground },
    userMeta: { flex: 1, gap: 4 },
    nickname: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    subText: { fontSize: 14, color: tk.text.secondary },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statsCell: {
      width: '31%',
      flexGrow: 1,
      padding: 14,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
    },
    statsValue: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    statsLabel: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    menuSection: { gap: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: tk.text.medium },
    menuCard: {
      borderRadius: rnRadius.lg, // 原 10,R1 吸附至 lg(8)
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 60,
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 10,
    },
    menuIcon: { fontSize: 16 },
    menuLabel: { flex: 1, fontSize: 16, color: tk.text.primary },
    logoutBtn: {
      marginTop: 8,
      height: 50,
      paddingHorizontal: 14,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.error.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: { fontSize: 16, fontWeight: '600', color: tk.error.text },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
