import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertificateItem, CertificateScreenProps, CertificateStatus } from '../../types'

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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('certificate.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('certificate.empty')}</Text>
            </View>
          ) : (
            items.map((item: CertificateItem) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => onPressItem(item)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
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
              </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tk.text.primary },
    cardCourse: { fontSize: 12, color: tk.text.secondary, marginTop: 2 },
    cardDate: { fontSize: 11, color: tk.text.tertiary, marginTop: 2 },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginLeft: 8,
      overflow: 'hidden',
    },
    statusText: { fontSize: 11, color: tk.surface.light },
  })
}
