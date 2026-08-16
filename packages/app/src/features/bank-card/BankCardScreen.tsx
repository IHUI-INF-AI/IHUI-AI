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
import type { BankCardItem, BankCardScreenProps } from '../../types'

/** 银行卡列表共享屏 — props 注入式跨端组件 */
export type { BankCardItem, BankCardScreenProps }

function maskNumber(num: string): string {
  if (!num) return ''
  if (num.length <= 4) return num
  return `**** **** **** ${num.slice(-4)}`
}

export function BankCardScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: BankCardScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('bankCard.title')}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList<BankCardItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>
              {loading ? t('common.loading') : t('bankCard.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.bankName}>{item.bankName}</Text>
              {item.isDefault ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t('bankCard.default')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardNumber}>{maskNumber(item.number)}</Text>
            <Text style={styles.holder}>
              {t('bankCard.holder')}: {item.holder}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    error: { paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: tk.danger.DEFAULT },
    listBody: { padding: 10 },
    separator: { height: 12 },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary },
    card: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bankName: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    badgeText: { fontSize: 10, color: tk.surface.light },
    cardNumber: {
      marginTop: 10,
      fontSize: 20,
      fontWeight: '600',
      color: tk.surface.light,
      letterSpacing: 1,
    },
    holder: { marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  })
}
