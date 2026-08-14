import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Alert, Clipboard, Platform, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { NavBar } from '../components/NavBar'
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
      {
        text: t('common.confirm'),
        onPress: () => Alert.alert(t('debug.clearCache'), t('debug.cleared')),
      },
    ])
  }

  const onClearStorage = () => {
    Alert.alert(t('debug.clearStorage'), t('debug.confirm'), [
      { text: t('common.cancel') },
      {
        text: t('common.confirm'),
        onPress: () => Alert.alert(t('debug.clearStorage'), t('debug.cleared')),
      },
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
      <NavBar title={t('debug.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>{t('debug.warning')}</Text>
        </View>
        <Card style={styles.card}>
          {items.map((item, idx) => (
            <View key={item.label} style={[styles.row, idx > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value} numberOfLines={1}>
                {item.value}
              </Text>
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
            共享组件 Demo (shared-demo)
          </Button>
        </Card>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: 16 },
  warningBar: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: tokens.warning.amberLight,
    marginBottom: 12,
  },
  warningText: { fontSize: 11, color: tokens.warning.amberText },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowDivider: { borderTopColor: tokens.surface.card, borderTopWidth: 1 },
  label: { fontSize: 12, color: tokens.text.secondary },
  value: { fontSize: 13, color: tokens.text.primary, maxWidth: 200 },
  btn: { marginTop: 8, borderRadius: 8 },
  btnPrimary: { marginTop: 8, borderRadius: 8, backgroundColor: tokens.success.DEFAULT },
})
