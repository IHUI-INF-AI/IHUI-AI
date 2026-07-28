import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { NoteDetailScreen as SharedNoteDetailScreen, type NoteDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'NoteDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function NoteDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [note, setNote] = useState<NoteDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<NoteDetailItem>(`/api/notes/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setNote(res.data)
      else setError(res.error || t('noteDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  return (
    <SharedNoteDetailScreen
      t={t}
      item={note}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
