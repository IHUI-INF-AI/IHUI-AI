import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AgreementScreen as SharedAgreementScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 用户协议 — 复用共享 AgreementScreen */
export function AgreementScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  return <SharedAgreementScreen t={t} onBack={() => navigation.goBack()} />
}
