import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { AboutScreenProps, SharedAppInfo } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

const DEFAULT_APP_INFO: Required<SharedAppInfo> = {
  appName: 'IHUI AI',
  version: '1.0.0',
  description:
    '全栈 AI 平台,支持 web / api / ai-service / mobile-rn / desktop / extension / miniapp-taro / cli 八端。',
  officialSite: 'https://aizhs.top',
  contactEmail: 'support@aizhs.top',
  license: 'MIT',
}

/**
 * AboutScreen — 跨端共享「关于」页。
 * 平台无关:用 react-native primitives 编写,web 端 react-native-web 渲染,RN 端原生渲染。
 * i18n 通过 `t` 注入,导航通过 `onBack` 注入(由调用方提供)。
 * 应用信息通过 `appInfo` 注入,缺省用 DEFAULT_APP_INFO。
 * 配色:由 colorScheme prop('light' | 'dark',默认 'light')经 getTokens 解析为明/暗 token 集。
 */
export function AboutScreen({
  t,
  appInfo,
  onBack,
  colorScheme = 'light',
}: AboutScreenProps & { colorScheme?: 'light' | 'dark' }) {
  const info = { ...DEFAULT_APP_INFO, ...appInfo }
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const rows = [
    { label: t('about.appName'), value: info.appName },
    { label: t('about.version'), value: info.version },
    { label: t('about.description'), value: info.description },
    { label: t('about.officialSite'), value: info.officialSite },
    { label: t('about.contactEmail'), value: info.contactEmail },
    { label: t('about.license'), value: info.license },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('about.title')}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.logoCard}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>IHUI</Text>
          </View>
          <Text style={styles.appName}>{info.appName}</Text>
          <Text style={styles.appTagline}>{info.description}</Text>
        </View>

        <View style={styles.infoCard}>
          {rows.map((row, idx) => (
            <View key={row.label} style={[styles.row, idx > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
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
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14 },
    logoCard: {
      padding: 14,
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      alignItems: 'center',
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: { fontSize: 20, fontWeight: '700', color: tk.surface.light },
    appName: { marginTop: 12, fontSize: 18, fontWeight: '700', color: tk.text.primary },
    appTagline: { marginTop: 8, fontSize: 14, color: tk.text.secondary, textAlign: 'center' },
    infoCard: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    rowDivider: { borderTopColor: tk.border.light, borderTopWidth: 1 },
    label: { fontSize: 14, color: tk.text.secondary },
    value: { fontSize: 14, color: tk.text.primary, maxWidth: 200 },
  })
}
