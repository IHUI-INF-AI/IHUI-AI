import { Alert } from 'react-native'
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

  const onContact = () => {
    Alert.alert('直接联系李总', '课程星球正在开发中，如需咨询请联系客服或李总。', [
      { text: '知道了', style: 'default' },
    ])
  }

  const props: LearnDevelopScreenProps = {
    t,
    onBack: () => navigation.goBack(),
    onContact,
    colorScheme: 'light',
  }

  return <SharedLearnDevelopScreen {...props} />
}
