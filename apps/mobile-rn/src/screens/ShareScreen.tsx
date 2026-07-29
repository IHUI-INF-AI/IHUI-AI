import { useState } from 'react'
import { Share as RnShare } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { ShareScreen as SharedShareScreen, type ShareResultItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'Share'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ShareScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { targetType, targetId, title } = route.params
  const [result, setResult] = useState<ShareResultItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remark, setRemark] = useState('')

  const onCreate = async () => {
    setLoading(true); setError('')
    const res = await fetchApi<ShareResultItem>('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, remark: remark.trim() }),
    })
    setLoading(false)
    if (res.success && res.data) setResult(res.data)
    else if (!res.success) setError(res.error || t('share.createFailed'))
  }

  const onShare = async () => {
    if (!result) return
    try { await RnShare.share({ message: `${title}\n${result.shareUrl}` }) } catch { /* user cancelled */ }
  }

  return (
    <SharedShareScreen
      t={t}
      targetTitle={title}
      remark={remark}
      result={result}
      loading={loading}
      error={error}
      onRemarkChange={setRemark}
      onCreate={onCreate}
      onShare={onShare}
      onBack={() => navigation.goBack()}
    />
  )
}
