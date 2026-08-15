import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { DevEnterCoverScreen as SharedDevEnterCoverScreen } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function DevEnterCoverScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [selected, setSelected] = useState<'month' | 'year'>('year')
  const [loading, setLoading] = useState(false)

  const onEnter = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigation.navigate('DevEnter')
    }, 600)
  }

  const onLearnMore = () => {
    navigation.navigate('ArticleList')
  }

  return (
    <SharedDevEnterCoverScreen
      t={t}
      planType={selected}
      loading={loading}
      onSelectPlan={setSelected}
      onNavigate={onEnter}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
