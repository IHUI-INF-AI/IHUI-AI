import { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Input, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CertApplyScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [name, setName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    if (!name.trim() || !idCard.trim()) {
      setError(t('certApply.placeholder'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess(false)
    try {
      const r = await fetch(`${API_BASE_URL}/api/certificates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, idCard }),
      })
      if (!r.ok) throw new Error()
      setSuccess(true)
      setName('')
      setIdCard('')
    } catch {
      setError(t('certApply.submitting'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-sm text-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">{t('certApply.title')}</Text>
      </View>
      <View className="p-4">
        <Text className="mt-2 text-xs text-muted-foreground">{t('certApply.name')}</Text>
        <Input
          className="mt-1"
          value={name}
          onChangeText={setName}
          placeholder={t('certApply.placeholder')}
        />
        <Text className="mt-2 text-xs text-muted-foreground">{t('certApply.idCard')}</Text>
        <Input
          className="mt-1"
          value={idCard}
          onChangeText={setIdCard}
          placeholder={t('certApply.placeholder')}
        />
        {error ? <Text className="mt-2 text-xs text-destructive">{error}</Text> : null}
        {success ? <Text className="mt-2 text-xs text-primary">{t('certApply.success')}</Text> : null}
        <TouchableOpacity
          className={`mt-4 items-center rounded-md bg-primary py-3 ${submitting ? 'opacity-60' : ''}`}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? <Loading color="#FFFFFF" size="sm" /> : <Text className="text-sm font-semibold text-primary-foreground">{t('certApply.submit')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}
