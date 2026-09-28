// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { TopupFailScreen as SharedTopupFailScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type TopupFailParams = {
  TopupFail: { reason?: string }
}
type Route = RouteProp<TopupFailParams, 'TopupFail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function TopupFailScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const reason = route.params?.reason || '充值未完成,请稍后重试'

  const onRetry = () => navigation.goBack()
  const onContactService = () => navigation.navigate('CustomerService')

  return (
    <SharedTopupFailScreen
      t={t}
      reason={reason}
      onRetry={onRetry}
      onContactService={onContactService}
      onBack={() => navigation.goBack()}
     colorScheme={resolvedTheme}/>
  )
}
