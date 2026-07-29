import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  CustomerServiceInfo,
  CustomerServiceScreenProps,
} from '../../types'

/** 客服共享屏 — props 注入式跨端组件 */
export type { CustomerServiceInfo, CustomerServiceScreenProps }

export function CustomerServiceScreen({
  t,
  info,
  loading,
  error,
  onCall,
  onEmail,
  onBack,
  colorScheme = 'light',
}: CustomerServiceScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t('customerService.empty')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('customerService.title')}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{t('customerService.status')}</Text>
            <View
              style={[styles.dot, info.online ? styles.dotOnline : styles.dotOffline]}
            />
            <Text
              style={[
                styles.statusText,
                info.online ? styles.textOnline : styles.textOffline,
              ]}
            >
              {info.online
                ? t('customerService.online')
                : t('customerService.offline')}
            </Text>
          </View>
          <Text style={styles.workHours}>
            {t('customerService.workingHours')}: {info.workingHours}
          </Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.contactRow} onPress={onCall} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Text style={styles.label}>{t('customerService.phone')}</Text>
            <Text style={styles.value}>{info.phone || '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactRow, styles.contactRowLast]} onPress={onEmail} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Text style={styles.label}>{t('customerService.email')}</Text>
            <Text style={styles.value}>{info.email || '—'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    body: { padding: 16 },
    card: {
      padding: 16,
      marginBottom: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { fontSize: 12, color: tk.text.secondary },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotOnline: { backgroundColor: tk.success.DEFAULT },
    dotOffline: { backgroundColor: tk.text.tertiary },
    statusText: { fontSize: 13, fontWeight: '600' },
    textOnline: { color: tk.success.DEFAULT },
    textOffline: { color: tk.text.tertiary },
    workHours: { marginTop: 8, fontSize: 12, color: tk.text.tertiary },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    contactRowLast: { marginTop: 4 },
    value: { fontSize: 13, color: tk.text.primary },
    muted: { fontSize: 13, color: tk.text.secondary },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
  })
}
