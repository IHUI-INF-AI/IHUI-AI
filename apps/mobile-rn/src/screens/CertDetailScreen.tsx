import { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Card, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Cert {
  id: string
  certNo: string
  title: string
  issuer: string
  holder: string
  issuedAt: string
  expiredAt?: string
  score: number
  verifyUrl: string
}

type Route = RouteProp<RootStackParamList, 'CertDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CertDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [cert, setCert] = useState<Cert | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Cert>(`/api/certificates/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setCert(res.data)
      else setError(res.error || t('certDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Loading />
        <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  if (error || !cert)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Text className="mb-2 text-center text-[13px] text-destructive">{error || t('certDetail.loadFailed')}</Text>
        <TouchableOpacity
          className="mt-3 rounded-md bg-primary px-4 py-2"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <ScrollView className="flex-1 bg-card px-4 pb-8 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mb-3 mt-2 text-[22px] font-semibold text-foreground">{t('certDetail.title')}</Text>
      <Card className="border-2 border-primary bg-primary/10 p-4">
        <Text className="text-lg font-semibold text-foreground">{cert.title}</Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          {t('certDetail.certNo')}:{cert.certNo}
        </Text>
        <View className="my-3 h-px bg-primary" />
        <Text className="mt-1.5 text-[11px] text-muted-foreground">{t('certDetail.holder')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">{cert.holder}</Text>
        <Text className="mt-1.5 text-[11px] text-muted-foreground">{t('certDetail.issuer')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">{cert.issuer}</Text>
        <Text className="mt-1.5 text-[11px] text-muted-foreground">{t('certDetail.score')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">{cert.score}</Text>
        <Text className="mt-1.5 text-[11px] text-muted-foreground">{t('certDetail.issuedAt')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">{cert.issuedAt}</Text>
        {cert.expiredAt ? (
          <>
            <Text className="mt-1.5 text-[11px] text-muted-foreground">{t('certDetail.expiredAt')}</Text>
            <Text className="mt-0.5 text-sm text-foreground">{cert.expiredAt}</Text>
          </>
        ) : null}
      </Card>
      <TouchableOpacity
        className="mt-4 items-center rounded-md border border-primary py-3"
        onPress={() => navigation.navigate('CertVerify', { certNo: cert.certNo })}
      >
        <Text className="text-sm font-semibold text-primary">{t('certDetail.verify')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
