import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FeedbackScreen as SharedFeedbackScreen } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { FeedbackSubmitPayload } from '@ihui/rn-app'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端 Feedback 包装器 — 注入 t + onBack(navigation.goBack)+ onSubmit(fetchApi)。
 * 渲染共享 FeedbackScreen(@ihui/rn-app),平台无关 UI 由共享层负责。
 */
export function FeedbackScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const handleSubmit = async (payload: FeedbackSubmitPayload): Promise<boolean> => {
    try {
      const res = await fetchApi('/feedbacks', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return res.success
    } catch {
      return false
    }
  }

  return (
    <SharedFeedbackScreen
      t={t}
      onSubmit={handleSubmit}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
