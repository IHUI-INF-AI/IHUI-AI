import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  InviteInfo,
  InviteRecordItem,
  InviteScreenProps,
} from '@ihui/types'

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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('invite.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && !info ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
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
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('invite.empty')}</Text>
            </View>
          }
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
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 8 },
    infoCard: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    codeLabel: { fontSize: 12, color: tk.text.secondary },
    codeValue: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    statsRow: {
      flexDirection: 'row',
      marginTop: 12,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '700', color: tk.success.DEFAULT },
    statLabel: { marginTop: 2, fontSize: 11, color: tk.text.secondary },
    shareBtn: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    shareBtnText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    sectionTitle: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    card: {
      padding: 12,
      borderRadius: 8,
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
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    cardStatus: { fontSize: 11, fontWeight: '600' },
    statusDone: { color: tk.success.DEFAULT },
    statusPending: { color: tk.warning.DEFAULT },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
    cardReward: { fontSize: 14, fontWeight: '700', color: tk.success.DEFAULT },
  })
}
