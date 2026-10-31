// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { InviteInfo, InviteRecordItem, InviteScreenProps } from '@ihui/types'

import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'

/** 邀请记录/Props 类型 re-export(单一来源 @ihui/types) */
export type { InviteInfo, InviteRecordItem, InviteScreenProps }

/**
 * 邀请记录共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ loading 态(loading && !info)
 * + FlatList<InviteRecordItem>(ListHeaderComponent: info card[邀请码 + 统计 + 分享按钮]
 * + sectionTitle)+ 邀请记录卡片(nickname + reward + invitedAt)+ 下拉刷新 + 空态。
 * 平台特定(导航 / API 调用 / 分享)由 wrapper 通过 props 注入。
 */
export function InviteScreen({
  t,
  info,
  records,
  loading,
  refreshing,
  error,
  onRefresh,
  onShare,
  onBack,
  colorScheme = 'light',
}: InviteScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('invite.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && !info ? (
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      ) : (
        <FlatList<InviteRecordItem>
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            info ? (
              <View>
                <View style={styles.infoCard}>
                  <View style={styles.codeRow}>
                    <Text style={styles.codeLabel}>{t('invite.inviteCode')}</Text>
                    <Text style={styles.codeValue}>{info.inviteCode}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{info.totalInvited}</Text>
                      <Text style={styles.statLabel}>{t('invite.totalInvited')}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{info.totalReward}</Text>
                      <Text style={styles.statLabel}>{t('invite.totalReward')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onShare}
                    style={styles.shareBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.shareBtnText}>{t('invite.share')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.sectionTitle}>{t('invite.sectionTitle')}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState title={t('invite.empty')} colorScheme={colorScheme} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.nickname}
                </Text>
                <Text
                  style={[
                    styles.cardStatus,
                    item.status === 'completed' ? styles.statusDone : styles.statusPending,
                  ]}
                >
                  {item.status === 'completed'
                    ? t('invite.statusCompleted')
                    : t('invite.statusPending')}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.cardTime}>{item.invitedAt}</Text>
                <Text style={styles.cardReward}>+{item.reward}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: rnSpacing['sm-loose'], fontSize: 14, color: tk.danger.DEFAULT },
    listBody: { padding: 14, paddingBottom: rnSpacing['3xl'] },
    separator: { height: 8 },
    infoCard: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    codeLabel: { fontSize: 14, color: tk.text.secondary },
    codeValue: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: rnSpacing.md,
    },
    statItem: { flex: 1, alignItems: 'center', minWidth: 96 },
    statValue: { fontSize: 20, fontWeight: '700', color: tk.success.DEFAULT },
    statLabel: { marginTop: rnSpacing.sm, fontSize: 11, color: tk.text.secondary },
    shareBtn: {
      marginTop: rnSpacing.md,
      height: 50,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    shareBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
    sectionTitle: {
      marginTop: rnSpacing.lg,
      marginBottom: rnSpacing.sm,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: rnSpacing.sm,
    },
    cardStatus: { fontSize: 11, fontWeight: '600' },
    statusDone: { color: tk.success.DEFAULT },
    statusPending: { color: tk.warning.DEFAULT },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
    cardReward: { fontSize: 16, fontWeight: '700', color: tk.success.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
