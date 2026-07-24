import { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Input, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface VerifyResult {
  valid: boolean
  certNo: string
  title: string
  holder: string
  issuer: string
  issuedAt: string
}

type Route = RouteProp<RootStackParamList, 'CertVerify'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CertVerifyScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const initialNo = route.params?.certNo ?? ''
  const [certNo, setCertNo] = useState(initialNo)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onVerify = async () => {
    if (!certNo.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    const res = await fetchApi<VerifyResult>(
      `/api/certificates/verify?certNo=${encodeURIComponent(certNo.trim())}`,
    )
    setLoading(false)
    if (res.success) setResult(res.data)
    else setError(res.error || t('certVerify.failed'))
  }

  return (
    <ScrollView className="flex-1 bg-card px-4 pb-8 pt-12" keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mb-3 mt-2 text-[22px] font-semibold text-foreground">{t('certVerify.title')}</Text>
      <Text className="mt-3 text-xs text-muted-foreground">{t('certVerify.certNo')}</Text>
      <Input
        className="mt-1"
        value={certNo}
        onChangeText={setCertNo}
        placeholder={t('certVerify.placeholder')}
        returnKeyType="search"
        onSubmitEditing={onVerify}
      />
      <TouchableOpacity
        className={`mt-4 items-center rounded-md py-3 ${!certNo.trim() || loading ? 'bg-muted-foreground' : 'bg-primary'}`}
        onPress={onVerify}
        disabled={!certNo.trim() || loading}
      >
        <Text className="text-sm font-semibold text-primary-foreground">
          {loading ? t('common.loading') : t('certVerify.verify')}
        </Text>
      </TouchableOpacity>
      {loading ? <View className="mt-4 items-center"><Loading /></View> : null}
      {error ? <Text className="mt-3 text-[13px] text-destructive">{error}</Text> : null}
      {result ? (
        <View
          className={`mt-4 rounded-md border p-4 ${result.valid ? 'border-primary bg-primary/10' : 'border-destructive bg-destructive/10'}`}
        >
          <Text className={`text-base font-semibold ${result.valid ? 'text-primary' : 'text-destructive'}`}>
            {result.valid ? t('certVerify.valid') : t('certVerify.invalid')}
          </Text>
          {result.valid ? (
            <>
              <Text className="mt-2 text-[15px] font-semibold text-foreground">{result.title}</Text>
              <Text className="mt-1 text-[13px] text-foreground/80">
                {t('certVerify.holder')}:{result.holder}
              </Text>
              <Text className="mt-1 text-[13px] text-foreground/80">
                {t('certVerify.issuer')}:{result.issuer}
              </Text>
              <Text className="mt-1 text-[13px] text-foreground/80">
                {t('certVerify.issuedAt')}:{result.issuedAt}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  )
}
