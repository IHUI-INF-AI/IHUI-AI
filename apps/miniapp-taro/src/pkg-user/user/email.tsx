// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
// 描边画在外层容器 `.email-input-box` 上 ⇒ 走 hook 文档的 WRAP 形态②:handlers 留 Input、focusStyle 铺容器。
import { useFieldFocus } from '@/hooks/use-field-focus'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import { getProfile, bindEmail, sendEmailCode } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import './email.css'

export default function Email() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [currentEmail, setCurrentEmail] = useState('')
  const [email, setEmail] = useState('')
  // AI 操控通道(2026-09-21):只登记新邮箱(PII,回传值会被注册表打码);
  // 验证码字段属凭据,不交出写通道。
  useUiField({
    kind: 'input',
    label: t('user.email.emailPlaceholder'),
    placeholder: t('user.email.emailPlaceholder'),
    readValue: () => email,
    setValue: setEmail,
  })
  const [code, setCode] = useState('')
  // 两个输入盒各自的运行时聚焦档(描边在容器上)
  const ffEmail = useFieldFocus()
  const ffCode = useFieldFocus()
  const [counting, setCounting] = useState(false)
  const [count, setCount] = useState(60)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const maskedEmail = (() => {
    const e = (currentEmail || '').trim()
    if (!e) return tt('user.email.unbound', '未绑定')
    const atIdx = e.indexOf('@')
    if (atIdx <= 0) return e
    const head = e.slice(0, Math.min(2, atIdx))
    return head + '***' + e.slice(atIdx)
  })()

  useDidShow(() => {
    // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
    gate.waitUntilReady(() => {
      void (async () => {
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
      })()
    })
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
      Taro.showToast({
        title: tt('user.email.sameAsCurrent', '新邮箱不能与当前邮箱相同'),
        icon: 'none',
      })
      return
    }
    try {
      // 立因:原写法先打 POST /auth/email/send(后端从未注册),再在 catch 里把同一个邮箱地址
      // 当 phone 塞给 POST /auth/sms/send —— 那不是降级,是把错路由洗成"看起来成功"(邮箱永远
      // 进不了短信通道)。真形 = POST /auth/email/code(端内唯一出口 sendEmailCode,scene 取
      // 该出口现值:后端 emailCodeSchema 只有 register|login|reset 三档,无 bind 档)。
      await sendEmailCode(target)
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
    <ThemeRoot>
      <View className="email-page">
        {currentEmail ? (
          <View>
            <Text className="email-title">{tt('user.email.changeTitle', '更换邮箱')}</Text>
            <Text className="email-desc">
              {tt('user.email.currentLabel', '当前邮箱')}: {maskedEmail}
            </Text>
          </View>
        ) : (
          <View>
            <Text className="email-title">{tt('user.email.bindTitle', '绑定邮箱')}</Text>
            <Text className="email-desc">
              {tt('user.email.bindDesc', '绑定后可用于找回密码、接收通知')}
            </Text>
          </View>
        )}
        <View className="email-field">
          <View className="email-input-box" style={ffEmail.focusStyle}>
            <Input
              className="email-input"
              {...ffEmail.spread}
              type="text"
              placeholder={tt('user.email.emailPlaceholder', '请输入邮箱')}
              placeholderClass="email-placeholder"
              value={email}
              onInput={(e) => setEmail(e.detail.value)}
            />
          </View>
        </View>
        <View className="email-field">
          <View className="email-input-box" style={ffCode.focusStyle}>
            <Input
              className="email-input"
              {...ffCode.spread}
              type="number"
              maxlength={6}
              placeholder={tt('user.email.codePlaceholder', '请输入验证码')}
              placeholderClass="email-placeholder"
              value={code}
              onInput={(e) => setCode(e.detail.value)}
            />
            <Text className={`email-code-btn ${counting ? 'disabled' : ''}`} onClick={sendCode}>
              {counting ? `${count}s` : tt('user.email.getCode', '获取验证码')}
            </Text>
          </View>
        </View>
        <View
          className={`email-submit ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim()) && code.trim().length === 6 && !submitting ? '' : 'disabled'}`}
          hoverClass="opacity-60"
          onClick={onSubmit}
        >
          <Text>
            {submitting ? tt('user.email.binding', '绑定中…') : tt('user.email.bind', '绑定')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
