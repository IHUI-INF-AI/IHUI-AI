// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 修改/绑定手机号 — 小程序薄壳
 *
 * UI 单源:packages/app/src/features/change-phone/ChangePhoneScreen.tsx
 *   RN 消费点:apps/mobile-rn/src/screens/ChangePhoneScreen.tsx:153
 * 平台能力(GET /user/profile、短信发送、pwdExist 查重、bindPhone)留在本端;
 * 共享屏内零 Taro、零平台 API。旧验证码步骤与 web ChangePhoneModal 一致。
 * i18n:共享屏按键经 PHONE_TEXT 映射到既有 user.phone.* / user.security.* 词条,
 *   不允许渲染裸 key(scripts/tests/miniapp-shell-form.test.mjs T12 断言)。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { getProfile, sendSmsCode, bindPhone, pwdExist } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useI18n } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'
import { logger } from '@/utils/logger'
import { ChangePhoneScreen } from '@ihui/rn-app/features/change-phone/ChangePhoneScreen'

/** 共享屏词条 → 本端既有词条(全部解析为人话;缺任一条 T12 必红) */
const PHONE_TEXT: Record<string, string> = {
  'user.profile.changePhoneTitle': 'user.phone.bindTitle',
  'changePhone.selectNation': 'user.phone.selectNation',
  'user.profile.newPhonePlaceholder': 'user.phone.newPhonePlaceholder',
  'user.profile.codePlaceholder': 'user.phone.codeLength',
  'user.profile.sendNewCode': 'user.security.sendCode',
  'user.profile.resend': 'user.phone.resend',
  'user.profile.confirmChange': 'user.phone.bind',
  'changePhone.submitting': 'user.phone.binding',
  'user.profile.oldPhone': 'user.phone.currentLabel',
  'user.profile.oldCode': 'user.security.code',
  'user.profile.sendOldCode': 'user.security.sendCode',
}

export default function Phone() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()
  const [currentPhone, setCurrentPhone] = useState('')
  const [oldCode, setOldCode] = useState('')
  const [oldCodeMin, setOldCodeMin] = useState(0)
  const [newPhone, setNewPhone] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newCodeMin, setNewCodeMin] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const oldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const newTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const maskedPhone = (() => {
    const p = (currentPhone || '').trim()
    if (!p || p.length < 11) return tt('user.phone.unbound', '未绑定')
    return p.slice(0, 3) + '****' + p.slice(-4)
  })()

  useEffect(
    () => () => {
      if (oldTimerRef.current) clearInterval(oldTimerRef.current)
      if (newTimerRef.current) clearInterval(newTimerRef.current)
    },
    [],
  )

  useDidShow(() => {
    // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
    gate.waitUntilReady(() => {
      void (async () => {
        try {
          const profile = await getProfile()
          setCurrentPhone(profile.phone || '')
        } catch (e) {
          logger.error('user/phone', t('userPhone.q1'), e)
        }
      })()
    })
  })

  function startOldCountdown() {
    setOldCodeMin(60)
    oldTimerRef.current = setInterval(() => {
      setOldCodeMin((prev) => {
        if (prev <= 1) {
          if (oldTimerRef.current) clearInterval(oldTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function startNewCountdown() {
    setNewCodeMin(60)
    newTimerRef.current = setInterval(() => {
      setNewCodeMin((prev) => {
        if (prev <= 1) {
          if (newTimerRef.current) clearInterval(newTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const onSendOldCode = useCallback(async () => {
    if (oldCodeMin > 0) return
    const p = (currentPhone || '').trim()
    if (!p || p.length !== 11) {
      onToast(tt('user.phone.noCurrent', '当前未绑定手机号'), { kind: 'error' })
      return
    }
    try {
      await sendSmsCode(p)
      onToast(tt('user.phone.codeSent', '验证码已发送'), { kind: 'success' })
      startOldCountdown()
    } catch (e) {
      logger.error('user/phone', t('userPhone.q2'), e)
      onToast(tt('user.phone.codeSendFailed', '验证码发送失败'), { kind: 'error' })
    }
  }, [currentPhone, oldCodeMin, tt, t])

  const onSendCode = useCallback(async () => {
    if (newCodeMin > 0) return
    const phone = (newPhone || '').trim()
    if (!/^1\d{10}$/.test(phone)) {
      onToast(tt('user.phone.phoneInvalid', '手机号格式不正确'), { kind: 'error' })
      return
    }
    if (phone === currentPhone) {
      onToast(tt('user.phone.sameAsCurrent', '新手机号不能与当前手机号相同'), { kind: 'error' })
      return
    }
    try {
      const exist = await pwdExist(phone)
      if (exist) {
        onToast(tt('user.phone.alreadyRegistered', '该手机号已注册,请换用其他手机号'), {
          kind: 'error',
        })
        return
      }
    } catch (e) {
      logger.error('user/phone', t('userPhone.q3'), e)
      // 查询失败不阻塞,继续发送
    }
    try {
      await sendSmsCode(phone)
      onToast(tt('user.phone.codeSent', '验证码已发送'), { kind: 'success' })
      startNewCountdown()
    } catch (e) {
      logger.error('user/phone', t('userPhone.q4'), e)
      onToast(tt('user.phone.codeSendFailed', '验证码发送失败'), { kind: 'error' })
    }
  }, [currentPhone, newCodeMin, newPhone, tt, t])

  const onSubmit = useCallback(async () => {
    if (submitting) return
    const phone = (newPhone || '').trim()
    const code = (newCode || '').trim()
    if (!/^1\d{10}$/.test(phone)) {
      onToast(tt('user.phone.phoneInvalid', '手机号格式不正确'), { kind: 'error' })
      return
    }
    if (currentPhone && oldCode.trim().length !== 6) {
      onToast(tt('user.phone.codeLength', '请输入 6 位验证码'), { kind: 'info' })
      return
    }
    if (code.length !== 6) {
      onToast(tt('user.phone.codeLength', '请输入 6 位验证码'), { kind: 'info' })
      return
    }
    setSubmitting(true)
    try {
      await bindPhone(phone, code)
      onToast(tt('user.phone.bindSuccess', '手机号绑定成功'), { kind: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('user/phone', t('user.phone.bindTitle'), e)
      onToast(tt('common.failed', '操作失败'), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [currentPhone, newCode, newPhone, oldCode, submitting, t, tt])

  const sharedT = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const mapped = PHONE_TEXT[key]
      const next = params && 'seconds' in params ? { ...params, s: params.seconds } : params
      return t(mapped ?? key, next)
    },
    [t],
  )

  return (
    <ThemeRoot>
      <ChangePhoneScreen
        t={sharedT}
        phoneNumber={newPhone}
        codeValue={newCode}
        phoneHead="+86"
        nationShow={false}
        codeMin={newCodeMin}
        sendCodeShow={false}
        tip=""
        submitting={submitting}
        nations={[]}
        onPhoneChange={setNewPhone}
        onCodeChange={setNewCode}
        onToggleNationShow={() => {}}
        onSelectNation={() => {}}
        onSendCode={onSendCode}
        onSubmit={onSubmit}
        onBack={() => Taro.navigateBack()}
        oldPhone={currentPhone ? maskedPhone : undefined}
        oldCode={oldCode}
        oldCodeMin={oldCodeMin}
        onOldCodeChange={setOldCode}
        onSendOldCode={onSendOldCode}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
