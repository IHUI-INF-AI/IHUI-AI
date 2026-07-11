import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { register, sendSmsCode } from '@/api'
import './index.css'

export default function RegisterIndex() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const onSendCode = useCallback(async () => {
    if (!phone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (countdown > 0) return
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: '验证码已发送', icon: 'success' })
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
  }, [phone, countdown])

  const onSubmit = useCallback(async () => {
    if (!phone.trim() || !code.trim() || !password.trim()) {
      Taro.showToast({ title: '请完善信息', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await register({ phone, code, password })
      Taro.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/login' }), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [phone, code, password])

  return (
    <View className="register-page">
      <View className="page-header">
        <Text className="page-title">注册账号</Text>
      </View>
      <View className="form">
        <View className="form-item">
          <Text className="form-label">手机号</Text>
          <Input
            className="form-input"
            type="number"
            placeholder="请输入手机号"
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className="form-item code-item">
          <Input
            className="form-input code-input"
            type="number"
            placeholder="验证码"
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <Text className={`send-code ${countdown > 0 ? 'disabled' : ''}`} onClick={onSendCode}>
            {countdown > 0 ? `${countdown}s` : '获取验证码'}
          </Text>
        </View>
        <View className="form-item">
          <Text className="form-label">密码</Text>
          <Input
            className="form-input"
            password
            placeholder="请设置密码"
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
          注册
        </Button>
      </View>
    </View>
  )
}
