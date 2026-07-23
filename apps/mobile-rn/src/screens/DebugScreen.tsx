import { Alert, Clipboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface DebugItem {
  label: string
  value: string
}

export function DebugScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const items: DebugItem[] = [
    { label: t('debug.platform'), value: Platform.OS },
    { label: t('debug.version'), value: Platform.Version?.toString() ?? '-' },
    { label: t('debug.apiBaseUrl'), value: API_BASE_URL },
    { label: t('debug.env'), value: __DEV__ ? 'development' : 'production' },
    { label: t('debug.locale'), value: 'zh-CN' },
  ]

  const onClearCache = () => {
    Alert.alert(t('debug.clearCache'), t('debug.confirm'), [
      { text: t('common.cancel') },
      { text: t('common.confirm'), onPress: () => Alert.alert(t('debug.clearCache'), t('debug.cleared')) },
    ])
  }

  const onClearStorage = () => {
    Alert.alert(t('debug.clearStorage'), t('debug.confirm'), [
      { text: t('common.cancel') },
      { text: t('common.confirm'), onPress: () => Alert.alert(t('debug.clearStorage'), t('debug.cleared')) },
    ])
  }

  const onCopyLogs = async () => {
    try {
      const logText = items.map((i) => `${i.label}: ${i.value}`).join('\n')
      if (Clipboard && Clipboard.setString) {
        Clipboard.setString(logText)
      }
      Alert.alert(t('debug.copyLogs'), t('debug.copied'))
    } catch {
      Alert.alert(t('debug.copyLogs'), t('debug.copyFailed'))
    }
  }

  const onOpenSharedDemo = () => {
    navigation.navigate('SharedDemo')
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('debug.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>{t('debug.warning')}</Text>
        </View>
        <Card style={styles.card}>
          {items.map((item, idx) => (
            <View key={item.label} style={[styles.row, idx > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </Card>
        <Card style={styles.card}>
          <Button onPress={onClearCache} variant="outline" style={styles.btn}>
            {t('debug.clearCache')}
          </Button>
          <Button onPress={onClearStorage} variant="outline" style={styles.btn}>
            {t('debug.clearStorage')}
          </Button>
          <Button onPress={onCopyLogs} style={styles.btnPrimary}>
            {t('debug.copyLogs')}
          </Button>
        </Card>
        <Card style={styles.card}>
          <Button onPress={onOpenSharedDemo} variant="outline" style={styles.btn}>
            共享组件 Demo (Solito + NativeWind)
          </Button>
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
  warningBar: { padding: 10, borderRadius: 8, backgroundColor: '#FEF3C7', marginBottom: 12 },
  warningText: { fontSize: 11, color: '#92400E' },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowDivider: { borderTopColor: '#F3F4F6', borderTopWidth: 1 },
  label: { fontSize: 12, color: '#6B7280' },
  value: { fontSize: 13, color: '#111827', maxWidth: 200 },
  btn: { marginTop: 8, borderRadius: 8 },
  btnPrimary: { marginTop: 8, borderRadius: 8, backgroundColor: '#10B981' },
})
