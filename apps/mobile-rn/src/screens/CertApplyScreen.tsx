// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CertApplyScreen as SharedCertApplyScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CertApplyScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [name, setName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const onSubmit = async () => {
    if (!name.trim() || !idCard.trim()) {
      setError(t('certApply.placeholder'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetchApi('/certificates', {
        method: 'POST',
        body: JSON.stringify({ name, idCard }),
      })
      if (!res.success) throw new Error()
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
    <SharedCertApplyScreen
      t={t}
      name={name}
      idCard={idCard}
      submitting={submitting}
      error={error}
      success={success}
      onNameChange={setName}
      onIdCardChange={setIdCard}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
