import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useRef, useEffect, useCallback } from 'react'
import { register, sendSmsCode } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function RegisterIndex() {
  const { t } = useI18n()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const tt = useCallback((k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }, [t])

  const onSendCode = useCallback(async () => {
    if (countdown > 0) return
    if (!phone.trim()) {
      Taro.showToast({ title: tt('register.enterPhone', '请输入手机号'), icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      Taro.showToast({ title: tt('register.phoneInvalid', '请输入正确的手机号'), icon: 'none' })
      return
    }
    try {
      await sendSmsCode(phone.trim())
      Taro.showToast({ title: tt('register.codeSent', '验证码已发送'), icon: 'success' })
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
    } catch {
      // ignore
    }
  }, [phone, countdown, tt])

  const onSubmit = useCallback(async () => {
    if (!phone.trim() || !code.trim() || !password.trim()) {
      Taro.showToast({ title: tt('register.incomplete', '请填写完整信息'), icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      Taro.showToast({ title: tt('register.phoneInvalid', '请输入正确的手机号'), icon: 'none' })
      return
    }
    if (password.length < 6 || password.length > 20) {
      Taro.showToast({ title: tt('register.pwdLength', '密码长度 6-20 位'), icon: 'none' })
      return
    }
    if (!agree) {
      Taro.showToast({ title: tt('register.agreeFirst', '请先阅读并同意用户协议'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await register({ phone: phone.trim(), code: code.trim(), password })
      Taro.showToast({ title: tt('register.success', '注册成功'), icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/login' }), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [phone, code, password, agree, tt])

  function openAgreement(type: 'user' | 'privacy') {
    const url = type === 'user' ? '/pages/about/protocol' : '/pages/about/privacy'
    Taro.navigateTo({ url, fail: () => Taro.showToast({ title: tt('register.pageMissing', '页面未注册'), icon: 'none' }) })
  }

  function toLogin() {
    Taro.redirectTo({ url: '/pages/login/login' })
  }

  return (
    <View className="register-page">
      <View className="page-header">
        <Text className="page-title">{tt('register.title', '注册账号')}</Text>
      </View>
      <View className="form">
        <View className="form-item">
          <Text className="form-label">{tt('register.phone', '手机号')}</Text>
          <Input
            className="form-input"
            type="number"
            maxlength={11}
            placeholder={tt('register.phonePlaceholder', '请输入手机号')}
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className="form-item code-item">
          <Text className="form-label">{tt('register.code', '验证码')}</Text>
          <Input
            className="form-input code-input"
            type="number"
            maxlength={6}
            placeholder={tt('register.codePlaceholder', '请输入验证码')}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <Text className={`send-code ${countdown > 0 ? 'disabled' : ''}`} onClick={onSendCode}>
            {countdown > 0 ? `${countdown}s` : tt('register.getCode', '获取验证码')}
          </Text>
        </View>
        <View className="form-item">
          <Text className="form-label">{tt('register.password', '密码')}</Text>
          <View className="pwd-wrap">
            <Input
              className="form-input pwd-input"
              password={!showPwd}
              maxlength={20}
              placeholder={tt('register.passwordPlaceholder', '请设置密码')}
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
            />
            <Text className="pwd-toggle" onClick={() => setShowPwd((v) => !v)}>
              {showPwd ? tt('register.hide', '隐藏') : tt('register.show', '显示')}
            </Text>
          </View>
          <Text className="form-hint">{tt('register.pwdHint', '6-20 位,建议字母数字组合')}</Text>
        </View>
        <View className={`submit-btn ${submitting ? 'disabled' : ''}`} onClick={onSubmit}>
          <Text>{submitting ? tt('register.submitting', '注册中…') : tt('register.submit', '注册')}</Text>
        </View>
        <View className="agreement-row">
          <View className="checkbox-wrap" onClick={() => setAgree((v) => !v)}>
            <View className={`checkbox ${agree ? 'checked' : ''}`}>
              {agree ? <Text className="checkbox-icon">✓</Text> : null}
            </View>
          </View>
          <Text className="agreement-text">
            {tt('register.agreePrefix', '我已阅读并同意')}
            <Text className="agreement-link" onClick={() => openAgreement('user')}>
              {tt('register.userAgreement', '《用户协议》')}
            </Text>
            <Text className="agreement-link" onClick={() => openAgreement('privacy')}>
              {tt('register.privacyPolicy', '《隐私协议》')}
            </Text>
          </Text>
        </View>
        <View className="login-entry">
          <Text className="login-hint">{tt('register.hasAccount', '已有账号?')}</Text>
          <Text className="login-link" onClick={toLogin}>
            {tt('register.toLogin', '去登录')}
          </Text>
        </View>
      </View>
    </View>
  )
}
