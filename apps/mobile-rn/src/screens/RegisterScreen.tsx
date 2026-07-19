import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card, Input } from '@ihui/ui-native'
import { register, sendSmsCode } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PHONE_RE = /^1[3-9]\d{9}$/

export function RegisterScreen() {
  const { t } = useI18n()
  const { login } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!PHONE_RE.test(phone)) {
      setError(t('register.phoneInvalid'))
      return
    }
    setSending(true)
    setError('')
    const res = await sendSmsCode(phone, 'register')
    setSending(false)
    if (res.success) {
      startCountdown()
    } else {
      setError(res.error || t('register.codeSendFailed'))
    }
  }

  const handleRegister = async () => {
    if (!PHONE_RE.test(phone)) {
      setError(t('register.phoneInvalid'))
      return
    }
    if (!password || password.length < 6) {
      setError(t('register.passwordTooShort'))
      return
    }
    if (!code) {
      setError(t('register.codeRequired'))
      return
    }
    setLoading(true)
    setError('')
    const res = await register(phone, password, code, invitationCode || undefined)
    if (!res.success) {
      setError(res.error || t('register.failed'))
      setLoading(false)
      return
    }
    // 注册成功后自动登录(复用现有 login 流程写入 AuthContext)
    const loginRes = await login(phone, password)
    setLoading(false)
    if (!loginRes.success) {
      setError(loginRes.error || t('register.autoLoginFailed'))
      navigation.navigate('Login')
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pt-12 pb-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-base text-neutral-700 dark:text-neutral-300">
            {t('common.back')}
          </Text>
        </TouchableOpacity>
        <Text className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t('register.title')}
        </Text>
        <Text className="mt-1 text-sm text-neutral-500">{t('register.subtitle')}</Text>
      </View>

      <View className="px-4 mt-4">
        <Card className="p-4">
          <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('register.phone')}
          </Text>
          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder={t('register.phonePlaceholder')}
            keyboardType="phone-pad"
            autoCapitalize="none"
            className="mt-2"
          />

          <Text className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('register.code')}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="flex-1">
              <Input
                value={code}
                onChangeText={setCode}
                placeholder={t('register.codePlaceholder')}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <Button
              variant="outline"
              disabled={sending || countdown > 0}
              onPress={handleSendCode}
            >
              {countdown > 0
                ? t('register.resendIn', { seconds: countdown })
                : sending
                  ? t('register.sending')
                  : t('register.sendCode')}
            </Button>
          </View>

          <Text className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('register.password')}
          </Text>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder={t('register.passwordPlaceholder')}
            secureTextEntry
            className="mt-2"
          />

          <Text className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('register.invitationCode')}
          </Text>
          <Input
            value={invitationCode}
            onChangeText={setInvitationCode}
            placeholder={t('register.invitationPlaceholder')}
            autoCapitalize="none"
            className="mt-2"
          />

          {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}

          <View className="mt-4">
            <Button loading={loading} disabled={loading || sending} onPress={handleRegister}>
              {loading ? t('register.registering') : t('register.submit')}
            </Button>
          </View>

          <View className="mt-3 flex-row items-center justify-center gap-1">
            <Text className="text-xs text-neutral-500">{t('register.hasAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text className="text-xs text-emerald-600">{t('register.toLogin')}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </View>
  )
}
