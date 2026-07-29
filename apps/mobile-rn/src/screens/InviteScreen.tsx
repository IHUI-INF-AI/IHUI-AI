import { useCallback, useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { InviteScreen as SharedInviteScreen } from '@ihui/rn-app'
import type { InviteInfo, InviteRecordItem } from '@ihui/types'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function InviteScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [records, setRecords] = useState<InviteRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [infoRes, listRes] = await Promise.all([
        fetchApi<InviteInfo>('/distribution/overview'),
        fetchApi<InviteRecordItem[]>('/distribution/invited-users'),
      ])
      if (!infoRes.success || !listRes.success) throw new Error()
      setInfo(infoRes.data ?? null)
      setRecords(listRes.data ?? [])
    } catch {
      setError(t('invite.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onShare = async () => {
    if (!info) return
    try {
      await Share.share({ message: `${t('invite.shareText')}: ${info.inviteUrl}` })
    } catch {
      // ignore
    }
  }

  return (
    <SharedInviteScreen
      t={t}
      info={info}
      records={records}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onShare={onShare}
      onBack={() => navigation.goBack()}
    />
  )
}
