import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  IcpRecordScreen as SharedIcpRecordScreen,
  type IcpRecordScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function IcpRecordScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const props: IcpRecordScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    colorScheme: 'light',
  }

  return <SharedIcpRecordScreen {...props} />
}
