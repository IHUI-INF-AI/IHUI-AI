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
  PromoteStatus,
  PromoteInfo,
  PromoteInviteRecord,
  PromoteScreenProps,
} from '../../types'

export type { PromoteStatus, PromoteInfo, PromoteInviteRecord, PromoteScreenProps }

const STATUS_KEYS: Record<PromoteStatus, string> = {
  active: 'promote.status_active',
  inactive: 'promote.status_inactive',
}

/**
 * 推广共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 统计卡片 + 推广链接 + 规则 + 邀请记录。
 * 平台特定(导航 / API 调用 / 复制剪贴板)由 wrapper 通过 props 注入。
 */
export function PromoteScreen({
  t,
  info,
  records,
  loading,
  refreshing,
  error,
  copied,
  onRefresh,
  onCopy,
  onShare,
  onBack,
  colorScheme = 'light',
}: PromoteScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryBtnText}>{t('promote.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('promote.title')}</Text>
        <Text style={styles.subtitle}>{t('promote.subtitle')}</Text>
      </View>

      {info ? (
        <>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{info.inviteCount}</Text>
                <Text style={styles.statLabel}>{t('promote.inviteCount')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{info.activeCount}</Text>
                <Text style={styles.statLabel}>{t('promote.activeCount')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>¥{info.totalEarnings}</Text>
                <Text style={styles.statLabel}>{t('promote.totalEarnings')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.linkCard}>
            <Text style={styles.linkLabel}>{t('promote.referralLink')}</Text>
            <Text style={styles.linkText} numberOfLines={1}>
              {info.referralLink}
            </Text>
            <View style={styles.linkActions}>
              <TouchableOpacity style={[styles.linkBtn, styles.copyBtn]} onPress={onCopy}>
                <Text style={styles.linkBtnText}>
                  {copied ? t('promote.copySuccess') : t('promote.copyLink')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.linkBtn, styles.shareBtn]} onPress={onShare}>
                <Text style={styles.linkBtnText}>{t('promote.shareBtn')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.codeText}>
              {t('promote.referralCode')}: {info.referralCode}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>{t('promote.rules')}</Text>
          <View style={styles.rulesCard}>
            {info.rules.length === 0 ? (
              <Text style={styles.emptyText}>{t('promote.empty')}</Text>
            ) : (
              info.rules.map((rule, idx) => (
                <Text key={idx} style={styles.ruleText}>
                  • {rule}
                </Text>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>{t('promote.inviteRecords')}</Text>
          <View style={styles.recordsList}>
            {records.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('promote.empty')}</Text>
              </View>
            ) : (
              records.map((item) => (
                <View key={item.id} style={styles.recordCard}>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordName} numberOfLines={1}>
                      {item.nickname}
                    </Text>
                    <Text style={styles.recordDate}>{item.joinDate}</Text>
                  </View>
                  <View style={styles.recordRight}>
                    <Text style={styles.recordContribution}>+¥{item.contribution}</Text>
                    <View
                      style={[styles.recordStatus, item.status === 'active' && styles.statusActive]}
                    >
                      <Text style={styles.recordStatusText}>{t(STATUS_KEYS[item.status])}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      ) : null}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center', marginTop: 8 },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backBtn: { marginBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    statsCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.success.light,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 22, fontWeight: '700', color: tk.success.DEFAULT },
    statLabel: { marginTop: 8, fontSize: 11, color: tk.success.deepText },
    linkCard: {
      marginHorizontal: 10,
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    linkLabel: { fontSize: 14, fontWeight: '600', color: tk.text.medium },
    linkText: { marginTop: 8, fontSize: 14, color: tk.success.DEFAULT },
    linkActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    linkBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    copyBtn: { backgroundColor: tk.brand.DEFAULT },
    shareBtn: { backgroundColor: tk.surface.card },
    linkBtnText: { fontSize: 14, color: tk.surface.light },
    codeText: { marginTop: 10, fontSize: 11, color: tk.text.tertiary },
    sectionTitle: {
      paddingHorizontal: 10,
      paddingTop: 16,
      paddingBottom: 8,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    rulesCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    ruleText: { fontSize: 14, color: tk.text.secondary, marginVertical: 8, lineHeight: 18 },
    recordsList: { marginHorizontal: 10, marginBottom: 24 },
    recordCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    recordInfo: { flex: 1, marginRight: 8 },
    recordName: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    recordDate: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    recordRight: { alignItems: 'flex-end' },
    recordContribution: { fontSize: 14, fontWeight: '600', color: tk.success.DEFAULT },
    recordStatus: {
      marginTop: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    statusActive: { backgroundColor: tk.success.light },
    recordStatusText: { fontSize: 10, color: tk.text.secondary },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      height: 44,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryBtnText: { color: tk.surface.light, fontSize: 14 },
  })
}
