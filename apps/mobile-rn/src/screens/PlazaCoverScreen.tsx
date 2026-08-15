import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { PlazaCoverScreen as SharedPlazaCoverScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function PlazaCoverScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const onEnter = () => {
    navigation.navigate('Plaza')
  }

  const onPublish = () => {
    navigation.navigate('SetNeed')
  }

  return (
    <SharedPlazaCoverScreen
      t={t}
      onBack={() => navigation.goBack()}
      onEnter={onEnter}
      onPublish={onPublish}
    />
  )
}
