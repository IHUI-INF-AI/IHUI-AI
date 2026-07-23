import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { TextLink } from 'solito/link'
import type { AboutScreenProps, SharedAppInfo } from '../../types'

const DEFAULT_APP_INFO: Required<SharedAppInfo> = {
  appName: 'IHUI AI',
  version: '1.0.0',
  description: '全栈 AI 平台,支持 web / api / ai-service / mobile-rn / desktop / extension / miniapp-taro / cli 八端。',
  officialSite: 'https://ihui.ai',
  contactEmail: 'support@ihui.ai',
  license: 'MIT',
}

/**
 * AboutScreen — 跨端共享「关于」页。
 *
 * 平台无关:用 react-native primitives 编写,web 端 react-native-web 渲染,RN 端原生渲染。
 * i18n 通过 `t` 注入,导航通过 `onBack` 注入(不传则用 solito TextLink 跨端导航)。
 * 应用信息通过 `appInfo` 注入,缺省用 DEFAULT_APP_INFO。
 */
export function AboutScreen({ t, appInfo, onBack }: AboutScreenProps) {
  const info = { ...DEFAULT_APP_INFO, ...appInfo }

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
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
        ) : (
          <TextLink href="/" textProps={{ style: styles.backText }}>
            {t('common.back')}
          </TextLink>
        )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16 },
  logoCard: {
    padding: 20,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  appName: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#111827' },
  appTagline: { marginTop: 4, fontSize: 12, color: '#6B7280', textAlign: 'center' },
  infoCard: { padding: 12, borderRadius: 8, backgroundColor: '#F9FAFB' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowDivider: { borderTopColor: '#E5E7EB', borderTopWidth: 1 },
  label: { fontSize: 12, color: '#6B7280' },
  value: { fontSize: 13, color: '#111827', maxWidth: 200 },
})
