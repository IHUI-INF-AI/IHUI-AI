// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { rpx } from '@/utils/rpx'
import { FocusInput } from '@/components/FocusField'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { sendSmsCode, loginBySms, register, bindPhone, type UserInfo } from '@/api'
import { useCountdown } from '@ihui/shared/hooks'
import {
  VERIFY_CODE_BOX_FONT_PX,
  VERIFY_CODE_BOX_GAP_PX,
  VERIFY_CODE_BOX_HEIGHT_PX,
  VERIFY_CODE_BOX_WIDTH_PX,
  VERIFY_CODE_BUTTON_FONT_PX,
  VERIFY_CODE_BUTTON_HEIGHT_PX,
  VERIFY_CODE_CARD_MARGIN_X_PX,
  VERIFY_CODE_CARD_MAX_WIDTH_PX,
  VERIFY_CODE_CARD_PADDING_PX,
  VERIFY_CODE_COUNTDOWN_FONT_PX,
  VERIFY_CODE_COUNTDOWN_SECONDS,
  VERIFY_CODE_DESC_FONT_PX,
  VERIFY_CODE_LENGTH,
  VERIFY_CODE_TITLE_FONT_PX,
} from '@ihui/shared/ui/verify-code-modal-spec'

export type VerifyCodeType = 'register' | 'login' | 'changePhone'

export interface VerifyCodeModalProps {
  visible?: boolean
  phone?: string
  type?: VerifyCodeType
  onClose?: () => void
  onSuccess?: (data: { accessToken?: string; refreshToken?: string; user?: UserInfo }) => void
}

// 几何/字号单一源 = @ihui/shared/ui/verify-code-modal-spec(与 RN 端共用;spec 存逻辑 px,本端 rpx 换算)
// 结构承载差异(关闭入口/双按钮/6 枚 FocusInput/号码并入描述句)按规则6 保留,见 spec 头注。

export default function VerifyCodeModal({
  visible = false,
  phone = '',
  type = 'login',
  onClose,
  onSuccess,
}: VerifyCodeModalProps) {
  const [codes, setCodes] = useState<string[]>(Array(VERIFY_CODE_LENGTH).fill(''))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  // 2026-07-28 Q-1: 复用 @ihui/shared/hooks useCountdown,消除本地 setInterval/useRef/useState 重复实现。
  // 初始 count=0(显示"重新发送"),发送验证码时 reset(60) + start() 启动倒计时。
  const { count: countdown, start, reset: resetCountdown } = useCountdown(0)
  const tt = useTt()

  const reset = useCallback(() => {
    setCodes(Array(VERIFY_CODE_LENGTH).fill(''))
    setCurrentIndex(0)
    resetCountdown(0)
    setSubmitting(false)
  }, [resetCountdown])

  useEffect(() => {
    if (!visible) reset()
    // useCountdown 内部 useEffect 会在组件卸载时自动清理 timer,无需手动 cleanup
  }, [visible, reset])

  const startCountdown = useCallback(() => {
    resetCountdown(VERIFY_CODE_COUNTDOWN_SECONDS)
    start()
  }, [resetCountdown, start])

  const onSendCode = useCallback(async () => {
    if (countdown > 0) return
    if (!phone) {
      Taro.showToast({ title: tt('verify.phoneEmpty', '手机号为空'), icon: 'none' })
      return
    }
    if (phone.length !== 11) {
      Taro.showToast({ title: tt('verify.phoneInvalid', '请输入正确手机号'), icon: 'none' })
      return
    }
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: tt('verify.codeSent', '验证码已发送'), icon: 'success' })
      startCountdown()
    } catch {
      // ignore
    }
  }, [phone, countdown, startCountdown, tt])

  const handleInput = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1)
      const next = [...codes]
      next[index] = digit
      setCodes(next)
      if (digit && index < VERIFY_CODE_LENGTH - 1) {
        setCurrentIndex(index + 1)
      }
    },
    [codes],
  )

  const fullCode = codes.join('')

  const verifyCode = useCallback(async () => {
    if (fullCode.length !== VERIFY_CODE_LENGTH) {
      Taro.showToast({ title: tt('verify.codeIncomplete', '请输入完整验证码'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      let result: { accessToken?: string; refreshToken?: string; user?: UserInfo } = {}
      if (type === 'register') {
        await register({ phone, code: fullCode })
      } else if (type === 'changePhone') {
        await bindPhone(phone, fullCode)
      } else {
        result = await loginBySms(phone, fullCode)
      }
      Taro.showToast({ title: tt('verify.verifySuccess', '验证成功'), icon: 'success' })
      onSuccess?.(result)
      onClose?.()
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [fullCode, type, phone, onSuccess, onClose, tt])

  if (!visible) return null

  // 单条带 ICU 参数的完整消息,禁止 "…后重" + tt('p1','发') 这种把词劈成两半的拼接
  // (en/ko/ja 语法上不可能成立)。复用 shared/auth.resendCode 既有五语译法。
  const sendText =
    countdown > 0
      ? tt('auth.resendCode', '{seconds}s 后重发', { seconds: countdown })
      : tt('VerifyCodeModal.p2', '重新发送')

  return (
    <View className="fixed inset-0 z-[2000] flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-[var(--color-black-40)]" />
      <View
        className="relative bg-card ui-panel rounded-xl w-full"
        style={{
          marginLeft: rpx(VERIFY_CODE_CARD_MARGIN_X_PX),
          marginRight: rpx(VERIFY_CODE_CARD_MARGIN_X_PX),
          padding: rpx(VERIFY_CODE_CARD_PADDING_PX),
          maxWidth: rpx(VERIFY_CODE_CARD_MAX_WIDTH_PX),
        }}
        onClick={(e) => e.stopPropagation()}
        hoverClass="opacity-60"
      >
        <View className="flex items-center justify-between mb-3">
          <Text
            className="font-medium text-foreground"
            style={{ fontSize: rpx(VERIFY_CODE_TITLE_FONT_PX) }}
          >
            {tt('verify.getCode', '获取验证码')}
          </Text>
          <Text className="text-sm text-muted-foreground" onClick={onClose}>
            {tt('common.close', '关闭')}
          </Text>
        </View>
        <Text
          className="block text-muted-foreground mb-3 leading-relaxed"
          style={{ fontSize: rpx(VERIFY_CODE_DESC_FONT_PX) }}
        >
          {tt('tail.12', '验证码已发送至 {m}', { m: phone })}
        </Text>
        <View className="flex justify-center mb-3" style={{ gap: rpx(VERIFY_CODE_BOX_GAP_PX) }}>
          {codes.map((c, idx) => (
            <FocusInput
              key={idx}
              className="text-center text-base border border-border rounded-sm"
              style={{
                width: rpx(VERIFY_CODE_BOX_WIDTH_PX),
                height: rpx(VERIFY_CODE_BOX_HEIGHT_PX),
                fontSize: rpx(VERIFY_CODE_BOX_FONT_PX),
              }}
              type="number"
              maxlength={1}
              focus={visible && idx === currentIndex}
              value={c}
              onInput={(e) => handleInput(idx, e.detail.value)}
            />
          ))}
        </View>
        <View
          className={`text-center mb-4 ${countdown > 0 ? 'text-muted-foreground' : 'text-primary'}`}
          style={{ fontSize: rpx(VERIFY_CODE_COUNTDOWN_FONT_PX) }}
          onClick={onSendCode}
          hoverClass="opacity-60"
        >
          <Text>{sendText}</Text>
        </View>
        <View className="flex space-x-3">
          <View
            className="flex-1 rounded-sm bg-muted text-center"
            style={{
              height: rpx(VERIFY_CODE_BUTTON_HEIGHT_PX),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onClose}
            hoverClass="opacity-60"
          >
            <Text className="text-foreground" style={{ fontSize: rpx(VERIFY_CODE_BUTTON_FONT_PX) }}>
              {tt('common.cancel', '取消')}
            </Text>
          </View>
          <View
            className={`flex-1 rounded-sm text-center ${submitting ? 'bg-muted' : 'bg-primary'}`}
            style={{
              height: rpx(VERIFY_CODE_BUTTON_HEIGHT_PX),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={submitting ? undefined : verifyCode}
            hoverClass="opacity-60"
          >
            <Text className="text-primary-foreground" style={{ fontSize: rpx(VERIFY_CODE_BUTTON_FONT_PX) }}>
              {submitting
                ? tt('VerifyCodeModal.p3', '验证中...')
                : tt('TitleSwitchTypeBar.confirm', '确定')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
