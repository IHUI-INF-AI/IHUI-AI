import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOverview, type CommissionOverview } from '@ihui/api-client'
import { EarnCommissionScreen as SharedEarnCommissionScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function EarnCommissionScreen() {
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
    navigation.navigate('Vip')
  }

  return (
    <View style={{ flex: 1 }}>
      <SharedEarnCommissionScreen
        t={t}
        onBack={() => navigation.goBack()}
        overview={overview}
        onOpenVip={onOpenVip}
      />
    </View>
  )
}

export default EarnCommissionScreen
