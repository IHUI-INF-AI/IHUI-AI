// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  PromoteStatus,
  PromoteInfo,
  PromoteInviteRecord,
  PromoteScreenProps,
} from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

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
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('promote.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
          style={styles.backBtn}
        />
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
                <Text style={styles.copyBtnText}>
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
              <EmptyState title={t('promote.empty')} colorScheme={colorScheme} />
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
    emptyText: { fontSize: rnType.body.size, color: tk.text.tertiary, marginTop: rnSpacing.sm },
    errorText: {
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
      textAlign: 'center',
      marginTop: rnSpacing.sm,
    },
    header: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    backBtn: { marginBottom: rnSpacing.sm },
    title: { fontSize: rnType.display.size, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    statsCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.success.light,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 22, fontWeight: '700', color: tk.success.DEFAULT },
    statLabel: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.success.deepText,
    },
    linkCard: {
      marginHorizontal: 10,
      marginTop: rnSpacing.md,
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    linkLabel: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.medium },
    linkText: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.success.DEFAULT },
    linkActions: { flexDirection: 'row', gap: rnSpacing.sm, marginTop: 10 },
    linkBtn: {
      flex: 1,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
    },
    copyBtn: { backgroundColor: tk.brand.cta },
    shareBtn: { backgroundColor: tk.surface.card },
    linkBtnText: { fontSize: rnType.body.size, color: tk.surface.light },
    copyBtnText: { fontSize: rnType.body.size, color: tk.brand.ctaForeground },
    codeText: { marginTop: 10, fontSize: rnType.caption.size, color: tk.text.tertiary },
    sectionTitle: {
      paddingHorizontal: 10,
      paddingTop: rnSpacing.lg,
      paddingBottom: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    rulesCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    ruleText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      marginVertical: rnSpacing.sm,
      lineHeight: 18,
    },
    recordsList: { marginHorizontal: 10, marginBottom: rnSpacing['2xl'] },
    recordCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.sm,
    },
    recordInfo: { flex: 1, marginRight: rnSpacing.sm },
    recordName: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    recordDate: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    recordRight: { alignItems: 'flex-end' },
    recordContribution: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    },
    recordStatus: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    statusActive: { backgroundColor: tk.success.light },
    recordStatusText: { fontSize: 10, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
