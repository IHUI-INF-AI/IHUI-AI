import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  PromoteScreen as SharedPromoteScreen,
  type PromoteInfo,
  type PromoteInviteRecord,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function PromoteScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<PromoteInfo | null>(null)
  const [records, setRecords] = useState<PromoteInviteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [infoRes, recordsRes] = await Promise.all([
        fetchApi<PromoteInfo>('/promote/info'),
        fetchApi<{ list: PromoteInviteRecord[] }>('/promote/records', {
          params: { page: 1, pageSize: 10 },
        }),
      ])
      if (!infoRes.success || !recordsRes.success) {
        setError(t('promote.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setInfo(infoRes.data ?? null)
      setRecords(recordsRes.data?.list ?? [])
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    if (!info) return
    Alert.alert(t('promote.copyLink'), info.referralLink)
    setCopied(true)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false)
      copiedTimerRef.current = null
    }, 1500)
  }

  const handleShare = () => {
    Alert.alert(t('promote.shareBtn'), info?.referralLink ?? '')
  }

  return (
    <SharedPromoteScreen
      t={t}
      info={info}
      records={records}
      loading={loading}
      refreshing={refreshing}
      error={error}
      copied={copied}
      onRefresh={() => void load(true)}
      onCopy={handleCopy}
      onShare={handleShare}
      onBack={() => navigation.goBack()}
    />
  )
}
