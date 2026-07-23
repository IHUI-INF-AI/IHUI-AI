import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AboutScreen as SharedAboutScreen } from '@ihui/app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端 About 包装器 — 注入 t + onBack(navigation.goBack),渲染共享 AboutScreen。
 */
export function AboutScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  return <SharedAboutScreen t={t} onBack={() => navigation.goBack()} />
}
