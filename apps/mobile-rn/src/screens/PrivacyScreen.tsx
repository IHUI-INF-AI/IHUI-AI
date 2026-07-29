import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { PrivacyScreen as SharedPrivacyScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 隐私政策 — 复用共享 PrivacyScreen */
export function PrivacyScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  return <SharedPrivacyScreen t={t} onBack={() => navigation.goBack()} />
}
