import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { register } from '@ihui/api-client'
import { RegisterScreen as SharedRegisterScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function RegisterScreen() {
  const { t } = useI18n()
  const { login } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async () => {
    if (!account.trim()) {
      setError(t('register.phoneInvalid'))
      return
    }
    if (!password || password.length < 6) {
      setError(t('register.passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('register.passwordTooShort'))
      return
    }
    setLoading(true)
    setError('')
    const res = await register(account.trim(), password)
    if (!res.success) {
      setError(res.error || t('register.failed'))
      setLoading(false)
      return
    }
    const loginRes = await login(account.trim(), password)
    setLoading(false)
    if (!loginRes.success) {
      setError(loginRes.error || t('register.autoLoginFailed'))
      navigation.navigate('Login')
    }
  }

  return (
    <SharedRegisterScreen
      t={t}
      account={account}
      password={password}
      confirmPassword={confirmPassword}
      loading={loading}
      error={error}
      onAccountChange={setAccount}
      onPasswordChange={setPassword}
      onConfirmPasswordChange={setConfirmPassword}
      onRegister={handleRegister}
      onBack={() => navigation.goBack()}
    />
  )
}
