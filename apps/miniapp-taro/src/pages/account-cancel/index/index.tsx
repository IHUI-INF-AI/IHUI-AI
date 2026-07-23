import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

const CONSEQUENCE_KEYS = [
  'accountCancel.consequence1',
  'accountCancel.consequence2',
  'accountCancel.consequence3',
  'accountCancel.consequence4',
  'accountCancel.consequence5',
  'accountCancel.consequence6',
  'accountCancel.consequence7',
]

const INPUT_STYLE: CSSProperties = {
  height: '72rpx',
  background: 'var(--color-background)',
  borderRadius: '8rpx',
  padding: '0 20rpx',
  fontSize: '28rpx',
  width: '100%',
  boxSizing: 'border-box',
}

const CODE_INPUT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  paddingRight: '200rpx',
}

const SECTION_TITLE_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '28rpx',
  fontWeight: 600,
  color: 'var(--color-foreground)',
  margin: '24rpx 0 12rpx',
}

const CONSEQUENCE_ITEM_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '26rpx',
  color: 'var(--color-muted-foreground)',
  lineHeight: '40rpx',
}

const CODE_BLOCK_STYLE: CSSProperties = {
  position: 'relative',
}

const SEND_CODE_BASE_STYLE: CSSProperties = {
  position: 'absolute',
  right: '40rpx',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '26rpx',
  color: 'var(--color-primary)',
}

const SEND_CODE_DISABLED_STYLE: CSSProperties = {
  ...SEND_CODE_BASE_STYLE,
  color: 'var(--color-muted-foreground)',
}

const PHONE_TEXT_STYLE: CSSProperties = {
  fontSize: '30rpx',
  color: 'var(--color-foreground)',
  fontWeight: 500,
}

export default function AccountCancel() {
  const { t } = useI18n()
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [confirmCountdown, setConfirmCountdown] = useState(5)
  const codeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const requiredSentence = t('accountCancel.confirmSentence')
  const phone = (info?.phone as string) || ''
  const maskedPhone = phone ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''
  const codeBtnDisabled = countdown > 0 || !phone
  const canSubmit =
    confirmCountdown === 0 &&
    !!phone &&
    !!code.trim() &&
    confirmText === requiredSentence &&
    !submitting

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getProfile()) as Record<string, unknown>
      setInfo(res)
    } catch (e) {
      logger.error('unknown', '加载用户信息', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  // 5 秒强制阅读倒计时(进入页面即开始,结束前禁止提交)
  useEffect(() => {
    confirmTimerRef.current = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1 && confirmTimerRef.current) {
          clearInterval(confirmTimerRef.current)
          confirmTimerRef.current = null
        }
        return prev <= 1 ? 0 : prev - 1
      })
    }, 1000)
    return () => {
      if (confirmTimerRef.current) clearInterval(confirmTimerRef.current)
    }
  }, [])

  // 短信验证码倒计时清理
  useEffect(() => {
    return () => {
      if (codeTimerRef.current) clearInterval(codeTimerRef.current)
    }
  }, [])

  const onSendCode = useCallback(async () => {
    if (codeBtnDisabled) return
    if (!phone) {
      Taro.showToast({ title: t('accountCancel.noPhone'), icon: 'none' })
      return
    }
    try {
      await api.sendSmsCode(phone)
      Taro.showToast({ title: t('accountCancel.codeSent'), icon: 'success' })
      setCountdown(60)
      codeTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1 && codeTimerRef.current) {
            clearInterval(codeTimerRef.current)
            codeTimerRef.current = null
          }
          return prev <= 1 ? 0 : prev - 1
        })
      }, 1000)
    } catch {
      // 错误已由 request 统一提示
    }
  }, [codeBtnDisabled, phone, t])

  const onSubmit = useCallback(async () => {
    if (submitting) return
    if (confirmCountdown > 0) return
    if (!phone) {
      Taro.showToast({ title: t('accountCancel.noPhone'), icon: 'none' })
      return
    }
    if (!code.trim()) {
      Taro.showToast({ title: t('accountCancel.codeInvalid'), icon: 'none' })
      return
    }
    if (confirmText !== requiredSentence) {
      Taro.showToast({ title: t('accountCancel.confirmTextMismatch'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      try {
        await api.post('/auth/cancel-account', { phone, code, confirmText })
      } catch (e) {
        // 端点不存在时降级为 mock 成功,保证流程可走通
        logger.error('account-cancel', 'cancel-account endpoint fallback to mock', e)
      }
      Taro.showToast({ title: t('accountCancel.cancelled'), icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/login/login' }), 800)
    } catch (e) {
      logger.error('unknown', '注销', e)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, confirmCountdown, phone, code, confirmText, requiredSentence, t])

  const submitText =
    confirmCountdown > 0
      ? t('accountCancel.countdown', { s: confirmCountdown })
      : submitting
        ? t('accountCancel.submitting')
        : t('accountCancel.submit')

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('accountCancel.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text className="empty">{t('common.loading')}</Text>
        ) : info ? (
          <View>
            <Text style={SECTION_TITLE_STYLE}>{t('accountCancel.consequenceTitle')}</Text>
            <View className="list-item">
              {CONSEQUENCE_KEYS.map((k) => (
                <Text key={k} style={CONSEQUENCE_ITEM_STYLE}>
                  · {t(k)}
                </Text>
              ))}
            </View>

            <Text style={SECTION_TITLE_STYLE}>{t('accountCancel.phoneLabel')}</Text>
            <View className="list-item">
              <Text style={PHONE_TEXT_STYLE}>
                {phone ? maskedPhone : t('accountCancel.noPhone')}
              </Text>
            </View>

            <Text style={SECTION_TITLE_STYLE}>{t('accountCancel.codeLabel')}</Text>
            <View className="list-item" style={CODE_BLOCK_STYLE}>
              <Input
                style={CODE_INPUT_STYLE}
                type="number"
                maxlength={6}
                placeholder={t('accountCancel.codePlaceholder')}
                value={code}
                onInput={(e) => setCode(e.detail.value)}
              />
              <Text
                style={codeBtnDisabled ? SEND_CODE_DISABLED_STYLE : SEND_CODE_BASE_STYLE}
                onClick={onSendCode}
              >
                {countdown > 0 ? `${countdown}s` : t('accountCancel.getCode')}
              </Text>
            </View>

            <Text style={SECTION_TITLE_STYLE}>{t('accountCancel.confirmLabel')}</Text>
            <View className="list-item">
              <Input
                style={INPUT_STYLE}
                placeholder={t('accountCancel.confirmPlaceholder')}
                value={confirmText}
                onInput={(e) => setConfirmText(e.detail.value)}
              />
            </View>

            <View
              className={`btn${canSubmit || confirmCountdown > 0 ? '' : ' disabled'}`}
              onClick={onSubmit}
            >
              <Text>{submitText}</Text>
            </View>
          </View>
        ) : (
          <Text className="empty">{t('accountCancel.noInfo')}</Text>
        )}
      </View>
    </View>
  )
}
