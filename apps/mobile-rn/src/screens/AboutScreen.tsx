import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface InfoRow {
  label: string
  value: string
}

export function AboutScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const rows: InfoRow[] = [
    { label: t('about.appName'), value: 'IHUI AI' },
    { label: t('about.version'), value: '1.0.0' },
    { label: t('about.description'), value: t('about.descriptionValue') },
    { label: t('about.officialSite'), value: 'https://ihui.ai' },
    { label: t('about.contactEmail'), value: 'support@ihui.ai' },
    { label: t('about.license'), value: 'MIT' },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('about.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.logoCard}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>IHUI</Text>
          </View>
          <Text style={styles.appName}>IHUI AI</Text>
          <Text style={styles.appTagline}>{t('about.descriptionValue')}</Text>
        </Card>
        <Card style={styles.card}>
          {rows.map((row, idx) => (
            <View key={row.label} style={[styles.row, idx > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </Card>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16 },
  logoCard: { padding: 20, marginBottom: 12, borderRadius: 8, alignItems: 'center' },
  logo: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  appName: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#111827' },
  appTagline: { marginTop: 4, fontSize: 12, color: '#6B7280', textAlign: 'center' },
  card: { padding: 12, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivider: { borderTopColor: '#F3F4F6', borderTopWidth: 1 },
  label: { fontSize: 12, color: '#6B7280' },
  value: { fontSize: 13, color: '#111827', maxWidth: 200 },
})
