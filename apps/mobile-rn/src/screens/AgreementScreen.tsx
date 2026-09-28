// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AgreementScreen as SharedAgreementScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 用户协议 — 复用共享 AgreementScreen */
export function AgreementScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  return (
    <SharedAgreementScreen t={t} onBack={() => navigation.goBack()} colorScheme={resolvedTheme} />
  )
}
