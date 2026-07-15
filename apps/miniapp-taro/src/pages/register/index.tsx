import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { register, sendSmsCode } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function RegisterIndex() {
  const { t } = useI18n()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const onSendCode = useCallback(async () => {
    if (!phone.trim()) {
      Taro.showToast({ title: t('register.enterPhone'), icon: 'none' })
      return
    }
    if (countdown > 0) return
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: t('register.codeSent'), icon: 'success' })
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch {
      // ignore
    }
  }, [phone, countdown, t])

  const onSubmit = useCallback(async () => {
    if (!phone.trim() || !code.trim() || !password.trim()) {
      Taro.showToast({ title: t('register.incomplete'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await register({ phone, code, password })
      Taro.showToast({ title: t('register.success'), icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/login' }), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [phone, code, password, t])

  return (
    <View className="register-page">
      <View className="page-header">
        <Text className="page-title">{t('register.title')}</Text>
      </View>
      <View className="form">
        <View className="form-item">
          <Text className="form-label">{t('register.phone')}</Text>
          <Input
            className="form-input"
            type="number"
            placeholder={t('register.phonePlaceholder')}
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className="form-item code-item">
          <Input
            className="form-input code-input"
            type="number"
            placeholder={t('register.code')}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <Text className={`send-code ${countdown > 0 ? 'disabled' : ''}`} onClick={onSendCode}>
            {countdown > 0 ? `${countdown}s` : t('register.getCode')}
          </Text>
        </View>
        <View className="form-item">
          <Text className="form-label">{t('register.password')}</Text>
          <Input
            className="form-input"
            password
            placeholder={t('register.passwordPlaceholder')}
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>
        <Button
          className="submit-btn"
          loading={submitting}
          disabled={submitting}
          onClick={onSubmit}
        >
          {t('register.submit')}
        </Button>
      </View>
    </View>
  )
}
