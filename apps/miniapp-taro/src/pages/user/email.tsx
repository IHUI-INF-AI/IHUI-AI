import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import { getProfile, bindEmail, post } from '@/api'
import { useI18n } from '@/i18n'
import './email.css'

export default function Email() {
  const { t } = useI18n()
  const [currentEmail, setCurrentEmail] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [counting, setCounting] = useState(false)
  const [count, setCount] = useState(60)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tt = useCallback((k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }, [t])

  const maskedEmail = (() => {
    const e = (currentEmail || '').trim()
    if (!e) return tt('user.email.unbound', '未绑定')
    const atIdx = e.indexOf('@')
    if (atIdx <= 0) return e
    const head = e.slice(0, Math.min(2, atIdx))
    return head + '***' + e.slice(atIdx)
  })()

  useDidShow(async () => {
    try {
      const profile = await getProfile()
      const e = profile.email || ''
      setCurrentEmail(e)
      // 已绑定邮箱时清空输入,等用户主动输入新邮箱
      setEmail(e ? '' : e)
    } catch (e) {
      logger.error('user/email', '获取用户信息', e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    }
  })

  function startCountdown() {
    setCounting(true)
    timerRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          setCounting(false)
          return 60
        }
        return prev - 1
      })
    }, 1000)
  }

  async function sendCode() {
    if (counting) return
    const target = (email || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      Taro.showToast({ title: tt('user.email.emailInvalid', '邮箱格式不正确'), icon: 'none' })
      return
    }
    if (target === currentEmail) {
      Taro.showToast({ title: tt('user.email.sameAsCurrent', '新邮箱不能与当前邮箱相同'), icon: 'none' })
      return
    }
    try {
      // 优先调用专用邮箱验证码接口;后端未提供时降级为通用短信接口
      try {
        await post('/auth/email/send', { email: target })
      } catch (e) {
        // 邮箱验证码端点不存在时,降级用通用 sms/send(scene=email) 占位
        await post('/auth/sms/send', { phone: target, scene: 'email' })
      }
      Taro.showToast({ title: tt('user.email.codeSent', '验证码已发送'), icon: 'success' })
      startCountdown()
    } catch (e) {
      logger.error('user/email', '发送邮箱验证码', e)
      Taro.showToast({ title: tt('user.email.codeSendFailed', '验证码发送失败'), icon: 'none' })
    }
  }

  async function onSubmit() {
    if (submitting) return
    const target = (email || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      Taro.showToast({ title: tt('user.email.emailInvalid', '邮箱格式不正确'), icon: 'none' })
      return
    }
    if (code.trim().length !== 6) {
      Taro.showToast({ title: tt('user.email.codeLength', '请输入 6 位验证码'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await bindEmail(target, code.trim())
      Taro.showToast({ title: tt('user.email.bindSuccess', '邮箱绑定成功'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/email', '绑定邮箱', e)
      Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="email-page">
      {currentEmail ? (
        <View className="email-intro">
          <Text className="email-intro-title">{tt('user.email.changeTitle', '更换邮箱')}</Text>
          <Text className="email-intro-desc">
            {tt('user.email.currentLabel', '当前邮箱')}: {maskedEmail}
          </Text>
        </View>
      ) : (
        <View className="email-intro">
          <Text className="email-intro-title">{tt('user.email.bindTitle', '绑定邮箱')}</Text>
          <Text className="email-intro-desc">
            {tt('user.email.bindDesc', '绑定后可用于找回密码、接收通知')}
          </Text>
        </View>
      )}
      <View className="email-card">
        <View className="email-row email-row-divider">
          <Text className="email-label">{tt('user.email.email', '邮箱')}</Text>
          <Input
            className="email-input"
            type="text"
            placeholder={tt('user.email.emailPlaceholder', '请输入邮箱')}
            value={email}
            onInput={(e) => setEmail(e.detail.value)}
          />
        </View>
        <View className="email-row">
          <Text className="email-label">{tt('user.email.code', '验证码')}</Text>
          <View className="email-input-wrap">
            <Input
              className="email-input email-code-input"
              type="number"
              maxlength={6}
              placeholder={tt('user.email.codePlaceholder', '请输入验证码')}
              value={code}
              onInput={(e) => setCode(e.detail.value)}
            />
            <Text
              className={`email-code-btn ${counting ? 'disabled' : ''}`}
              onClick={sendCode}
            >
              {counting ? `${count}s` : tt('user.email.getCode', '获取验证码')}
            </Text>
          </View>
        </View>
      </View>
      <View
        className={`email-submit ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim()) && code.trim().length === 6 && !submitting ? '' : 'disabled'}`}
        onClick={onSubmit}
      >
        <Text>{submitting ? tt('user.email.binding', '绑定中…') : tt('user.email.bind', '绑定')}</Text>
      </View>
    </View>
  )
}
