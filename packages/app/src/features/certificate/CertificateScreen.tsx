// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertificateItem, CertificateScreenProps, CertificateStatus } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, PressableCard, ScreenSkeleton } from '../../components/ScreenStates'

/** 证书状态/列表项/Props 类型 re-export(单一来源 @ihui/types) */
export type { CertificateItem, CertificateScreenProps, CertificateStatus }

/**
 * 证书列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:只负责渲染列表 UI + 下拉刷新 + 状态徽章。
 * 平台特定(导航/API 调用)由 wrapper 通过 props 注入。
 */
export function CertificateScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: CertificateScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusColor = (status: CertificateStatus): string => {
    switch (status) {
      case 'issued':
        return tk.success.DEFAULT
      case 'expired':
        return tk.warning.amber
      case 'revoked':
        return tk.danger.DEFAULT
      default:
        return tk.gray[400]
    }
  }

  const statusLabel = (status: CertificateStatus): string => {
    switch (status) {
      case 'issued':
        return t('certificate.status.issued')
      case 'expired':
        return t('certificate.status.expired')
      case 'revoked':
        return t('certificate.status.revoked')
      default:
        return status
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('certificate.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <EmptyState title={t('certificate.empty')} colorScheme={colorScheme} />
          ) : (
            items.map((item: CertificateItem) => (
              <PressableCard
                key={item.id}
                style={styles.card}
                onPress={() => onPressItem(item)}
                colorScheme={colorScheme}
              >
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.cardCourse} numberOfLines={1}>
                  {item.courseName}
                </Text>
                <Text style={styles.cardDate}>
                  {t('certificate.issuedDate')}: {item.issueDate}
                </Text>
                {item.expiryDate ? (
                  <Text style={styles.cardDate}>
                    {t('certificate.expiryDate')}: {item.expiryDate}
                  </Text>
                ) : null}
              </PressableCard>
            ))
          )}
        </ScrollView>
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
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 10, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    listBody: { padding: 10 },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: rnSpacing.sm,
    },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    cardCourse: { fontSize: rnType.body.size, color: tk.text.secondary, marginTop: rnSpacing.sm },
    cardDate: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginTop: rnSpacing.sm },
    statusBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      marginLeft: rnSpacing.sm,
      overflow: 'hidden',
    },
    statusText: { fontSize: rnType.caption.size, color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
