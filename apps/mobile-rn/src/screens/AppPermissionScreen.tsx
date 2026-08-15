import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AppPermissionScreen as SharedAppPermissionScreen,
  type AppPermissionScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AppPermissionScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const props: AppPermissionScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    colorScheme: 'light',
  }

  return <SharedAppPermissionScreen {...props} />
}
