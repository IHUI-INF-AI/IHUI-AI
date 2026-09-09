// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const CONSEQUENCE_KEYS = [
  'accountCancel.consequence1',
  'accountCancel.consequence2',
  'accountCancel.consequence3',
  'accountCancel.consequence4',
  'accountCancel.consequence5',
  'accountCancel.consequence6',
  'accountCancel.consequence7',
]

// 样式对齐 RN 共享 AccountCancelScreen(packages/app/src/features/account-cancel):
// 尺寸换算 raw dp ×2 = rpx;颜色 tk.* → tokens.css 语义变量
const INPUT_STYLE: CSSProperties = {
  height: '100rpx', // RN input height 50 → 100rpx
  background: 'var(--color-muted)', // tk.surface.muted
  borderRadius: '24rpx', // RN radius 12 → 24rpx
  padding: '0 24rpx', // RN paddingHorizontal 12 → 24rpx
  fontSize: '32rpx', // RN 16 → 32rpx
  color: 'var(--color-foreground)', // tk.text.primary
  border: '2rpx solid var(--color-border)', // RN borderWidth 1 + tk.border.light
  width: '100%',
  boxSizing: 'border-box',
}

const CODE_INPUT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  flex: 1,
  minWidth: 0,
}

const SECTION_TITLE_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '32rpx', // RN label 16 → 32rpx
  fontWeight: 600,
  color: 'var(--color-foreground)', // tk.text.primary
  margin: '24rpx 0 16rpx', // fieldGroup gap 8 → 16rpx
}

const CONSEQUENCE_ITEM_STYLE: CSSProperties = {
  display: 'block',
  fontSize: '28rpx', // RN desc 14 → 28rpx
  color: 'var(--color-muted-foreground)', // tk.text.secondary
  lineHeight: '36rpx', // RN lineHeight 18 → 36rpx
}

// RN desc 卡片:tk.surface.light 底 + radius 12 → 24rpx + padding 12 → 24rpx
const DESC_CARD_STYLE: CSSProperties = {
  background: 'var(--color-surface-light)',
  borderRadius: '24rpx',
  padding: '24rpx',
  marginBottom: '16rpx',
}

// 手机号只读展示盒:复用 RN input 视觉(muted 底 + 描边 + radius 24rpx)
const PHONE_BOX_STYLE: CSSProperties = {
  ...DESC_CARD_STYLE,
  marginBottom: 0,
  height: '100rpx',
  padding: '0 24rpx',
  display: 'flex',
  alignItems: 'center',
  background: 'var(--color-muted)',
  border: '2rpx solid var(--color-border)',
  boxSizing: 'border-box',
}

const CODE_BLOCK_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 0,
}

// RN smsBtn:height 44 → 88rpx,brand 底(radius 12 → 24rpx);
// 文字 RN 用 tk.surface.light(暗色下白底白字不可读)→ 语义修正为 --color-primary-foreground
const SEND_CODE_BASE_STYLE: CSSProperties = {
  height: '88rpx',
  lineHeight: '88rpx',
  padding: '0 24rpx',
  marginLeft: '16rpx',
  borderRadius: '24rpx',
  background: 'var(--color-primary)',
  fontSize: '28rpx', // RN 14 → 28rpx
  fontWeight: 600,
  color: 'var(--color-primary-foreground)',
  textAlign: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
}

const SEND_CODE_DISABLED_STYLE: CSSProperties = {
  ...SEND_CODE_BASE_STYLE,
  background: 'var(--color-muted)',
  color: 'var(--color-text-tertiary)', // tk.text.tertiary
}

const PHONE_TEXT_STYLE: CSSProperties = {
  fontSize: '32rpx', // RN input 16 → 32rpx
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
  const codeSendingRef = useRef(false)

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
    // 2026-08-21 修复(双击重发竞态):codeBtnDisabled 依赖的 countdown 在
    // await sendSmsCode 网络往返期间仍为 0,快速双击会两次通过守卫 →
    // 发两条短信 + 启动两个 interval(第一个引用被覆盖泄漏,倒计时 2 倍速)。
    // 用同步 ref 守卫覆盖整个 await 窗口。
    if (codeSendingRef.current) return
    codeSendingRef.current = true
    try {
      if (!phone) {
        Taro.showToast({ title: t('accountCancel.noPhone'), icon: 'none' })
        return
      }
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
    } finally {
      codeSendingRef.current = false
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
      await api.post('/auth/cancel-account', { phone, code, confirmText })
      Taro.showToast({ title: t('accountCancel.cancelled'), icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/login/login' }), 800)
    } catch (e) {
      // 真实失败:如实提示,不假装注销成功
      logger.error('unknown', '注销', e)
      Taro.showToast({ title: t('accountCancel.failed') || '注销失败,请重试', icon: 'none' })
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
    // 对齐 RN 共享 AccountCancelScreen:header(返回+标题)由原生导航栏承载;
    // 内容区 padding 14 → 28rpx、底部 32 → 64rpx
    <ThemeRoot>
      <View className="min-h-screen bg-background">
        <View className="px-[20rpx] pt-[24rpx] pb-[24rpx]">
          <Text className="text-[40rpx] font-bold text-foreground">{t('accountCancel.title')}</Text>
        </View>
        <View className="p-[28rpx] pb-[64rpx]">
          {loading ? (
            <Text className="text-center text-muted-foreground py-[96rpx] text-[28rpx]">
              {t('common.loading')}
            </Text>
          ) : info ? (
            <View>
              <Text style={SECTION_TITLE_STYLE}>{t('accountCancel.consequenceTitle')}</Text>
              <View style={DESC_CARD_STYLE}>
                {CONSEQUENCE_KEYS.map((k) => (
                  <Text key={k} style={CONSEQUENCE_ITEM_STYLE}>
                    · {t(k)}
                  </Text>
                ))}
              </View>

              <Text style={SECTION_TITLE_STYLE}>{t('accountCancel.phoneLabel')}</Text>
              <View style={PHONE_BOX_STYLE}>
                <Text style={PHONE_TEXT_STYLE}>
                  {phone ? maskedPhone : t('accountCancel.noPhone')}
                </Text>
              </View>

              <Text style={SECTION_TITLE_STYLE}>{t('accountCancel.codeLabel')}</Text>
              <View style={CODE_BLOCK_STYLE}>
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
              <Input
                style={INPUT_STYLE}
                placeholder={t('accountCancel.confirmPlaceholder')}
                value={confirmText}
                onInput={(e) => setConfirmText(e.detail.value)}
              />

              {/* 对齐 RN submitBtn:danger 底 + 白字,height 50 → 100rpx,radius 12 → 24rpx */}
              <View
                className={`mt-[24rpx] flex h-[100rpx] items-center justify-center rounded-[24rpx] bg-[var(--color-danger)]${canSubmit || confirmCountdown > 0 ? '' : ' opacity-60'}`}
                hoverClass="opacity-60"
                onClick={onSubmit}
              >
                <Text className="text-[36rpx] font-semibold text-[var(--color-danger-foreground)]">
                  {submitText}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="text-center text-muted-foreground py-[96rpx] text-[28rpx]">
              {t('accountCancel.noInfo')}
            </Text>
          )}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
