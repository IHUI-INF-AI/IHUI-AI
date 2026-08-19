import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  LearnDevelopScreen as SharedLearnDevelopScreen,
  type LearnDevelopScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function LearnDevelopScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  // 直接联系李总 → 创客名片页(对齐原项目 learn_develop showDetails → /pages/carte/index)
  const onContact = () => {
    navigation.navigate('Carte')
  }

  const props: LearnDevelopScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    onContact,
    colorScheme: 'light',
  }

  return <SharedLearnDevelopScreen {...props} />
}
