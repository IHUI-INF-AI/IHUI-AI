import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TeamDetailScreenProps } from '../../types'

/** TeamDetailScreen props re-export(单一来源 @ihui/types) */
export type { TeamDetailScreenProps }

/**
 * 团队成员详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染成员信息卡片 + 贡献统计 + 操作按钮。
 * 平台特定(导航/拨号/跳转)由 wrapper 通过 props 注入。
 */
export function TeamDetailScreen({
  t,
  onBack,
  member,
  onContact,
  onViewOrders,
  colorScheme = 'light',
}: TeamDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const stats = useMemo(
    () => [
      {
        label: t('teamDetail.transactionVolume') || '成交额',
        value: '¥' + (member.transactionVolume / 100).toFixed(2),
      },
      {
        label: t('teamDetail.commission') || '获取佣金',
        value: '¥' + (member.commission / 100).toFixed(2),
      },
      { label: t('teamDetail.orderNum') || '成交订单数', value: String(member.orderNum) },
    ],
    [member, t],
  )

  const initials = member.nickname ? member.nickname.slice(0, 1).toUpperCase() : '?'

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('teamDetail.title') || '团队成员详情'}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.memberCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.memberMeta}>
            <Text style={styles.nickname}>{member.nickname}</Text>
            <Text style={styles.metaText}>
              {t('teamDetail.phone')}:{member.phone}
            </Text>
            <Text style={styles.metaText}>
              {t('teamDetail.joinedAt')}:{member.joinedAt}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnPrimary,
              pressed ? styles.pressed : null,
            ]}
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={t('teamDetail.contact') || '联系成员'}
          >
            <Text style={styles.actionBtnPrimaryText}>{t('teamDetail.contact') || '联系'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
            onPress={onViewOrders}
            accessibilityRole="button"
            accessibilityLabel={t('teamDetail.viewOrders') || '查看订单'}
          >
            <Text style={styles.actionBtnText}>{t('teamDetail.viewOrders') || '查看订单'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 16 },
    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: tk.surface.card,
      borderRadius: 12,
      padding: 16,
      gap: 16,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '600', color: tk.surface.light },
    memberMeta: { flex: 1, gap: 4 },
    nickname: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    metaText: { fontSize: 13, color: tk.text.secondary },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: tk.surface.card,
      borderRadius: 12,
      padding: 16,
      gap: 8,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: { fontSize: 16, fontWeight: '600', color: tk.brand.DEFAULT },
    statLabel: { fontSize: 12, color: tk.text.secondary },
    actionRow: { flexDirection: 'row', gap: 12 },
    actionBtn: {
      flex: 1,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.card,
    },
    actionBtnPrimary: { backgroundColor: tk.brand.DEFAULT },
    actionBtnText: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    actionBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    pressed: { opacity: 0.85 },
  })
}
