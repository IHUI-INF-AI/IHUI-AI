import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Section {
  title: string
  body: string
}

export function AgreementScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const sections: Section[] = [
    { title: t('agreement.sectionTerms'), body: t('agreement.sectionTermsBody') },
    { title: t('agreement.sectionRights'), body: t('agreement.sectionRightsBody') },
    { title: t('agreement.sectionObligations'), body: t('agreement.sectionObligationsBody') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('agreement.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card style={styles.card}>
          <Text style={styles.subtitle}>{t('agreement.subtitle')}</Text>
          <Text style={styles.updatedAt}>{t('agreement.updatedAt')}: 2026-07-19</Text>
        </Card>
        {sections.map((section) => (
          <Card key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  subtitle: { fontSize: 13, color: '#6B7280' },
  updatedAt: { marginTop: 8, fontSize: 11, color: '#9CA3AF' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sectionBody: { marginTop: 6, fontSize: 12, color: '#374151', lineHeight: 18 },
})
