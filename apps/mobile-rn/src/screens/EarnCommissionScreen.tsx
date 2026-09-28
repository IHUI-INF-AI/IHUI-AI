// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOverview, type CommissionOverview } from '@ihui/api-client'
import { EarnCommissionScreen as SharedEarnCommissionScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function EarnCommissionScreen() {
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const [overview, setOverview] = useState<CommissionOverview | null>(null)

  const load = useCallback(async () => {
    const res = await getOverview()
    if (res.success) setOverview(res.data ?? null)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onOpenVip = (): void => {
    // 对齐历史「开通会员」入口:loginPopUp/UserInfoCard openIntroduce → vip_info?type=IntroducePopup
    navigation.navigate('Vip', { type: 'IntroducePopup' })
  }

  return (
    <View style={{ flex: 1 }}>
      <SharedEarnCommissionScreen
        t={t}
        onBack={() => navigation.goBack()}
        overview={overview}
        onOpenVip={onOpenVip}
        colorScheme={resolvedTheme}
      />
    </View>
  )
}

export default EarnCommissionScreen
